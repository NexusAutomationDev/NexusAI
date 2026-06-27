//! KB persistence + retrieval (KB-06: single shared index, no scoping).
//!
//! Plan 03-03: real rusqlite-side persistence over the shared `nexusai.db` file
//! (the same file tauri-plugin-sql opens for the JS/Drizzle layer).
//!
//! - Relational tables (`kb_items`, `kb_chunks`) are normally created by the
//!   Drizzle migration `0002_kb.sql` on the JS side. This module also creates
//!   them with `IF NOT EXISTS` so the Rust connection works even if it opens
//!   before the migration runs (defensive — the schemas match 0002_kb.sql).
//! - Virtual tables (`kb_vectors` vec0, `kb_fts` fts5) live OUTSIDE Drizzle and
//!   are created here via `vector::init_vec_table` + `search::init_fts_table`.
//!
//! Ordering requirement (Pattern 1): `vector::register_sqlite_vec()` is an
//! auto-extension and MUST be called at app startup BEFORE the first connection
//! is opened (done in src-tauri/src/lib.rs setup). Opening a connection here
//! before registration would fail with `no such module: vec0`.
//!
//! Run: `cargo test -p nexusai-kb query`

use std::path::Path;

use anyhow::Context as _;
use fastembed::TextEmbedding;
use rusqlite::Connection;
use tauri::ipc::Channel;
use uuid::Uuid;

use crate::chunk;
use crate::embed;
use crate::progress;
use crate::schema::{Citation, IndexProgress, KbKind};
use crate::search;
use crate::vector;

/// Current Unix-millisecond timestamp (matches the JS/Drizzle integer-ms convention).
fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Open a connection to the shared `nexusai.db` and ensure all KB tables exist.
///
/// `register_sqlite_vec()` must already have been called at startup (Task 3 in
/// src-tauri/src/lib.rs) so the `vec0` module is available on this connection.
/// Each call opens a fresh rusqlite connection (SQLite handles concurrent
/// connections to the same WAL file); commands open one for the duration of the
/// work and drop it when done.
pub fn kb_connection(db_path: &Path) -> anyhow::Result<Connection> {
    let conn = Connection::open(db_path)
        .with_context(|| format!("opening KB db at {}", db_path.display()))?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    ensure_relational_tables(&conn)?;
    vector::init_vec_table(&conn)?;
    search::init_fts_table(&conn)?;
    Ok(conn)
}

/// Create the relational KB tables if absent (mirrors 0002_kb.sql).
///
/// Idempotent — `IF NOT EXISTS` means this is a no-op once Drizzle has run.
fn ensure_relational_tables(conn: &Connection) -> anyhow::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS kb_items (
            id TEXT PRIMARY KEY NOT NULL,
            kind TEXT NOT NULL CHECK(kind IN ('file','note','url')),
            title TEXT NOT NULL,
            source_path TEXT,
            folder_id TEXT,
            status TEXT NOT NULL DEFAULT 'pending'
              CHECK(status IN ('pending','indexing','indexed','failed')),
            error_reason TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            deleted_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS kb_chunks (
            rowid INTEGER PRIMARY KEY,
            id TEXT NOT NULL UNIQUE,
            item_id TEXT NOT NULL,
            ordinal INTEGER NOT NULL,
            content TEXT NOT NULL,
            section TEXT,
            char_start INTEGER,
            char_end INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_kb_chunks_item ON kb_chunks(item_id);
        CREATE INDEX IF NOT EXISTS idx_kb_items_status ON kb_items(status);",
    )?;
    Ok(())
}

/// Upsert a kb_items row, preserving created_at on conflict (D-11 reconcile).
///
/// Commands call this before indexing so the item is visible (status='indexing')
/// even if the app reloads mid-index.
pub fn upsert_item(
    conn: &Connection,
    item_id: &str,
    kind: KbKind,
    title: &str,
    source_path: Option<&str>,
    folder_id: Option<&str>,
) -> anyhow::Result<()> {
    let kind_str = match kind {
        KbKind::File => "file",
        KbKind::Note => "note",
        KbKind::Url => "url",
    };
    let ts = now_ms();
    conn.execute(
        "INSERT INTO kb_items
            (id, kind, title, source_path, folder_id, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'indexing', ?6, ?6)
         ON CONFLICT(id) DO UPDATE SET
            kind = excluded.kind,
            title = excluded.title,
            source_path = excluded.source_path,
            folder_id = excluded.folder_id,
            status = 'indexing',
            error_reason = NULL,
            updated_at = excluded.updated_at,
            deleted_at = NULL",
        rusqlite::params![item_id, kind_str, title, source_path, folder_id, ts],
    )?;
    Ok(())
}

/// Mark an item terminally failed with a reason (D-12), tolerating a missing row.
pub fn set_failed(conn: &Connection, item_id: &str, reason: &str) -> anyhow::Result<()> {
    conn.execute(
        "UPDATE kb_items SET status='failed', error_reason=?2, updated_at=?3 WHERE id=?1",
        rusqlite::params![item_id, reason, now_ms()],
    )?;
    Ok(())
}

/// Index an item's text: chunk → embed → persist chunks + vectors → mark indexed.
///
/// Streams `IndexProgress` over `ch` (Started → Chunk → Indexed/Failed, D-11).
/// All chunk rows + vectors are written inside a single transaction so a failure
/// leaves no half-indexed state; FTS stays in sync via the kb_chunks triggers
/// created by `search::init_fts_table`. On any error the item is marked `failed`
/// (terminal, reconcilable — D-12) and a `Failed` event is emitted.
pub fn index_item(
    conn: &mut Connection,
    item_id: &str,
    text: &str,
    model: &mut TextEmbedding,
    ch: &Channel<IndexProgress>,
) -> anyhow::Result<()> {
    match index_item_inner(conn, item_id, text, model, ch) {
        Ok(()) => Ok(()),
        Err(e) => {
            let reason = e.to_string();
            // Best-effort terminal failure record; surface the original error.
            let _ = set_failed(conn, item_id, &reason);
            progress::emit(
                ch,
                IndexProgress::Failed {
                    item_id: item_id.to_string(),
                    reason,
                },
            );
            Err(e)
        }
    }
}

fn index_item_inner(
    conn: &mut Connection,
    item_id: &str,
    text: &str,
    model: &mut TextEmbedding,
    ch: &Channel<IndexProgress>,
) -> anyhow::Result<()> {
    progress::emit(
        ch,
        IndexProgress::Started {
            item_id: item_id.to_string(),
            total_chunks: None,
        },
    );

    let chunks = chunk::chunk_default(text);
    let total = chunks.len() as u32;

    // Re-emit Started now that the chunk count is known so the UI can show a
    // determinate "Indexando X de Y" bar (D-11).
    progress::emit(
        ch,
        IndexProgress::Started {
            item_id: item_id.to_string(),
            total_chunks: Some(total),
        },
    );

    if chunks.is_empty() {
        // Nothing to embed — mark indexed (empty doc is a valid terminal state).
        conn.execute(
            "UPDATE kb_items SET status='indexed', error_reason=NULL, updated_at=?2 WHERE id=?1",
            rusqlite::params![item_id, now_ms()],
        )?;
        progress::emit(
            ch,
            IndexProgress::Indexed {
                item_id: item_id.to_string(),
            },
        );
        return Ok(());
    }

    let texts: Vec<String> = chunks.iter().map(|c| c.content.clone()).collect();
    let embeddings = embed::embed_passages(model, &texts)
        .context("embedding chunk passages")?;
    anyhow::ensure!(
        embeddings.len() == chunks.len(),
        "embedding count {} != chunk count {}",
        embeddings.len(),
        chunks.len()
    );

    let tx = conn.transaction()?;
    for (i, (c, emb)) in chunks.iter().zip(embeddings.iter()).enumerate() {
        let chunk_id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO kb_chunks
                (id, item_id, ordinal, content, section, char_start, char_end)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                chunk_id,
                item_id,
                c.ordinal as i64,
                c.content,
                c.section,
                c.char_start as i64,
                c.char_end as i64,
            ],
        )?;
        let rowid = tx.last_insert_rowid();
        // FTS sync happens via the AFTER INSERT trigger; vectors are written
        // explicitly keyed by the shared rowid.
        vector::insert_vector(&tx, rowid, emb)?;

        progress::emit(
            ch,
            IndexProgress::Chunk {
                item_id: item_id.to_string(),
                done: (i + 1) as u32,
                total: Some(total),
            },
        );
    }

    tx.execute(
        "UPDATE kb_items SET status='indexed', error_reason=NULL, updated_at=?2 WHERE id=?1",
        rusqlite::params![item_id, now_ms()],
    )?;
    tx.commit()?;

    progress::emit(
        ch,
        IndexProgress::Indexed {
            item_id: item_id.to_string(),
        },
    );
    Ok(())
}

/// Idempotently re-index an item (D-12): delete existing chunks + vectors first,
/// then re-run the full index pipeline. The delete + re-embed run so no stale
/// vector survives a re-index. `index_item` handles its own failure marking.
pub fn reindex_item(
    conn: &mut Connection,
    item_id: &str,
    text: &str,
    model: &mut TextEmbedding,
    ch: &Channel<IndexProgress>,
) -> anyhow::Result<()> {
    if let Err(e) = delete_chunks_for_item(conn, item_id) {
        let reason = e.to_string();
        let _ = set_failed(conn, item_id, &reason);
        progress::emit(
            ch,
            IndexProgress::Failed {
                item_id: item_id.to_string(),
                reason,
            },
        );
        return Err(e);
    }
    index_item(conn, item_id, text, model, ch)
}

/// Delete all chunks + their vectors for an item (idempotent re-index / delete).
///
/// Collects the chunk rowids first, deletes the vec0 rows (vectors have no
/// trigger), then `DELETE FROM kb_chunks WHERE item_id=?` (FTS is cleaned by the
/// AFTER DELETE trigger). Wrapped in a transaction so the two deletes are atomic.
pub fn delete_chunks_for_item(conn: &mut Connection, item_id: &str) -> anyhow::Result<()> {
    let tx = conn.transaction()?;
    let rowids: Vec<i64> = {
        let mut stmt = tx.prepare("SELECT rowid FROM kb_chunks WHERE item_id=?1")?;
        let rows = stmt.query_map([item_id], |r| r.get::<_, i64>(0))?;
        rows.collect::<rusqlite::Result<Vec<i64>>>()?
    };
    vector::delete_vectors_for_rowids(&tx, &rowids)?;
    tx.execute("DELETE FROM kb_chunks WHERE item_id=?1", [item_id])?;
    tx.commit()?;
    Ok(())
}

/// Soft-delete an item (set deleted_at) and purge its chunks + vectors.
///
/// The kb_items row is kept (soft delete) for audit/undo; the heavy chunk +
/// vector data is removed so the index doesn't return stale citations (KB-06).
pub fn delete_item(conn: &mut Connection, item_id: &str) -> anyhow::Result<()> {
    delete_chunks_for_item(conn, item_id)?;
    conn.execute(
        "UPDATE kb_items SET deleted_at=?2, status='pending', updated_at=?2 WHERE id=?1",
        rusqlite::params![item_id, now_ms()],
    )?;
    Ok(())
}

/// Resolve fused chunk rowids to citations (ordered as given by the fusion).
///
/// Applies NO per-item / per-agent / owner filter — the KB is a single shared
/// index callable by any agent (KB-06, D-16). Joins kb_chunks → kb_items to
/// build the citation source-card metadata (D-04). Rowids not found (e.g. a
/// concurrently deleted chunk) are skipped. Output preserves the input order.
pub fn query_chunks(conn: &Connection, rowids: &[i64]) -> anyhow::Result<Vec<Citation>> {
    let mut citations = Vec::with_capacity(rowids.len());
    let mut stmt = conn.prepare(
        "SELECT c.id, c.item_id, i.title, i.kind, c.section, c.content
         FROM kb_chunks c
         JOIN kb_items i ON i.id = c.item_id
         WHERE c.rowid = ?1",
    )?;
    for &rowid in rowids {
        let mut rows = stmt.query([rowid])?;
        if let Some(row) = rows.next()? {
            let kind_str: String = row.get(3)?;
            let kind = match kind_str.as_str() {
                "note" => KbKind::Note,
                "url" => KbKind::Url,
                _ => KbKind::File,
            };
            citations.push(Citation {
                id: row.get(0)?,
                item_id: row.get(1)?,
                item_title: row.get(2)?,
                kind,
                section: row.get(4)?,
                snippet: row.get(5)?,
            });
        }
    }
    Ok(citations)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    /// Build an in-memory DB mirroring the relational part of 0002_kb.sql.
    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(
            "CREATE TABLE kb_items (
                id TEXT PRIMARY KEY NOT NULL,
                kind TEXT NOT NULL CHECK(kind IN ('file','note','url')),
                title TEXT NOT NULL,
                source_path TEXT,
                folder_id TEXT,
                status TEXT NOT NULL DEFAULT 'pending'
                  CHECK(status IN ('pending','indexing','indexed','failed')),
                error_reason TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                deleted_at INTEGER
            );
            CREATE TABLE kb_chunks (
                rowid INTEGER PRIMARY KEY,
                id TEXT NOT NULL UNIQUE,
                item_id TEXT NOT NULL,
                ordinal INTEGER NOT NULL,
                content TEXT NOT NULL,
                section TEXT,
                char_start INTEGER,
                char_end INTEGER
            );",
        )
        .expect("create tables");

        conn.execute_batch(
            "INSERT INTO kb_items (id, kind, title, status, created_at, updated_at)
                VALUES ('a', 'file', 'Item A', 'indexed', 0, 0),
                       ('b', 'note', 'Item B', 'indexed', 0, 0);
             INSERT INTO kb_chunks (rowid, id, item_id, ordinal, content)
                VALUES (1, 'chunk-a', 'a', 0, 'conteúdo do item A'),
                       (2, 'chunk-b', 'b', 0, 'conteúdo do item B');",
        )
        .expect("seed rows");
        conn
    }

    #[test]
    fn test_query_chunks_no_scoping() {
        let conn = setup_db();
        // Two chunks from two DIFFERENT items — query_chunks must return BOTH,
        // proving no per-item/per-agent/owner filter is applied (KB-06).
        let citations = query_chunks(&conn, &[1, 2]).expect("query chunks");
        assert_eq!(citations.len(), 2, "both chunks across both items must return");
        let item_ids: std::collections::HashSet<&str> =
            citations.iter().map(|c| c.item_id.as_str()).collect();
        assert_eq!(
            item_ids,
            ["a", "b"].into_iter().collect(),
            "chunks from both items 'a' and 'b' must be present (no scoping)"
        );
    }

    #[test]
    fn test_query_chunks_preserves_order_and_maps_kind() {
        let conn = setup_db();
        // Reverse order in → reverse order out; kinds map from the joined item.
        let citations = query_chunks(&conn, &[2, 1]).expect("query chunks");
        assert_eq!(citations.len(), 2);
        assert_eq!(citations[0].item_id, "b");
        assert_eq!(citations[0].kind, KbKind::Note);
        assert_eq!(citations[1].item_id, "a");
        assert_eq!(citations[1].kind, KbKind::File);
    }
}

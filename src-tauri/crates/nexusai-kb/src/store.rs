//! KB persistence + retrieval contract (KB-06: single shared index, no scoping).
//! Wave 0: contract + RED test; real impl in Plan 03-03.
//!
//! Run: `cargo test -p nexusai-kb query`

/// A retrieved chunk with the metadata needed for a citation source card (D-04).
#[derive(Debug, Clone, PartialEq)]
pub struct Citation {
    pub chunk_id: String,
    pub item_id: String,
    pub item_title: String,
    pub content: String,
    pub section: Option<String>,
}

/// Resolve chunk rowids to citations. Applies NO per-item / per-agent / owner
/// filter — the KB is a single shared index callable by any agent (KB-06, D-16).
///
/// RED stub — real implementation lands in Plan 03-03.
pub fn query_chunks(
    _conn: &rusqlite::Connection,
    _rowids: &[i64],
) -> anyhow::Result<Vec<Citation>> {
    unimplemented!("query_chunks implemented in Plan 03-03")
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
}

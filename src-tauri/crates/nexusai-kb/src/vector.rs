//! THE single sqlite-vec module (D-16).
//!
//! Nothing outside this file may import `sqlite_vec`. All vec0 calls live here so the
//! alpha library's API churn never leaks past one module.
//!
//! Run: `cargo test -p nexusai-kb vector`

use rusqlite::{ffi::sqlite3_auto_extension, Connection, Result};
use sqlite_vec::sqlite3_vec_init;
use zerocopy::AsBytes;

/// Register the sqlite-vec extension once at startup, before opening connections.
///
/// Call ONCE at startup, BEFORE opening the KB connection (Plan 03-03 calls this
/// from the Tauri setup hook). Registering it as an auto-extension means every
/// `Connection` opened afterwards has the `vec0` virtual table available.
///
// DO NOT bump rusqlite past 0.31 — this transmute breaks at 0.34 (sqlite-vec issue #206):
// the `sqlite3_auto_extension` signature changed and the load must switch to
// `register_auto_extension` with a `RawAutoExtension` cast.
pub fn register_sqlite_vec() {
    unsafe {
        sqlite3_auto_extension(Some(std::mem::transmute(sqlite3_vec_init as *const ())));
    }
}

/// Create the `kb_vectors` vec0 virtual table (embedding float[384]).
///
/// 384 = MultilingualE5Small dimension (Pitfall 3: the dimension is a schema
/// constant — changing the embedding model requires dropping + recreating this
/// table and re-embedding everything). vec0 stores only rowid + vector; all chunk
/// metadata/text lives in the normal `kb_chunks` table keyed by the same rowid.
pub fn init_vec_table(db: &Connection) -> Result<()> {
    db.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS kb_vectors USING vec0(embedding float[384])",
        [],
    )?;
    Ok(())
}

/// Insert a 384-dim vector keyed by the shared chunk rowid.
///
/// `emb.as_bytes()` (zerocopy) passes the raw little-endian f32 bytes sqlite-vec
/// expects without an intermediate copy.
pub fn insert_vector(db: &Connection, chunk_rowid: i64, emb: &[f32]) -> Result<()> {
    db.prepare("INSERT INTO kb_vectors(rowid, embedding) VALUES (?, ?)")?
        .execute(rusqlite::params![chunk_rowid, emb.as_bytes()])?;
    Ok(())
}

/// KNN: return (chunk_rowid, distance) for the k nearest vectors.
///
/// Distance is the vec0 L2/cosine distance (smaller = closer). Join the returned
/// rowids back to `kb_chunks` for metadata.
pub fn knn(db: &Connection, query: &[f32], k: usize) -> Result<Vec<(i64, f64)>> {
    db.prepare(
        "SELECT rowid, distance FROM kb_vectors
         WHERE embedding MATCH ?1 ORDER BY distance LIMIT ?2",
    )?
    .query_map(rusqlite::params![query.as_bytes(), k as i64], |r| {
        Ok((r.get(0)?, r.get(1)?))
    })?
    .collect()
}

/// Delete vectors for the given chunk rowids (idempotent re-index, D-12).
///
/// Call BEFORE re-embedding an item so a re-index never leaves stale vectors.
pub fn delete_vectors_for_rowids(db: &Connection, rowids: &[i64]) -> Result<()> {
    if rowids.is_empty() {
        return Ok(());
    }
    let placeholders = rowids
        .iter()
        .map(|_| "?")
        .collect::<Vec<_>>()
        .join(",");
    let sql = format!("DELETE FROM kb_vectors WHERE rowid IN ({placeholders})");
    let params: Vec<&dyn rusqlite::ToSql> =
        rowids.iter().map(|r| r as &dyn rusqlite::ToSql).collect();
    db.prepare(&sql)?.execute(params.as_slice())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    /// Build a 384-dim vector that is all `base` except index 0 set to `spike`.
    fn vec384(base: f32, spike: f32) -> Vec<f32> {
        let mut v = vec![base; 384];
        v[0] = spike;
        v
    }

    #[test]
    fn test_knn_roundtrip() {
        // register_sqlite_vec() registers an auto-extension, which only applies to
        // connections opened AFTER it (the documented "call once at startup before
        // opening connections" contract). So register first, then open.
        register_sqlite_vec();
        let conn = Connection::open_in_memory().expect("in-memory db");
        init_vec_table(&conn).expect("init vec table");

        // Three known vectors with distinct "spike" values.
        insert_vector(&conn, 1, &vec384(0.0, 0.0)).expect("insert 1");
        insert_vector(&conn, 2, &vec384(0.0, 5.0)).expect("insert 2");
        insert_vector(&conn, 3, &vec384(0.0, 9.0)).expect("insert 3");

        // Query closest to vector #2 (spike ~5.0).
        let hits = knn(&conn, &vec384(0.0, 4.9), 1).expect("knn");
        assert_eq!(hits.len(), 1, "k=1 must return exactly one hit");
        assert_eq!(hits[0].0, 2, "nearest vector must be rowid #2");
    }
}

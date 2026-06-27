//! THE single sqlite-vec module (D-16). Wave 0: contract + RED test; impl in Plan 03-02.
//!
//! Nothing outside this file may import `sqlite_vec`. All vec0 calls live here so the
//! alpha library's API churn never leaks past one module.
//!
//! Run: `cargo test -p nexusai-kb vector`

use rusqlite::{Connection, Result};

/// Register the sqlite-vec extension once at startup, before opening connections.
///
/// RED stub — real implementation (sqlite3_auto_extension transmute) lands in Plan 03-02.
/// NOTE: pinned to rusqlite 0.31 — the transmute load breaks on 0.34+ (Pitfall 1).
pub fn register_sqlite_vec() {
    unimplemented!("register_sqlite_vec implemented in Plan 03-02")
}

/// Create the `kb_vectors` vec0 virtual table (embedding float[384]).
pub fn init_vec_table(_db: &Connection) -> Result<()> {
    unimplemented!("init_vec_table implemented in Plan 03-02")
}

/// Insert a 384-dim vector keyed by the shared chunk rowid.
pub fn insert_vector(_db: &Connection, _chunk_rowid: i64, _emb: &[f32]) -> Result<()> {
    unimplemented!("insert_vector implemented in Plan 03-02")
}

/// KNN: return (chunk_rowid, distance) for the k nearest vectors.
pub fn knn(_db: &Connection, _query: &[f32], _k: usize) -> Result<Vec<(i64, f64)>> {
    unimplemented!("knn implemented in Plan 03-02")
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
        let conn = Connection::open_in_memory().expect("in-memory db");
        register_sqlite_vec();
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

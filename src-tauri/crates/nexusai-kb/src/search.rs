//! Hybrid retrieval: FTS5 BM25 + RRF fusion over vector.rs results (KB-02).
//!
//! Runs BM25 (FTS5) and vector KNN (vector.rs) independently, then fuses them by
//! RANK — never raw score (BM25 is negative, distance is positive; Pitfall 4) —
//! with Reciprocal Rank Fusion (k=60).
//!
//! Run: `cargo test -p nexusai-kb rrf`

use crate::vector;
use rusqlite::{Connection, Result};

/// Create the `kb_fts` FTS5 external-content table over `kb_chunks` + sync triggers.
///
/// `tokenize='unicode61'` case-folds and strips diacritics — correct for PT-BR
/// (Pitfall 6: NOT 'porter', which is English stemming). External-content avoids
/// storing the chunk text twice; the AFTER INSERT/UPDATE/DELETE triggers keep
/// `kb_fts` in sync with `kb_chunks`.
pub fn init_fts_table(db: &Connection) -> Result<()> {
    db.execute_batch(
        "CREATE VIRTUAL TABLE IF NOT EXISTS kb_fts USING fts5(
            content,
            content='kb_chunks',
            content_rowid='rowid',
            tokenize='unicode61'
        );

        CREATE TRIGGER IF NOT EXISTS kb_chunks_ai AFTER INSERT ON kb_chunks BEGIN
            INSERT INTO kb_fts(rowid, content) VALUES (new.rowid, new.content);
        END;

        CREATE TRIGGER IF NOT EXISTS kb_chunks_ad AFTER DELETE ON kb_chunks BEGIN
            INSERT INTO kb_fts(kb_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
        END;

        CREATE TRIGGER IF NOT EXISTS kb_chunks_au AFTER UPDATE ON kb_chunks BEGIN
            INSERT INTO kb_fts(kb_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
            INSERT INTO kb_fts(rowid, content) VALUES (new.rowid, new.content);
        END;",
    )?;
    Ok(())
}

/// BM25 keyword search: return chunk rowids best-first.
///
/// `bm25()` is NEGATIVE in SQLite (more negative = more relevant), so `ORDER BY
/// bm25(kb_fts)` ascending yields the most relevant rows first (Pitfall 4).
pub fn bm25_search(db: &Connection, query: &str, k: usize) -> Result<Vec<i64>> {
    db.prepare(
        "SELECT rowid FROM kb_fts
         WHERE kb_fts MATCH ?1 ORDER BY bm25(kb_fts) LIMIT ?2",
    )?
    .query_map(rusqlite::params![query, k as i64], |r| r.get(0))?
    .collect()
}

/// Fuse two ranked lists of chunk rowids by Reciprocal Rank Fusion.
///
/// `score(d) = Σ_lists 1/(k + rank)` where rank is 1-based. Returns the top_n
/// rowids ordered by fused score (best first). Fusion is over RANKS, never raw
/// scores (BM25 is negative, distance is positive — Pitfall 4). Ties are broken by
/// ascending rowid so the ordering is deterministic.
pub fn reciprocal_rank_fusion(
    vec_hits: &[i64],
    bm25_hits: &[i64],
    k: f64,
    top_n: usize,
) -> Vec<i64> {
    use std::collections::HashMap;
    let mut scores: HashMap<i64, f64> = HashMap::new();
    for (rank, &id) in vec_hits.iter().enumerate() {
        *scores.entry(id).or_default() += 1.0 / (k + (rank + 1) as f64);
    }
    for (rank, &id) in bm25_hits.iter().enumerate() {
        *scores.entry(id).or_default() += 1.0 / (k + (rank + 1) as f64);
    }
    let mut ranked: Vec<(i64, f64)> = scores.into_iter().collect();
    // Sort by fused score desc; tie-break by rowid asc for deterministic output.
    ranked.sort_by(|a, b| {
        b.1.partial_cmp(&a.1)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(a.0.cmp(&b.0))
    });
    ranked.into_iter().take(top_n).map(|(id, _)| id).collect()
}

/// Hybrid search: BM25 + vector KNN fused with RRF (k=60). Returns chunk rowids.
///
/// This is the function Plan 03-03's `query_kb` command calls. A wider fusion pool
/// (`top_n * 4` candidates per list) gives RRF more overlap to work with before
/// truncating to `top_n`.
pub fn hybrid_search(
    db: &Connection,
    query_text: &str,
    query_vec: &[f32],
    top_n: usize,
) -> Result<Vec<i64>> {
    let pool = top_n.saturating_mul(4).max(top_n);
    let bm25_hits = bm25_search(db, query_text, pool)?;
    let vec_hits: Vec<i64> = vector::knn(db, query_vec, pool)?
        .into_iter()
        .map(|(rowid, _distance)| rowid)
        .collect();
    Ok(reciprocal_rank_fusion(&vec_hits, &bm25_hits, 60.0, top_n))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rrf_deterministic() {
        // Hand-computed (k=60):
        //   10: 1/61 + 1/63 ≈ 0.032264
        //   30: 1/63 + 1/61 ≈ 0.032264  (ties with 10, highest)
        //   20: 1/62          ≈ 0.016129
        //   40: 1/62          ≈ 0.016129
        let vec_hits = [10, 20, 30];
        let bm25_hits = [30, 40, 10];
        let fused = reciprocal_rank_fusion(&vec_hits, &bm25_hits, 60.0, 4);

        assert_eq!(fused.len(), 4, "top_n=4 must return four rowids");

        // 10 and 30 are the top two (tied highest), 20 and 40 follow.
        let top_two: std::collections::HashSet<i64> = fused[..2].iter().copied().collect();
        assert_eq!(
            top_two,
            [10, 30].into_iter().collect(),
            "10 and 30 must be the top two fused results"
        );
        let bottom_two: std::collections::HashSet<i64> = fused[2..].iter().copied().collect();
        assert_eq!(
            bottom_two,
            [20, 40].into_iter().collect(),
            "20 and 40 must follow"
        );
    }
}

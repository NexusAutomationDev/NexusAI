//! Hybrid retrieval: FTS5 BM25 + RRF fusion over vector.rs results (KB-02).
//! Wave 0: contract + RED test; impl in Plan 03-01/03-02.
//!
//! Run: `cargo test -p nexusai-kb rrf`

/// Fuse two ranked lists of chunk rowids by Reciprocal Rank Fusion.
///
/// `score(d) = Σ_lists 1/(k + rank)` where rank is 1-based. Returns the
/// top_n rowids ordered by fused score (best first). Fusion is over RANKS,
/// never raw scores (BM25 is negative, distance is positive — Pitfall 4).
///
/// RED stub — real implementation lands in Plan 03-01/03-02.
pub fn reciprocal_rank_fusion(
    _vec_hits: &[i64],
    _bm25_hits: &[i64],
    _k: f64,
    _top_n: usize,
) -> Vec<i64> {
    unimplemented!("reciprocal_rank_fusion implemented in Plan 03-01/03-02")
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

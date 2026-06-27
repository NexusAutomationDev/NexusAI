//! Semantic chunking (KB-01). Wave 0: contract + RED tests; impl in Plan 03-01.
//!
//! Run: `cargo test -p nexusai-kb chunk`

/// A single chunk of text with citation metadata.
#[derive(Debug, Clone, PartialEq)]
pub struct Chunk {
    pub content: String,
    pub ordinal: usize,
    pub section: Option<String>,
    pub char_start: usize,
    pub char_end: usize,
}

/// Split `text` into overlapping, paragraph-aware, token-bounded chunks.
///
/// `target_tokens` caps chunk size; `overlap_tokens` controls how much
/// consecutive chunks share. Markdown headings (`#`/`##`) become the `section`
/// of the chunks that follow them.
///
/// RED stub — real implementation lands in Plan 03-01.
pub fn chunk_text(_text: &str, _target_tokens: usize, _overlap_tokens: usize) -> Vec<Chunk> {
    unimplemented!("chunk_text implemented in Plan 03-01")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_md() -> String {
        std::fs::read_to_string(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/fixtures/sample.md"
        ))
        .expect("sample.md fixture must exist")
    }

    #[test]
    fn test_chunk_respects_markdown_headings() {
        let chunks = chunk_text(&sample_md(), 128, 16);
        // At least one chunk should carry the nearest heading as its section.
        let has_section_a = chunks.iter().any(|c| c.section.as_deref() == Some("A"));
        let has_section_b = chunks.iter().any(|c| c.section.as_deref() == Some("B"));
        assert!(
            has_section_a && has_section_b,
            "chunks must reflect the nearest markdown heading (A and B)"
        );
    }

    #[test]
    fn test_chunk_produces_multiple_chunks() {
        let chunks = chunk_text(&sample_md(), 64, 8);
        assert!(
            chunks.len() > 1,
            "a long input must yield more than one chunk, got {}",
            chunks.len()
        );
    }

    #[test]
    fn test_chunk_overlap_nonzero() {
        let chunks = chunk_text(&sample_md(), 64, 8);
        assert!(chunks.len() >= 2, "need >=2 chunks to test overlap");
        // Consecutive chunks overlap: chunk N+1 starts before chunk N ends.
        for pair in chunks.windows(2) {
            assert!(
                pair[1].char_start < pair[0].char_end,
                "consecutive chunks must overlap (char_start[N+1] < char_end[N])"
            );
        }
    }
}

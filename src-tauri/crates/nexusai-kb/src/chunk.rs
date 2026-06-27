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

/// Characters-per-token heuristic. ~512 tokens ≈ ~2048 chars (03-RESEARCH §Chunking).
const CHARS_PER_TOKEN: usize = 4;

/// A segmented block of the source text: a paragraph or heading-bounded span,
/// carrying its character offsets into the original text and the active section.
struct Block {
    char_start: usize,
    char_end: usize,
    section: Option<String>,
}

/// Split `text` into overlapping, paragraph-aware, token-bounded chunks.
///
/// `target_tokens` caps chunk size; `overlap_tokens` controls how much
/// consecutive chunks share. Markdown headings (`#`..`######`) become the
/// `section` of the chunks that follow them. Char offsets index the original
/// `text` (char positions, not bytes).
pub fn chunk_text(text: &str, target_tokens: usize, overlap_tokens: usize) -> Vec<Chunk> {
    let target_chars = (target_tokens * CHARS_PER_TOKEN).max(1);
    let overlap_chars = overlap_tokens * CHARS_PER_TOKEN;

    let chars: Vec<char> = text.chars().collect();
    let blocks = segment_blocks(&chars);
    if blocks.is_empty() {
        return Vec::new();
    }

    let mut chunks: Vec<Chunk> = Vec::new();
    let mut ordinal: usize = 0;

    for block in &blocks {
        // A block may itself exceed target_chars — hard-split it.
        let mut pos = block.char_start;
        while pos < block.char_end {
            let mut end = (pos + target_chars).min(block.char_end);

            // Determine this chunk's start, applying overlap against the
            // previous chunk so consecutive chunks share text.
            let start = if let Some(prev) = chunks.last() {
                pos.saturating_sub(overlap_chars).max(0)
                    // never overlap further back than where the prev chunk began
                    .max(prev.char_start.min(pos))
            } else {
                pos
            };

            // Ensure forward progress even with tiny targets.
            if end <= pos {
                end = block.char_end;
            }

            let content: String = chars[start..end].iter().collect();
            chunks.push(Chunk {
                content,
                ordinal,
                section: block.section.clone(),
                char_start: start,
                char_end: end,
            });
            ordinal += 1;
            pos = end;
        }
    }

    chunks
}

/// Segment the char slice into blocks on Markdown headings and blank-line
/// (`\n\n`) paragraph boundaries, tracking the active section heading.
fn segment_blocks(chars: &[char]) -> Vec<Block> {
    let full: String = chars.iter().collect();
    let mut blocks: Vec<Block> = Vec::new();
    let mut section: Option<String> = None;

    // Walk line by line, tracking char offsets. Headings update `section` and
    // are not emitted as content blocks; consecutive non-blank lines accumulate
    // into a paragraph block until a blank line closes it.
    let mut line_start_char = 0usize; // char offset of current line start
    let mut para_start: Option<usize> = None; // char offset where current paragraph began
    let mut para_end = 0usize; // char offset just past current paragraph content

    let flush = |start: Option<usize>, end: usize, sec: &Option<String>, blocks: &mut Vec<Block>| {
        if let Some(s) = start {
            if end > s {
                blocks.push(Block {
                    char_start: s,
                    char_end: end,
                    section: sec.clone(),
                });
            }
        }
    };

    for line in full.split_inclusive('\n') {
        let line_len = line.chars().count();
        let trimmed = line.trim_end_matches(['\n', '\r']);
        let trimmed_start = trimmed.trim_start();

        let is_heading = trimmed_start.starts_with('#')
            && trimmed_start
                .trim_start_matches('#')
                .starts_with(|c: char| c == ' ' || c.is_whitespace())
            && trimmed_start.matches('#').count() <= 6;

        if is_heading {
            // Close any open paragraph, then set the new section.
            flush(para_start, para_end, &section, &mut blocks);
            para_start = None;
            let heading_text = trimmed_start.trim_start_matches('#').trim().to_string();
            section = if heading_text.is_empty() {
                None
            } else {
                Some(heading_text)
            };
        } else if trimmed.trim().is_empty() {
            // Blank line → paragraph boundary.
            flush(para_start, para_end, &section, &mut blocks);
            para_start = None;
        } else {
            // Content line → extend the current paragraph.
            if para_start.is_none() {
                para_start = Some(line_start_char);
            }
            para_end = line_start_char + trimmed.chars().count();
        }

        line_start_char += line_len;
    }
    flush(para_start, para_end, &section, &mut blocks);

    blocks
}

/// Default chunking used by Plan 03-03 callers: ~512 tokens, ~64 overlap.
pub fn chunk_default(text: &str) -> Vec<Chunk> {
    chunk_text(text, 512, 64)
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

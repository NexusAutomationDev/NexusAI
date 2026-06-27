---
phase: 03-knowledge-base-rag
plan: 01
subsystem: knowledge-base
tags: [rust, ingestion, chunking, specta, dom_smoothie, docx-rust, pdf-extract, rag]

# Dependency graph
requires:
  - phase: 03-knowledge-base-rag
    plan: 00
    provides: nexusai-kb crate skeleton, Cargo deps, RED tests (chunk/scrape), fixtures
provides:
  - File/URL → clean UTF-8 text ingestion (parse_file, fetch_url, extract_article)
  - Section-aware, overlapping, token-bounded chunking (chunk_text, chunk_default)
  - Shared specta IPC types (KbItem, KbChunk, Citation, IndexProgress, command I/O)
affects: [03-02, 03-03, 03-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dom_smoothie Readability::new(html, None, None).parse() → Article { title: String, text_content: StrTendril }"
    - "docx-rust DocxFile::from_file().parse() then iterate document.body.content matching BodyContent::Paragraph"
    - "IndexProgress mirrors chat StreamEvent tagged-enum (tag=event, content=data) for reused Channel handler"

key-files:
  created:
    - src-tauri/crates/nexusai-kb/src/schema.rs
  modified:
    - src-tauri/crates/nexusai-kb/src/lib.rs
    - src-tauri/crates/nexusai-kb/src/ingest.rs
    - src-tauri/crates/nexusai-kb/src/chunk.rs

key-decisions:
  - "dom_smoothie 0.18 API: Readability::new(html, document_url, cfg) where url/cfg are None; .parse() returns Article; text_content is a StrTendril (.to_string() to convert), title is already String"
  - "docx-rust 0.1.11: extract via DocxFile::from_file(path).parse(), iterate docx.document.body.content, match BodyContent::Paragraph, join para.text() with \\n\\n for paragraph-aware boundaries"
  - "Chunking heuristic: 4 chars/token; section tracked via Markdown heading lines (#..######); overlap implemented as start = pos - overlap_chars so char_start[N+1] < char_end[N]"

requirements-completed: [KB-01, KB-04]

# Metrics
duration: 5min
completed: 2026-06-27
---

# Phase 3 Plan 01: Ingestion + Chunking + IPC Types Summary

**Implemented the ingestion/chunking half of nexusai-kb: files and URLs become clean UTF-8 text, text becomes section-tagged overlapping chunks, and the crate's shared specta IPC types are defined — turning the Plan 03-00 `chunk` and `scrape` RED tests GREEN.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-27T03:28:01Z
- **Completed:** 2026-06-27T03:33:10Z
- **Tasks:** 3
- **Files created/modified:** 4

## Accomplishments

- **schema.rs** — all KB IPC types deriving `specta::Type` + serde camelCase: `KbKind`/`KbStatus` (lowercase enums matching Drizzle CHECK constraints), `KbItem`, `KbChunk`, `Citation` (D-04 source cards), the `IndexProgress` tagged enum (mirrors chat `StreamEvent` so the frontend Channel handler is reused), and Plan 03-03 command I/O types (`ImportFileInput`, `AddUrlInput`, `CreateNoteInput`, `QueryKbInput`, `QueryKbOutput`, `ReindexInput`). Wired via `pub mod schema;` in lib.rs.
- **ingest.rs** — `parse_file` dispatches by lowercased extension (pdf→pdf-extract, docx→docx-rust paragraph join, md/txt→raw UTF-8 read, unknown→`"Codificação não suportada"`); `fetch_url` GETs with a desktop User-Agent and bails `"Falha ao buscar URL"` on non-2xx; `extract_article` runs dom_smoothie Readability and bails `"Conteúdo não encontrado (página dinâmica)"` on empty extraction (D-13 / KB-04).
- **chunk.rs** — `chunk_text` segments source on Markdown headings + blank-line paragraphs (tracking the active `section`), packs blocks to ~`target_tokens*4` chars, hard-splits oversized blocks, and overlaps consecutive chunks; char offsets index the original text. `chunk_default(text)` = `chunk_text(text, 512, 64)` for Plan 03-03 callers.

## Task Commits

1. **Task 1: Crate IPC types (schema.rs)** — `6174f4f` (feat)
2. **Task 2: Ingestion (ingest.rs) — file parse + URL scrape** — `77c95cd` (feat)
3. **Task 3: Chunking (chunk.rs)** — `f4ba51b` (feat)

## Confirmed Library API Shapes (per plan output requirement)

- **dom_smoothie 0.18.0:** `Readability::new<T: Into<StrTendril>>(html, document_url: Option<&str>, cfg: Option<Config>) -> Result<Self, ReadabilityError>`; `.parse(&mut self) -> Result<Article, ReadabilityError>`. `Article.title` is `String`; `Article.text_content` is `StrTendril` (convert with `.to_string()`). Called as `Readability::new(html, None, None)?.parse()?`.
- **docx-rust 0.1.11:** `DocxFile::from_file(path)?` then `.parse()?` returns a `Docx` borrowing the file. Body text accessed via `docx.document.body.content: Vec<BodyContent>`; matched `BodyContent::Paragraph(para)` and called `para.text() -> String`, joined with `\n\n`. (A `body.text()` helper exists but joins with `\r\n` and skips tables — chose explicit paragraph iteration for paragraph-aware boundaries the chunker relies on.) Both `from_file` and `parse` return a non-`std::error::Error` error type, mapped to anyhow via `.map_err(|e| anyhow!("{e:?}"))`.

## Verification

- `cargo build -p nexusai-kb` → exits 0.
- `cargo test -p nexusai-kb --lib chunk::` → 3/3 pass (headings, multiple, overlap).
- `cargo test -p nexusai-kb scrape` → 1/1 pass (test_scrape_strips_chrome).

## Deviations from Plan

None — plan executed as written. The dom_smoothie/docx-rust API shapes matched the plan's expectations (the plan explicitly asked to confirm them at impl time; confirmed and documented above). `parse_file`'s docx branch uses explicit paragraph iteration as the plan specified rather than the crate's `body.text()` helper, to preserve paragraph boundaries for chunking.

## Known Stubs

None introduced by this plan. The pre-existing `store::query_chunks` stub (`unimplemented!()`) remains RED by design — it is owned by Plan 03-03 (it surfaces in `cargo test ... chunk` only because the test name `test_query_chunks_no_scoping` contains "chunk"; the targeted `chunk::` module filter shows it is unrelated). `vector.rs`/`search.rs`/`embed.rs` stubs remain owned by Plan 03-02.

## Next Plan Readiness

- Plan 03-02 (embedding/vector) can consume the `Chunk` stream from `chunk_text`/`chunk_default`.
- Plan 03-03 (store/commands) can use `parse_file`/`fetch_url`/`extract_article` and the schema command I/O types.
- Plan 03-06 (citation source cards) can read `Citation` + chunk `section`/offset metadata.

## Self-Check: PASSED

All created/modified files verified present; all three task commits (`6174f4f`, `77c95cd`, `f4ba51b`) present in git history.

---
*Phase: 03-knowledge-base-rag*
*Completed: 2026-06-27*

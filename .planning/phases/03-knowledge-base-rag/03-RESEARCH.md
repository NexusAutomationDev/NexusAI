# Phase 3: Knowledge Base + RAG - Research

**Researched:** 2026-06-27
**Domain:** Local RAG (file/note/URL ingestion, local ONNX embeddings, hybrid BM25+vector retrieval) in a Tauri v2 desktop app (Rust core + React 19 webview)
**Confidence:** MEDIUM-HIGH (HIGH on stack picks and patterns; MEDIUM on sqlite-vec alpha API surface and fastembed offline behavior — both flagged below)

## Summary

Phase 3 is almost entirely a **Rust-side** phase. Every heavy operation — file parsing, embedding via ONNX, vector storage, BM25, fusion, scraping — lives in the `nexusai-kb` crate behind a single module surface (D-16), exactly as the chat crate already does for streaming. The frontend reuses everything Phase 2 shipped: the Channel API streaming pattern (now for indexing progress, not tokens), `react-markdown ^10` + the `MarkdownRenderer`/`MessageBubble` (now with a citation custom-node), the resizable two-pane split, Zustand stores, and the Drizzle migration pattern. There is very little net-new frontend plumbing — the new UI is a tree + table browser, a CodeMirror notes editor, and a KB-scope selector bolted onto the existing `MessageInput`.

The riskiest pieces are two alpha/young Rust libraries: **sqlite-vec** (`0.1.10-alpha.4`) and **fastembed** (`5.17.2`, healthy but with a known offline-mode gotcha). Both must be wrapped so their API churn never leaks past one module. The recommended approach is to **hand-build the hybrid retriever** (FTS5 + sqlite-vec + Reciprocal Rank Fusion) rather than adopt the brand-new `cairn-search` crate (single 0.1.0 release, 2 dependents) — RRF is a ~15-line algorithm and hand-building keeps the alpha surface minimal and fully under our control, which is exactly what D-16 / STATE.md demands.

**Primary recommendation:** Build `nexusai-kb` as: `fastembed` (MultilingualE5Small, 384-dim, PT-BR-capable) for embeddings → `rusqlite` (already bundled, v0.31) loading `sqlite-vec` via `sqlite3_auto_extension` for vector KNN → a parallel **FTS5** virtual table for BM25 → a small **RRF (k=60)** fusion function in Rust. Parse files with `pdf-extract` (PDF), `docx-rust` (DOCX), and direct UTF-8 read (md/txt). Scrape URLs with `reqwest` + `dom_smoothie` (Readability-port). Stream per-item indexing progress to a single Zustand `indexingStore` via `tauri::ipc::Channel`. Notes editor: `@uiw/react-codemirror` + `@codemirror/lang-markdown`. Browser: `react-arborist` (tree) + `@tanstack/react-table` v8 (flat view). **CRITICAL caveat:** pin sqlite-vec — do NOT bump `rusqlite` to 0.34+ without a code change (the `sqlite3_auto_extension` transmute breaks at 0.34).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** RAG is integrated INTO the existing Phase 2 chat module — not a separate KB-chat view. A toggle / @-mention ("usar KB") opts a normal chat message into KB grounding. Reuses the shipped streaming pipeline (Channel API `startStream`), `MessageList`, `MessageBubble`, `MarkdownRenderer`, real-time persistence.
- **D-02:** The `/kb` route is NOT a second chat surface — it hosts the KB browser/management UI (D-09). Phase 3 keeps a single chat codepath.
- **D-03:** A KB-scope selector lives beside the existing per-message model picker in `MessageInput`. KB-grounding is tracked per-message (conversations can mix grounded/ungrounded messages).
- **D-04:** Inline numbered footnotes `[1]`, `[2]` rendered as clickable spans via a custom react-markdown node, PLUS source cards below the answer (filename + section/page). This is the primary success-criterion-satisfying pattern.
- **D-05:** The LLM is prompt-instructed to emit citation IDs that map to chunk metadata from the hybrid retriever. A citation-ID → chunk-metadata lookup is attached per message.
- **D-06:** Fallback if local-model citation-ID fidelity is weak: degrade to source-cards-only (no inline markers). Click-to-open-chunk + hover previews are DEFERRED to 3.x.
- **D-07:** CodeMirror 6 via `@uiw/react-codemirror` + `@codemirror/lang-markdown`. Raw Markdown IS the stored source of truth (perfect RAG-chunking fidelity; WYSIWYG leaks serialization edge-cases).
- **D-08:** Notes are first-class KB items: stored as clean Markdown on disk, embedded via fastembed-rs, retrieved alongside imported files. The editor must NOT mutate/normalize the user's Markdown.
- **D-09:** Hybrid two-pane layout reusing the resizable split (`react-resizable-panels`): LEFT = collapsible folder/notes tree (`react-arborist` OR `@headless-tree/react`); RIGHT = flat, filterable "All Items" view (TanStack Table v8 + shadcn data-table + faceted filters) listing files, notes, URLs with type icon + indexed-status badge.
- **D-10:** Each item shows type (file/note/URL) and indexed status. Status is filterable; folders apply only to notes (files/URLs stay in the flat view, not forced into the tree).
- **D-11:** Single Zustand `indexingStore` keyed by item ID, fed by Channel API progress events: per-item `Badge` (pending→indexing→indexed→failed, backed by a SQLite `status` column for reconcile-on-reload); global `Progress` panel ("3 de 8", item-count based, indeterminate when chunk total unknown); `Sonner` toast for URL-paste flow and terminal failures.
- **D-12:** `failed` is a terminal `Badge variant="destructive"` with per-row Retry/Re-index + tooltip carrying a short error reason. Re-index is idempotent in Rust — DELETE the item's existing chunks/vectors before re-embedding.
- **D-13:** Import entry points / empty state: central dashed drop zone ("Arraste PDF, Markdown, DOCX ou TXT aqui") + "Escolher arquivos" button + URL paste input with "Adicionar". No demo/sample-data seeding.
- **D-14:** Embeddings computed locally via fastembed-rs (ONNX), zero external API calls — KB queries against already-indexed content must work fully offline (success criterion #5). LOCKED by requirement.
- **D-15:** The embedding model MUST handle Brazilian Portuguese well. Prefer multilingual (`paraphrase-multilingual-*` / multilingual-e5 family) over English-only models. Researcher to confirm best fastembed-supported option (PT-BR quality vs download size).
- **D-16:** Single shared KB — no per-agent isolation. Retrieval interface callable by any agent (Phase 7) against the same index. ALL vector operations stay isolated behind a single Rust module (sqlite-vec is alpha).

### Claude's Discretion

- Chunking strategy (size, overlap, paragraph- vs token-based) — respecting clean Markdown boundaries for notes.
- URL scraping engine and main-content extraction approach (Readability-style vs full HTML; JS-heavy page handling).
- Exact fastembed model selection (within D-15's PT-BR/multilingual constraint).
- SQLite schema specifics for KB tables (items, chunks, vectors, folders) — normalized + a `status` column per item.
- Citation-ID prompt wording and the markdown custom-node implementation details.
- Tree library final pick (`react-arborist` vs `@headless-tree/react`) and table faceted-filter wiring.

### Deferred Ideas (OUT OF SCOPE)

- Click-to-open chunk in source document + hover preview → 3.x (needs per-filetype source viewer).
- Gmail/Calendar as KB sources → Phase 5.
- KB consumption by agents / orchestrated sharing → Phase 7 (the shared interface is built here per D-16, but agent USE is Phase 7).
- Node.js sidecar for embeddings (`@xenova/transformers`) → explicitly NOT used in Phase 3; fastembed-rs in Rust covers KB-07. Sidecar is Phase 7.
- WYSIWYG visual editor (TipTap) → discarded for notes (markdown fidelity risk).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **KB-01** | Import local files (PDF/.md/.txt/.docx) — auto-indexed with semantic chunking | `pdf-extract` + `docx-rust` + UTF-8 read → chunker (paragraph-aware, ~512-token chunks, ~15% overlap) → fastembed → sqlite-vec + FTS5. See Standard Stack, Architecture Patterns, Chunking. |
| **KB-02** | Ask LLM questions answered from indexed docs (hybrid: BM25 + sqlite-vec) | FTS5 BM25 + sqlite-vec KNN, fused with RRF (k=60). Top-k chunks injected into the existing chat stream (D-01). See Hybrid Retrieval pattern. |
| **KB-03** | Create/edit/organize notes in a Markdown editor | `@uiw/react-codemirror` + `@codemirror/lang-markdown` (D-07); notes stored as clean .md (D-08); folders table for organization. See Frontend Stack. |
| **KB-04** | Save URLs → scrape + index → queryable within one minute | `reqwest` fetch + `dom_smoothie` Readability extraction → same chunk/embed pipeline; completion signaled by Channel event (D-11), not a timer. See URL Scraping. |
| **KB-05** | File-explorer view of all items + indexed status (Obsidian-like) | `react-arborist` tree (notes/folders) + TanStack Table v8 flat view with faceted status filter (D-09/D-10). `status` column drives Badge. |
| **KB-06** | KB shared across all agents — no silos | Single shared SQLite store; retrieval is one Rust function callable by any caller (D-16). No per-agent scoping columns. |
| **KB-07** | Embeddings generated locally via fastembed-rs (ONNX) — no external API | `fastembed 5.17.2`, `MultilingualE5Small` (384-dim), ONNX Runtime bundled via `ort`. Model downloaded once on setup; runtime inference is fully local. See Embedding Model + offline caveat. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Commit format:** `<emoji> <type>(scope): <description>` (e.g. `✨ feat(kb): ...`), description ≤72 chars, imperative, no trailing period. NEVER include "Generated with Claude Code" / "Co-Authored-By" lines. Scope `kb` (or `backend`/`ui`/`database`/`deps`) fits this phase.
- **Tauri Webview Boundary:** No Node-only/NAPI deps in the webview. All file I/O, embeddings, vector ops, scraping, and HTTP happen in **Rust**; the frontend only `invoke()`s commands and `listen()`s on Channels. (This is why fastembed-rs in Rust — not `@xenova/transformers` in a sidecar — satisfies KB-07.)
- **Streaming:** Use `tauri::ipc::Channel`, never `emit()` in a loop (FOUND-05). Applies to indexing-progress events.
- **Local-first / no-server / offline:** No external API for indexing or KB-query retrieval. (One online step is unavoidable: first-time embedding-model download — see Common Pitfalls.)
- **Language:** User content and UI copy are PT-BR (drop-zone text, error reasons, etc. are Portuguese per D-13).

---

## Standard Stack

### Core (Rust — `nexusai-kb` crate)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastembed` | **5.17.2** | Local ONNX text embeddings (KB-07) | The de-facto Rust local-embedding crate (Qdrant-ecosystem `Anush008/fastembed-rs`); bundles ONNX Runtime via `ort`, no system install; 46 models incl. multilingual E5. |
| `sqlite-vec` | **0.1.10-alpha.4** (pin exactly) | Vector KNN via `vec0` virtual table | Only embedded, server-less, Rust-loadable vector option for Tauri (CLAUDE.md locked). Pure C, embeds in the existing SQLite file. |
| `rusqlite` | **0.31** (already in `src-tauri/Cargo.toml`, `bundled`) | SQLite connection that loads sqlite-vec + runs FTS5 | Supports `sqlite3_auto_extension`. **Already present** — do NOT upgrade to 0.34+ (breaks the sqlite-vec transmute, see Pitfalls). |
| `zerocopy` | **0.7+** | `Vec<f32>` → `&[u8]` for sqlite-vec params | sqlite-vec wants raw little-endian f32 bytes; `.as_bytes()` avoids a copy. (CLAUDE.md already lists 0.7.) |
| `pdf-extract` | **0.10+** | Extract text from PDF | Most-used pure-Rust PDF text crate; simple `extract_text(path)` API; actively released. |
| `docx-rust` | **0.1.11** | Extract text from .docx | Parses OOXML, iterate paragraphs→runs→text. (Alternatively `dotext` for a unified file→text reader — see Alternatives.) |
| `dom_smoothie` | latest | Readability-style main-content extraction from HTML (KB-04) | Mozilla-Readability port on `dom_query`; scores DOM, extracts article, strips chrome. Outperforms the older `readability`/`readable-readability` crates (known to fail). |
| `reqwest` | **0.12** (already used by chat crate) | Fetch URL HTML | Already a workspace HTTP client; reuse. |
| `uuid` | **1.x** (already used by chat crate) | Item/chunk IDs | Same pattern as Phase 2. |

### Supporting (Frontend — npm)

| Library | Version (current) | Purpose | When to Use |
|---------|-------------------|---------|-------------|
| `@uiw/react-codemirror` | **4.25.10** | CodeMirror 6 React wrapper (D-07 notes editor) | Notes editing surface. React 16.8+ (works on React 19). |
| `@codemirror/lang-markdown` | **6.5.0** | Markdown language support for CM6 | Pair with the wrapper; gives syntax highlighting + structure. |
| `@tanstack/react-table` | **8.21.3** | Headless table for the flat "All Items" view (D-09) | Faceted status/type filters, sorting. Pairs with shadcn data-table. |
| `react-arborist` | **3.10.5** | Folder/notes tree (D-09 left pane) | Battle-tested VSCode-sidebar-style tree, built-in DnD + virtualization. (See tree decision below.) |
| `sonner` | **2.0.7** | Toasts for URL-paste + terminal failures (D-11) | shadcn's recommended toast; **NOT yet installed** — add it. |
| `react-resizable-panels` | 4.11.2 (installed) | Reuse the chat two-pane split (D-09) | Already a dependency. |
| `react-markdown` | 10.1.0 (installed) | Render answers + citation custom-node (D-04) | Already a dependency; add a custom node for `[n]` spans. |
| `zustand` | 5.0.14 (installed) | `indexingStore` (D-11) | Same pattern as `chat.ts`. |
| `@tanstack/react-query` | 5.101.1 (installed) | KB CRUD queries (items/notes/folders) | Same pattern as `queries/chat.ts`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-built FTS5+vec+RRF | `cairn-search 0.1.0` (sqlite-vec+FTS5+RRF crate) | Tempting — does exactly this — but it's a SINGLE 0.1.0 release with 2 dependents, and it pulls in its own `fastembed`+`rusqlite`. Adopting it would put our vector layer behind a *second* unvetted alpha, contradicting D-16's "absorb API changes in OUR module." RRF is ~15 lines. **Recommend hand-build.** Keep cairn-search as a reference implementation. |
| `docx-rust` | `dotext` | `dotext` is a unified "any document → text" reader (docx, xlsx, pdf, odt). Convenient single dependency, but thinner/older and less control over docx structure (no per-paragraph access for clean chunk boundaries). Use `docx-rust` for structure; consider `dotext` only if a single-crate parser is preferred. |
| `pdf-extract` | `lopdf` (low-level) / `pdfsink-rs` | `pdf-extract` is the simplest text path. `lopdf` is lower-level (more control, more work). `pdfsink-rs` claims 10-50× speed but is newer. Start with `pdf-extract`; revisit only if perf or extraction quality is poor. |
| `react-arborist` | `@headless-tree/react 1.7.0` | Headless Tree is newer (smaller bundle, better DnD interop) but less battle-tested. `react-arborist` is the complete, proven VSCode-sidebar solution and the tree here is simple (notes + folders). **Recommend `react-arborist`** unless advanced cross-tree DnD is needed. |
| `MultilingualE5Small` | `MultilingualE5Base` / `ParaphraseMLMpnetBaseV2` | Base = 768-dim, better quality, ~2× the download/RAM/latency. For a <100K-vector personal KB on a laptop, Small (384-dim) is the right default; Base is the upgrade lever if PT-BR retrieval quality disappoints. |

**Installation:**
```bash
# Frontend (npm)
npm install @uiw/react-codemirror @codemirror/lang-markdown @tanstack/react-table react-arborist sonner

# Rust — add to src-tauri/crates/nexusai-kb/Cargo.toml
# fastembed = "5.17"
# sqlite-vec = "=0.1.10-alpha.4"   # PIN exactly — alpha
# rusqlite  = { version = "0.31", features = ["bundled"] }   # match root crate; do NOT bump to 0.34+
# zerocopy  = "0.7"
# pdf-extract = "0.10"
# docx-rust = "0.1"
# dom_smoothie = "*"   # confirm latest at impl time
# reqwest = { version = "0.12", features = ["json"] }  # already in workspace style
# tokio, serde, serde_json, tauri, uuid, tauri-specta, specta  # mirror nexusai-chat/Cargo.toml
```

**Version verification:** Confirmed via `cargo search` / `npm view` on 2026-06-27: `fastembed 5.17.2`, `sqlite-vec 0.1.10-alpha.4`, `react-arborist 3.10.5`, `@uiw/react-codemirror 4.25.10`, `@codemirror/lang-markdown 6.5.0`, `@tanstack/react-table 8.21.3`, `@headless-tree/react 1.7.0`, `sonner 2.0.7`. Re-confirm `pdf-extract`, `docx-rust`, `dom_smoothie`, `zerocopy` exact patch versions at implementation time (registry may have moved).

## Architecture Patterns

### Recommended Project Structure

```
src-tauri/crates/nexusai-kb/src/
├── lib.rs            # Tauri commands (import_file, add_url, create_note, query_kb, reindex_item) + specta types
├── schema.rs         # serde/specta IPC types (KbItem, KbChunk, Citation, IndexProgress) — mirrors schema.ts
├── ingest.rs         # file/url/note → raw text (pdf-extract, docx-rust, dom_smoothie dispatch by type)
├── chunk.rs          # text → Vec<Chunk> (paragraph-aware, token-bounded, overlap)
├── embed.rs          # fastembed TextEmbedding singleton (lazy_static, like CANCEL_MAP) — embed(passages)/embed_query
├── vector.rs         # ⭐ THE single sqlite-vec module (D-16): auto_extension load, vec0 table, insert, KNN
├── search.rs         # FTS5 BM25 query + RRF fusion over vector.rs results
└── progress.rs       # Channel<IndexProgress> emission helper (reuse streaming.rs shape)

src/
├── routes/kb/
│   ├── index.tsx           # hybrid two-pane layout (resizable panels)
│   ├── -components/
│   │   ├── FolderTree.tsx       # react-arborist (notes/folders)
│   │   ├── ItemsTable.tsx       # TanStack Table v8 + faceted filters
│   │   ├── NoteEditor.tsx       # @uiw/react-codemirror + lang-markdown
│   │   ├── ImportDropzone.tsx   # D-13 empty state / drop zone
│   │   └── IndexStatusBadge.tsx # selector off indexingStore
├── lib/stores/indexing.ts      # Zustand indexingStore (D-11)
├── lib/queries/kb.ts           # TanStack Query CRUD for items/notes/folders
└── routes/chat/-components/
    ├── MessageInput.tsx        # + KB-scope selector (D-03)
    └── MarkdownRenderer.tsx    # + citation [n] custom node (D-04)
```

### Pattern 1: The single vector module (D-16) — sqlite-vec load + KNN
**What:** All sqlite-vec calls live in `vector.rs`. The extension is registered once at app startup (before opening the KB connection).
**When to use:** Any vector store/query. Nothing outside this file imports `sqlite_vec`.
```rust
// Source: https://alexgarcia.xyz/sqlite-vec/rust.html + sqlite-vec/examples/simple-rust/demo.rs (verified verbatim)
use rusqlite::{ffi::sqlite3_auto_extension, Connection, Result};
use sqlite_vec::sqlite3_vec_init;
use zerocopy::AsBytes;

// Call ONCE at startup, before opening connections. WORKS on rusqlite 0.31.
// ⚠️ This transmute BREAKS on rusqlite 0.34+ (signature change → use register_auto_extension there).
pub fn register_sqlite_vec() {
    unsafe {
        sqlite3_auto_extension(Some(std::mem::transmute(sqlite3_vec_init as *const ())));
    }
}

// Create the vec0 virtual table. 384 = MultilingualE5Small dim.
// vec0 only stores rowid + vector → keep chunk metadata in a normal `kb_chunks` table keyed by the same id.
pub fn init_vec_table(db: &Connection) -> Result<()> {
    db.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS kb_vectors USING vec0(embedding float[384])",
        [],
    )?;
    Ok(())
}

pub fn insert_vector(db: &Connection, chunk_rowid: i64, emb: &[f32]) -> Result<()> {
    db.prepare("INSERT INTO kb_vectors(rowid, embedding) VALUES (?, ?)")?
        .execute(rusqlite::params![chunk_rowid, emb.as_bytes()])?;
    Ok(())
}

// KNN: returns (chunk_rowid, distance) for the k nearest. Join rowid back to kb_chunks for metadata.
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
```

### Pattern 2: fastembed singleton (PT-BR multilingual)
**What:** Load the ONNX model once, reuse for all embeddings. Mirror the chat crate's `lazy_static! { static ref CANCEL_MAP }` pattern.
```rust
// Source: https://github.com/Anush008/fastembed-rs README (verified)
use fastembed::{TextEmbedding, InitOptions, EmbeddingModel};

// MultilingualE5Small → "intfloat/multilingual-e5-small", 384-dim, strong PT-BR.
// Set cache_dir to a Tauri app-data path so the ONNX model persists across launches.
pub fn load_model(cache_dir: std::path::PathBuf) -> anyhow::Result<TextEmbedding> {
    Ok(TextEmbedding::try_new(
        InitOptions::new(EmbeddingModel::MultilingualE5Small)
            .with_cache_dir(cache_dir)
            .with_show_download_progress(true),
    )?)
}

// E5 models expect prefixes. Index chunks as "passage: …", queries as "query: …".
pub fn embed_passages(model: &TextEmbedding, texts: &[String]) -> anyhow::Result<Vec<Vec<f32>>> {
    let prefixed: Vec<String> = texts.iter().map(|t| format!("passage: {t}")).collect();
    Ok(model.embed(prefixed, None)?)
}
pub fn embed_query(model: &TextEmbedding, q: &str) -> anyhow::Result<Vec<f32>> {
    Ok(model.embed(vec![format!("query: {q}")], None)?.remove(0))
}
```

### Pattern 3: Hybrid retrieval = FTS5 BM25 + vector KNN + RRF
**What:** Run BM25 and vector KNN independently, fuse by rank (not score) with RRF k=60.
```rust
// FTS5 table (one-time): external-content over kb_chunks to avoid storing text twice.
// CREATE VIRTUAL TABLE kb_fts USING fts5(content, content='kb_chunks', content_rowid='rowid', tokenize='unicode61');
// (unicode61 case-folds + strips diacritics — good for PT-BR. Avoid 'porter' which is English-stemming only.)
// Keep in sync via AFTER INSERT/UPDATE/DELETE triggers on kb_chunks.

// bm25() returns a NEGATIVE number in SQLite (more negative = more relevant) → ORDER BY bm25(kb_fts) ASC.
// SELECT rowid, bm25(kb_fts) AS score FROM kb_fts WHERE kb_fts MATCH ?1 ORDER BY score LIMIT ?2;

// RRF fusion (k=60). rank is 1-based position in each list.
// Source: standard RRF — score(d) = Σ_lists 1/(k + rank). Verified across multiple sources.
fn reciprocal_rank_fusion(
    vec_hits: &[i64],   // chunk rowids, best-first
    bm25_hits: &[i64],  // chunk rowids, best-first
    k: f64,             // 60.0
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
    ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    ranked.into_iter().take(top_n).map(|(id, _)| id).collect()
}
```

### Pattern 4: Indexing progress via Channel (reuse Phase 2)
**What:** Same `tauri::ipc::Channel<T>` mechanism as `streaming.rs`, but the payload is an indexing-progress enum, fed into the `indexingStore` instead of accumulating tokens.
```rust
// Mirror nexusai-settings::StreamEvent shape (tagged: { event, data }).
#[derive(Clone, Serialize, specta::Type)]
#[serde(tag = "event", content = "data", rename_all = "lowercase")]
pub enum IndexProgress {
    Started   { item_id: String, total_chunks: Option<u32> }, // None → indeterminate bar (D-11)
    Chunk     { item_id: String, done: u32, total: Option<u32> },
    Indexed   { item_id: String },
    Failed    { item_id: String, reason: String },            // → destructive badge + tooltip (D-12)
}
// command: async fn import_file(input, on_event: Channel<IndexProgress>) -> Result<(), String>
```
Frontend mirrors `chat.ts`'s `startStream`: `const ch = new Channel<IndexProgress>(); ch.onmessage = e => indexingStore.apply(e); await invoke('import_file', { input, onEvent: ch });`

### Pattern 5: Citations (D-04/D-05) with the D-06 fallback
**What:** Retriever returns top chunks with stable short IDs. Prompt the LLM to cite them as `[1]`, `[2]`. A custom react-markdown node turns `[n]` into a clickable span resolving to the per-message citation map; source cards render below.
```
# System-prompt scaffold (PT-BR), injected only when KB-scope is on (D-03):
"Responda APENAS com base nos trechos abaixo. Cite a fonte de cada afirmação
 usando o número entre colchetes correspondente, ex: [1]. Se a resposta não
 estiver nos trechos, diga que não encontrou.

 [1] (arquivo: contrato.pdf, seção: Cláusula 3) <chunk text>
 [2] (nota: Reunião 12/05) <chunk text>"
```
**D-06 fallback:** if the local model emits unreliable `[n]` markers, drop the custom-node rendering and show source-cards-only (the cards are driven by the retriever's returned chunks, independent of the model's text — so they're always correct). Build the retriever→citation-map first; the inline markers are a presentation layer on top.

### Anti-Patterns to Avoid
- **Storing chunk text inside `vec0`:** `vec0` is for vectors + rowid only. Keep all metadata/text in a normal `kb_chunks` table joined by rowid (the documented metadata-table workaround).
- **Letting any file outside `vector.rs` touch sqlite-vec:** violates D-16; makes the alpha upgrade a shotgun change.
- **Bumping `rusqlite` to 0.34+ casually:** silently breaks the sqlite-vec `transmute` load (see Pitfalls). Pin it.
- **Normalizing note Markdown on save:** D-08 forbids it — store exactly what the user typed (CodeMirror gives raw text; don't round-trip through a serializer).
- **`emit()` in an indexing loop:** FOUND-05 violation — use the Channel.
- **`porter` FTS5 tokenizer for PT-BR:** it's English stemming. Use `unicode61` (diacritic-folding) — or `trigram` if substring matching is wanted.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text embeddings | Custom ONNX inference / call an API | `fastembed` | Bundles ORT, handles tokenization, model download/cache, pooling. API would violate KB-07. |
| Vector KNN | Brute-force cosine in Rust over all rows | `sqlite-vec` (`vec0` MATCH) | Locked by CLAUDE.md; handles binary storage + KNN in-SQL; stays in the one SQLite file. |
| Full-text/BM25 | Custom inverted index | SQLite **FTS5** `bm25()` | Built into bundled SQLite; battle-tested; zero new deps. |
| PDF text extraction | Parse PDF streams yourself | `pdf-extract` | PDF text layout/encoding is a swamp (CMaps, ligatures, columns). |
| DOCX parsing | Unzip + walk OOXML XML by hand | `docx-rust` | OOXML run/paragraph model is fiddly. |
| Web main-content extraction | Strip tags with regex / dump full HTML | `dom_smoothie` | Readability scoring (boilerplate removal) is a known-hard problem; naive crates (`readability`) fail often. |
| Tree view | Custom recursive divs | `react-arborist` | Virtualization, keyboard nav, DnD, selection — all solved. |
| Data table w/ filters | Custom table | `@tanstack/react-table` v8 | Faceted filtering/sorting headless; pairs with shadcn. |
| Markdown editor | contenteditable | `@uiw/react-codemirror` + lang-markdown | CM6 gives selection model, undo, syntax, perf. |

**Key insight:** Phase 3's genuinely novel code is *glue* — the chunker, the RRF fusion (~15 lines), the citation prompt/map, and the `indexingStore`. Everything heavy is a maintained library. Resist re-implementing retrieval primitives; the value is in wiring them and isolating the alpha ones (D-16).

## Chunking (Claude's Discretion → concrete defaults)

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Unit | Paragraph-aware, token-bounded | Respects clean Markdown boundaries (D-08) yet caps chunk size. |
| Target size | ~512 tokens (~2000 chars) | Fits E5's typical context window; standard RAG default; balances recall vs precision. |
| Overlap | ~10-15% (~64-token slide) | Preserves cross-boundary context for retrieval without exploding vector count. |
| Markdown notes | Split on heading (`#`/`##`) and blank-line paragraph boundaries first, then pack to size | Keeps semantic sections intact; section title becomes citation "section" metadata (D-04 source cards). |
| PDF/DOCX | Split on double-newline/paragraph, then pack | Page number (PDF) → citation metadata where available. |
| Metadata per chunk | `item_id`, `ordinal`, `char_start/end`, optional `section`/`page` | Drives citation source cards (D-04) and idempotent re-index deletion (D-12). |

**Idempotent re-index (D-12):** `DELETE FROM kb_chunks WHERE item_id = ?` (cascade/explicit `DELETE FROM kb_vectors WHERE rowid IN (...)` and FTS via triggers) BEFORE re-inserting. Wrap in a transaction.

## SQLite Schema (Claude's Discretion → proposed)

New migration `0002_kb.sql`, extend `src/lib/db/schema.ts` mirroring the Phase 2 pattern (text UUID PKs, integer ms timestamps, soft-delete optional). Drizzle manages the relational tables; `kb_vectors` (vec0) and `kb_fts` (FTS5) are created in **Rust** (`vector.rs`/`search.rs`) since they're virtual tables outside Drizzle's model.

```sql
-- 0002_kb.sql (relational part — managed by Drizzle)
CREATE TABLE kb_folders (            -- notes organization (D-09, notes-only)
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES kb_folders(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE TABLE kb_items (              -- files, notes, URLs (one row per KB item)
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('file','note','url')),   -- D-10 type
  title TEXT NOT NULL,
  source_path TEXT,                  -- disk path (file/note) or URL
  folder_id TEXT REFERENCES kb_folders(id) ON DELETE SET NULL, -- notes only
  status TEXT NOT NULL DEFAULT 'pending'                        -- D-11 reconcile-on-reload
    CHECK(status IN ('pending','indexing','indexed','failed')),
  error_reason TEXT,                 -- D-12 tooltip text
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE TABLE kb_chunks (             -- rowid INTEGER PK links to kb_vectors.rowid & kb_fts.rowid
  rowid INTEGER PRIMARY KEY,         -- shared rowid across vec0 + fts5
  id TEXT NOT NULL UNIQUE,
  item_id TEXT NOT NULL REFERENCES kb_items(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  content TEXT NOT NULL,
  section TEXT,                      -- heading/page for citations (D-04)
  char_start INTEGER, char_end INTEGER
);
CREATE INDEX idx_kb_chunks_item ON kb_chunks(item_id);
CREATE INDEX idx_kb_items_status ON kb_items(status);
-- kb_vectors (vec0) and kb_fts (fts5) + sync triggers created in Rust.
```
Note: `kb_chunks.rowid` is the integer join key to both `vec0` and `fts5` (both index by rowid). The text `id` is the stable citation ID surfaced to the LLM.

## URL Scraping (Claude's Discretion → recommendation, KB-04)

- **Fetch:** `reqwest::get(url)` (reuse the chat crate's HTTP stack). Set a desktop User-Agent.
- **Extract:** `dom_smoothie` → returns an `Article { title, content, text_content, … }`. Feed `text_content` (clean main content) into the same chunk→embed pipeline. Title → `kb_items.title`.
- **JS-heavy pages (acceptable limitation):** `reqwest` fetches static HTML only — SPAs that render client-side will yield little content. **Acceptable for v1** (D-13 scope). Surface a `failed` badge with reason "conteúdo não encontrado (página dinâmica)" rather than silently indexing an empty page. Headless-browser rendering is out of scope.
- **"Queryable within one minute" (KB-04):** completion is signaled by the `Indexed` Channel event + Sonner toast (D-11), not a timer. Fetch+extract+chunk+embed for a typical article (a few hundred chunks max) is well under a minute on local ONNX; the success criterion is event-driven.

## Frontend Decisions (Claude's Discretion → recommendations)

- **Tree (D-09):** `react-arborist 3.10.5` — proven, complete, DnD + virtualization built in; the notes/folders tree is simple. (Headless Tree is the alternative if cross-tree DnD becomes a requirement.)
- **Table (D-09):** `@tanstack/react-table 8.21.3` with shadcn data-table; faceted filters on `kind` and `status` columns (the shadcn faceted-filter recipe). Status badge cell is a pure selector off `indexingStore` reconciled against the `status` DB column.
- **Editor (D-07):** `@uiw/react-codemirror 4.25.10` + `@codemirror/lang-markdown 6.5.0`. For the Obsidian-style live-preview feel, the markdown extension highlights inline; a separate `react-markdown` preview pane (already a dep) can render alongside if a split preview is wanted. Do NOT pull `@uiw/react-markdown-editor` (it's a heavier opinionated bundle) — compose the primitives to honor D-08 (no markdown mutation).
- **Citation node (D-04):** `react-markdown` `components={{ /* custom text or rehype plugin to wrap [n] */ }}`. A small `rehype` plugin (or a text-splitting component) detects `[\d+]` and wraps it in a clickable `<sup>`/span resolving to the per-message citation map.

## Common Pitfalls

### Pitfall 1: rusqlite 0.34+ breaks the sqlite-vec load
**What goes wrong:** A routine `cargo update`/dependency bump to `rusqlite >= 0.34` makes `std::mem::transmute(sqlite3_vec_init ...)` into `sqlite3_auto_extension` fail to compile or misbehave — the signature changed (now expects `RawAutoExtension` via `register_auto_extension`).
**Why it happens:** sqlite-vec's published Rust example targets the pre-0.34 API; the project is on 0.31.
**How to avoid:** Pin `rusqlite = "0.31"` in BOTH the root crate (already) and `nexusai-kb`. Pin `sqlite-vec = "=0.1.10-alpha.4"`. Add a code comment in `vector.rs`. If a future upgrade is forced, switch to `register_auto_extension` with the `RawAutoExtension` cast (issue #206).
**Warning signs:** Compile error around `transmute`, or `vec_version()` query failing at runtime.

### Pitfall 2: fastembed first-run requires network; offline-check bug
**What goes wrong:** (a) The ONNX model must download on first use — so a brand-new install is NOT offline-capable until the model is cached. (b) Known fastembed issue (#218/#30): after the v3 change, some versions still perform a network "check" against the hosted model even when cached, hanging behind a firewall.
**Why it happens:** Model weights aren't bundled; an HF freshness check can run at init.
**How to avoid:** Treat model download as a **one-time setup step** (download on first KB use with a progress UI; D-11's progress infra covers it). Persist to a Tauri app-data `cache_dir` via `with_cache_dir`. Verify the pinned fastembed version (5.17.2) loads from cache with the network OFF during testing (offline test — see Validation Architecture criterion #5). If the offline-check bug bites, set `HF_HUB_OFFLINE`/pin a version known to respect cache. **This does NOT violate success criterion #5** — that criterion is about *querying already-indexed content* offline, which is satisfied (embedding a query + KNN + BM25 are all local once the model is cached).
**Warning signs:** Init hangs with no network; first-run latency spike (~50-100MB download for E5-small).

### Pitfall 3: vec0 dimension is fixed at table creation
**What goes wrong:** Switching embedding models (e.g. E5-small 384 → E5-base 768) silently mismatches the `vec0(embedding float[384])` table; inserts/queries fail or corrupt.
**How to avoid:** Treat the model + dimension as a schema constant. If the model changes, that's a migration: drop+recreate `kb_vectors` and **re-embed everything**. Record the model name in `schema_meta` so a mismatch is detectable on startup.
**Warning signs:** Dimension-mismatch errors from sqlite-vec; nonsense KNN results after a model swap.

### Pitfall 4: bm25() sign + score-vs-rank fusion
**What goes wrong:** Naively combining raw `bm25()` (negative) with cosine distance (positive, smaller=closer) produces garbage rankings.
**How to avoid:** Use **RRF over ranks**, not raw scores (Pattern 3). Never normalize/add the raw scores. `ORDER BY bm25(kb_fts)` ASC (more negative first); `ORDER BY distance` ASC for vectors; then fuse positions.
**Warning signs:** Keyword-obvious hits ranking below irrelevant semantic neighbors.

### Pitfall 5: FTS5/vec0 not isolated → can't reconcile status on reload
**What goes wrong:** Dropped Channel events leave a row stuck "indexing" forever in the UI.
**How to avoid:** The `status` column in `kb_items` is the durable source of truth (D-11); the `indexingStore` is transient. On app load, hydrate badges from the DB `status`, not from in-memory state. Any item left `indexing` at startup → mark `failed`/offer retry.

### Pitfall 6: PT-BR diacritics + tokenizer
**What goes wrong:** `porter` (English) stemming or ASCII-only tokenizing mangles "ção/ã/é" → BM25 misses obvious PT-BR matches.
**How to avoid:** Use FTS5 `tokenize='unicode61'` (Unicode case-fold + diacritic removal). For embeddings, MultilingualE5 handles PT-BR natively; remember the `passage:`/`query:` prefixes.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@xenova/transformers` in Node sidecar (CLAUDE.md) | `fastembed` (ONNX) in Rust | Phase 3 decision (D-14, supersedes CLAUDE.md note) | No sidecar process for KB; simpler, all-Rust embedding. |
| Vector-only RAG | Hybrid BM25 + vector + RRF | Industry standard 2025-26 | Better recall on names/acronyms/exact terms that pure embeddings miss. |
| `readability`/`readable-readability` crates | `dom_smoothie` (Readability port on `dom_query`) | 2025 | Older crates known to fail content extraction; dom_smoothie is the current best-in-class. |
| rusqlite pre-0.34 `sqlite3_auto_extension` transmute | `register_auto_extension` (0.34+) | rusqlite 0.34 | We stay on 0.31 → keep transmute; documented trap if upgraded. |

**Deprecated/outdated for this phase:**
- `@xenova/transformers` sidecar — NOT used in Phase 3 (Phase 7 concern).
- TipTap/WYSIWYG for notes — discarded (D-08 fidelity).

## Open Questions

1. **Local-model citation-ID fidelity (D-05/D-06)**
   - What we know: Frontier models cite `[n]` reliably; smaller/local models vary.
   - What's unclear: Whether the user's chosen chat models (OpenRouter/OpenAI/Gemini — all cloud in this app, not truly "local LLM") emit stable markers. NOTE: the *LLM* here is still a cloud chat model (Phase 2); only *embeddings* are local. So citation fidelity is likely HIGH (these are capable models), and D-06's fallback is a safety net, not the expected path.
   - Recommendation: Build the retriever→citation-map and source-cards FIRST (always correct, model-independent), then layer inline `[n]` markers. Ship cards as the floor.

2. **fastembed exact offline behavior on 5.17.2**
   - What we know: Cached models load locally; some versions ran an HF check (#218).
   - What's unclear: Whether 5.17.2 specifically still checks.
   - Recommendation: Pin 5.17.2, write an offline integration test (network disabled) before relying on it; have `HF_HUB_OFFLINE` as a fallback.

3. **`dom_smoothie` exact current version / API stability**
   - Recommendation: Confirm latest version + `Article` field names at implementation time (it's young but the best option). Fallback: `article_scraper` or `dom_content_extraction`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust toolchain / cargo | Whole crate | ✓ | `cargo search` ran successfully | — |
| `rusqlite` (bundled SQLite incl. FTS5) | vector + BM25 | ✓ | 0.31 in `src-tauri/Cargo.toml`, `bundled` feature | — |
| ONNX Runtime | fastembed inference | ✓ (bundled) | via `ort` (bundled by fastembed; no system install) | — |
| Network (first run only) | fastembed model download | ⚠️ one-time | — | Pre-bundle model file / document offline-setup step |
| Vitest | Frontend tests | ✓ | `vitest 4.1.9`, config at `vitest.config.ts`, tests in `tests/**` | — |
| `cargo test` (Rust unit tests) | `nexusai-kb` tests | ✓ | workspace builds | — |

**Missing dependencies with no fallback:** None blocking — all required tooling is present.
**Missing dependencies with fallback:** First-run model download needs network (one-time); mitigate by treating it as an explicit setup step (Pitfall 2). npm packages (`react-arborist`, `@uiw/react-codemirror`, `@codemirror/lang-markdown`, `@tanstack/react-table`, `sonner`) are NOT yet installed — `npm install` step required.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 (frontend) + `cargo test` (Rust `nexusai-kb`) |
| Config file | `vitest.config.ts` (jsdom, globals, `tests/setup.ts`) |
| Quick run command | `npm run test` (→ `vitest run`) for frontend; `cargo test -p nexusai-kb` for Rust |
| Full suite command | `npm run test && cargo test --workspace` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KB-01 | File parse + chunk produces N chunks for a fixture PDF/MD/TXT/DOCX | unit (Rust) | `cargo test -p nexusai-kb chunk` | ❌ Wave 0 |
| KB-02 | RRF fuses BM25+vector ranks deterministically (fixed input → fixed order) | unit (Rust) | `cargo test -p nexusai-kb rrf` | ❌ Wave 0 |
| KB-02 | sqlite-vec round-trip: insert vectors, KNN returns nearest rowid | unit (Rust, in-memory db) | `cargo test -p nexusai-kb vector` | ❌ Wave 0 |
| KB-03 | NoteEditor renders + emits raw markdown unchanged (no mutation, D-08) | component (Vitest) | `npm run test -- kb-notes-editor` | ❌ Wave 0 |
| KB-04 | dom_smoothie extracts main content from a saved HTML fixture | unit (Rust) | `cargo test -p nexusai-kb scrape` | ❌ Wave 0 |
| KB-05 | ItemsTable faceted filter narrows by status/kind | component (Vitest) | `npm run test -- kb-items-table` | ❌ Wave 0 |
| KB-05 | IndexStatusBadge reflects indexingStore state transitions | component (Vitest) | `npm run test -- kb-indexing-store` | ❌ Wave 0 |
| KB-06 | `query_kb` retrieval callable with no agent/owner scoping (single shared index) | unit (Rust) | `cargo test -p nexusai-kb query` | ❌ Wave 0 |
| KB-07 | Embedding runs with network DISABLED once model cached (offline) | integration (Rust, `#[ignore]` gated, network-off) | `cargo test -p nexusai-kb offline -- --ignored` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cargo test -p nexusai-kb` (Rust touched) and/or `npm run test -- <kb file>` (frontend touched).
- **Per wave merge:** `npm run test && cargo test --workspace`.
- **Phase gate:** Full suite green + the offline embedding test (criterion #5) passing before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `src-tauri/crates/nexusai-kb/src/chunk.rs` tests — KB-01 chunk boundaries/size/overlap (fixtures: a small PDF, .docx, .md, .txt in `crates/nexusai-kb/tests/fixtures/`)
- [ ] `vector.rs` test — KB-02 sqlite-vec in-memory KNN round-trip
- [ ] `search.rs` test — KB-02 RRF determinism + FTS5 bm25 ordering
- [ ] `ingest.rs` test — KB-04 dom_smoothie HTML fixture extraction
- [ ] `embed.rs` offline integration test — KB-07 / criterion #5 (network-off, model pre-cached; `#[ignore]`-gated for CI without the model)
- [ ] `tests/kb-indexing-store.test.ts` — D-11 store transitions (pending→indexing→indexed→failed)
- [ ] `tests/kb-items-table.test.tsx` — D-09/D-10 faceted filters
- [ ] `tests/kb-notes-editor.test.tsx` — D-08 no-mutation invariant
- [ ] Fixtures dir: tiny sample PDF/DOCX/MD/TXT + a saved HTML page (for deterministic, offline tests)

## Sources

### Primary (HIGH confidence)
- [sqlite-vec Rust guide (Alex Garcia)](https://alexgarcia.xyz/sqlite-vec/rust.html) — auto_extension load, zerocopy bytes
- [sqlite-vec demo.rs (verbatim)](https://github.com/asg017/sqlite-vec/blob/main/examples/simple-rust/demo.rs) — vec0 create/insert/KNN code
- [sqlite-vec issue #206 — rusqlite 0.34 compat](https://github.com/asg017/sqlite-vec/issues/206) — transmute breaks at 0.34
- [fastembed-rs README](https://github.com/Anush008/fastembed-rs) — TextEmbedding init, cache_dir, E5 prefixes, ORT bundling
- [fastembed EmbeddingModel enum (docs.rs)](https://docs.rs/fastembed/latest/fastembed/enum.EmbeddingModel.html) — 46 variants, MultilingualE5Small/Base/Large
- [SQLite FTS5 docs](https://sqlite.org/fts5.html) — bm25(), unicode61/porter tokenizers, external-content + triggers
- `cargo search` / `npm view` on 2026-06-27 — exact current versions
- Existing code: `nexusai-chat/src/streaming.rs` (Channel pattern), `schema.rs` (specta types), `src/lib/stores/chat.ts`, `src/lib/db/migrations/0001_chat.sql`, `vitest.config.ts`, `tests/*`

### Secondary (MEDIUM confidence)
- [fastembed offline issue #218](https://github.com/qdrant/fastembed/issues/218) & [#30](https://github.com/Anush008/fastembed-rs/issues/30) — offline check gotcha
- [dom_smoothie](https://github.com/niklak/dom_smoothie) + [Comparing 13 Rust HTML-extraction crates](https://emschwartz.me/comparing-13-rust-crates-for-extracting-text-from-html/) — scraping choice
- [Reciprocal Rank Fusion explained (Serghei)](https://blog.serghei.pl/posts/reciprocal-rank-fusion-explained/) & [APXML RRF](https://apxml.com/courses/advanced-vector-search-llms/chapter-3-hybrid-search-approaches/rrf-fusion-algorithms) — RRF k=60 formula
- [docx-rust (docs.rs)](https://docs.rs/docx-rust) / [pdf-extract (crates.io)](https://crates.io/crates/pdf-extract) — file parsing crates
- [react-arborist](https://github.com/brimdata/react-arborist) vs [Headless Tree](https://medium.com/@lukasbach/headless-tree-and-the-future-of-react-complex-tree-fc920700e82a) — tree choice
- [@uiw/react-codemirror](https://www.npmjs.com/package/@uiw/react-codemirror) — notes editor

### Tertiary (LOW confidence — validate at implementation)
- `cairn-search 0.1.0` / `lexa-core` (crates.io) — referenced as reference impls, NOT recommended as deps (too new)
- `dom_smoothie` exact current version/API field names — confirm at impl time

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via registries on 2026-06-27; picks align with CLAUDE.md locked decisions.
- Architecture/patterns: HIGH — sqlite-vec + fastembed code verified verbatim from official sources; Channel/schema patterns copied from shipped Phase 2 code.
- sqlite-vec alpha API: MEDIUM — pinned version known-good on rusqlite 0.31; alpha may change (mitigated by D-16 isolation).
- fastembed offline behavior: MEDIUM — must be verified with an offline test before relying on criterion #5.
- Scraping/file-parse crates: MEDIUM — maintained but young; fallbacks documented.

**Research date:** 2026-06-27
**Valid until:** ~2026-07-27 (30 days for stable libs; sqlite-vec alpha and fastembed move faster — re-verify versions if implementation starts later)
</content>
</invoke>

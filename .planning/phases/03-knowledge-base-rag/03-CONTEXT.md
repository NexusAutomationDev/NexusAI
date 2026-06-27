# Phase 3: Knowledge Base + RAG - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers a personal knowledge base with local RAG. Users can import local files (PDF, .md, .txt, .docx), create and organize Markdown notes in folders, and save URLs that get scraped and indexed — then ask the LLM questions answered FROM that knowledge, with the response citing the source chunk. All embeddings are computed locally via fastembed-rs (ONNX), retrieval is hybrid (BM25 + sqlite-vec), and the entire KB is shared across agents (no per-agent silos). A file-explorer-style browser shows all KB items with their indexed status.

Out of scope: Gmail/Calendar as KB sources (Phase 5), agent orchestration consuming the KB (Phase 7), and the central dashboard (Phase 8). Phase 3 builds the shared RAG layer those later phases depend on.

</domain>

<decisions>
## Implementation Decisions

### RAG Query Surface (KB-02, success criterion #1)
- **D-01:** RAG is integrated INTO the existing Phase 2 chat module — not a separate KB-chat view. A toggle / @-mention ("usar KB") opts a normal chat message into KB grounding. Reuses the shipped streaming pipeline (Channel API `startStream`), `MessageList`, `MessageBubble`, `MarkdownRenderer`, and real-time persistence.
- **D-02:** The currently-stubbed `/kb` route is NOT a second chat surface — it hosts the KB browser/management UI (see D-09). It may later expose a shortcut into the same chat engine, but Phase 3 keeps a single chat codepath.
- **D-03:** A KB-scope selector lives beside the existing per-message model picker in `MessageInput`. Whether KB grounding is on is tracked per-message (conversations can mix grounded and ungrounded messages).

### Citations (success criterion #1: "response CITES the source chunk")
- **D-04:** Inline numbered footnotes `[1]`, `[2]` rendered as clickable spans via a custom react-markdown node, PLUS source cards below the answer showing filename + section/page. This is the primary, success-criterion-satisfying pattern.
- **D-05:** The LLM is prompt-instructed to emit citation IDs that map to chunk metadata from the hybrid retriever (BM25 + sqlite-vec already produces chunk IDs). A citation-ID → chunk-metadata lookup is attached per message.
- **D-06:** Fallback if local-model citation-ID fidelity proves weak: degrade to source-cards-only (no inline markers). Click-to-open-chunk-in-source and hover previews are DEFERRED to a 3.x enhancement (needs a per-filetype source viewer).

### Notes Editor (KB-03)
- **D-07:** CodeMirror 6 via `@uiw/react-codemirror` + `@codemirror/lang-markdown`. Chosen because raw Markdown IS the stored source of truth → perfect fidelity for RAG chunking (WYSIWYG editors serialize from a tree and leak edge-case data). Gives the Obsidian-style live-preview feel and the dense/minimal Linear/Raycast aesthetic natively.
- **D-08:** Notes are first-class KB items: stored as clean Markdown on disk, embedded via fastembed-rs, and retrieved alongside imported files. The editor must NOT mutate/normalize the user's Markdown beyond what they typed.

### KB Browser Layout (KB-05, KB-03 folders)
- **D-09:** Hybrid two-pane layout, reusing the existing resizable two-column split from the chat module (`react-resizable-panels`):
  - **Left:** collapsible folder/notes tree (headless tree lib — `react-arborist` or `@headless-tree/react`) for KB-03 folder organization.
  - **Right:** flat, filterable "All Items" view (TanStack Table v8 + shadcn data-table + faceted filters) listing files, notes, and URLs with type icon + indexed-status badge.
- **D-10:** Each item shows its type (file/note/URL) and indexed status clearly. Status is filterable; folders apply only to notes (files/URLs live in the flat view, not forced into the tree).

### Ingestion & Indexing UX (KB-01, KB-04, success criteria #4 & #5)
- **D-11:** Hybrid feedback model, all derived from a single Zustand `indexingStore` keyed by item ID, fed by Channel API progress events (same streaming pattern as Phase 2):
  - **Per-item Badge** (shadcn `Badge`): pending → indexing → indexed → failed. This is the durable source of truth, backed by a `status` column in SQLite so it reconciles on app reload / dropped events.
  - **Global progress panel** (shadcn `Progress` + "3 de 8"): shown for batch imports; item-count based, indeterminate bar when chunk total is unknown.
  - **Sonner toast**: for the discrete URL-paste flow (KB-04 "queryable within one minute", resolved by the Channel completion event, not a fixed timer) and for terminal failures.
- **D-12:** Failure handling: `failed` is a terminal `Badge variant="destructive"` state with a per-row Retry/Re-index action and a tooltip carrying a short error reason (e.g., "scrape timed out", "encoding não suportado"). Re-index is idempotent in Rust — delete the item's existing chunks/vectors before re-embedding.
- **D-13:** Import entry points / empty state: a central dashed drop zone (primary affordance: "Arraste PDF, Markdown, DOCX ou TXT aqui") + a "Escolher arquivos" button (file picker) + a URL paste input with an "Adicionar" button. No demo/sample-data seeding (local-first, private data). One headline, one subtle glyph, the drop zone, and the two fallback actions.

### Embedding & Language (KB-07)
- **D-14:** Embeddings computed locally via fastembed-rs (ONNX), zero external API calls — KB queries against already-indexed content must work fully offline (success criterion #5). This is LOCKED by requirement, not a discussion outcome.
- **D-15:** CONSTRAINT for the embedding-model choice (left to research): the model MUST handle Brazilian Portuguese content well, since the user's KB content is largely in PT-BR. Prefer a multilingual model (e.g. `paraphrase-multilingual-*` / multilingual-e5 family) over English-only models like `bge-small-en` — researcher to confirm the best fastembed-supported option balancing PT-BR quality vs download size.

### Shared KB (KB-06)
- **D-16:** The knowledge base is a single shared store — no per-agent isolation. The retrieval interface must be callable by any agent (Phase 7) against the same index. All vector operations stay isolated behind a single Rust module (sqlite-vec is alpha; absorb API changes there).

### Claude's Discretion
- Chunking strategy (chunk size, overlap, paragraph- vs token-based) — researcher/planner decide, respecting clean Markdown boundaries for notes.
- URL scraping engine and main-content extraction approach (Readability-style vs full HTML; handling of JS-heavy pages).
- Exact fastembed model selection (within the PT-BR / multilingual constraint of D-15).
- SQLite schema specifics for KB tables (items, chunks, vectors, folders) — maintain normalized structure + a `status` column per item.
- Citation-ID prompt wording and the markdown custom-node implementation details.
- Tree library final pick (`react-arborist` vs `@headless-tree/react`) and table faceted-filter wiring.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Knowledge Base (KB-01 through KB-07) — all 7 requirements mapped to this phase; success criteria are the acceptance bar
- `.planning/ROADMAP.md` §Phase 3: Knowledge Base + RAG — goal, 5 success criteria, dependency on Phase 2

### Architecture & Stack
- `CLAUDE.md` §Technology Stack — sqlite-vec (vector), rusqlite (extension loading), Drizzle ORM proxy, shadcn/ui, Zustand + TanStack Query. NOTE: the CLAUDE.md table mentions `@xenova/transformers` in a Node sidecar for embeddings — this is SUPERSEDED for Phase 3 by KB-07 (fastembed-rs ONNX in Rust, no sidecar). The sidecar is a Phase 7 concern.
- `CLAUDE.md` §Critical Architecture Constraint: The Tauri Webview Boundary — Channel API for streaming progress, key/data security, no Node-only deps in webview.
- `.planning/STATE.md` §Blockers/Concerns — "sqlite-vec is alpha; isolate all vector ops behind a single Rust module interface" (applies to D-16).

### Prior Phase Context (established patterns to reuse)
- `.planning/phases/02-llm-chat/02-CONTEXT.md` — chat streaming (Channel API), `MessageInput`/`MessageBubble`/`MarkdownRenderer`, react-markdown ^10, per-message model picker, resizable two-column split, Zustand + Tauri Store persistence. D-01..D-04 and D-09 build directly on these.
- `.planning/phases/01-foundation/01-CONTEXT.md` — Sidebar nav, AppShell layout, shadcn/ui setup, Drizzle migration pattern.

### Existing code (scaffold)
- `src-tauri/crates/nexusai-kb/src/lib.rs` — Phase 3 stub crate (currently `// Phase 3 stub — implementation deferred`).
- `src/routes/kb/index.tsx` — `/kb` route stub (ModuleStub placeholder).
- `src/lib/db/schema.ts` — Drizzle schema; extend with KB tables following the Phase 2 conversations/messages/attachments pattern.

### No external ADRs/specs yet — requirements + decisions above are authoritative

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Chat streaming infra** (`src/routes/chat/`, `nexusai-chat` crate) — Channel API `startStream`, `MessageList`, `MessageBubble`, `MarkdownRenderer`. RAG grounding (D-01) extends this rather than building new chat plumbing.
- **`react-markdown` ^10** — already a dependency; the citation custom-node (`[n]` → clickable span) plugs into the existing `MarkdownRenderer`.
- **Resizable two-column split** (`react-resizable-panels`, used in chat) — reused for the KB browser hybrid layout (D-09).
- **shadcn/ui primitives** — Badge, Progress, Sonner (toast), Input, Button, Tooltip already available for ingestion UX (D-11..D-13) with zero new deps.
- **Zustand + Tauri Store pattern** (`src/lib/stores/`) — `indexingStore` (D-11) follows the same load/set pattern as `chat.ts`/`settings.ts`.
- **rusqlite** (`src-tauri/Cargo.toml`, v0.31 bundled) — already present; supports `sqlite3_auto_extension` to load sqlite-vec.

### Established Patterns
- **Channel API streaming** (Rust → frontend) — Phase 2 proved it for tokens; Phase 3 reuses it for indexing progress events.
- **Drizzle schema + migrations** (`src/lib/db/schema.ts`, `migrations/`) — add KB tables (items, chunks, vectors metadata, folders) in a new migration file.
- **Isolate-alpha-lib-behind-Rust-module** (STATE.md decision) — all sqlite-vec calls behind one module in `nexusai-kb`.

### Integration Points
- **Crate**: implement `src-tauri/crates/nexusai-kb/` (ingestion, chunking, fastembed-rs embeddings, sqlite-vec + BM25 hybrid retrieval, scraping).
- **Route**: build out `src/routes/kb/` from stub into the hybrid browser (tree + table).
- **Chat route**: add KB-scope selector to `MessageInput`, citation rendering to `MessageBubble`/`MarkdownRenderer`, KB flag to chat store + stream payload.
- **Sidebar**: enable the KB module (`implemented: true`) following the Phase 2 chat-enable pattern.
- **Schema**: extend `src/lib/db/schema.ts` with KB tables including a per-item `status` column.

</code_context>

<specifics>
## Specific Ideas

- **Citações estilo Perplexity/AnythingLLM:** footnotes `[1]` inline + cards de fonte abaixo — "evidência a um clique" gera confiança.
- **Editor estilo Obsidian (live preview), não Word:** markdown cru como verdade, fidelidade pro RAG acima de riqueza visual.
- **Navegador híbrido:** árvore de pastas só pra notas; arquivos e URLs na view plana filtrável — não forçar itens sem hierarquia natural numa árvore.
- **Um só store de indexação:** badges, progresso e toasts são todos seletores puros de um `indexingStore` Zustand alimentado pelo Channel API — evita drift entre as três superfícies.
- **PT-BR em primeiro lugar:** o modelo de embedding precisa ser bom em português brasileiro (preferir multilíngue), porque o conteúdo da KB do usuário é majoritariamente em PT-BR.

</specifics>

<deferred>
## Deferred Ideas

- **Click-to-open chunk no documento de origem + hover preview** — melhoria 3.x; precisa de visualizador por tipo de arquivo (PDF page anchor, scroll-to em notas).
- **Gmail/Calendar como fontes da KB** — Phase 5.
- **Consumo da KB por agentes / compartilhamento orquestrado** — a interface compartilhada é construída aqui (D-16), mas o uso por agentes é Phase 7.
- **Sidecar Node.js para embeddings (@xenova/transformers)** — explicitamente NÃO usado no Phase 3 (fastembed-rs em Rust cobre KB-07); sidecar é Phase 7.
- **WYSIWYG visual (TipTap)** — descartado pra notas por risco de fidelidade de serialização do markdown; reconsiderar só se WYSIWYG virar requisito de produto.

</deferred>

---

*Phase: 03-knowledge-base-rag*
*Context gathered: 2026-06-26*

# Project Research Summary

**Project:** NexusAI — Desktop AI Super-App
**Domain:** Tauri v2 local-first desktop AI productivity hub
**Researched:** 2026-06-25
**Confidence:** MEDIUM-HIGH

## Executive Summary

NexusAI is a Tauri v2 desktop app (Windows + macOS) that unifies LLM chat, knowledge base/RAG, Gmail integration, notes, calendar, agent orchestration, MCP management, LLM benchmarking, and automations into a single local-first workspace. The research is unambiguous on one architectural constraint that drives every other decision: the Tauri webview has no Node.js, so all business logic (LLM API calls, database access, file I/O, OAuth, agent spawning) must live in the Rust backend. The frontend is a thin display layer communicating exclusively over typed IPC. The recommended architecture is a layered process model: React 19 webview → Rust core (plugin-per-module) → Node.js sidecar (AI SDK v7 agent orchestration) → MCP server child processes.

The recommended stack is React 19 + Vite + Zustand + TanStack Query on the frontend; Rust with reqwest, rusqlite, sqlite-vec, async-openai, and tauri-plugin-sql in the core; and a Node.js sidecar running Vercel AI SDK v7 for agent orchestration. SQLite is the single source of truth for all structured data; sqlite-vec (alpha but the only viable embedded option) provides vector search for RAG. Gmail uses OAuth2 PKCE exclusively — Google eliminated basic auth in March 2025. MCP client/server implementation requires a custom Rust approach since no mature Tauri-native MCP crate exists yet.

The three highest risks are: (1) IPC JSON serialization overhead and a known Tauri memory leak bug in event emission — both must be addressed in Phase 1 by using the Channel API for streaming; (2) distribution is blocked by macOS notarization requirements (Apple Developer account, specific entitlements) and there are permanent consequences if the Tauri updater private key is lost — both must be set up before the first distributable build; (3) RAG quality depends almost entirely on chunking strategy and hybrid retrieval, not the LLM — getting this wrong means users will distrust the knowledge base and churn.

---

## Key Findings

### Recommended Stack

| Layer | Technology | Version | Confidence | Notes |
|-------|------------|---------|------------|-------|
| Frontend framework | React 19 + Vite | 19 / 6.x | HIGH | Official Tauri recommendation; largest AI app ecosystem |
| Type safety | TypeScript | 5.5+ | HIGH | Required for tauri-specta end-to-end type generation |
| Styling | Tailwind CSS + shadcn/ui | 4.x / latest | HIGH | Zero-runtime; no Node.js deps; works in webview |
| UI state | Zustand | 5.x | HIGH | Zero Node.js deps; module-level stores; used in Tauri production apps |
| Async/IPC data | TanStack Query | 5.x | HIGH | Treats Tauri invoke() like API endpoints; caching + loading states |
| Routing | TanStack Router | 1.x | HIGH | Multi-module app needs client-side routing |
| Rich text | TipTap | 3.x | MEDIUM | Best React rich-text editor; no Node.js deps |
| LLM HTTP client | reqwest + async-openai | 0.12 / 0.27+ | HIGH | Only viable approach for CORS + API key security |
| Async runtime | tokio | 1.x | HIGH | Tauri's runtime; all async ops |
| IPC type gen | tauri-specta | 2.x | HIGH | Eliminates manual TypeScript type maintenance |
| SQLite (Rust) | rusqlite | 0.31+ | HIGH | Direct access for vector/FTS operations |
| SQLite (frontend) | tauri-plugin-sql + Drizzle ORM | 2.x / 0.36+ | MEDIUM-HIGH | Proxy pattern validated; migration workaround required |
| Vector search | sqlite-vec | 0.1.9+ | MEDIUM | Alpha; only embedded option; isolate behind Rust module |
| Local embeddings | fastembed-rs | latest | HIGH | Local ONNX model (BGE-small); offline; no API cost |
| Agent orchestration | Vercel AI SDK v7 (Node.js sidecar) | 7.x | MEDIUM | Sidecar adds complexity; SDK itself is excellent |
| Gmail auth | OAuth2 PKCE (yup-oauth2) | latest | HIGH | Mandatory since March 2025; validated by Velo open-source app |
| Gmail API | google-gmail1 (Rust crate) | latest | HIGH | Full thread/label/attachment access |
| Email (non-Gmail) | async-imap + lettre | 0.9 / 0.11 | HIGH | Rust-native IMAP/SMTP |
| Secrets storage | OS Keychain (keyring crate) | latest | HIGH | macOS Keychain + Windows Credential Manager |
| MCP client/server | Custom Rust JSON-RPC 2.0 | — | MEDIUM | tauri-plugin-mcp-client is v0.1.0/4 commits — use as reference only |
| Linting/formatting | Biome | 1.x | HIGH | Replaces ESLint + Prettier; Rust-based tooling |

### Expected Features

**Must have (table stakes):**

- Streaming LLM responses with markdown + syntax highlighting
- Conversation history persisted across sessions
- Model selector per conversation (multi-provider)
- System prompt / persona configuration
- File and image attachment input
- Stop generation button and token/cost tracking
- Local file ingestion into KB (PDF, DOCX, Markdown, TXT)
- Semantic search over knowledge base with source citation
- Note editor with Markdown, folders, tags, full-text search
- OAuth 2.0 Gmail auth (mandatory since March 2025)
- Gmail inbox read, thread view, compose, reply, label nav, search, AI summarization
- API key config UI for all LLM providers
- Command palette (Cmd+K) and keyboard-first navigation
- Dark/light mode

**Should have (differentiators):**

- Side-by-side LLM benchmarking (same prompt across N models with scoring) — no desktop app does this locally
- Shared KB context accessible to all agents — no competitor does cross-agent KB today
- MCP management UI with per-tool enable/disable and health monitoring
- NexusAI exposed as an MCP server (bidirectional MCP)
- Email and calendar content indexed into KB
- Hybrid retrieval (BM25 + vector + rerank) for production-quality RAG
- Basic agent orchestration with MCP tools and run history
- Visual trigger-action automation builder with scheduler
- @ mentions to inject KB chunks mid-conversation

**Defer to v2+:**

- Graph view for KB (needs force-layout engine; visual noise at 1000+ notes)
- Visual agent graph builder (most complex feature in the app)
- Calendar write access / NLP event creation
- Human-in-the-loop interrupt UI for agents
- Advanced multi-agent topologies (supervisor + worker)
- AI draft in user's voice
- Voice input/output

### Architecture Approach

NexusAI uses a layered process architecture where the webview is a thin display layer, the Rust core is organized as per-domain plugins, and a Node.js sidecar handles AI SDK v7 agent orchestration. All state is owned by Rust; the frontend subscribes to Tauri events and IPC results. One SQLite database (WAL mode) is the single source of truth. Secrets live exclusively in the OS Keychain.

**Major components:**

1. **Webview (React 19)** — UI rendering and display state only. Zero business logic. State layers: `useState` → Zustand (UI/session) → TanStack Query (IPC data from Rust).
2. **Rust Core (plugin-per-module)** — all LLM API calls, database access, OAuth, process management. Background tasks (Gmail sync, automation scheduler, embedding ingestion) as tokio tasks. CPU-intensive work via `spawn_blocking()`.
3. **Node.js Sidecar (AI SDK v7)** — multi-step agent loops, tool calling, MCP integration. Communicates with Rust over local HTTP. Restartable independently of the main app.
4. **SQLite + sqlite-vec** — single `nexusai.db`. WAL mode. rusqlite for vector/FTS; tauri-plugin-sql for frontend CRUD. FTS5 for keyword search.
5. **MCP Server Child Processes** — spawned on-demand by Rust via JSON-RPC 2.0 over stdio. Process group tracking required for clean shutdown.
6. **OS Keychain** — all secrets. API keys and OAuth tokens never touch SQLite or the webview.

### Critical Pitfalls

1. **IPC JSON overhead + event emission memory leak** — Use the Channel API for ALL LLM token streaming, never `window.emit()`. The memory leak is an active wry bug (#12724) with no fix. Establish Channel API patterns in Phase 1.
2. **macOS notarization blocks distribution + updater private key loss is permanent** — Specific JIT entitlements required in `entitlements.plist` or app crashes on all user machines. Lost updater private key = all installed users permanently cut off from updates. Set up before the first build.
3. **RAG fails at chunking, not at the LLM** — 73% of RAG failures are at retrieval. Use semantic chunking, add metadata to every chunk, implement hybrid BM25+vector retrieval, limit to 3-5 chunks. Design before ingesting any documents.
4. **Agent infinite loops burn API budget and cause unintended actions** — Hard guardrails are mandatory: turn limit (25), wall-clock timeout (5 min), repetition detection, token budget, confirmation gates before destructive actions. Must exist before any tool-using agent is exposed.
5. **SQLite write contention under concurrent module activity** — Enable WAL mode on init, serialize writes through a single Tokio channel, set `busy_timeout`. Configure in Phase 1 before any module writes to the database.

---

## Implications for Roadmap

### Phase 1: Foundation + Shell
**Rationale:** IPC patterns, SQLite WAL configuration, OS Keychain, plugin-per-module structure, and distribution infrastructure (notarization, updater keypair) cannot be retrofitted cleanly. Everything else depends on these being correct from day one.
**Delivers:** Tauri project scaffold with all plugins registered, SQLite in WAL mode with schema + migrations, API key storage in OS Keychain, settings UI, Channel API streaming pattern established, basic SPA routing, CI with code signing, updater keypair backed up.
**Addresses:** API key config UI, dark/light mode, global hotkey
**Avoids:** Monolithic main.rs, std::sync::Mutex across await points, updater key loss, macOS notarization surprise, SQLite write contention

### Phase 2: LLM Chat Core
**Rationale:** Primary value driver and dependency for benchmarking, RAG chat, agent chat, and email summarization. Streaming architecture established here (Channel API) is reused everywhere.
**Delivers:** Streaming chat with markdown rendering, conversation history, model selector (OpenRouter/OpenAI/Gemini), system prompt config, file/image attachment, stop generation, token/cost tracking.
**Uses:** plugin-llm (reqwest + async-openai), Tauri Channel API, Zustand for chat state, TanStack Query for history
**Avoids:** IPC JSON overhead, event emission memory leak, LLM context rot in long sessions (sliding window summarization)

### Phase 3: Knowledge Base + RAG
**Rationale:** The KB is NexusAI's most distinctive architectural component and a dependency for agents, email indexing, and RAG chat. Building it after LLM chat validates the sqlite-vec + fastembed-rs stack early.
**Delivers:** Document ingestion pipeline (PDF, DOCX, Markdown, TXT), local embeddings via fastembed-rs (offline BGE-small), sqlite-vec vector storage, hybrid retrieval (BM25 FTS5 + vector + rerank), semantic search in chat with source citation, note editor (Markdown, folders, tags, backlinks, full-text search).
**Uses:** plugin-kb (rusqlite + sqlite-vec + fastembed-rs), tokio spawn_blocking for embedding, FTS5 virtual table
**Avoids:** Fixed-size chunking failure, concurrent vector write corruption, CPU-intensive Tokio blocking

### Phase 4: LLM Benchmarking
**Rationale:** Core differentiator with bounded scope. Builds on Phase 2's LLM infrastructure. Validates multi-model async dispatch before it is needed in agents. Self-contained enough to ship cleanly between the KB and Gmail phases.
**Delivers:** Side-by-side multi-model dispatch, scoring rubric (user-defined or AI judge), benchmark history + trend, export (CSV/JSON), latency + cost per model.
**Uses:** plugin-llm (extend for parallel dispatch), SQLite benchmark runs table, rate limit exponential backoff
**Avoids:** LLM rate limiting causing silent failures

### Phase 5: Gmail Integration
**Rationale:** High user value, but OAuth complexity should be tackled after the core loop is solid. Email content feeds into KB (requires Phase 3). Delta sync architecture must be designed up-front to avoid polling pitfalls.
**Delivers:** OAuth2 PKCE flow, inbox read + thread view, compose + reply, label nav, search, AI thread summarization, action item extraction, email content indexed to KB.
**Uses:** plugin-gmail (google-gmail1, yup-oauth2, keyring crate), Gmail API history.list for delta sync, KB ingestion pipeline from Phase 3
**Avoids:** OAuth token silent revocation (graceful invalid_grant handling), polling instead of delta sync, tokens in webview memory

### Phase 6: MCP Management
**Rationale:** MCP is the tool layer for agents and the extensibility layer for NexusAI. Must be working before agent orchestration can use external tools. Bidirectional MCP (NexusAI-as-server) is a major differentiator.
**Delivers:** MCP server list UI (add/remove/enable/disable), per-tool enable/disable, server health monitoring, env var management, NexusAI exposed as an MCP server.
**Uses:** plugin-mcp-client (custom Rust JSON-RPC 2.0), process group tracking for clean shutdown
**Avoids:** MCP process lifecycle chaos (orphaned subprocesses), unsanitized MCP commands, protocol version mismatches

### Phase 7: Agent Orchestration + Automations
**Rationale:** Most complex phase; depends on LLM chat (Phase 2), KB (Phase 3), and MCP (Phase 6). Agent guardrails must be designed before any tool-using agent is exposed to users.
**Delivers:** Node.js sidecar (AI SDK v7) spawn + lifecycle, basic agent with MCP tools, agent run log + cancel, visual trigger-action automation builder, scheduled automations (cron), automation run history, shared KB access across agents.
**Uses:** Node.js sidecar (AI SDK v7), plugin-automations (tokio scheduler + cron), plugin-mcp-client, plugin-kb
**Avoids:** Agent infinite loops (turn limit + timeout + repetition detection + token budget), sidecar port conflicts (ephemeral port assignment)

### Phase 8: Dashboard + Polish
**Rationale:** Integration phase tying all modules together. System tray, background service, cross-module notifications, and central dashboard.
**Delivers:** Central dashboard aggregating all modules, system tray + quick-access, background service for automations when window is hidden, cross-module notifications, performance tuning, platform testing (Windows WebView2 + macOS WKWebView).
**Uses:** tauri-plugin-background-service, tauri notification plugin, AppHandle.emit_all for cross-window sync
**Avoids:** Multi-window shared state race conditions, WebView2 vs WKWebView CSS divergence

### Phase Ordering Rationale

- Phase 1 before everything: IPC patterns and SQLite WAL mode cannot be retrofitted; distribution infrastructure must be set up before any real build.
- Phase 2 before Phase 3: streaming architecture and provider abstraction from plugin-llm are reused by RAG-augmented chat.
- Phase 3 before Phase 5: email indexing into KB depends on the ingestion pipeline being complete.
- Phase 3 before Phase 7: shared KB access is a core agent differentiator; agents without KB are just LLM wrappers.
- Phase 4 after Phase 2: benchmarking is self-contained and validates multi-model dispatch before agents need it; early differentiator to validate.
- Phase 6 before Phase 7: agents need tools, and MCP is the tool layer.
- Phase 7 last of major features: depends on every preceding phase; most complex.

### Research Flags

Phases needing deeper research during planning:

- **Phase 1 (Distribution):** macOS notarization entitlements and Windows EV cert Azure Key Vault signing pipeline have sharp edges. Research specific CI setup per platform before the first build.
- **Phase 3 (RAG):** Semantic chunking implementation and BM25 + vector merge strategies are not standardized. Research LlamaIndex node parsers and sqlite-vec + FTS5 hybrid merge approaches.
- **Phase 6 (MCP):** MCP spec version targeting and NexusAI-as-MCP-server protocol design need protocol-level research. Bidirectional MCP has sparse documentation.
- **Phase 7 (Agents):** AI SDK v7 sidecar ↔ Rust bridge communication pattern needs a prototype spike. Few published examples exist for this exact topology.

Phases with standard patterns (research-phase can be skipped):

- **Phase 2 (LLM Chat):** Streaming in Tauri is production-validated with published code examples.
- **Phase 4 (Benchmarking):** Builds on Phase 2; no novel patterns.
- **Phase 5 (Gmail):** Velo open-source Tauri email client is a complete reference implementation.
- **Phase 8 (Dashboard/Polish):** Standard Tauri patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Frontend + Zustand + Rust core are HIGH (official docs + production apps). sqlite-vec (alpha) and AI SDK v7 sidecar are MEDIUM. MCP implementation is LOW-MEDIUM. |
| Features | MEDIUM-HIGH | Table stakes verified against 8+ live products. Differentiator value is inferred from competitive gaps, not user validation yet. |
| Architecture | HIGH | Core Tauri patterns (plugin-per-module, Rust-side LLM calls, Channel API, OS Keychain) verified against official Tauri v2 docs and multiple production apps. Sidecar pattern for agents is MEDIUM. |
| Pitfalls | HIGH | Most findings from official Tauri GitHub issues, production post-mortems, and Google's own documentation. IPC memory leak is a confirmed active bug (#12724). |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **AI SDK v7 sidecar ↔ Rust bridge:** Few published examples of the exact bidirectional pattern. Needs a prototype spike in Phase 7 planning.
- **sqlite-vec API stability:** Alpha library; API may change before v1.0. Isolate all vector operations behind a single Rust module interface so a swap is possible without cascading changes.
- **fastembed-rs vs API embeddings quality:** BGE-small is local-first but Voyage AI (`voyage-3-large`) outperforms it by ~10% on MTEB. If RAG quality is unsatisfactory in Phase 3 testing, plan a fallback to embedding API calls.
- **MCP spec version targeting:** Pin to a specific MCP spec version (2025-06-18 or later) and document compatibility requirements for user-provided servers.
- **Google OAuth app verification:** Apps in "Testing" mode have 7-day refresh token expiry. Publishing to production requires Google review for Gmail scopes. This could gate Phase 5 externally — start the verification process early.
- **LangGraph vs AI SDK v7 sidecar conflict:** ARCHITECTURE.md recommends Python + LangGraph; STACK.md recommends Node.js + AI SDK v7. Recommendation: start with AI SDK v7 (TypeScript, no Python bundling complexity). Revisit LangGraph only if complex state machine graphs are needed beyond AI SDK v7's capabilities.

---

## Sources

### Primary (HIGH confidence)

- Tauri v2 official docs (v2.tauri.app) — architecture, IPC, plugins, sidecar, state management, signing, updater
- Vercel AI SDK v7 release + migration guide (vercel.com, ai-sdk.dev) — agent orchestration, MCP integration
- Google OAuth for Native Apps (developers.google.com) — PKCE flow, token lifecycle
- Google Workspace Admin docs — Gmail OAuth mandate (March 2025)
- Velo open-source Tauri email client (github.com/avihaymenahem/velo) — Gmail PKCE + REST API production reference
- Tauri GitHub issues #12724, #9190, #11915 — memory leak in event emission (active bug)
- Tauri GitHub issues #11754, #11992 — Windows EV cert signing bug, notarization with external binaries
- sqlite-vec GitHub + author docs (alexgarcia.xyz) — embedded vector search
- fastembed-rs GitHub (Anush008/fastembed-rs) — local ONNX embeddings in Rust
- MCP Stdio transport security audit (VentureBeat) — sanitization requirement

### Secondary (MEDIUM confidence)

- Streaming Gemini in Tauri (dev.to/hiyoyok) — streaming token pattern
- Drizzle + SQLite in Tauri (dev.to/huakun, keypears.com) — proxy pattern + migration workaround
- Offline vector database with Tauri (whoisryosuke.com) — sqlite-vec production use case
- Local-first AI blueprint with Tauri (medium.com) — layered process architecture
- dannysmith/tauri-template (GitHub) — React + Zustand + TanStack Query in Tauri
- RAG production guide 2026 (lushbinary.com) — chunking + hybrid retrieval
- AI agent infinite loop analysis (fixbrokenaiapps.com, zenml.io, galileo.ai) — guardrail requirements
- Google OAuth invalid_grant analysis (nango.dev) — token revocation triggers

### Tertiary (LOW confidence)

- tauri-plugin-mcp-client (github.com/sublayerapp) — MCP reference only; v0.1.0, not production-ready
- MCP 2026 roadmap (blog.modelcontextprotocol.io) — spec direction only

---

*Research completed: 2026-06-25*
*Ready for roadmap: yes*

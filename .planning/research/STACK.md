# Technology Stack

**Project:** NexusAI — Desktop AI Super-App
**Researched:** 2026-06-25
**Confidence:** MEDIUM-HIGH (most choices verified against official docs and community evidence; AI SDK browser/Tauri integration is MEDIUM due to evolving landscape)

---

## Critical Architecture Constraint: The Tauri Webview Boundary

Before reviewing the stack, internalize this constraint — it drives most decisions:

**Tauri's webview does NOT have Node.js.** The frontend runs in a native OS webview (WKWebView on macOS, WebView2 on Windows). There is no `node:fs`, no `node:async_hooks`, no native NAPI addons accessible from webview context. Any library that depends on Node.js APIs at runtime will fail silently or crash in production.

Consequence: ALL heavy lifting — LLM API calls, SQLite access, file I/O, process management, encryption — must live in the **Rust backend**. The frontend is a thin UI layer that calls Rust via `invoke()`.

---

## Recommended Stack

### 1. Frontend Framework

**Recommendation: React 19 + Vite**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 19 | UI framework | Largest ecosystem, most Tauri templates/examples use React, best-supported by shadcn/ui, Zustand, TanStack Query — all of which NexusAI needs |
| Vite | 6.x | Build tool | Officially recommended by Tauri v2 docs for SPAs; fast HMR, Tauri-specific plugins available, all community templates use it |
| TypeScript | 5.5+ | Type safety | Required for tauri-specta type generation to work end-to-end |
| Tailwind CSS | 4.x | Styling | Zero-runtime, works perfectly in webview, pairs with shadcn/ui |
| shadcn/ui | latest | Component library | Unstyled, composable, React-native — no Node.js deps, works in webview |

**Why NOT Svelte/SvelteKit:** Svelte is technically fine in Tauri and has performance advantages for lighter apps. However, the NexusAI feature set (complex multi-module state, agent orchestration UI, rich dashboard) benefits from React's mature ecosystem. The Tauri community AI app templates (Velo, XandSuite, dannysmith/tauri-template) predominantly use React 19. Svelte's ecosystem for complex data-heavy UIs (rich text editors, drag-and-drop, virtual lists) is thinner. Use Svelte only if you prioritize bundle size over ecosystem.

**Why NOT Vue:** Vue is supported but has less Tauri community adoption and fewer examples in the AI desktop app space. Not a wrong choice, but React has better evidence of production use.

Confidence: HIGH — verified against official Tauri v2 docs, multiple production apps, community templates.

---

### 2. LLM Orchestration / Agent Framework

**Recommendation: Vercel AI SDK (Core) v7 + Rust (reqwest + tokio) for actual API calls**

This is the most nuanced decision. The architecture splits into two layers:

**Layer A — API calls and streaming: Rust backend (required)**

LLM API calls MUST be made from Rust, not from the webview. Reasons:
- CORS: External API endpoints (OpenRouter, OpenAI, Gemini) block cross-origin requests from webviews
- API key security: Keys stored in Rust cannot be exfiltrated from webview memory
- Streaming: Rust `reqwest` + `tokio` streams tokens directly to frontend via Tauri events (`.emit()`)

Use `reqwest` + `futures-util` in Rust for HTTP streaming against any OpenAI-compatible endpoint (OpenRouter, OpenAI, Gemini via OpenAI-compat mode). This pattern is well-documented and battle-tested (Gemini streaming in Tauri: verified working). The `openai` or `async-openai` Rust crate can provide a typed client.

| Crate | Version | Purpose |
|-------|---------|---------|
| reqwest | 0.12 | HTTP client with streaming |
| tokio | 1.x | Async runtime |
| async-openai | 0.27+ | Typed OpenAI-compatible API client |
| serde / serde_json | 1.x | JSON serialization for IPC |

**Layer B — Agent orchestration logic: Vercel AI SDK Core v7 (in a Node.js sidecar)**

AI SDK v7 is ESM-only, requires Node.js 22+, and has many server-side-focused features. It does NOT run in a browser/webview context directly for agent loops (node:async_hooks dependencies, file system access for workflows).

However, AI SDK v7 is the best TypeScript agent orchestration framework available and is the right choice for:
- Multi-step agent loops with `stopWhen` / `prepareStep`
- Structured output / tool calling schema definitions
- LangGraph-style orchestration via `@ai-sdk/langchain`
- MCP integration (`experimental_createMCPClient` / v7 MCP Apps)

**Implementation pattern:** Run AI SDK orchestration in a **Node.js sidecar** (Tauri sidecar feature). The sidecar exposes a local HTTP/IPC interface. The Rust backend delegates orchestration to the sidecar and bridges results to the webview via events. Direct API calls (streaming chat) skip the sidecar and go Rust → external API → webview for lowest latency.

| Package | Version | Purpose |
|---------|---------|---------|
| ai | 7.x (npm) | Core agent orchestration, tool calling, structured output |
| @ai-sdk/openai | latest | OpenAI/OpenRouter provider |
| @ai-sdk/google | latest | Gemini provider |

**Why NOT LangChain.js:** LangGraph.js v1.0+ has documented `node:async_hooks` dependency that breaks in browser/webview environments. Even in a sidecar, LangChain.js adds significant complexity and bundle size. AI SDK v7 now covers the same agent orchestration territory with better TypeScript ergonomics. LangChain.js is not wrong, but AI SDK v7 is leaner and more actively aligned with current LLM API designs. LOW confidence on long-term LangGraph browser support.

**Why NOT pure-Rust LLM orchestration:** Rust AI libraries (e.g., `llm`, `candle`) are excellent for running local models, but NexusAI targets cloud LLMs (OpenRouter, Gemini, OpenAI). Pure Rust for agent orchestration with tool calling and structured output is significantly more effort with fewer libraries. Use Rust for transport, TypeScript for orchestration.

Confidence: MEDIUM — the sidecar pattern is validated by production Tauri apps but the AI SDK v7 browser/webview direct path is not fully documented.

---

### 3. Vector Database for Local RAG

**Recommendation: sqlite-vec (SQLite extension via Rust/rusqlite)**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| sqlite-vec | 0.1.9 (latest stable alpha) | Vector similarity search | Embedded in the same SQLite file as regular data; no separate process; Rust crate available; runs anywhere SQLite runs |
| rusqlite | 0.31+ | SQLite + sqlite-vec connection in Rust | Supports `sqlite3_auto_extension()` to load sqlite-vec; better control than tauri-plugin-sql for vector operations |
| zerocopy | 0.7 | Efficient Vec<f32> → bytes conversion | Required for passing vectors to sqlite-vec without copying |

**Why sqlite-vec over alternatives:**

| Option | Status | Verdict |
|--------|--------|---------|
| LanceDB JS | Uses NAPI-RS native binaries — cannot load in Tauri webview, only works in Node.js sidecar | Use only in sidecar, adds complexity |
| ChromaDB local | Requires Python server or Docker — incompatible with local-first, no-server requirement | Eliminated |
| Qdrant local | Requires a running server process; Rust SDK fine, but adds operational overhead for desktop | Overkill for MVP |
| sqlite-vec | Pure C, no deps, embeds in SQLite, Rust crate available, WASM-capable | Winner for embedded desktop |

**Caveats on sqlite-vec:**
- Still in alpha (v0.1.10a4 as of May 2026). Not officially v1.0.
- No HNSW index — uses brute-force KNN scan. Acceptable for <100K vectors (typical knowledge base size). For 1M+ vectors, revisit.
- Virtual table limitations require a separate metadata table (workaround is documented).
- Must be initialized via Rust with `unsafe` code (`sqlite3_auto_extension`).

**Architecture:** Embeddings are generated in the Node.js sidecar (using `@xenova/transformers` or calling the LLM provider's embedding endpoint), then stored via Rust's rusqlite. Semantic search is a Tauri command that runs in Rust and returns ranked results to the frontend.

Confidence: MEDIUM — sqlite-vec is alpha but is the only viable embedded vector solution for Tauri's no-Node.js webview constraint. Production use validated by Ryosuke's November 2025 blog post.

---

### 4. State Management

**Recommendation: Zustand 5 (global UI/app state) + TanStack Query 5 (async/backend data)**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| Zustand | 5.x | Global UI state, session state, module state | ~3KB, zero boilerplate, subscription-based, works perfectly in webview, used by Velo email client and multiple Tauri AI apps |
| TanStack Query | 5.x | Async data from Tauri IPC commands | Caching, background refetch, loading/error states for all `invoke()` calls — treats Tauri commands like API endpoints |

**State layering pattern (validated by dannysmith/tauri-template):**
1. `useState` — local component state
2. `Zustand` — global UI state (current module, selected model, active agent, settings)
3. `TanStack Query` — persistent data (conversations, knowledge base entries, email cache) fetched from Rust via IPC

**Why NOT Redux Toolkit:** 10x more boilerplate for no meaningful advantage in a single-developer or small-team app. Redux shines for multi-team enterprise with strict patterns. Zustand provides 90% of Redux's benefits at 5% of the setup cost.

**Why NOT Jotai:** Jotai's atomic model is excellent for fine-grained reactivity (spreadsheets, design tools). NexusAI has distinct modules (chat, knowledge base, email, calendar) with module-level state, not granular atom-level reactivity. Zustand's store-per-module pattern is a cleaner fit.

Confidence: HIGH — both libraries are framework-agnostic, zero Node.js dependencies, well-documented Tauri integration.

---

### 5. SQLite Layer (Primary Database)

**Recommendation: tauri-plugin-sql (Rust/sqlx) + Drizzle ORM (proxy pattern) for frontend schema management**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tauri-plugin-sql | 2.x | SQLite access via Rust/sqlx for JS frontend | Official Tauri plugin; backed by sqlx; handles migrations; security-scoped |
| rusqlite | 0.31+ | Direct Rust SQLite for vector/FTS operations | Required for sqlite-vec; more control than sqlx for extension loading |
| Drizzle ORM | 0.36+ | Type-safe query builder in TypeScript | Proxy pattern bridges tauri-plugin-sql with Drizzle's schema definitions; migrations via import.meta.glob to avoid Node.js fs |

**Pattern:** Drizzle generates SQL → `sqlite-proxy` driver sends queries via `invoke()` → tauri-plugin-sql (or direct rusqlite for vector ops) executes in Rust → results returned to frontend.

**Why NOT better-sqlite3:** `better-sqlite3` is a Node.js native addon (NAPI). It does not exist in the Tauri webview. It could be used in a Node.js sidecar, but that's adding unnecessary complexity when tauri-plugin-sql exists specifically for this use case.

**Migration caveat:** Drizzle's built-in `migrate()` function uses `node:fs` to read `.sql` files — unavailable in webview. Use `import.meta.glob` to bundle migration files at Vite build time instead. This is a documented pattern with working examples.

Confidence: HIGH — Drizzle + tauri-plugin-sql proxy is production-validated by multiple 2025-2026 blog posts and open-source templates.

---

### 6. Email Integration (Gmail)

**Recommendation: Gmail REST API (OAuth 2.0 with PKCE) for Gmail; async-imap + lettre for generic IMAP/SMTP**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tauri-plugin-google-auth | latest | OAuth 2.0 PKCE flow for Gmail | Tauri-native plugin, handles deep-link callback, no client secret needed |
| google-gmail1 (Rust crate) | latest | Gmail REST API | Full Gmail API access (labels, threads, attachments, send) from Rust |
| async-imap | 0.9+ | IMAP for non-Gmail accounts | Pure Rust, async, supports OAuth2/XOAUTH2 |
| lettre | 0.11 | SMTP for sending email | Well-maintained Rust SMTP client |

**Why Gmail REST API over IMAP for Gmail:** As of March 2025, Google eliminated basic auth for IMAP/SMTP. OAuth2 is mandatory. The Gmail REST API (via `google-gmail1` crate) gives richer access: push notifications, thread management, attachment handling, label operations — things IMAP exposes awkwardly. Use IMAP only as fallback for non-Gmail accounts.

**OAuth flow:** PKCE flow (no client secret) → browser opens Google consent page → redirect to custom deep-link scheme → Tauri intercepts → token exchanged in Rust. Velo email client (open-source Tauri app) uses this exact pattern successfully.

**Important:** All OAuth tokens and credentials stored in Rust (encrypted via system keychain or AES-256 in SQLite). Never expose tokens to webview memory where they can be captured.

Confidence: HIGH — Gmail API + PKCE in Tauri is production-validated (Velo email client is open-source and uses this exact stack).

---

### 7. MCP Client/Server Implementation

**Recommendation: Custom Rust implementation for MCP server management + tauri-plugin-mcp-client (with caution) for MCP client**

**For consuming external MCP servers (client role):**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tauri-plugin-mcp-client | 0.1.0 (early) | MCP stdio transport in Tauri | Only Tauri-native MCP plugin found; JSON-RPC 2.0, multi-server, TypeScript API |

**Caution:** `tauri-plugin-mcp-client` is v0.1.0, 4 commits, not in cargo registry yet. It is NOT production-ready. Plan to use it as a reference implementation and fork/extend it rather than treating it as a stable dependency. Alternatively, implement MCP stdio transport directly in Rust — the protocol is not complex (JSON-RPC 2.0 over stdin/stdout).

**For the AI SDK v7 sidecar:** AI SDK v7 has `experimental_createMCPClient` and v7 introduces "MCP Apps" — use this from the Node.js sidecar for orchestrated tool calling against MCP servers.

**For exposing NexusAI as an MCP server (server role):** Implement in Rust using JSON-RPC 2.0 over stdio or SSE. The MCP spec is straightforward. No mature Rust MCP server crate exists yet — implement from scratch using `tokio` + `serde_json`. Bind to a local port for SSE transport or support stdio for client tools like Claude Code.

Confidence: LOW for the client plugin (too early-stage), MEDIUM for the custom Rust approach.

---

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tauri-specta | 2.x | Auto-generate TypeScript types from Rust commands | Always — eliminates manual type maintenance |
| TanStack Router | 1.x | Client-side routing between modules | Multi-module app needs routing (chat, notes, calendar, etc.) |
| Framer Motion | 11.x | Animations | Non-critical; add when MVP is working |
| TipTap | 3.x | Rich text editor for Notes module | Best React rich text editor, no Node.js deps |
| @xenova/transformers | 2.17+ | Local text embeddings (in sidecar) | Runs in Node.js sidecar for embedding generation without cloud API calls |
| date-fns | 3.x | Date manipulation for Calendar | Lightweight, tree-shakeable, no deps |
| DOMPurify | 3.x | Sanitize HTML in email rendering | Critical for preventing XSS in rendered emails |
| Biome | 1.x | Linting + formatting | Replaces ESLint + Prettier with faster Rust-based tooling |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Frontend | React 19 | Svelte/SvelteKit | Thinner ecosystem for complex UIs; fewer Tauri AI app templates; React has better evidence for NexusAI's complexity |
| LLM orchestration | AI SDK v7 (sidecar) | LangChain.js | LangGraph.js has `node:async_hooks` browser incompatibility; AI SDK v7 has cleaner API for agents |
| Vector DB | sqlite-vec | LanceDB JS | LanceDB uses NAPI native binaries — cannot run in webview; only usable in sidecar which adds complexity |
| Vector DB | sqlite-vec | ChromaDB | Requires external Python process — violates local-first, no-server constraint |
| Vector DB | sqlite-vec | Qdrant local | Requires running server process; overkill for <100K vector desktop use case |
| State | Zustand | Redux Toolkit | 10x boilerplate for no benefit in single-developer context |
| State | Zustand | Jotai | Atom model better for granular reactivity (design tools); module-level stores suit NexusAI better |
| SQLite (JS) | tauri-plugin-sql + Drizzle proxy | better-sqlite3 | better-sqlite3 is NAPI — cannot run in webview |
| Email | Gmail REST API | IMAP/SMTP for Gmail | Google disabled basic auth March 2025; OAuth IMAP possible but REST API gives richer capabilities |
| MCP client | Custom Rust impl | sublayerapp/tauri-plugin-mcp-client | Plugin is v0.1.0 with 4 commits — treat as reference, not dependency |

---

## Installation

```bash
# Frontend (in src-frontend/ or frontend/)
npm create tauri-app@latest -- --template react-ts
npm install zustand @tanstack/react-query @tanstack/react-router
npm install drizzle-orm
npm install -D drizzle-kit
npm install tailwindcss@4 @tailwindcss/vite
npm install -D @biomejs/biome

# shadcn/ui (component by component)
npx shadcn@latest init

# Node.js sidecar dependencies (in sidecar/ package)
npm install ai @ai-sdk/openai @ai-sdk/google
npm install @xenova/transformers  # for local embeddings
```

```toml
# Cargo.toml (Rust dependencies)
[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
reqwest = { version = "0.12", features = ["stream", "json"] }
tokio = { version = "1", features = ["full"] }
async-openai = "0.27"
rusqlite = { version = "0.31", features = ["bundled"] }
sqlite-vec = "0.1"
zerocopy = "0.7"
async-imap = "0.9"
lettre = "0.11"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[build-dependencies]
tauri-build = { version = "2", features = [] }
tauri-specta = { version = "2", features = ["derive", "typescript"] }
```

---

## Architecture Summary

```
┌──────────────────────────────────────────────────┐
│  Webview (React 19 + Vite)                        │
│  Zustand (UI state) + TanStack Query (IPC data)   │
│  Drizzle ORM proxy → invoke() → Rust              │
│  NO Node.js, NO direct DB/API access              │
└──────────────────┬───────────────────────────────┘
                   │ Tauri IPC (invoke / events)
┌──────────────────▼───────────────────────────────┐
│  Rust Core (Tauri backend)                        │
│  - reqwest: LLM API calls + token streaming       │
│  - rusqlite + sqlite-vec: SQLite + vector search  │
│  - tauri-plugin-sql: frontend DB proxy            │
│  - async-imap / lettre: email (non-Gmail)         │
│  - google-gmail1: Gmail REST API                  │
│  - MCP client/server (custom JSON-RPC 2.0)        │
│  - OAuth2 PKCE flow (tauri-plugin-google-auth)    │
└──────────────────┬───────────────────────────────┘
                   │ sidecar HTTP / stdio
┌──────────────────▼───────────────────────────────┐
│  Node.js Sidecar (Tauri sidecar feature)          │
│  - AI SDK v7: agent orchestration, tool calling   │
│  - @xenova/transformers: local text embeddings    │
│  - MCP client (AI SDK experimental_createMCPClient)│
└──────────────────────────────────────────────────┘
```

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| React + Vite as frontend | HIGH | Official Tauri recommendation; multiple production apps |
| Zustand + TanStack Query | HIGH | Zero Node.js deps; used in Tauri production apps |
| Rust for LLM API calls | HIGH | Only viable approach for CORS + key security; well-documented |
| AI SDK v7 (sidecar) | MEDIUM | SDK is excellent but sidecar architecture adds complexity; v7 just released |
| sqlite-vec for vectors | MEDIUM | Alpha status; no HNSW; but only embedded option for Tauri |
| Drizzle ORM proxy | MEDIUM-HIGH | Pattern validated by multiple 2025-2026 articles; migration workaround required |
| Gmail REST API + PKCE | HIGH | Production-validated by Velo email client |
| MCP implementation | LOW-MEDIUM | No mature Rust MCP crate; custom implementation required; tauri-plugin-mcp-client too early |
| tauri-specta | HIGH | Production-ready; core part of recommended Tauri templates |

---

## Key Risks and Mitigations

**Risk 1: AI SDK v7 sidecar complexity**
Running a Node.js sidecar inside a Tauri app adds build complexity, packaging (must bundle Node.js runtime or use a pre-built binary), and IPC overhead. Mitigation: Start with direct Rust API calls for chat; introduce the sidecar only when agent orchestration is needed. Consider `deno compile` to create a standalone binary that bundles the runtime.

**Risk 2: sqlite-vec alpha stability**
Vector search is core to RAG. sqlite-vec at v0.1.x may have breaking API changes. Mitigation: Isolate all vector operations behind a Rust module boundary. If sqlite-vec is replaced, only that module changes.

**Risk 3: MCP ecosystem is fast-moving**
The MCP spec is young and the Tauri-specific client plugins are immature. Mitigation: Implement minimal MCP client in Rust first (stdio transport only, for local MCPs). Add SSE transport later. Do not over-engineer for MCP v2 before it stabilizes.

**Risk 4: LLM API call architecture**
If LLM calls go through Rust, all streaming token processing must emit Tauri events. High-frequency events (streaming at 50 tokens/sec) can cause UI jank if event handling is not debounced. Mitigation: Batch token emissions or use a ring buffer pattern in Rust.

---

## Sources

- [Tauri v2 Frontend Configuration](https://v2.tauri.app/start/frontend/) — Official, HIGH confidence
- [Tauri v2 SQL Plugin](https://v2.tauri.app/plugin/sql/) — Official, HIGH confidence
- [AI SDK 7 Release](https://vercel.com/blog/ai-sdk-7) — Official, HIGH confidence
- [AI SDK Migration Guide 7.0](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0) — Official, HIGH confidence
- [sqlite-vec GitHub](https://github.com/asg017/sqlite-vec) — Official, HIGH confidence
- [sqlite-vec in Rust](https://alexgarcia.xyz/sqlite-vec/rust.html) — Author's docs, HIGH confidence
- [LangGraph.js Browser Compatibility Issue](https://github.com/langchain-ai/docs/issues/1177) — Community, MEDIUM confidence
- [Drizzle + SQLite in Tauri App](https://dev.to/huakun/drizzle-sqlite-in-tauri-app-kif) — Community, MEDIUM confidence
- [Drizzle SQLite Migrations in Tauri 2.0](https://keypears.com/blog/2025-10-04-drizzle-sqlite-tauri) — Community, MEDIUM confidence
- [Velo Open-Source Tauri Email Client](https://github.com/avihaymenahem/velo) — Production app, HIGH confidence
- [tauri-plugin-mcp-client](https://github.com/sublayerapp/tauri-plugin-mcp-client) — Early-stage, LOW confidence
- [Offline Vector Database with Tauri (Ryosuke)](https://whoisryosuke.com/blog/2025/offline-vector-database-with-tauri/) — Community, MEDIUM confidence
- [Streaming Gemini in Tauri](https://dev.to/hiyoyok/streaming-gemini-api-responses-in-rust-tauri-real-time-token-display-2i2o) — Community, MEDIUM confidence
- [Google OAuth for Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app) — Official, HIGH confidence
- [dannysmith/tauri-template](https://github.com/dannysmith/tauri-template) — Production template, MEDIUM confidence
- [TanStack Query integration in Tauri](https://deepwiki.com/dannysmith/tauri-template/5.4-tanstack-query-integration) — Community, MEDIUM confidence

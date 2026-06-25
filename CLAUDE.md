
### Commit Message Format

```
<emoji> <type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

---

### Types with Emojis

| Emoji | Type         | When to use                        |
| ----- | ------------ | ---------------------------------- |
| ✨     | **feat**     | A new feature                      |
| 🐛    | **fix**      | Bug fix                            |
| 📝    | **docs**     | Documentation only changes         |
| 💄    | **style**    | Code style/formatting only         |
| ♻️    | **refactor** | Code change without feature or fix |
| ⚡️    | **perf**     | Performance improvements           |
| ✅     | **test**     | Adding or updating tests           |
| 🔧    | **chore**    | Maintenance / tooling changes      |
| 🏗️   | **build**    | Build system / dependencies        |
| 🤖    | **ci**       | CI/CD changes                      |
| ⏪️    | **revert**   | Reverting commits                  |
| 🔒️   | **security** | Security fixes                     |

---

### Scopes (opcional)

Usa pra deixar mais claro onde mexeu:

* `auth`
* `api`
* `database`
* `ui`
* `frontend`
* `backend`
* `mobile`
* `config`
* `deps`
* `docker`

Exemplo:

```
✨ feat(auth): add refresh token support
🐛 fix(api): handle null response on login
```

---

### Regras boas de commit

* descrição curta (até ~72 caracteres)
* verbo no infinitivo ou imperativo: "add", "fix", "remove"
* sem ponto final
* commits pequenos e objetivos
* um commit = uma ideia

---

### Exemplos mais completos

```bash
✨ feat(auth): add refresh token rotation for improved security

✨ feat(chat): implement real-time message streaming via websocket

🐛 fix(api): handle null response when user has no profile

🐛 fix(ui): correct button alignment on mobile screens

📝 docs(readme): include setup steps for Windows and Linux

📝 docs(api): add missing request/response schema for login route

💄 style: run prettier across entire codebase

💄 style(header): adjust spacing and font sizes in navbar

♻️ refactor(user-service): split large service into smaller modules

♻️ refactor(handlers): remove duplicated validation logic

⚡️ perf(database): add index to improve query performance on messages table

⚡️ perf(cache): reduce redis calls in feed generation

✅ test(auth): add coverage for expired token cases

✅ test(api): add integration tests for user registration flow

🔧 chore(deps): update axios to latest stable version

🔧 chore(env): improve environment variable validation

🏗️ build(docker): optimize image size using multi-stage build

🏗️ build(webpack): enable code splitting for faster load times

🤖 ci(github): add caching for node_modules in pipeline

🤖 ci(actions): run tests on pull request and main branch

⏪️ revert(api): rollback pagination change due to performance issues

🔒️ security(auth): block brute force login attempts after 5 failures
```

---
### Important Rules

**NEVER** include these lines in commits:
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com>
```

<!-- GSD:project-start source:PROJECT.md -->
## Project

**NexusAI**

NexusAI é um app desktop all-in-one para Windows e macOS (Tauri v2) que unifica ferramentas de produtividade (email/Gmail, notas, calendário) com capacidades avançadas de IA: chat com múltiplos LLMs, orquestração de agentes, automações inteligentes, gerenciamento de MCPs e uma base de conhecimento compartilhada entre agentes. É uma central de comando pessoal com IA no núcleo, projetada tanto para uso próprio quanto para distribuição.

**Core Value:** Um workspace desktop unificado onde toda a informação do usuário (emails, arquivos, notas, histórico, web) fica acessível a agentes inteligentes que conseguem agir, automatizar e raciocinar em nome do usuário — tudo configurável sem precisar de código.

### Constraints

- **Tech (runtime)**: Tauri v2 — define a arquitetura frontend/backend do app (Rust core + webview)
- **Tech (AI framework)**: LangChain/LangGraph ainda não confirmado — decisão impacta orquestração de agentes e automações
- **Tech (storage)**: SQLite definido, mas tipo de vector DB a escolher (impacta RAG e knowledge base)
- **Plataformas**: Windows e macOS apenas — Linux fora do escopo por ora
- **Local-first**: dados do usuário ficam na máquina — nenhum servidor próprio gerencia dados privados
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Critical Architecture Constraint: The Tauri Webview Boundary
## Recommended Stack
### 1. Frontend Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 19 | UI framework | Largest ecosystem, most Tauri templates/examples use React, best-supported by shadcn/ui, Zustand, TanStack Query — all of which NexusAI needs |
| Vite | 6.x | Build tool | Officially recommended by Tauri v2 docs for SPAs; fast HMR, Tauri-specific plugins available, all community templates use it |
| TypeScript | 5.5+ | Type safety | Required for tauri-specta type generation to work end-to-end |
| Tailwind CSS | 4.x | Styling | Zero-runtime, works perfectly in webview, pairs with shadcn/ui |
| shadcn/ui | latest | Component library | Unstyled, composable, React-native — no Node.js deps, works in webview |
### 2. LLM Orchestration / Agent Framework
- CORS: External API endpoints (OpenRouter, OpenAI, Gemini) block cross-origin requests from webviews
- API key security: Keys stored in Rust cannot be exfiltrated from webview memory
- Streaming: Rust `reqwest` + `tokio` streams tokens directly to frontend via Tauri events (`.emit()`)
| Crate | Version | Purpose |
|-------|---------|---------|
| reqwest | 0.12 | HTTP client with streaming |
| tokio | 1.x | Async runtime |
| async-openai | 0.27+ | Typed OpenAI-compatible API client |
| serde / serde_json | 1.x | JSON serialization for IPC |
- Multi-step agent loops with `stopWhen` / `prepareStep`
- Structured output / tool calling schema definitions
- LangGraph-style orchestration via `@ai-sdk/langchain`
- MCP integration (`experimental_createMCPClient` / v7 MCP Apps)
| Package | Version | Purpose |
|---------|---------|---------|
| ai | 7.x (npm) | Core agent orchestration, tool calling, structured output |
| @ai-sdk/openai | latest | OpenAI/OpenRouter provider |
| @ai-sdk/google | latest | Gemini provider |
### 3. Vector Database for Local RAG
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| sqlite-vec | 0.1.9 (latest stable alpha) | Vector similarity search | Embedded in the same SQLite file as regular data; no separate process; Rust crate available; runs anywhere SQLite runs |
| rusqlite | 0.31+ | SQLite + sqlite-vec connection in Rust | Supports `sqlite3_auto_extension()` to load sqlite-vec; better control than tauri-plugin-sql for vector operations |
| zerocopy | 0.7 | Efficient Vec<f32> → bytes conversion | Required for passing vectors to sqlite-vec without copying |
| Option | Status | Verdict |
|--------|--------|---------|
| LanceDB JS | Uses NAPI-RS native binaries — cannot load in Tauri webview, only works in Node.js sidecar | Use only in sidecar, adds complexity |
| ChromaDB local | Requires Python server or Docker — incompatible with local-first, no-server requirement | Eliminated |
| Qdrant local | Requires a running server process; Rust SDK fine, but adds operational overhead for desktop | Overkill for MVP |
| sqlite-vec | Pure C, no deps, embeds in SQLite, Rust crate available, WASM-capable | Winner for embedded desktop |
- Still in alpha (v0.1.10a4 as of May 2026). Not officially v1.0.
- No HNSW index — uses brute-force KNN scan. Acceptable for <100K vectors (typical knowledge base size). For 1M+ vectors, revisit.
- Virtual table limitations require a separate metadata table (workaround is documented).
- Must be initialized via Rust with `unsafe` code (`sqlite3_auto_extension`).
### 4. State Management
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| Zustand | 5.x | Global UI state, session state, module state | ~3KB, zero boilerplate, subscription-based, works perfectly in webview, used by Velo email client and multiple Tauri AI apps |
| TanStack Query | 5.x | Async data from Tauri IPC commands | Caching, background refetch, loading/error states for all `invoke()` calls — treats Tauri commands like API endpoints |
### 5. SQLite Layer (Primary Database)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tauri-plugin-sql | 2.x | SQLite access via Rust/sqlx for JS frontend | Official Tauri plugin; backed by sqlx; handles migrations; security-scoped |
| rusqlite | 0.31+ | Direct Rust SQLite for vector/FTS operations | Required for sqlite-vec; more control than sqlx for extension loading |
| Drizzle ORM | 0.36+ | Type-safe query builder in TypeScript | Proxy pattern bridges tauri-plugin-sql with Drizzle's schema definitions; migrations via import.meta.glob to avoid Node.js fs |
### 6. Email Integration (Gmail)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tauri-plugin-google-auth | latest | OAuth 2.0 PKCE flow for Gmail | Tauri-native plugin, handles deep-link callback, no client secret needed |
| google-gmail1 (Rust crate) | latest | Gmail REST API | Full Gmail API access (labels, threads, attachments, send) from Rust |
| async-imap | 0.9+ | IMAP for non-Gmail accounts | Pure Rust, async, supports OAuth2/XOAUTH2 |
| lettre | 0.11 | SMTP for sending email | Well-maintained Rust SMTP client |
### 7. MCP Client/Server Implementation
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tauri-plugin-mcp-client | 0.1.0 (early) | MCP stdio transport in Tauri | Only Tauri-native MCP plugin found; JSON-RPC 2.0, multi-server, TypeScript API |
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
## Installation
# Frontend (in src-frontend/ or frontend/)
# shadcn/ui (component by component)
# Node.js sidecar dependencies (in sidecar/ package)
# Cargo.toml (Rust dependencies)
## Architecture Summary
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
## Key Risks and Mitigations
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

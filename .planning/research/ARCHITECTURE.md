# Architecture Patterns: NexusAI

**Domain:** Tauri v2 desktop AI super-app (local-first)
**Researched:** 2026-06-25
**Confidence:** HIGH (core Tauri patterns) / MEDIUM (agent/MCP integration)

---

## Recommended Architecture

NexusAI uses a **layered process architecture** with a single Rust core orchestrating multiple specialized child processes (sidecars), all coordinating through typed IPC channels. The webview frontend is a thin display layer; all business logic lives in Rust or in sidecar processes.

```
┌─────────────────────────────────────────────────────────────┐
│  WEBVIEW (React/Svelte)  — single window, client-side SPA   │
│  Routes: /chat /kb /gmail /notes /agents /mcp /automations  │
│  Communicates via: invoke() commands + event listeners       │
└─────────────────────────┬───────────────────────────────────┘
                          │ IPC (JSON-RPC over custom protocol)
┌─────────────────────────▼───────────────────────────────────┐
│  TAURI CORE (Rust — main process)                           │
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │  plugin-llm  │ │  plugin-kb   │ │  plugin-mcp-client │  │
│  │  (LLM calls, │ │  (SQLite +   │ │  (stdio spawn,     │  │
│  │   streaming) │ │   sqlite-vec,│ │   JSON-RPC 2.0,    │  │
│  │              │ │   fastembed) │ │   multi-server)    │  │
│  └──────────────┘ └──────────────┘ └────────────────────┘  │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │  plugin-     │ │  plugin-     │ │  plugin-           │  │
│  │  gmail       │ │  notes-cal   │ │  automations       │  │
│  │  (OAuth2,    │ │  (SQLite,    │ │  (tokio tasks,     │  │
│  │   Gmail API) │ │   local FS)  │ │   scheduler)       │  │
│  └──────────────┘ └──────────────┘ └────────────────────┘  │
│                                                             │
│  AppState (Arc<Mutex<T>>) — shared across all plugins       │
│  tauri::async_runtime (Tokio) — all async ops run here      │
└──────────┬────────────────────────┬────────────────────────┘
           │ HTTP (localhost)        │ stdio (JSON-RPC)
    ┌──────▼──────┐          ┌──────▼──────────────────────┐
    │  AGENT      │          │  MCP SERVERS (child procs)  │
    │  SIDECAR    │          │  Each spawned on demand:    │
    │  (Python +  │          │  - filesystem MCP           │
    │  LangGraph/ │          │  - browser MCP              │
    │  FastAPI)   │          │  - custom user MCPs         │
    └─────────────┘          └─────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | Technology |
|-----------|---------------|-------------------|------------|
| Webview (frontend) | UI rendering, user events, display state | Tauri Core via `invoke()` + events | React or Svelte, TypeScript |
| Tauri Core (Rust) | Command routing, state management, spawning processes, auth, DB access | Webview (IPC), Agent Sidecar (HTTP), MCP servers (stdio) | Rust, Tokio, tauri v2 |
| plugin-llm | Direct LLM API calls (OpenRouter, OpenAI, Gemini), streaming tokens to frontend | Tauri Core (managed), Webview (events) | Rust, reqwest, tauri::Channel |
| plugin-kb | Knowledge base: ingest docs, generate embeddings, hybrid search (FTS5 + vector) | Tauri Core (managed), SQLite | Rust, rusqlite, sqlite-vec, fastembed-rs |
| plugin-mcp-client | Spawn MCP server child processes, route JSON-RPC 2.0 over stdio, manage lifecycle | Tauri Core, MCP child procs | Rust, tauri-plugin-mcp-client pattern |
| plugin-gmail | Gmail API auth (OAuth2 PKCE), email sync, local cache, calendar data | Tauri Core, Gmail REST API, SQLite | Rust, yup-oauth2 or oauth2-rs |
| plugin-automations | Schedule and run background tasks, trigger agents, emit events | Tauri Core (AppHandle), Agent Sidecar | Rust, tokio (spawn + select), cron |
| plugin-notes-cal | Local notes storage, calendar views (possibly CalDAV sync) | Tauri Core, SQLite | Rust |
| Agent Sidecar | LangGraph/LangChain orchestration, multi-step agent loops, tool routing | Tauri Core over HTTP (localhost), MCP servers | Python, FastAPI, LangGraph |
| MCP Servers | Tool execution: file read/write, browser, search, custom actions | Agent Sidecar OR Tauri Core | Node.js/Python binaries, stdio |
| SQLite (main.db) | Persistent storage for all structured data | All plugins via rusqlite | SQLite + sqlite-vec extension |
| OS Keychain | Secrets: API keys, OAuth tokens | Tauri Core via keyring crate | OS Keychain (macOS Keychain, Windows Credential Manager) |

---

## Data Flow

### LLM Streaming Flow
```
User types → invoke("send_message") → plugin-llm
  → reqwest POST to LLM API with stream=true
  → futures_util::StreamExt processes SSE chunks
  → window.emit("ai-token", chunk) per token
  → frontend event listener accumulates tokens → display
  → window.emit("ai-done") on completion
  → Rust saves full message to SQLite (messages table)
```

### RAG / Knowledge Base Query Flow
```
User message → plugin-llm retrieves context first:
  → invoke("kb_search", query) → plugin-kb
  → fastembed-rs generates query embedding (local ONNX, offline)
  → sqlite-vec KNN search → top-K chunks
  → FTS5 keyword search → merge results (hybrid)
  → return ranked chunks to plugin-llm
  → inject chunks into system prompt
  → proceed with LLM streaming flow above
```

### Agent Orchestration Flow
```
User triggers agent → invoke("run_agent", task) → Tauri Core
  → HTTP POST to Agent Sidecar (FastAPI, localhost:PORT)
  → LangGraph executes multi-step graph
  → Each step calls tools via MCP protocol:
     Agent → stdio → MCP Server binary → result → Agent
  → LangGraph streams partial results via SSE
  → Tauri Core receives SSE → emits events to frontend
  → Final result stored in SQLite
```

### MCP Server Lifecycle Flow
```
User enables MCP in UI → invoke("mcp_connect", config) → plugin-mcp-client
  → Rust spawns child process via tauri shell command
  → Communicates via stdin/stdout with JSON-RPC 2.0
  → plugin-mcp-client maintains connection map (server_id → child handle)
  → Tools exposed by MCP are listed and available to Agent Sidecar
  → When user disables MCP → child process killed → removed from map
```

### Gmail Sync Flow
```
App start → plugin-gmail checks OAuth token in OS Keychain
  → If token expired: refresh via yup-oauth2 (offline access_type)
  → Background tokio task spawned: periodic sync loop
    → Gmail API list/get messages → delta sync (historyId)
    → Store in SQLite: emails table (subject, body, labels, thread_id)
    → Emit "gmail-sync-complete" event to frontend
  → User actions (send/label/archive) → invoke() → Rust → Gmail API
```

### Background Automation Flow
```
User creates automation (via GUI or AI chat)
  → invoke("create_automation", rule) → plugin-automations
  → Rule stored in SQLite: automations table
  → tokio background task runs cron/interval loop
  → On trigger: invoke agent sidecar or call plugin-llm directly
  → Results emitted as events to frontend
  → Can create notifications via tauri notification plugin
```

---

## Tauri v2-Specific Architecture Decisions

### 1. Plugin-per-Module Structure (HIGH confidence)

Each major domain (LLM, KB, Gmail, MCP, Automations) lives in its own Tauri plugin (Cargo crate). Plugins:
- Own their state via `app.manage(PluginState { ... })`
- Expose commands via `invoke_handler!(commands::...)`
- Declare permissions in `permissions/` directory (required — commands are locked by default)
- Access shared state via `tauri::State<T>` in command handlers
- Use `AppHandle` when state must be passed across threads (cheap to clone)

**Why this over a monolithic lib.rs:** Each plugin can be developed, tested, and reasoned about independently. Official Tauri plugins workspace (`tauri-apps/plugins-workspace`) uses exactly this structure.

### 2. LLM Calls from Rust, Not JavaScript (HIGH confidence)

LLM API calls happen exclusively in Rust (plugin-llm), not from the frontend JS:
- API keys stored in OS Keychain, never in JS context
- Streaming via `reqwest` + `futures_util::StreamExt`
- Tokens forwarded to frontend via `window.emit("ai-token", chunk)`
- Frontend uses `listen("ai-token", handler)` to accumulate

**Why not JS fetch directly:** API keys would be exposed in the webview context. Rust controls conversation history, token counting, and context injection — none of that logic belongs in the frontend.

For the Channel API (Tauri v2's alternative to events for large data): use `tauri::ipc::Channel<T>` when sending many chunks to avoid event system overhead. This is more efficient than hundreds of individual `window.emit()` calls.

### 3. Agent Sidecar: Python/FastAPI Process (MEDIUM confidence)

LangGraph and LangChain are Python-first. Running them as a FastAPI sidecar process is the production-proven pattern for Tauri+AI:
- PyInstaller bundles Python + all deps into a single binary
- Tauri bundles the binary via `bundle.externalBin` in `tauri.conf.json`
- Tauri Core spawns it at startup via `app.shell().sidecar("agent-sidecar")`
- Communication: HTTP to `127.0.0.1:PORT` (random ephemeral port selected at startup)
- If Agent Sidecar crashes → Tauri Core can restart it without crashing the app

**Alternative (Rust-native agents):** `rig` crate provides Rust-native LLM agent primitives. Use this only if LangGraph is abandoned — rig is less mature for complex multi-step graphs. For the full LangGraph state machine capability, Python sidecar is the right call.

**Port management:** Agent sidecar should accept `--port PORT` argument; Tauri Core picks a free port and passes it at spawn time.

### 4. MCP Servers as On-Demand Child Processes (HIGH confidence)

Each MCP server is a child process spawned by plugin-mcp-client:
- Transport: stdio (stdin/stdout) with JSON-RPC 2.0
- Thread-safe connection map: `Arc<Mutex<HashMap<ServerId, ChildHandle>>>`
- `tauri-plugin-mcp-client` (sublayerapp/tauri-plugin-mcp-client) implements this pattern
- Security: validate MCP server command+args in Rust before spawning — do not pass user-supplied commands unsanitized (known MCP stdio security vulnerability)
- MCP servers can be called by Agent Sidecar (Python talks to them directly) OR by Tauri Core routing — prefer Agent Sidecar calling MCPs to keep agent logic co-located

### 5. SQLite as the Single Source of Truth (HIGH confidence)

One SQLite database (`nexusai.db`) accessed via `rusqlite` (direct, for performance-critical paths like vector search) and `tauri-plugin-sql` (for simple CRUD from frontend). sqlite-vec extension provides vector storage.

Schema areas:
```sql
-- Conversations and messages
conversations (id, title, model, created_at)
messages (id, conv_id, role, content, tokens, created_at)

-- Knowledge base
kb_documents (id, title, source_type, source_path, indexed_at)
kb_chunks (id, doc_id, content, position)
kb_embeddings (virtual table via sqlite-vec, chunk_id, embedding float[N])

-- Email
emails (id, gmail_id, thread_id, subject, body_text, labels, received_at, synced_at)
email_attachments (id, email_id, filename, local_path)

-- Notes and calendar
notes (id, title, content, tags, created_at, updated_at)
calendar_events (id, source, title, start_at, end_at, description)

-- Agents and automations
agents (id, name, config_json, mcp_servers_json, created_at)
automations (id, name, trigger_type, trigger_config, action_config, enabled)
automation_runs (id, automation_id, status, output, ran_at)

-- MCP registry
mcp_servers (id, name, command, args_json, env_json, enabled)

-- Settings
settings (key, value, updated_at)
```

Migrations managed in Rust at startup via the `tauri-plugin-sql` migration API.

### 6. Background Tasks via Tokio (HIGH confidence)

Long-running work (Gmail sync, automation scheduler, embedding ingestion) runs as `tokio::task::spawn()` jobs in Tauri's async runtime, not as OS services or separate processes:
- Use `tokio::sync::Mutex` (not `std::sync::Mutex`) for state shared across await points
- Use `tokio::sync::mpsc` channels for task-to-core communication
- Cancellation via `tokio::select!` with a `CancellationToken`
- Tasks communicate results to frontend via `AppHandle.emit_all()`
- `tauri-plugin-background-service` exists for keeping tasks alive when windows are hidden (system tray apps)

### 7. OAuth2 for Gmail: Rust-Side, Tokens in OS Keychain (HIGH confidence)

- OAuth2 PKCE flow via `oauth2-rs` or `yup-oauth2`
- PKCE is mandatory for desktop apps (no client secret)
- Access token stored in OS Keychain via `keyring` crate (macOS Keychain / Windows Credential Manager)
- API keys (OpenRouter, OpenAI, Gemini) also stored in OS Keychain — never in SQLite plaintext
- `offline` access type ensures refresh tokens work without user re-auth
- Token refresh handled automatically by `yup-oauth2`'s Authenticator (caches to disk + refreshes)

### 8. Single Window, SPA with Routing (MEDIUM confidence)

NexusAI is best served as a single window with a client-side router (React Router `createBrowserRouter`, not hash router):
- `/chat` — LLM chat
- `/kb` — knowledge base
- `/gmail` — email client
- `/notes` — notes + calendar
- `/agents` — agent management
- `/mcp` — MCP server manager
- `/automations` — automation builder
- `/settings` — API keys, preferences

Secondary windows (popups, detachable panels) can be created via `WebviewWindow` API if needed. Capabilities are scoped per window in Tauri v2's ACL system.

---

## Suggested Build Order

Dependencies between components drive this order. Build nothing until its dependencies exist.

```
Phase 1: Foundation
  └── Tauri project scaffold + plugin architecture skeleton
  └── SQLite with migrations + schema
  └── OS Keychain integration (API key storage)
  └── Settings UI

Phase 2: LLM Core
  └── plugin-llm (streaming, multi-provider, model switching)
  └── Basic chat UI
  └── Conversation persistence to SQLite
  └── [Depends on: Phase 1]

Phase 3: Knowledge Base
  └── plugin-kb: document ingestion pipeline
  └── fastembed-rs + sqlite-vec integration
  └── Hybrid search (FTS5 + vector)
  └── KB browser UI
  └── [Depends on: Phase 1; Phase 2 needed for RAG chat]

Phase 4: Gmail Integration
  └── plugin-gmail: OAuth2 PKCE flow
  └── Email sync background task
  └── Email UI (read, compose, labels)
  └── Gmail data available to KB (emails indexed)
  └── [Depends on: Phase 1, Phase 3 for KB indexing]

Phase 5: Notes & Calendar
  └── plugin-notes-cal: local notes storage
  └── Calendar UI (CalDAV optional)
  └── Notes available to KB
  └── [Depends on: Phase 1, Phase 3]

Phase 6: Agent Orchestration
  └── Agent Sidecar (Python/FastAPI/LangGraph)
  └── Sidecar spawn + lifecycle management
  └── plugin-mcp-client: MCP server management
  └── Agent UI: create, configure, monitor
  └── [Depends on: Phase 2, Phase 3, MCP infra]

Phase 7: Automations
  └── plugin-automations: scheduler + action engine
  └── Automation builder UI (GUI + AI chat)
  └── Trigger types: time, email, message, event
  └── [Depends on: Phase 6]

Phase 8: Dashboard + Polish
  └── Central dashboard aggregating all modules
  └── LLM benchmark feature
  └── System tray + background service polish
  └── [Depends on: all phases]
```

---

## Key Architectural Decisions to Make Early

These decisions affect everything and must be locked in before Phase 2:

| Decision | Options | Recommendation | Why Early |
|----------|---------|----------------|-----------|
| Frontend framework | React, Svelte, Vue | React (largest ecosystem, RSC not needed — use Vite) | Affects all UI code |
| Rust plugin module boundaries | Monolith lib.rs vs per-feature plugins | Per-feature plugins from day 1 | Refactoring later is painful |
| LLM streaming transport | `window.emit()` events vs `tauri::Channel` | Start with events, migrate to Channel if perf issues | Channel API is v2-only, cleaner for streaming |
| Agent runtime | Python sidecar vs Rust-native (rig) | Python sidecar for LangGraph; Rust for simple tool calls | LangGraph Python graph semantics don't translate to Rust cleanly |
| Vector DB approach | sqlite-vec vs separate Qdrant/Chroma | sqlite-vec (embedded, zero deps, works offline) | Separate process adds ops complexity for local-first app |
| Port assignment for sidecars | Hardcoded vs random ephemeral | Random ephemeral port passed as argument | Avoids port conflicts with user services |
| Embedding model | API (OpenAI embeddings) vs local (fastembed-rs) | Local fastembed-rs (BGE-small, ONNX, offline) | Local-first constraint — no network needed for KB search |
| OAuth token storage | SQLite vs OS Keychain | OS Keychain always | API keys in SQLite = plaintext if DB is accessed directly |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: LLM API Keys in JavaScript Context
**What goes wrong:** Keys in JS context are readable via DevTools or via the webview process memory.
**Instead:** All HTTP calls to LLM APIs happen from Rust. Keys live in OS Keychain only.

### Anti-Pattern 2: std::sync::Mutex Across Await Points
**What goes wrong:** Tauri commands are async (Tokio). Holding a `std::sync::Mutex` guard across `.await` causes a panic or deadlock at runtime.
**Instead:** Use `tokio::sync::Mutex` for any state shared across async tasks.

### Anti-Pattern 3: Passing Unsanitized Commands to MCP Server Spawn
**What goes wrong:** MCP stdio transport executes OS commands — a user-supplied command string could run arbitrary binaries.
**Instead:** Validate MCP server configs against an allowlist or require user confirmation for new commands. Store validated configs in SQLite.

### Anti-Pattern 4: Giant Monolithic main.rs
**What goes wrong:** As modules multiply, `main.rs` becomes impossible to maintain and compile times explode.
**Instead:** Each domain is a Tauri plugin with its own Cargo crate from the start.

### Anti-Pattern 5: Synchronous Embedding During User Actions
**What goes wrong:** fastembed-rs model inference blocks the Tokio thread pool, causing the UI to freeze.
**Instead:** Wrap embedding calls in `tokio::task::spawn_blocking()`. Queue ingestion work; never do it inline with a user command response.

### Anti-Pattern 6: Polling Gmail API Instead of Delta Sync
**What goes wrong:** Full email list fetches are slow and hit API rate limits quickly.
**Instead:** Use Gmail API `history.list(historyId)` for delta sync. Store `historyId` after each sync in SQLite.

### Anti-Pattern 7: Single Port Hardcoded for Agent Sidecar
**What goes wrong:** If port is already in use, sidecar fails to start with no clear error.
**Instead:** Tauri Core selects a free ephemeral port at startup and passes it as `--port PORT` to the sidecar.

---

## Scalability Considerations

| Concern | Current Scope (single user) | If Distributed Later |
|---------|-----------------------------|-----------------------|
| SQLite concurrency | Single writer, many readers — fine | Would need WAL mode + connection pool |
| Embedding index size | sqlite-vec handles millions of rows | If >10M chunks consider dedicated Qdrant |
| Agent memory | In-process LangGraph state | LangGraph persistence to SQLite (checkpoint store) |
| MCP servers | 5-20 concurrent child procs — fine | No concern for single-user desktop |
| Background tasks | Tokio green threads — fine | No concern for single-user desktop |

---

## Sources

- [Tauri v2 IPC Architecture](https://v2.tauri.app/concept/inter-process-communication/) — HIGH confidence
- [Tauri v2 Sidecar Documentation](https://v2.tauri.app/develop/sidecar/) — HIGH confidence
- [Tauri v2 Plugin Development](https://v2.tauri.app/develop/plugins/) — HIGH confidence
- [Tauri v2 Architecture Overview](https://v2.tauri.app/concept/architecture/) — HIGH confidence
- [Node.js as a Sidecar (Tauri)](https://v2.tauri.app/learn/sidecar-nodejs/) — HIGH confidence
- [Tauri HTTP Client Plugin](https://v2.tauri.app/plugin/http-client/) — HIGH confidence
- [Tauri v2 State Management](https://v2.tauri.app/develop/state-management/) — HIGH confidence
- [Streaming Gemini in Tauri v2 (DEV.to)](https://dev.to/hiyoyok/streaming-gemini-api-responses-in-rust-tauri-real-time-token-display-2i2o) — MEDIUM confidence (community, verified pattern)
- [tauri-plugin-mcp-client (sublayerapp)](https://github.com/sublayerapp/tauri-plugin-mcp-client) — MEDIUM confidence
- [Local-First AI Blueprint with Tauri (Medium)](https://medium.com/@Musbell008/a-technical-blueprint-for-local-first-ai-with-rust-and-tauri-b9211352bc0e) — MEDIUM confidence
- [Building Production-Ready Desktop LLM Apps: Tauri + FastAPI](https://aiechoes.substack.com/p/building-production-ready-desktop) — MEDIUM confidence
- [fastembed-rs (Rust)](https://github.com/Anush008/fastembed-rs) — HIGH confidence
- [sqlite-vec vector extension](https://dev.to/aairom/embedded-intelligence-how-sqlite-vec-delivers-fast-local-vector-search-for-ai-3dpb) — MEDIUM confidence
- [Offline Vector DB with Tauri](https://whoisryosuke.com/blog/2025/offline-vector-database-with-tauri/) — MEDIUM confidence
- [MCP Stdio Transport Security](https://venturebeat.com/security/mcp-stdio-flaw-200000-ai-agent-servers-exposed-ox-security-audit) — HIGH confidence (security finding)
- [MCP Stdio vs Streamable HTTP](https://medium.com/@namankalrabhiwani54/mcp-stdio-vs-streamable-http-d17974cc92a8) — MEDIUM confidence
- [OAuth2 (Rust crate)](https://docs.rs/oauth2/latest/oauth2/) — HIGH confidence
- [yup-oauth2 (Rust)](https://docs.rs/yup-oauth2/) — HIGH confidence
- [tauri-plugin-keyring](https://github.com/charlesportwoodii/tauri-plugin-keyring/tree/master) — MEDIUM confidence
- [Async tasks in Tauri v2](https://dev.to/hiyoyok/rust-async-in-tauri-v2-what-tripped-me-up-and-how-i-fixed-it-1662) — MEDIUM confidence
- [Tauri v2 System Tray](https://v2.tauri.app/learn/system-tray/) — HIGH confidence

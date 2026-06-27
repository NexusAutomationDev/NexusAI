# Roadmap: NexusAI

## Overview

NexusAI is built in 8 phases that follow a strict dependency chain: the Tauri foundation and distribution infrastructure must be correct before anything else; LLM chat provides the streaming architecture reused by every other module; the knowledge base provides the shared RAG layer that makes agents genuinely useful; benchmarking validates multi-model dispatch before agents need it; Gmail and Calendar bring the productivity data into the workspace; MCP establishes the tool layer agents depend on; agent orchestration and automations are the most complex phase and require every prior phase; and the final phase unifies everything into a central dashboard. Each phase delivers a coherent, independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Tauri scaffold, SQLite WAL, OS Keychain, Channel API pattern, settings UI, CI with signing and notarization
- [ ] **Phase 2: LLM Chat** - Streaming chat with markdown rendering, conversation history, multi-provider model selection, file attachment
- [ ] **Phase 3: Knowledge Base + RAG** - Document ingestion, local embeddings, hybrid retrieval, notes editor, shared KB across agents
- [ ] **Phase 4: LLM Benchmarking** - Side-by-side multi-model dispatch, manual scoring
- [ ] **Phase 5: Gmail + Calendar** - OAuth2 PKCE Gmail access, email reading, AI email tools, Google Calendar sync and write
- [ ] **Phase 6: MCP Management** - External MCP servers via UI, per-tool control, health monitoring, NexusAI as MCP server
- [ ] **Phase 7: Agents + Automations** - Node.js sidecar, subagent creation, scheduled automations, natural-language automation config, guardrails
- [ ] **Phase 8: Dashboard + Polish** - Central dashboard aggregating all modules, system tray, background service, cross-platform testing

## Phase Details

### Phase 1: Foundation
**Goal**: The app shell exists with correct architecture — any subsequent module can be added without retrofitting IPC patterns, SQLite config, secret storage, or distribution infrastructure
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08
**Success Criteria** (what must be TRUE):
  1. User can open the app on both macOS and Windows, enter API keys via the settings UI, and confirm keys are stored in the OS Keychain (not in any plain-text file on disk)
  2. User can switch between light and dark theme and see the preference persist across app restarts
  3. User can select a default model per task type (chat, agents, benchmark) via the settings screen
  4. A streaming response from any LLM provider arrives token-by-token via the Channel API pattern — no event-loop emission, memory stable over a 10-minute session
  5. A distributable build can be produced for macOS (notarized, with correct JIT entitlements) and Windows (code-signed), and the updater keypair is backed up with documented recovery procedure
**Plans**: 6 plans
Plans:
- [x] 01-00-PLAN.md — Wave 0: Test scaffold (Vitest config + 8 requirement test files)
- [x] 01-01-PLAN.md — Wave 1: Tauri v2 scaffold + 7-crate Cargo workspace + SQLite WAL + Drizzle proxy
- [x] 01-02-PLAN.md — Wave 2: App shell layout (Sidebar, AppShell, TanStack Router, module stubs)
- [x] 01-03-PLAN.md — Wave 3: Settings page content (API key management + model selection)
- [x] 01-04-PLAN.md — Wave 4: Appearance section + Channel API streaming pattern
- [x] 01-05-PLAN.md — Wave 5: GitHub Actions CI pipeline + updater keypair + SIGNING.md
**UI hint**: yes

### Phase 2: LLM Chat
**Goal**: Users have a fully functional, streaming LLM chat interface that works across all configured providers and persists conversation history
**Depends on**: Phase 1
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05
**Success Criteria** (what must be TRUE):
  1. User can start a conversation and see tokens stream in real-time from any configured provider (OpenRouter, OpenAI, Gemini) without waiting for the full response
  2. User can browse and search all previous conversations and resume any of them, with full history intact across app restarts
  3. User can switch the active model mid-conversation and continue without losing the conversation history
  4. User can attach a PDF, image, or document to a message and receive a response that references its content
  5. Code blocks in LLM responses render with syntax highlighting and Markdown formatting is applied throughout
**Plans**: 9 plans
Plans:
- [x] 02-00-PLAN.md — Wave 1: Test scaffolds for CHAT-01 through CHAT-05 (5 test files + IPC mocks)
- [x] 02-01-PLAN.md — Wave 1: SQLite schema (conversations + messages + attachments) + migration + npm packages
- [x] 02-02-PLAN.md — Wave 2: Rust nexusai-chat crate (streaming, providers, attachments, schema types)
- [x] 02-03-PLAN.md — Wave 2: Chat Zustand store + TanStack Query hooks (conversation/message CRUD)
- [x] 02-04-PLAN.md — Wave 3: Chat layout (two-column resizable) + ConversationList component
- [x] 02-05-PLAN.md — Wave 3: MessageBubble + MarkdownRenderer + MessageList with auto-scroll
- [x] 02-06-PLAN.md — Wave 4: MessageInput (textarea, model picker, file attach, send/stop)
- [x] 02-07-PLAN.md — Wave 5: Route wiring, sidebar enable, keyboard shortcuts, empty state
- [ ] 02-08-PLAN.md — Wave 6: Human smoke test checkpoint
**UI hint**: yes

### Phase 3: Knowledge Base + RAG
**Goal**: Users can build a personal knowledge base from local files, notes, and URLs, and ask the LLM questions that are answered from that knowledge — all embeddings computed locally, shared across agents
**Depends on**: Phase 2
**Requirements**: KB-01, KB-02, KB-03, KB-04, KB-05, KB-06, KB-07
**Success Criteria** (what must be TRUE):
  1. User can drag-drop or import a PDF, .md, .txt, or .docx file and ask the LLM a question whose answer appears in that document — the response cites the source chunk
  2. User can create and edit notes in a Markdown editor with folder organization, and those notes are searchable and retrievable by the LLM via RAG
  3. User can paste a URL and have its content scraped, indexed, and available for LLM questions within one minute
  4. User can browse all knowledge base items (files, notes, URLs) in a file-explorer-style view and see their indexed status
  5. Embeddings for all indexed content are computed locally with no external API call — app functions in offline mode for KB queries against already-indexed content
**Plans**: 8 plans
Plans:
- [ ] 03-00-PLAN.md — Wave 1: Deps + KB schema/migration + Wave 0 RED tests & fixtures
- [ ] 03-01-PLAN.md — Wave 2: Rust ingest (file/URL parse) + chunking + IPC types
- [ ] 03-02-PLAN.md — Wave 2: Rust embeddings (fastembed E5) + sqlite-vec + FTS5/RRF search
- [ ] 03-03-PLAN.md — Wave 3: KB Tauri commands + progress + store + app registration
- [ ] 03-04-PLAN.md — Wave 4: indexingStore + KB queries + browser (tree/table/dropzone)
- [ ] 03-05-PLAN.md — Wave 5: CodeMirror notes editor + /kb two-pane route + sidebar enable
- [ ] 03-06-PLAN.md — Wave 4: Chat RAG — KB-scope selector + citations ([n] + source cards)
- [ ] 03-07-PLAN.md — Wave 6: Human smoke test checkpoint
**UI hint**: yes

### Phase 4: LLM Benchmarking
**Goal**: Users can evaluate multiple LLM models against the same prompt side by side and record which response was better
**Depends on**: Phase 2
**Requirements**: BENCH-01, BENCH-02
**Success Criteria** (what must be TRUE):
  1. User can enter a prompt, select two or more models, and see all responses arrive in parallel columns — each streaming independently
  2. User can mark one response as the winner (or call it a tie), and that manual score is persisted and visible in benchmark history
**Plans**: TBD
**UI hint**: yes

### Phase 5: Gmail + Calendar
**Goal**: Users can read and AI-process their Gmail inbox and view and manage their Google Calendar events, all within NexusAI — OAuth tokens stored exclusively in OS Keychain
**Depends on**: Phase 3
**Requirements**: GMAIL-01, GMAIL-02, GMAIL-03, CAL-01, CAL-02
**Success Criteria** (what must be TRUE):
  1. User can authenticate with their Google account via OAuth2 PKCE and see their Gmail inbox load inside the app without entering a password again on subsequent launches
  2. User can open any email and read its full content (HTML and plain text), and navigate email threads
  3. User can ask the AI to summarize an open email or draft a reply based on its content, and receive a contextual response
  4. User can see their upcoming Google Calendar events synced inside the app
  5. User can create or edit a Google Calendar event from within the app and see it reflected in Google Calendar
**Plans**: TBD
**UI hint**: yes

### Phase 6: MCP Management
**Goal**: Users can connect external MCP servers and control them at the per-tool level, monitor their health, and NexusAI itself is accessible as an MCP server from other clients
**Depends on**: Phase 1
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04
**Success Criteria** (what must be TRUE):
  1. User can add an external MCP server (stdio or HTTP/SSE) via the UI by entering its connection details and see it appear in the server list
  2. User can enable or disable individual tools within a connected MCP server without removing the server
  3. User can view the real-time status, recent logs, and health indicator for each connected MCP server
  4. An external MCP client (e.g., Claude Desktop) can connect to NexusAI as an MCP server and invoke NexusAI's exposed capabilities
**Plans**: TBD
**UI hint**: yes

### Phase 7: Agents + Automations
**Goal**: Users can create subagents with defined roles and tools, set up scheduled and conversational automations, and all agents share the knowledge base — with mandatory guardrails preventing runaway loops
**Depends on**: Phase 3, Phase 6
**Requirements**: AGENT-01, AGENT-02, AGENT-03, AGENT-04
**Success Criteria** (what must be TRUE):
  1. User can create a named subagent, assign it a role description and a set of MCP tools, and run it against a task — the agent's actions and tool calls are visible in a run log
  2. User can set up a scheduled automation (e.g., "summarize my emails every day at 8am") via the GUI and see it execute on schedule with a run history
  3. User can describe an automation in natural language ("send me a morning briefing every weekday") and have the LLM configure it without writing code
  4. Every agent run with tool access is bounded by a maximum iteration count, a wall-clock timeout, and automatic loop detection — a runaway agent stops itself and logs why
**Plans**: TBD

### Phase 8: Dashboard + Polish
**Goal**: All modules are surfaced in a central dashboard, the app runs background tasks when the window is hidden, and the product is stable and consistent across Windows and macOS
**Depends on**: Phase 7
**Requirements**: (none — dashboard requirement not formalized in REQUIREMENTS.md; see Coverage Notes below)
**Success Criteria** (what must be TRUE):
  1. User sees a central dashboard on app launch that aggregates live status from all modules (recent chats, KB item count, upcoming calendar events, agent run status, active MCPs)
  2. Scheduled automations continue to execute when the app window is closed to tray
  3. App appearance and behavior is consistent between macOS (WKWebView) and Windows (WebView2) with no visible CSS or functional regressions
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/6 | Planned | - |
| 2. LLM Chat | 0/9 | Planned | - |
| 3. Knowledge Base + RAG | 0/8 | Planned | - |
| 4. LLM Benchmarking | 0/TBD | Not started | - |
| 5. Gmail + Calendar | 0/TBD | Not started | - |
| 6. MCP Management | 0/TBD | Not started | - |
| 7. Agents + Automations | 0/TBD | Not started | - |
| 8. Dashboard + Polish | 0/TBD | Not started | - |

---

## Coverage Notes

**35/35 v1 requirements mapped across Phases 1-7.**

Phase 8 (Dashboard + Polish) has no formal REQ-ID. The dashboard is listed as an "active" feature in PROJECT.md but was not assigned a requirement ID in REQUIREMENTS.md. Options:
1. Add DASH-01 to REQUIREMENTS.md for the central dashboard requirement and map it to Phase 8
2. Treat Phase 8 as an integration/polish phase with no formal requirement coverage (acceptable for polish phases)

Recommendation: Add DASH-01 to formalize coverage. This can be done during Phase 7→8 transition.

---

*Generated: 2026-06-25 | Phase 1 planned: 2026-06-25 | Phase 2 planned: 2026-06-26*

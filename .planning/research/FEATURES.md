# Feature Landscape

**Domain:** Desktop AI super-app / personal productivity hub
**Researched:** 2026-06-25
**Confidence:** MEDIUM-HIGH (multiple sources, verified against live products)

---

## Research Basis

Investigated: ChatGPT Desktop, Claude Desktop, Cursor, Open WebUI, PyGPT, Dive (MCP host), Notion AI, Obsidian, Linear, Mem.ai, LangGraph Studio, n8n, Make, mcp-hub, mcp-manager, and published RAG production guides.

---

## Table Stakes

Features users expect from a 2025 desktop AI app. Missing one = product feels unfinished.

### LLM Chat

| Feature | Why Expected | Complexity | Reference |
|---------|--------------|------------|-----------|
| Conversation history (persisted across sessions) | Every major chat UI does this | Low | ChatGPT Projects, Claude, Open WebUI |
| Markdown + code block rendering (with syntax highlight) | LLMs output markdown; raw text is unusable | Low | Open WebUI, LobeChat |
| Model selector per conversation | Multi-provider is NexusAI's premise | Low | Open WebUI, Dive |
| System prompt / persona configuration | Power users expect this; unlocks customization | Low | ChatGPT Projects, Open WebUI |
| Streaming responses | Non-streamed responses feel broken in 2025 | Low | Universal |
| File/image attachment input | Claude and ChatGPT both support this | Medium | ChatGPT, Claude Desktop |
| Copy/export conversation | Basic data portability | Low | Open WebUI |
| Stop generation button | Essential for long runaway responses | Low | Universal |
| Token / cost tracking per conversation | Users managing API costs need visibility | Medium | Open WebUI, PyGPT |

### Knowledge Base

| Feature | Why Expected | Complexity | Reference |
|---------|--------------|------------|-----------|
| Local file ingestion (PDF, DOCX, Markdown, TXT) | Obsidian set this expectation | Medium | Obsidian, PyGPT |
| Semantic search (vector) over knowledge base | Table stakes for RAG in 2025 | High | Obsidian + plugins, Open WebUI |
| Backlinks / bidirectional links between notes | Obsidian made this a baseline expectation | Medium | Obsidian |
| Note editor with Markdown support | Obsidian, Notion — every serious PKM does this | Medium | Obsidian, Notion |
| Folder / tag organization | Most basic KB organization | Low | Obsidian, Notion |
| Full-text search across vault | Non-AI keyword search as fallback | Medium | Obsidian |
| Source citation in AI responses (which chunk answered) | Users need to trust and verify AI answers | Medium | Open WebUI RAG with citations |

### Gmail Integration

| Feature | Why Expected | Complexity | Reference |
|---------|--------------|------------|-----------|
| OAuth 2.0 authentication (mandatory since March 2025) | Google deprecated all non-OAuth access March 2025 | Medium | Google Workspace docs |
| Read inbox / threads | Core read access | Medium | Gmail API |
| Compose and send email | Core write access | Medium | Gmail API |
| Reply to thread | Expected from any email integration | Medium | Gmail API |
| Label / folder navigation | Users expect inbox structure mirrored | Medium | Gmail API IMAP |
| Search emails | Gmail search is a primary usage pattern | Medium | Gmail API |
| Thread summarization via AI | Superhuman, Shortwave, Gmail Gemini all do this | Medium | Superhuman, Shortwave |

### Agent & Automation Basics

| Feature | Why Expected | Complexity | Reference |
|---------|--------------|------------|-----------|
| Tool use / function calling by agents | Required for agents to be useful | High | LangGraph, OpenAI Agents SDK |
| Agent run history / log view | Without this, agents are black boxes | Medium | LangGraph Studio, LangSmith |
| Ability to stop / cancel a running agent | Safety and control | Medium | LangGraph |

### UX / Shell

| Feature | Why Expected | Complexity | Reference |
|---------|--------------|------------|-----------|
| Command palette (Cmd+K or Cmd+Shift+P) | Notion, Linear, VS Code set this expectation | Medium | Notion, Linear, VS Code |
| Slash commands in chat input | Cursor, Notion, Claude Code — common pattern | Low | Notion, Cursor |
| Keyboard-first navigation | Power users expect it; reduces friction | Medium | Linear |
| Global hotkey to open app / new chat | Desktop app convention (Alfred, Raycast pattern) | Low | Raycast, Alfred |
| Dark / light mode | Universal desktop app expectation | Low | All apps |
| Settings UI for API keys / provider config | NexusAI's non-negotiable — no hardcoded keys | Low | Requirement from PROJECT.md |

---

## Differentiators

Features that set NexusAI apart from single-purpose tools. Not expected by default, but high value when present.

### Knowledge Base — Advanced

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Graph view (node-link visualization of KB) | Visual thinkers love this; Obsidian's killer feature | High | Starts beautiful, becomes noise at 1000+ notes — needs local graph + filtering |
| Shared knowledge context across ALL agents | No competitor does cross-agent KB today | High | Core NexusAI differentiator; requires KB as a service layer |
| URL ingestion (fetch and index web pages into KB) | Bookmarking + indexing in one action | Medium | Open WebUI does basic version |
| Email/calendar content indexed into KB | Makes AI context-aware of user's actual work | High | No single tool does this end-to-end today |
| Hybrid retrieval (BM25 + vector + rerank) | Dramatically better than vector-only recall | High | See RAG notes below |
| Knowledge source filtering per conversation | "Search only emails from last month" | Medium | Granular context = more accurate answers |

### LLM Chat — Advanced

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Side-by-side model comparison (same prompt → N models) | NexusAI's benchmarking premise; no desktop app does this well | High | LM Arena does it online; nobody does it locally for personal use |
| Branching conversations | Non-linear exploration of responses | High | LobeChat has it; most apps don't |
| Canvas / artifact output panel | ChatGPT Canvas UX — editable outputs next to chat | High | Very high complexity; substantial differentiator |
| Custom personas / agents per chat | Users can save a "Code Reviewer" persona that auto-loads | Medium | Open WebUI model builder, PyGPT experts mode |
| @ mentions to bring in KB chunks mid-conversation | Natural way to inject context ("@myProjectNotes") | Medium | Obsidian + AI plugins do partial version |
| Conversation templates / prompt library | Save and reuse complex prompts | Low | Few apps expose this cleanly |

### LLM Benchmarking

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Run same prompt across N configured models simultaneously | Core NexusAI requirement from PROJECT.md | High | Requires async multi-model dispatch |
| Scoring rubric (user-defined or AI judge) | Moves beyond subjective preference to structured eval | High | LLM-as-judge pattern is well established in 2025 |
| Score history and trend over time | Track which model is getting better/worse for your use case | Medium | Requires persistence layer for eval runs |
| Export benchmark results | Shareable data | Low | CSV / JSON export |
| Latency + cost per model in benchmark | Real-world tradeoffs visible alongside quality score | Medium | Token counting + API response time |

### MCP Management

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Visual MCP server list (enable/disable per server) | mcp-manager has this; NexusAI needs it built-in | Medium | See mcp-manager, Dive on GitHub |
| Add server by config (stdio / SSE / HTTP) | Both transport types needed per MCP 2025-06-18 spec | Medium | Dive handles both |
| Per-tool enable/disable within a server | Fine-grained control; Dive does this | Medium | Granular safety control |
| MCP server health monitoring | Know if a server is broken before agent uses it | Medium | mcp-hub has this pattern |
| Expose NexusAI capabilities as MCP server | Other apps can use NexusAI as a tool source | High | Major differentiator — bidirectional MCP |
| One-click MCP server install from marketplace | Claude Desktop has directory; NexusAI should too | High | Requires catalog / registry integration |
| Environment variable management for MCP configs | Credentials per-server without plaintext leaks | Medium | mcp-hub uses placeholder syntax |

### Agent Orchestration

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Visual agent graph builder (drag nodes/edges) | LangGraph Studio UX on desktop | Very High | Most complex feature in the app |
| Supervisor + worker agent topology | Standard multi-agent pattern (LangGraph) | High | Requires proper state management |
| Persistent checkpointing / time-travel debugging | LangGraph's killer feature — replay any state | High | Requires DB-backed checkpointer |
| Per-node metrics overlay (latency, cost, tool calls) | Debugging and optimization | High | LangGraph Studio has this |
| Human-in-the-loop interrupt points | Safety gate before irreversible agent actions | High | LangGraph supports this pattern |
| Shared agent memory via KB | Agents learn from each other's runs | High | Core NexusAI differentiator |

### Gmail / Email — Advanced

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI draft generation from thread context | Superhuman/Shortwave-level feature | High | Requires context threading + LLM |
| Action item extraction from threads | Reduces email-to-task friction | Medium | LLM summarization pattern |
| Smart triage / priority inbox via AI | High user value; few desktop apps do this locally | High | Requires email scanning + classification |
| Draft in user's voice (learn writing style) | Shortwave Ghostwriter — personal AI writer | Very High | Requires fine-tuning or RAG on sent emails |

### Calendar

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Google Calendar read (events list) | Baseline for "what's my day" query | Medium | Google Calendar API OAuth |
| Event creation from natural language | "Schedule 1h with Sarah next Tuesday" → creates event | High | NLP → Calendar API write |
| Context from calendar in AI responses | Agent knows you have a meeting in 30 min | Medium | Calendar as a data source in KB/context |

### Automations

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Conversation-triggered automation creation | "From now on, summarize every email from @boss" | Very High | Requires intent parsing + automation storage |
| Visual trigger-action builder (no-code) | n8n / Make pattern for non-technical users | High | Drag-and-drop canvas, trigger picker, action picker |
| Scheduled automations (cron-based) | "Every Monday morning summarize my week" | Medium | Requires background task runner |
| Automation run history and logs | Debugging automations | Medium | Table of runs with status and output |

---

## Anti-Features

Things to deliberately NOT build in v1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time collaboration / multiplayer | Out of scope per PROJECT.md; adds extreme complexity | Single-user local-first; export/share when needed |
| Mobile app | Out of scope per PROJECT.md | Desktop only — Windows + macOS |
| Own cloud backend for data storage | Out of scope per PROJECT.md; privacy risk | Local SQLite + vector DB; user owns all data |
| Training / fine-tuning models | Massively out of scope; requires GPU infra | Use RAG for personalization instead |
| Graph view at launch | Spectacular for 50-200 notes, becomes visual noise at 1000+; requires dedicated force-layout engine | Ship flat folder+tag view in v1; graph view is v2+ |
| Voice input / output | High complexity (STT/TTS pipelines), nice-to-have not core | Ship text-first; voice is a later phase |
| Image generation | Creative tool, not productivity hub | Exclude or expose via MCP tool only |
| Built-in browser / web scraping | Complexity; OS webview sandboxing issues in Tauri | Use MCP Fetch server or user-provided web-search MCP |
| Social / sharing features | Not a social product | Export to file/clipboard |
| Plugin marketplace (own) | Enormous surface area to maintain | Use MCP ecosystem as the plugin layer instead |
| Email client full parity (IMAP/SMTP all providers) | Gmail is enough for v1; full IMAP is a separate product | Gmail-first, expand later if validated |
| Custom LLM fine-tuning UI | Not relevant to target user; massive scope | Stick to inference; fine-tuning via external tooling |
| Canvas / whiteboard editing | ChatGPT Canvas took months to build; not core to NexusAI's KB-first premise | Artifact panel (read-only with copy) is sufficient for v1 |

---

## Feature Dependencies

```
OAuth / Gmail auth
  → Gmail read
    → Thread summarization
      → Action item extraction
      → AI draft (depends on LLM chat)
    → Email indexed to KB
      → AI answers questions about emails

API key config (Settings)
  → LLM chat (model selector, streaming)
    → Agent tool use
      → Agent orchestration
        → Shared KB access
        → MCP tools
    → LLM benchmarking (multi-model dispatch)

KB ingestion pipeline (chunking → embeddings → vector store)
  → Semantic search
    → RAG-powered chat (@ mention, file context)
      → Agent KB access
      → Email/calendar context in AI

MCP server config (stdio/SSE)
  → MCP tool calling in agents
    → Agent orchestration (uses MCPs as tools)
  → NexusAI as MCP server (reverse direction)

Automation trigger store
  → Scheduled runs (cron runner)
  → Conversation-triggered automations (intent parser)
    → Agent execution
    → Gmail actions
    → Calendar actions
```

---

## MVP Recommendation

### Phase 1 — Core Loop (must ship together)

1. API key config + provider setup (OpenRouter, OpenAI, Gemini)
2. LLM chat: streaming, markdown, history, model selector, system prompt
3. Local note editor (Markdown, folder tree, basic search)
4. Settings panel (API keys, default model)

Without these four working together, nothing else is useful.

### Phase 2 — Knowledge Base

5. File ingestion to KB (PDF, DOCX, Markdown)
6. Vector embeddings via sqlite-vec (embedded, no server)
7. RAG: semantic search in chat (cite sources)
8. Full-text search fallback (SQLite FTS5)

### Phase 3 — LLM Benchmarking

9. Side-by-side multi-model dispatch
10. Manual scoring rubric
11. Benchmark history + export

This is a core differentiator and relatively self-contained. Build before Gmail.

### Phase 4 — Gmail Integration

12. OAuth 2.0 flow
13. Inbox read + thread view
14. Compose + reply
15. AI thread summarization
16. Email content indexed to KB

### Phase 5 — MCP Management

17. MCP server list UI (add/remove/enable/disable)
18. Per-tool enable/disable
19. Server health status
20. Connect NexusAI KB and tools as MCP server (reverse direction)

### Phase 6 — Agent Orchestration + Automations

21. Basic agent with MCP tools (single agent, runs in chat)
22. Agent run log
23. Visual trigger-action automation builder
24. Automation scheduler

### Defer to v2

- Calendar (read + NLP scheduling)
- Visual agent graph builder (LangGraph Studio-style)
- Human-in-the-loop interrupt UI
- Advanced agent topologies (supervisor + worker)
- Graph view for KB
- Voice input/output
- AI email drafting in user's voice

---

## Competitive Reference Map

| Feature Area | Best-in-Class Reference | What NexusAI Should Learn |
|--------------|------------------------|--------------------------|
| LLM chat UI | Open WebUI | Markdown rendering, multi-provider, RAG citation pattern |
| Knowledge base | Obsidian | Local-first vault, backlinks, folder + tag model |
| MCP management | Dive | Per-tool toggle, enable/disable, stdio + SSE support |
| Agent visualization | LangGraph Studio | Graph topology view, per-node metrics, state replay |
| Benchmarking UX | LM Arena / Chatbot Arena | Side-by-side layout, model labels, scoring |
| Automation builder | n8n | Visual trigger-action canvas, no-code node editor |
| Email AI | Shortwave | Thread summarization, AI drafts, triage |
| Command UX | Linear / Notion | Command palette, keyboard-first, slash commands |

---

## RAG System Requirements (Production Quality)

These inform the KB architecture; not just feature flags.

**Chunking:**
- Documents: 512-1024 tokens with 128-token overlap
- Code: function/class-level chunks via AST
- Every chunk must carry metadata: source file, section heading, parent doc ID, ingestion timestamp

**Embeddings:**
- Use a local or API embedding model consistently (do not mix embedding models across a single KB index)
- For local-first: Ollama-served embedding models (no API cost per query)
- For quality + low cost: Voyage AI (`voyage-3-large`) — outperforms OpenAI embeddings by ~10% on MTEB

**Retrieval:**
- Hybrid: BM25 (keyword) + vector similarity — do not use vector-only
- Re-ranker pass after retrieval (cross-encoder or LLM-judge rerank)
- Return top-k = 5-10 chunks, include metadata for citation

**Storage:**
- sqlite-vec is sufficient for <100k documents (embedded, zero-config, works inside Tauri)
- Chromadb (uses sqlite + hnswlib) is a viable alternative with Python SDK
- Do not use Pinecone/Weaviate/Qdrant for local-first desktop — they require a server

**Known failure modes:**
- 80% of RAG failures are at the ingestion/chunking layer, not the LLM
- Missing metadata = no citations = users lose trust
- Vector-only retrieval misses exact keyword matches (names, IDs, codes)
- Large context windows do not replace good retrieval — accuracy drops when relevant chunk is in the middle of a 1M-token window

---

## Sources

Research basis (confidence levels noted):

- Open WebUI features — HIGH (verified against docs.openwebui.com and GitHub)
- Dive MCP Host — HIGH (verified against GitHub openagentplatform/Dive)
- mcp-hub — HIGH (verified against GitHub ravitemer/mcp-hub)
- PyGPT feature list — HIGH (verified against GitHub szczyglis-dev/py-gpt)
- LangGraph Studio — HIGH (verified against langchain.com/langgraph)
- ChatGPT Desktop features — HIGH (verified against OpenAI Help Center)
- Notion AI Agents — MEDIUM (multiple consistent sources, Notion blog + CNBC)
- Obsidian KB features — HIGH (verified against obsidian.md docs)
- RAG production requirements — MEDIUM-HIGH (multiple production guides, 2026 date)
- Gmail OAuth mandate (March 2025) — HIGH (verified against Google Workspace admin docs)
- LLM evaluation platforms — MEDIUM (WebSearch, multiple sources agree)
- sqlite-vec for desktop RAG — HIGH (verified against DEV Community + SitePoint articles)
- Automation builder UX patterns — MEDIUM (n8n, Make documentation + multiple blog sources)
- No-code automation market data — LOW (analyst estimates, single source)

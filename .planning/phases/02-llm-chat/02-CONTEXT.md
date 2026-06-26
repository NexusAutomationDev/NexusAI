# Phase 2: LLM Chat - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers a fully functional streaming LLM chat interface that works across all configured providers (OpenRouter, OpenAI, Gemini API). Users can create conversations, see tokens arrive in real-time, browse and search conversation history, switch models mid-conversation without losing history, attach files (PDFs, images, documents) to messages, and see responses rendered with markdown formatting and syntax-highlighted code blocks.

No knowledge base integration, no Gmail/Calendar, no agents — those are Phase 3+. The only user-facing feature in Phase 2 is the Chat module itself.

</domain>

<decisions>
## Implementation Decisions

### Chat UI Layout
- **D-01:** Two-column split layout — conversation list always visible on left, chat view on right (like Slack/Discord). No need to switch views to browse conversations.
- **D-02:** Conversation list width: resizable (user can drag to adjust), starts at default 280px.
- **D-03:** Conversation list shows: title + timestamp + model badge. Dense but informative, matches Linear/Raycast aesthetic from Phase 1.
- **D-04:** Search bar at top of conversation list — searches title + message content, filters list in real-time. Standard pattern.
- **D-05:** "New Chat" button at top of conversation list (above search bar) — creates new conversation, focuses input.
- **D-06:** Conversation titles: auto-generate from first message using LLM. User can edit. No manual naming friction.
- **D-07:** Conversations organized in flat list with time-based sections ("Today", "Yesterday", "Last 7 days", etc.) — no folders/tags in Phase 2.
- **D-08:** Individual messages use full-width alternating backgrounds (user messages one background, AI messages another) like ChatGPT/Claude. Maximizes readable width for code/long text.
- **D-09:** Message input placed bottom-fixed with padding — always visible above window edge, like ChatGPT/Claude. Standard pattern.

### Streaming & Markdown Rendering
- **D-10:** Markdown library: `react-markdown` + `rehype-highlight` for syntax highlighting. Most popular React markdown renderer, battle-tested.
- **D-11:** Code blocks have copy button (on hover) + language badge (top-right). Standard UX for AI chat (like ChatGPT, Claude).
- **D-12:** Partial markdown parsed and rendered incrementally during streaming — code blocks/formatting appear as soon as complete. Smooth UX but more CPU (acceptable tradeoff).
- **D-13:** Auto-scroll if user is near bottom (within ~100px). If user scrolled up, don't interrupt. Standard chat pattern.
- **D-14:** Stop button appears during streaming (cancels request). Regenerate button on finished messages. Standard AI chat pattern.

### File Attachments
- **D-15:** Paperclip button in input area (opens file picker) + drag-drop zone over chat area. Standard pattern (ChatGPT, Claude).
- **D-16:** Attached files show preview before sending: images show thumbnail, documents show icon + filename. User can remove before send.
- **D-17:** File type restrictions: PDF, images (jpg/png/webp), docs (docx/txt/md). Max 10MB per file. Matches typical LLM provider limits.
- **D-18:** Files sent to LLM providers as base64 inline in message content. Standard for OpenAI/Anthropic/Gemini APIs. No separate upload step.
- **D-19:** Multiple files per message allowed (no hard cap, but UI should handle 2-5 files gracefully).

### Model Selection
- **D-20:** Per-message model picker — dropdown next to send button, user picks model for each message. Conversation history preserved across model changes (CHAT-03 requirement).
- **D-21:** Each AI message shows model badge (e.g., 'GPT-4o', 'Claude 3.5') in message header. Clear which model answered, matches conversation list badge decision.
- **D-22:** Model picker defaults to last used model in conversation (continuity within conversation).
- **D-23:** When switching models mid-conversation, send full history to new model. Conversation context maintained (CHAT-03 requirement).

### Message Actions
- **D-24:** Message actions available: Copy (any message), Edit (user messages — re-sends), Delete (any message). Standard chat actions.

### Loading & Error States
- **D-25:** API errors displayed as inline error message in chat (like "API Error: Rate limit exceeded"). Clear context, doesn't interrupt flow.
- **D-26:** Typing indicator (3 dots animation) in message bubble while waiting for stream to start. Standard chat pattern.

### Keyboard Shortcuts
- **D-27:** Enter sends message, Shift+Enter for newline in input (like ChatGPT, Claude). Standard for AI chat.
- **D-28:** Cmd/Ctrl+K creates new conversation (common pattern). Up/down arrows navigate conversation list when focused.

### Conversation Deletion
- **D-29:** Delete via context menu (right-click or three-dot menu on conversation) + confirmation dialog ("Are you sure?"). Safe, standard pattern.
- **D-30:** No archive feature in Phase 2 — conversations are either visible or deleted (SQLite soft-delete for safety). Archive complexity deferred.

### Data Storage
- **D-31:** Normalized schema: `conversations` table → `messages` table → `attachments` table. Attachment files on disk, paths in DB. Clean, queryable.
- **D-32:** Messages persisted immediately after each message sent/received — save user message on send, AI message as tokens arrive (or on completion). Real-time persistence, zero data loss risk.

### System Prompts
- **D-33:** No system prompts / custom instructions in Phase 2. Deferred to Phase 7 (Agents) or future. Keeps scope tight (CHAT scope is basic chat, not agent configuration).

### Empty States
- **D-34:** First-time user (no conversations): centered welcome message ("Start a conversation"), input field active and ready. User can type immediately.

### Claude's Discretion
- Conversation title generation prompt (what to ask LLM for title generation)
- Exact SQLite schema column names and types (as long as normalized structure is maintained)
- Resizable conversation list implementation (drag handle, state persistence)
- Markdown syntax highlighting theme (must be accessible with dark/light themes)
- Error message formatting and wording (keep concise, actionable)
- Attachment file storage location on disk (use Tauri app data directory)
- Typing indicator animation timing and style
- Confirmation dialog copy ("Are you sure you want to delete this conversation?")

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §LLM Chat (CHAT-01 through CHAT-05) — all 5 requirements mapped to this phase; success criteria are the acceptance bar
- `.planning/ROADMAP.md` §Phase 2 — goal, success criteria, and UI hint

### Architecture (from CLAUDE.md and Phase 1 context)
- `CLAUDE.md` §Technology Stack — react-markdown, rehype-highlight, Channel API streaming, SQLite with Drizzle ORM proxy
- `CLAUDE.md` §Critical Architecture Constraint: The Tauri Webview Boundary — Channel API for streaming, file handling constraints
- `.planning/phases/01-foundation/01-CONTEXT.md` — established patterns: Sidebar navigation, Zustand stores with Tauri Store persistence, AppShell layout (ml-12 offset), shadcn/ui component library, settings store with model selection

### No external ADRs yet — requirements fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Sidebar component** (`src/components/layout/Sidebar.tsx`) — already has Chat module icon (MessageSquare), currently disabled. Change `implemented: false` to `implemented: true` for Chat module.
- **AppShell component** (`src/components/layout/AppShell.tsx`) — provides ml-12 offset for main content, Outlet for route rendering. Chat route will render inside this shell.
- **Settings store** (`src/lib/stores/settings.ts`) — has `chatModel` state with Tauri Store persistence, model picker can read/write from here.
- **shadcn/ui components** — Button, Input, Select, Badge, Tooltip, Separator already available for chat UI construction.
- **TanStack Router** — routing setup exists, need to add `/chat` route with conversation list + chat view.

### Established Patterns
- **Zustand stores with Tauri Store persistence** — create `src/lib/stores/chat.ts` following the same pattern as `settings.ts` (load from store, update with `set()` + `store.set()`).
- **Channel API streaming** — Phase 1 documented this pattern in context but not yet implemented. Phase 2 implements the actual streaming pattern (Rust side: async reqwest + tokio streams → `channel.send()`, TypeScript side: `channel.listen()` → state updates).
- **Sidebar navigation pattern** — icon-only sidebar with tooltips. Chat module already declared in `MODULES` array, just needs `implemented: true`.

### Integration Points
- **Route**: Create `src/routes/chat/` directory with layout and conversation routes (TanStack Router file-based routing).
- **SQLite schema**: Extend Drizzle schema (`src/lib/db/schema.ts`) with `conversations`, `messages`, `attachments` tables.
- **Rust crate**: `src-tauri/crates/nexusai-chat/` already exists as stub. Implement LLM API calls (reqwest), streaming Channel API, file handling, SQLite writes.
- **Sidebar**: Update `src/components/layout/Sidebar.tsx` → change Chat module `implemented: true`.

</code_context>

<specifics>
## Specific Ideas

- **Visual reference:** Two-column split like Slack/Discord for conversations + chat. Full-width alternating backgrounds like ChatGPT/Claude for messages.
- **Markdown rendering:** Incremental parsing during streaming — user sees formatting appear as soon as markdown elements complete, not just plain text.
- **Model switching:** Per-message granularity with full history sent to new model. This is more flexible than conversation-level switching and directly satisfies CHAT-03.
- **File attachments:** Base64 inline is simpler than file upload endpoints and matches how OpenAI/Anthropic/Gemini APIs work natively.
- **No system prompts:** Keeps Phase 2 scope tight. System prompts are an "agent configuration" concept — belongs in Phase 7 (Agents), not basic chat.

</specifics>

<deferred>
## Deferred Ideas

- Archive feature (hide without delete) — deferred to future; Phase 2 has delete only
- Example prompt suggestions on empty state — deferred to future; Phase 2 has simple welcome message + input
- Global or per-conversation system prompts — deferred to Phase 7 (Agents) or v2
- Conversation folders/tags — deferred to future; Phase 2 has time-based sections only
- Export conversation (markdown, JSON) — deferred to future
- Search filters (by model, date range) — deferred to future; Phase 2 has basic text search only
- Vim-style keyboard navigation (J/K) — deferred to v2; Phase 2 has minimal shortcuts (Cmd+K, arrows)

</deferred>

---

*Phase: 02-llm-chat*
*Context gathered: 2026-06-26*

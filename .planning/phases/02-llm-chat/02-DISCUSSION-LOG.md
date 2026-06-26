# Phase 2: LLM Chat - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-26
**Phase:** 02-llm-chat
**Areas discussed:** Chat UI Layout & Conversation List, Streaming & Markdown Rendering, File Attachments, Model Selection in Chat, Message Actions, Loading & Error States, Keyboard Shortcuts, Conversation Deletion & Archive, Data Storage & Schema, Conversation Auto-save, System Messages & Prompts, Empty States

---

## Chat UI Layout & Conversation List

### Message Display Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Centered column (max-width) | Messages centered with max-width (like ChatGPT, Claude web) — better readability for long conversations. Leaves empty space on ultrawide. | |
| Full-width with padding | Messages span full available width with left/right padding — uses all screen real estate. Better for code blocks. | |
| Two-column split | Conversation list always visible on left, chat on right (like Slack/Discord) — no need to switch views to browse conversations. | ✓ |

**User's choice:** Two-column split
**Notes:** Keeps conversation list always visible for quick switching without navigation overhead.

---

### Conversation List Content

| Option | Description | Selected |
|--------|-------------|----------|
| Title + timestamp + model badge (Recommended) | Title (first message or auto-generated), last message time, model indicator. Dense but informative — matches Linear/Raycast aesthetic from Phase 1. | ✓ |
| Title + preview snippet + timestamp | Title + first line of last message + time. More context but takes more vertical space. | |
| Title only (minimal) | Just conversation title. Maximum density, less context. User decides titles explicitly. | |

**User's choice:** Title + timestamp + model badge (Recommended)
**Notes:** Balances information density with visual cleanliness per Phase 1 aesthetic.

---

### Conversation Search

| Option | Description | Selected |
|--------|-------------|----------|
| Search bar at top of conversation list (Recommended) | Input field above the conversation list — searches title + message content. Filters list in real-time. Standard pattern. | ✓ |
| Command palette (Cmd+K) | Global command palette for search (like Raycast/Linear) — more powerful but needs keyboard-first users. | |
| Filter dropdown + search input | Dropdown to filter by model/date range + search input. More granular but more UI complexity. | |

**User's choice:** Search bar at top of conversation list (Recommended)
**Notes:** CHAT-02 requires search; standard pattern is most discoverable.

---

### New Conversation Creation

| Option | Description | Selected |
|--------|-------------|----------|
| 'New Chat' button at top of conversation list (Recommended) | Prominent button above conversations (like ChatGPT, Claude). Clears current chat, focuses input. | ✓ |
| Auto-create on first message | No explicit 'new' button — empty state has input, first message creates conversation. Simpler but less explicit. | |
| Both: button + auto-create | Button for explicit new chat, but also auto-create if user types in empty state. Most flexible. | |

**User's choice:** 'New Chat' button at top of conversation list (Recommended)
**Notes:** Explicit, discoverable action for creating new conversations.

---

### Conversation Titles

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-generate from first message (Recommended) | LLM generates concise title from first message (like ChatGPT). User can edit. No manual naming friction. | ✓ |
| User names manually | User must provide a title when creating conversation. Explicit but adds step. | |
| Timestamp-based (no titles) | Conversations identified by date/time only (like 'Today, 2:34 PM'). Simple but harder to find specific conversations. | |

**User's choice:** Auto-generate from first message (Recommended)
**Notes:** Reduces friction while maintaining searchability.

---

### Conversation List Width

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed 280px (Recommended) | Standard sidebar width (like VS Code, Linear) — consistent, predictable. Works well with title + timestamp + badge. | |
| Resizable | User can drag to resize the conversation list. More flexible but adds complexity and state management. | ✓ |
| Fixed 320px (wider) | Wider to show more of title/preview. Takes more horizontal space from chat area. | |

**User's choice:** Resizable
**Notes:** User requested flexibility for different screen sizes and preferences.

---

### Message Style

| Option | Description | Selected |
|--------|-------------|----------|
| Full-width alternating backgrounds (Recommended) | User messages one background, AI messages another (like ChatGPT, Claude) — maximizes readable width for code/long text. | ✓ |
| Chat bubbles (left/right) | User messages on right with bubble, AI on left (like iMessage). More conversational feel but wastes horizontal space. | |
| Minimal — no backgrounds | Just text with subtle dividers. Very clean but harder to distinguish who said what. | |

**User's choice:** Full-width alternating backgrounds (Recommended)
**Notes:** Maximizes code readability, aligns with power-tool aesthetic from Phase 1.

---

### Conversation Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Flat list with time-based sections (Recommended) | All conversations in one list, auto-grouped by 'Today', 'Yesterday', 'Last 7 days', etc. Simple, zero friction. | ✓ |
| User-created folders/tags | Users can create folders or tag conversations for organization. More powerful but adds complexity and UI. | |
| Flat list only | Single chronological list, no grouping. Simplest but harder to navigate with many conversations. | |

**User's choice:** Flat list with time-based sections (Recommended)
**Notes:** Automatic organization with no user overhead.

---

### Input Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom-fixed with padding (Recommended) | Input bar fixed at bottom of chat area (above window edge) — always visible, like ChatGPT/Claude. Standard pattern. | ✓ |
| Bottom of scroll area | Input appears after all messages (scrolls with content) — simpler but hidden when messages overflow. | |
| Top (reverse chat) | Input at top, newest messages below (like Slack threads). Unconventional but keeps input always visible. | |

**User's choice:** Bottom-fixed with padding (Recommended)
**Notes:** Standard AI chat pattern, always accessible.

---

## Streaming & Markdown Rendering

### Markdown Library

| Option | Description | Selected |
|--------|-------------|----------|
| react-markdown + rehype-highlight (Recommended) | Most popular React markdown renderer. Works with remark/rehype plugins. Battle-tested, good syntax highlighting. | ✓ |
| marked + highlight.js (manual) | Lower-level — parse markdown yourself, render as dangerouslySetInnerHTML. More control but more work. | |
| @uiw/react-markdown-preview | All-in-one component with syntax highlighting built-in. Simpler setup but less customization. | |

**User's choice:** react-markdown + rehype-highlight (Recommended)
**Notes:** Industry standard, CHAT-05 requires syntax highlighting.

---

### Code Block Features

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — copy button + language badge (Recommended) | Copy button appears on hover (like ChatGPT, Claude). Language badge in top-right. Standard UX for AI chat. | ✓ |
| Copy button only | No language label — just copy functionality. Simpler but less informative. | |
| No extras (just highlighted code) | Plain syntax-highlighted code blocks. User copies manually. Minimal but less convenient. | |

**User's choice:** Yes — copy button + language badge (Recommended)
**Notes:** Standard AI chat UX, improves usability.

---

### Partial Markdown Parsing

| Option | Description | Selected |
|--------|-------------|----------|
| Parse and render incrementally (Recommended) | Re-parse markdown on every token — code blocks/formatting appear as soon as complete. Smooth but more CPU. | ✓ |
| Buffer until markdown elements complete | Show raw text mid-block, render markdown only when element finished. Less CPU but choppier UX. | |
| Show raw text, parse on stream end | Stream shows plain text, markdown renders when response finishes. Smoothest streaming but delayed formatting. | |

**User's choice:** Parse and render incrementally (Recommended)
**Notes:** CHAT-01 requires real-time streaming; incremental parsing provides best UX.

---

### Auto-scroll Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-scroll if user is near bottom (Recommended) | Scroll to follow new tokens IF user is at bottom (within ~100px). If user scrolled up, don't interrupt. Standard chat pattern. | ✓ |
| Always auto-scroll | Force scroll to bottom on every token. Smooth but disruptive if user is reading earlier messages. | |
| Never auto-scroll | User manually scrolls to see new tokens. Least disruptive but feels broken. | |

**User's choice:** Auto-scroll if user is near bottom (Recommended)
**Notes:** Respects user intent when reading history, follows stream when watching.

---

### Stop & Regenerate Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Stop button during streaming + regenerate after (Recommended) | 'Stop' button appears during streaming (cancels request). 'Regenerate' button on finished messages. Standard AI chat pattern. | ✓ |
| Stop button only | Can interrupt streaming but can't regenerate. Simpler but less flexible. | |
| No controls | Responses run to completion, no stop/regenerate. Simplest but frustrating for bad responses. | |

**User's choice:** Stop button during streaming + regenerate after (Recommended)
**Notes:** Standard AI chat pattern, gives user control over response quality.

---

## File Attachments

### Attachment Method

| Option | Description | Selected |
|--------|-------------|----------|
| Paperclip button + drag-drop (Recommended) | Paperclip icon in input area (opens file picker) + drag-drop zone over chat. Standard pattern (ChatGPT, Claude). | ✓ |
| Drag-drop only | No explicit button — drag files into chat area. Cleaner UI but less discoverable. | |
| Button only (no drag-drop) | Paperclip button opens file picker. Simpler implementation but less convenient. | |

**User's choice:** Paperclip button + drag-drop (Recommended)
**Notes:** CHAT-04 requires file attachment; dual method is most discoverable.

---

### File Preview

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — thumbnail + name + remove button (Recommended) | Images show thumbnail, documents show icon + filename. User can remove before send. Clear feedback. | ✓ |
| Name + icon only | Show filename with type icon, no image thumbnails. Simpler but less visual. | |
| No preview (list only) | Just filename in list below input. Minimal but less informative. | |

**User's choice:** Yes — thumbnail + name + remove button (Recommended)
**Notes:** Clear visual feedback before sending.

---

### File Type Restrictions

| Option | Description | Selected |
|--------|-------------|----------|
| Restrict to common types + 10MB limit (Recommended) | Allow: PDF, images (jpg/png/webp), docs (docx/txt/md). Max 10MB per file. Matches typical LLM provider limits. | ✓ |
| Allow all types, warn on unsupported | No upfront restriction — accept anything, show error if provider rejects. More flexible but confusing. | |
| No restrictions | Allow any file type/size. Simplest but will fail at API call time with cryptic errors. | |

**User's choice:** Restrict to common types + 10MB limit (Recommended)
**Notes:** Prevents confusing provider-side errors by validating upfront.

---

### API Format for Files

| Option | Description | Selected |
|--------|-------------|----------|
| Base64 inline in message content (Recommended) | Encode file as base64, include in message payload. Standard for OpenAI/Anthropic/Gemini APIs. No separate upload step. | ✓ |
| Upload to temp storage, send URL | Upload file to local temp dir, send file:// URL. Avoids large payloads but adds complexity. | |
| Provider-specific handling | Different approach per provider based on their docs. Most flexible but more code. | |

**User's choice:** Base64 inline in message content (Recommended)
**Notes:** Matches how OpenAI/Anthropic/Gemini APIs work natively, simplest implementation.

---

### Multiple Attachments

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — multiple files per message (Recommended) | User can attach 2+ files before sending (like email). More flexible. Show all previews in a row/grid. | ✓ |
| One file per message | Only one attachment allowed per message. Simpler but less convenient for multi-document questions. | |
| Multiple files, but max 3-5 | Allow multiple but cap at reasonable limit. Prevents payload bloat. | |

**User's choice:** Yes — multiple files per message (Recommended)
**Notes:** More flexible for multi-document questions.

---

## Model Selection in Chat

### Model Switching Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Per-message model picker (Recommended) | Dropdown next to send button — user picks model for each message. Conversation history preserved across model changes. Flexible. | ✓ |
| Conversation-level (with switch option) | Conversation uses one model, but user can switch via menu (applies to future messages). Simpler but less granular. | |
| Use global chatModel setting only | No per-conversation switching — use Settings > chatModel for all chats. Simplest but violates CHAT-03. | |

**User's choice:** Per-message model picker (Recommended)
**Notes:** CHAT-03 requires mid-conversation model switching; per-message is most flexible.

---

### Model Badge on Messages

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — model badge on each AI message (Recommended) | Small badge (e.g., 'GPT-4o', 'Claude 3.5') in message header. Clear which model answered. Matches conversation list badge decision. | ✓ |
| Show only when model changes | Badge appears only when switching models mid-conversation. Less visual noise but less clear. | |
| No badge (user knows from picker) | No model indicator on messages. Cleanest but loses context when reviewing old conversations. | |

**User's choice:** Yes — model badge on each AI message (Recommended)
**Notes:** Provides context when reviewing old conversations, matches list design.

---

### Model Picker Default

| Option | Description | Selected |
|--------|-------------|----------|
| Last used model in conversation (Recommended) | Picker defaults to whatever model was used in previous message. Continuity within conversation. | ✓ |
| Global chatModel from Settings | Always default to Settings > chatModel. Consistent but ignores conversation context. | |
| Remember per-conversation | Each conversation remembers its last model, persisted. Most flexible but more state to manage. | |

**User's choice:** Last used model in conversation (Recommended)
**Notes:** Provides continuity within conversation without extra persistence complexity.

---

### History When Switching Models

| Option | Description | Selected |
|--------|-------------|----------|
| Send full history to new model (Recommended) | When switching to different model, send all prior messages as context. Continuity maintained (CHAT-03 requirement). | ✓ |
| Start fresh context | New model sees only new messages (no prior history). Cleaner separation but breaks conversation flow. | |
| Ask user each time | Prompt 'Include previous N messages?' when switching. Most control but adds friction. | |

**User's choice:** Send full history to new model (Recommended)
**Notes:** CHAT-03 requires switching "without losing conversation history" — full history send is correct interpretation.

---

## Message Actions

### Available Actions

| Option | Description | Selected |
|--------|-------------|----------|
| Copy, Edit (user), Delete (Recommended) | Copy any message, edit your own messages (re-sends), delete any message. Standard chat actions. | ✓ |
| Copy only | Only copy action available. Simplest but less flexible — can't fix typos or remove mistakes. | |
| Copy, Edit, Delete, Regenerate, Share | Full action suite including share message/conversation. Most powerful but clutters UI. | |

**User's choice:** Copy, Edit (user), Delete (Recommended)
**Notes:** Standard chat actions; Regenerate already handled separately as stream control.

---

## Loading & Error States

### Error Display

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error message in chat (Recommended) | Show error as a message in the conversation (like 'API Error: Rate limit exceeded'). Clear context, doesn't interrupt flow. | ✓ |
| Toast notification | Pop-up notification at top/bottom of screen. Less intrusive but user might miss it. | |
| Modal dialog | Error modal blocks interaction until dismissed. Most prominent but disruptive. | |

**User's choice:** Inline error message in chat (Recommended)
**Notes:** Keeps error in conversation context, less disruptive than modal.

---

### Loading Indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Typing indicator (3 dots animation) (Recommended) | Animated '...' in message bubble while waiting for stream to start. Standard chat pattern. | ✓ |
| Skeleton message block | Gray placeholder block with shimmer effect. More modern but less clear. | |
| Spinner in message area | Loading spinner where message will appear. Clear but feels slower. | |

**User's choice:** Typing indicator (3 dots animation) (Recommended)
**Notes:** Standard chat pattern, clear and non-intrusive.

---

## Keyboard Shortcuts

### Send Key

| Option | Description | Selected |
|--------|-------------|----------|
| Enter sends, Shift+Enter for newline (Recommended) | Enter sends message (like ChatGPT, Claude). Shift+Enter adds line break in input. Standard for AI chat. | ✓ |
| Ctrl+Enter sends, Enter for newline | Enter adds newline, Ctrl+Enter sends (like Slack). Better for multi-line messages but less common. | |
| Configurable (user chooses) | Let user pick in settings. Most flexible but v2 requirement says no custom shortcuts in v1. | |

**User's choice:** Enter sends, Shift+Enter for newline (Recommended)
**Notes:** Standard AI chat pattern; v2 defers custom shortcuts.

---

### Navigation Shortcuts

| Option | Description | Selected |
|--------|-------------|----------|
| Cmd/Ctrl+K for new chat, arrow keys in list (Recommended) | Cmd+K creates new conversation (common pattern). Up/down arrows navigate conversation list when focused. Minimal but useful. | ✓ |
| Full keyboard nav (J/K, Cmd+number) | Vim-style J/K for list, Cmd+1-9 for quick switch. Power-user friendly but steeper learning curve. | |
| No keyboard shortcuts (mouse only) | Click-only navigation. Simplest but less efficient for keyboard users. | |

**User's choice:** Cmd/Ctrl+K for new chat, arrow keys in list (Recommended)
**Notes:** Minimal shortcuts for keyboard users; v2 defers complex custom shortcuts.

---

## Conversation Deletion & Archive

### Deletion Method

| Option | Description | Selected |
|--------|-------------|----------|
| Context menu + confirmation dialog (Recommended) | Right-click or three-dot menu on conversation → Delete → 'Are you sure?' confirmation. Safe, standard pattern. | ✓ |
| Swipe to delete (mobile-style) | Swipe left reveals delete button. Modern but less discoverable on desktop. | |
| Delete button (no confirmation) | Direct delete button, no confirmation. Fast but risky for accidental clicks. | |

**User's choice:** Context menu + confirmation dialog (Recommended)
**Notes:** Safe deletion with confirmation, standard desktop pattern.

---

### Archive Feature

| Option | Description | Selected |
|--------|-------------|----------|
| No archive — delete only (Recommended) | Simplify: conversations are either visible or deleted (SQLite soft-delete for safety). No archive complexity in v1. | ✓ |
| Archive to separate list | Archive conversations to 'Archived' section (like Gmail). Can unarchive later. Adds UI complexity. | |
| Archive with search visibility | Archived conversations hidden from list but appear in search. Middle ground but confusing. | |

**User's choice:** No archive — delete only (Recommended)
**Notes:** Keeps Phase 2 scope tight; soft-delete provides safety without archive UI complexity.

---

## Data Storage & Schema

### Storage Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Messages table + separate attachments table (Recommended) | Normalized schema: conversations → messages → attachments. Clean, queryable. Attachment files on disk, paths in DB. | ✓ |
| Messages with JSON attachments column | Single messages table, attachments as JSON array. Simpler schema but harder to query attachments. | |
| Single conversations table with JSON | Entire conversation stored as JSON blob. Simplest schema but no message-level queries. | |

**User's choice:** Messages table + separate attachments table (Recommended)
**Notes:** Normalized schema enables message-level queries and CHAT-02 content search.

---

## Conversation Auto-save

### Persistence Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Immediately after each message sent/received (Recommended) | Save user message on send, AI message as tokens arrive (or on completion). Real-time persistence, zero data loss risk. | ✓ |
| On conversation completion (streaming ends) | Save both user + AI messages after AI finishes responding. Batched writes but slight risk if app crashes mid-response. | |
| On window close / interval | Save periodically or on app exit. Least DB writes but highest data loss risk. | |

**User's choice:** Immediately after each message sent/received (Recommended)
**Notes:** CHAT-02 requires conversation history persistence; immediate save prevents data loss.

---

## System Messages & Prompts

### System Prompt Support

| Option | Description | Selected |
|--------|-------------|----------|
| No system prompts in Phase 2 (Recommended) | Phase 2 is basic chat only. System prompts/custom instructions deferred to Phase 7 (Agents) or future. Keeps scope tight. | ✓ |
| Global system prompt (Settings) | One system prompt in Settings applied to all conversations. Simple but inflexible. | |
| Per-conversation system prompt | Users can set custom instructions per conversation. More flexible but adds UI complexity. | |

**User's choice:** No system prompts in Phase 2 (Recommended)
**Notes:** Keeps Phase 2 scope focused on basic chat; system prompts are "agent configuration" concept for Phase 7.

---

## Empty States

### First-Time User Experience

| Option | Description | Selected |
|--------|-------------|----------|
| Welcome message + input ready (Recommended) | Centered welcome text ('Start a conversation'), input field active and ready. User can type immediately. | ✓ |
| Example prompts / suggestions | Show 3-4 prompt cards user can click to start (like ChatGPT homepage). More guided but adds design work. | |
| Just empty conversation list + input | Blank conversation list, active input. Minimal but less friendly for first-time users. | |

**User's choice:** Welcome message + input ready (Recommended)
**Notes:** Simple, friendly empty state without scope creep of example prompts.

---

## Claude's Discretion

Areas where user said "you decide" or deferred to Claude:

- Conversation title generation prompt (what to ask LLM for title generation)
- Exact SQLite schema column names and types (as long as normalized structure is maintained)
- Resizable conversation list implementation (drag handle, state persistence)
- Markdown syntax highlighting theme (must be accessible with dark/light themes)
- Error message formatting and wording (keep concise, actionable)
- Attachment file storage location on disk (use Tauri app data directory)
- Typing indicator animation timing and style
- Confirmation dialog copy ("Are you sure you want to delete this conversation?")

---

## Deferred Ideas

Ideas mentioned during discussion that were noted for future phases:

- Archive feature (hide without delete) — deferred to future; Phase 2 has delete only
- Example prompt suggestions on empty state — deferred to future; Phase 2 has simple welcome message + input
- Global or per-conversation system prompts — deferred to Phase 7 (Agents) or v2
- Conversation folders/tags — deferred to future; Phase 2 has time-based sections only
- Export conversation (markdown, JSON) — deferred to future
- Search filters (by model, date range) — deferred to future; Phase 2 has basic text search only
- Vim-style keyboard navigation (J/K) — deferred to v2; Phase 2 has minimal shortcuts (Cmd+K, arrows)

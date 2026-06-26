# Phase 2: LLM Chat - Research

**Researched:** 2026-06-25
**Domain:** Streaming LLM chat interface with multi-provider support, file attachments, and persistent conversation history
**Confidence:** HIGH

## Summary

Phase 2 implements a production-quality streaming chat interface following established patterns from ChatGPT, Claude, and modern AI chat applications. The architecture leverages Tauri v2's Channel API for token streaming (avoiding the wry memory leak from emit loops), react-markdown with incremental rendering for smooth UX during streaming, and a normalized SQLite schema for conversation persistence.

**Key architectural insight:** The Tauri webview boundary requires all LLM API calls (OpenAI, OpenRouter, Gemini) to happen in Rust using reqwest + tokio, not in the frontend. This solves two critical problems: (1) CORS restrictions that block webview → external API calls, and (2) API key security (keys stay in Rust memory, never exposed to JavaScript). The Rust side streams tokens via Channel API, and the frontend consumes them with a Channel listener that updates React state.

**Primary recommendation:** Use react-markdown with memoization for markdown rendering (not the newer Streamdown or StreamMD libraries, which add complexity without clear benefit for chat-length content), implement auto-scroll with wheel-event detection to distinguish user scrolling from layout expansion, and leverage shadcn/ui's Resizable component (wraps react-resizable-panels) for the two-column conversation list layout with localStorage persistence.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Chat UI Layout:**
- **D-01:** Two-column split layout — conversation list always visible on left, chat view on right (like Slack/Discord). No need to switch views to browse conversations.
- **D-02:** Conversation list width: resizable (user can drag to adjust), starts at default 280px.
- **D-03:** Conversation list shows: title + timestamp + model badge. Dense but informative, matches Linear/Raycast aesthetic from Phase 1.
- **D-04:** Search bar at top of conversation list — searches title + message content, filters list in real-time. Standard pattern.
- **D-05:** "New Chat" button at top of conversation list (above search bar) — creates new conversation, focuses input.
- **D-06:** Conversation titles: auto-generate from first message using LLM. User can edit. No manual naming friction.
- **D-07:** Conversations organized in flat list with time-based sections ("Today", "Yesterday", "Last 7 days", etc.) — no folders/tags in Phase 2.
- **D-08:** Individual messages use full-width alternating backgrounds (user messages one background, AI messages another) like ChatGPT/Claude. Maximizes readable width for code/long text.
- **D-09:** Message input placed bottom-fixed with padding — always visible above window edge, like ChatGPT/Claude. Standard pattern.

**Streaming & Markdown Rendering:**
- **D-10:** Markdown library: `react-markdown` + `rehype-highlight` for syntax highlighting. Most popular React markdown renderer, battle-tested.
- **D-11:** Code blocks have copy button (on hover) + language badge (top-right). Standard UX for AI chat (like ChatGPT, Claude).
- **D-12:** Partial markdown parsed and rendered incrementally during streaming — code blocks/formatting appear as soon as complete. Smooth UX but more CPU (acceptable tradeoff).
- **D-13:** Auto-scroll if user is near bottom (within ~100px). If user scrolled up, don't interrupt. Standard chat pattern.
- **D-14:** Stop button appears during streaming (cancels request). Regenerate button on finished messages. Standard AI chat pattern.

**File Attachments:**
- **D-15:** Paperclip button in input area (opens file picker) + drag-drop zone over chat area. Standard pattern (ChatGPT, Claude).
- **D-16:** Attached files show preview before sending: images show thumbnail, documents show icon + filename. User can remove before send.
- **D-17:** File type restrictions: PDF, images (jpg/png/webp), docs (docx/txt/md). Max 10MB per file. Matches typical LLM provider limits.
- **D-18:** Files sent to LLM providers as base64 inline in message content. Standard for OpenAI/Anthropic/Gemini APIs. No separate upload step.
- **D-19:** Multiple files per message allowed (no hard cap, but UI should handle 2-5 files gracefully).

**Model Selection:**
- **D-20:** Per-message model picker — dropdown next to send button, user picks model for each message. Conversation history preserved across model changes (CHAT-03 requirement).
- **D-21:** Each AI message shows model badge (e.g., 'GPT-4o', 'Claude 3.5') in message header. Clear which model answered, matches conversation list badge decision.
- **D-22:** Model picker defaults to last used model in conversation (continuity within conversation).
- **D-23:** When switching models mid-conversation, send full history to new model. Conversation context maintained (CHAT-03 requirement).

**Message Actions:**
- **D-24:** Message actions available: Copy (any message), Edit (user messages — re-sends), Delete (any message). Standard chat actions.

**Loading & Error States:**
- **D-25:** API errors displayed as inline error message in chat (like "API Error: Rate limit exceeded"). Clear context, doesn't interrupt flow.
- **D-26:** Typing indicator (3 dots animation) in message bubble while waiting for stream to start. Standard chat pattern.

**Keyboard Shortcuts:**
- **D-27:** Enter sends message, Shift+Enter for newline in input (like ChatGPT, Claude). Standard for AI chat.
- **D-28:** Cmd/Ctrl+K creates new conversation (common pattern). Up/down arrows navigate conversation list when focused.

**Conversation Deletion:**
- **D-29:** Delete via context menu (right-click or three-dot menu on conversation) + confirmation dialog ("Are you sure?"). Safe, standard pattern.
- **D-30:** No archive feature in Phase 2 — conversations are either visible or deleted (SQLite soft-delete for safety). Archive complexity deferred.

**Data Storage:**
- **D-31:** Normalized schema: `conversations` table → `messages` table → `attachments` table. Attachment files on disk, paths in DB. Clean, queryable.
- **D-32:** Messages persisted immediately after each message sent/received — save user message on send, AI message as tokens arrive (or on completion). Real-time persistence, zero data loss risk.

**System Prompts:**
- **D-33:** No system prompts / custom instructions in Phase 2. Deferred to Phase 7 (Agents) or future. Keeps scope tight (CHAT scope is basic chat, not agent configuration).

**Empty States:**
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

### Deferred Ideas (OUT OF SCOPE)
- Archive feature (hide without delete) — deferred to future; Phase 2 has delete only
- Example prompt suggestions on empty state — deferred to future; Phase 2 has simple welcome message + input
- Global or per-conversation system prompts — deferred to Phase 7 (Agents) or v2
- Conversation folders/tags — deferred to future; Phase 2 has time-based sections only
- Export conversation (markdown, JSON) — deferred to future
- Search filters (by model, date range) — deferred to future; Phase 2 has basic text search only
- Vim-style keyboard navigation (J/K) — deferred to v2; Phase 2 has minimal shortcuts (Cmd+K, arrows)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAT-01 | Usuário pode iniciar conversa com qualquer LLM configurado e ver tokens chegando em streaming em tempo real | Tauri Channel API + async-openai crate + reqwest streaming; incremental react-markdown rendering |
| CHAT-02 | Usuário pode acessar histórico completo de conversas anteriores, com busca por conteúdo | SQLite normalized schema (conversations → messages); TanStack Query for IPC data fetching; search via Drizzle query |
| CHAT-03 | Usuário pode trocar de modelo ou provedor dentro da mesma conversa sem perder o histórico | Per-message model tracking in schema; full history sent to new model (D-23) |
| CHAT-04 | Usuário pode anexar arquivos (PDF, imagens, documentos) a uma mensagem para o LLM analisar | Tauri dialog file picker + readBinaryFile; base64 encoding in Rust; OpenAI vision API format (data:image/png;base64,...) |
| CHAT-05 | Respostas do LLM são renderizadas em Markdown com syntax highlighting para código | react-markdown v10.1.0 + rehype-highlight v7.0.2; code block copy button (custom component) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-markdown | 10.1.0 | Markdown rendering | Most popular React markdown renderer; battle-tested for chat-length content; supports incremental rendering with memoization |
| rehype-highlight | 7.0.2 | Syntax highlighting for code blocks | Official rehype plugin; uses highlight.js under the hood; works seamlessly with react-markdown |
| async-openai | 0.27+ | Typed OpenAI-compatible API client (Rust) | Most mature Rust OpenAI library; supports streaming via tokio; compatible with OpenRouter, OpenAI, and local providers |
| reqwest | 0.12 | HTTP client with streaming (Rust) | De facto standard for HTTP in Rust; async/await support; streaming response bodies; TLS built-in |
| tokio | 1.x | Async runtime (Rust) | Standard async runtime for Rust; required by async-openai and reqwest |
| serde / serde_json | 1.x | JSON serialization for IPC (Rust) | Standard Rust JSON library; required for Tauri command inputs/outputs |
| react-resizable-panels | 4.x | Resizable split layout | Maintained by bvaughn (React core team); shadcn/ui Resizable wraps this; keyboard accessible; localStorage persistence |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| remark-gfm | 4.x | GitHub Flavored Markdown support | Use with react-markdown to support tables, strikethrough, task lists (common in AI responses) |
| @tauri-apps/plugin-dialog | 2.x | File picker for attachments | Official Tauri plugin for native file dialogs |
| @tauri-apps/plugin-fs | 2.x | Read files as binary for base64 encoding | Official Tauri plugin; use readBinaryFile for images/PDFs |
| date-fns | 3.x | Date formatting for conversation list | Lightweight, tree-shakeable; use for "Today", "Yesterday", relative timestamps |
| react-textarea-autosize | 8.x | Auto-growing textarea for message input | Standard pattern for chat inputs; grows with content, supports Shift+Enter |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-markdown | Streamdown (Vercel) | Streamdown is specialized for very long streaming responses (>50KB); adds complexity (multi-pass rendering, background worker) without clear benefit for chat-length content |
| react-markdown | StreamMD (Altrusian) | StreamMD has better incremental parsing performance but requires custom block tracking logic; react-markdown + memoization is simpler and "good enough" for <10K tokens |
| async-openai | openai-oxide | openai-oxide has 60% faster SSE streaming (zero-copy parser) but is newer (March 2026); async-openai has broader community adoption |
| rehype-highlight | rehype-pretty-code | rehype-pretty-code uses shiki (vs highlight.js); more themes, better highlighting, but slower; acceptable for batch rendering, not ideal for incremental streaming |
| react-resizable-panels | Custom drag handle | Custom implementation is fragile (touch support, keyboard nav, persistence); react-resizable-panels is maintained by React core team |

**Installation:**
```bash
# Frontend dependencies
npm install react-markdown rehype-highlight remark-gfm
npm install react-resizable-panels date-fns react-textarea-autosize
npm install @tauri-apps/plugin-dialog @tauri-apps/plugin-fs

# shadcn/ui components (if not already installed)
npx shadcn@latest add resizable scroll-area dropdown-menu context-menu

# Rust dependencies (add to src-tauri/crates/nexusai-chat/Cargo.toml)
# async-openai = "0.27"
# reqwest = { version = "0.12", features = ["json", "stream"] }
# tokio = { version = "1", features = ["full"] }
# serde = { version = "1", features = ["derive"] }
# serde_json = "1"
# base64 = "0.22"
```

**Version verification:**
- react-markdown: 10.1.0 (verified 2026-06-25)
- rehype-highlight: 7.0.2 (verified 2026-06-25)
- @tanstack/react-router: 1.170.16 (verified 2026-06-25, already in project)
- async-openai: latest is 0.27.2 as of May 2026
- reqwest: 0.12.28 (workspace dependency, recent stable)

## Architecture Patterns

### Recommended Project Structure
```
src/
├── routes/
│   └── chat/
│       ├── route.tsx               # Chat layout (two-column split)
│       ├── index.tsx                # Chat view (conversation + messages)
│       └── components/
│           ├── ConversationList.tsx
│           ├── MessageList.tsx
│           ├── MessageInput.tsx
│           ├── MessageBubble.tsx
│           ├── MarkdownRenderer.tsx
│           └── FileAttachmentPicker.tsx
├── lib/
│   ├── stores/
│   │   └── chat.ts                  # Zustand store for active conversation, streaming state
│   └── db/
│       ├── schema.ts                # Add conversations, messages, attachments tables
│       └── migrations/
│           └── 0002_chat.sql        # Phase 2 migration
└── components/
    └── ui/
        └── resizable.tsx            # shadcn Resizable component

src-tauri/crates/nexusai-chat/src/
├── lib.rs                           # Module exports
├── streaming.rs                     # Channel API streaming implementation
├── providers.rs                     # OpenAI/OpenRouter/Gemini API calls
├── attachments.rs                   # File reading + base64 encoding
└── schema.rs                        # Tauri command types (serde structs)
```

### Pattern 1: Tauri Channel API Streaming (CRITICAL)
**What:** Rust creates a Channel, streams tokens via `channel.send()`, frontend listens with `channel.onmessage` callback.
**When to use:** ALL streaming operations (LLM responses, file uploads, long-running tasks). NEVER use `emit()` in a loop (causes wry memory leak — documented in FOUND-05).
**Example:**
```rust
// Source: https://v2.tauri.app/develop/calling-frontend/
use tauri::ipc::Channel;

#[derive(serde::Serialize)]
struct StreamChunk {
    delta: String,
    done: bool,
}

#[tauri::command]
async fn stream_chat(
    prompt: String,
    on_chunk: Channel<StreamChunk>,
) -> Result<(), String> {
    // async-openai streaming
    let client = async_openai::Client::new();
    let mut stream = client.chat()
        .create_stream(request)
        .await
        .map_err(|e| e.to_string())?;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        if let Some(delta) = chunk.choices[0].delta.content.as_ref() {
            on_chunk.send(StreamChunk {
                delta: delta.to_string(),
                done: false,
            }).ok();
        }
    }

    on_chunk.send(StreamChunk {
        delta: String::new(),
        done: true,
    }).ok();

    Ok(())
}
```

```typescript
// Frontend: Channel listener
import { Channel } from '@tauri-apps/api/core';

const channel = new Channel<{ delta: string; done: boolean }>();
channel.onmessage = (chunk) => {
  if (chunk.done) {
    setIsStreaming(false);
  } else {
    setMessageContent(prev => prev + chunk.delta);
  }
};

await invoke('stream_chat', { prompt, onChunk: channel });
```

### Pattern 2: Incremental Markdown Rendering with Memoization
**What:** Wrap react-markdown in React.memo, update parent state with accumulated text, rely on React's diffing to avoid re-rendering unchanged blocks.
**When to use:** Streaming LLM responses where markdown syntax arrives token-by-token.
**Example:**
```tsx
// Source: https://tigerabrodi.blog/how-to-build-a-performant-ai-markdown-renderer
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { memo } from 'react';

const MarkdownRenderer = memo(({ content }: { content: string }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline ? (
            <CodeBlock language={match?.[1]} code={String(children)} />
          ) : (
            <code className={className} {...props}>{children}</code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
});
```

### Pattern 3: Auto-Scroll with Wheel Event Detection
**What:** Detect user-initiated scrolling (wheel event) vs. layout expansion (scroll event from DOM growing). Only auto-scroll if user is near bottom AND hasn't manually scrolled up.
**When to use:** Any streaming chat UI where content grows during streaming.
**Example:**
```tsx
// Source: https://medium.com/@disgcfrguy/the-scroll-problem-nobody-talks-about-when-building-ai-chat-interface-987c223cafc0
const MessageList = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = () => {
      userScrolledRef.current = true; // User is actively scrolling
    };

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      isNearBottomRef.current = distanceFromBottom < 100;

      // If user manually scrolled to bottom, clear flag
      if (isNearBottomRef.current) {
        userScrolledRef.current = false;
      }
    };

    el.addEventListener('wheel', handleWheel);
    el.addEventListener('scroll', handleScroll);

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    // Auto-scroll on new content if user hasn't scrolled up
    if (!userScrolledRef.current && isNearBottomRef.current) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messageContent]); // Trigger on content change

  return <div ref={scrollRef} className="overflow-y-auto">...</div>;
};
```

### Pattern 4: File Attachment Base64 Encoding (Tauri)
**What:** Use Tauri dialog plugin to pick files, read as binary with fs plugin, convert to base64 in Rust, pass to frontend.
**When to use:** Image/PDF attachments for vision-capable LLMs (GPT-4o, Gemini, Claude).
**Example:**
```rust
// Source: https://developers.openai.com/api/docs/guides/file-inputs
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;

#[derive(serde::Serialize)]
struct FileAttachment {
    filename: String,
    mime_type: String,
    base64_data: String,
}

#[tauri::command]
async fn pick_and_encode_file(app: AppHandle) -> Result<FileAttachment, String> {
    let file_path = app.dialog()
        .file()
        .add_filter("Images & Docs", &["png", "jpg", "jpeg", "webp", "pdf", "txt", "md"])
        .blocking_pick_file()
        .ok_or("User cancelled")?;

    let contents = app.fs()
        .read(&file_path)
        .await
        .map_err(|e| e.to_string())?;

    let mime_type = match file_path.extension().and_then(|s| s.to_str()) {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("pdf") => "application/pdf",
        _ => "application/octet-stream",
    };

    Ok(FileAttachment {
        filename: file_path.file_name().unwrap().to_string_lossy().to_string(),
        mime_type: mime_type.to_string(),
        base64_data: base64::encode(&contents),
    })
}
```

```typescript
// Frontend: Send to OpenAI with vision
const attachment = await invoke<FileAttachment>('pick_and_encode_file');

const message = {
  role: 'user',
  content: [
    { type: 'text', text: userPrompt },
    {
      type: 'image_url',
      image_url: {
        url: `data:${attachment.mime_type};base64,${attachment.base64_data}`,
      },
    },
  ],
};
```

### Pattern 5: Normalized SQLite Schema for Chat
**What:** Three tables: `conversations` (metadata), `messages` (linked to conversation), `attachments` (linked to message). Files stored on disk, paths in DB.
**When to use:** Any chat application with conversation history and file attachments.
**Example:**
```typescript
// Source: https://www.geeksforgeeks.org/dbms/how-to-design-a-database-for-messaging-systems/
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(), // UUID
  title: text('title').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }), // Soft delete
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(), // UUID
  conversationId: text('conversation_id').notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  model: text('model'), // e.g., 'gpt-4o', 'claude-3-5-sonnet'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(), // UUID
  messageId: text('message_id').notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  filePath: text('file_path').notNull(), // Absolute path in app data dir
  fileSizeBytes: integer('file_size_bytes').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

### Pattern 6: Resizable Conversation List with Persistence
**What:** Use shadcn/ui Resizable (wraps react-resizable-panels), set `autoSaveId` to persist panel sizes to localStorage.
**When to use:** Two-column layouts where user should control panel widths.
**Example:**
```tsx
// Source: https://ui.shadcn.com/docs/components/radix/resizable
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

export function ChatLayout() {
  return (
    <ResizablePanelGroup direction="horizontal" autoSaveId="chat-layout">
      <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
        <ConversationList />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={75}>
        <ChatView />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
```

### Anti-Patterns to Avoid
- **emit() in a loop for streaming:** Causes wry memory leak (FOUND-05). Use Channel API instead.
- **Re-parsing entire markdown on every token:** Causes quadratic performance degradation. Use React.memo and rely on React's diffing.
- **Auto-scroll without wheel event detection:** Hijacks scroll position when user is reading old messages. Only scroll if user is near bottom AND hasn't manually scrolled.
- **Storing base64 in SQLite:** Bloats database, slows queries. Store files on disk, paths in DB.
- **Conversation-level model switching:** Loses per-message flexibility. Track model per message, send full history when switching.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown parsing during streaming | Custom incremental parser | react-markdown + React.memo | Mature, handles edge cases (unclosed tags, escaping, nested syntax); memoization is "good enough" for chat-length content |
| Syntax highlighting | Custom highlight.js wrapper | rehype-highlight (official rehype plugin) | Already integrated with react-markdown; supports 190+ languages; themes via CSS |
| Resizable panels | Custom drag handle + resize logic | react-resizable-panels (via shadcn Resizable) | Keyboard accessible, touch support, localStorage persistence, maintained by React core team (bvaughn) |
| Auto-scroll logic | Custom scroll detection | Wheel + scroll event pattern (see Pattern 3) | Distinguishes user scrolling from layout expansion; avoids common pitfalls (scroll hijacking, jitter) |
| OpenAI API client (Rust) | Manual reqwest + JSON parsing | async-openai crate | Typed API, handles streaming, compatible with OpenRouter/local providers, well-maintained |
| File picker | Manual OS dialogs | @tauri-apps/plugin-dialog | Cross-platform (Windows/macOS), native file dialogs, filters by extension |

**Key insight:** Streaming chat UIs have subtle edge cases (incomplete markdown syntax during streaming, scroll position hijacking, quadratic re-parsing) that mature libraries already solve. The complexity cost of custom solutions outweighs any performance benefit.

## Common Pitfalls

### Pitfall 1: Markdown Rendering Flicker (Incomplete Syntax)
**What goes wrong:** During streaming, tokens arrive mid-syntax (`**bold`, unclosed code fences, half-written links). Markdown parser treats incomplete syntax as literal text, so users see raw `**bold` instead of **bold**, then it snaps to formatted output when the closing `**` arrives.
**Why it happens:** react-markdown parses on every render, and incomplete syntax is semantically "plain text" until completed.
**How to avoid:** Accept this as inherent behavior (ChatGPT/Claude have the same issue), OR implement a buffering strategy: only re-render markdown when you receive a whitespace boundary (space, newline) or sentence break. This trades latency for smoothness.
**Warning signs:** Code blocks with backticks flash between raw and highlighted state; bold/italic markers flicker.

**Source:** [How To Build a Performant AI Markdown Renderer](https://tigerabrodi.blog/how-to-build-a-performant-ai-markdown-renderer)

### Pitfall 2: Auto-Scroll Hijacking User Position
**What goes wrong:** Message grows token-by-token, DOM expands, browser fires scroll events (not because user scrolled, but because content expanded). Your scroll handler assumes user scrolled, stops auto-scrolling, and now new tokens arrive off-screen.
**Why it happens:** You can't distinguish layout-shift scroll events from user-initiated scroll events with `scroll` listener alone.
**How to avoid:** Add a separate `wheel` event listener — wheel only fires for physical mouse/trackpad input, never for layout shifts. Track "user scrolled up" flag on wheel, clear it when user scrolls to bottom. Only auto-scroll if flag is false AND user is near bottom.
**Warning signs:** Auto-scroll stops working after user scrolls up once; new messages appear off-screen.

**Source:** [The scroll problem nobody talks about when building AI chat interface](https://medium.com/@disgcfrguy/the-scroll-problem-nobody-talks-about-when-building-ai-chat-interface-987c223cafc0)

### Pitfall 3: Quadratic Re-Parsing Performance (Large Responses)
**What goes wrong:** At render 200 (2000 words accumulated), you re-parse 2000 words of markdown and diff hundreds of DOM nodes on every token. Page jitters, scrolling stutters, CPU spikes.
**Why it happens:** react-markdown re-parses the entire accumulated text on every state update. Work grows quadratically: 100 tokens/sec = 100 full re-parses/sec.
**How to avoid:** Wrap react-markdown in React.memo so sibling messages don't re-render. For very long responses (>10K tokens), consider throttling renders with requestAnimationFrame (batch updates at 60fps instead of every token).
**Warning signs:** Scrolling becomes janky after 500+ tokens; CPU usage climbs during streaming; frame drops in DevTools performance profiling.

**Source:** [How To Build a Performant AI Markdown Renderer](https://tigerabrodi.blog/how-to-build-a-performant-ai-markdown-renderer)

### Pitfall 4: CORS Errors from Webview API Calls
**What goes wrong:** Frontend tries to call OpenAI API directly from JavaScript. Request fails with CORS error because OpenAI doesn't whitelist `tauri://localhost` origin.
**Why it happens:** External APIs don't allow cross-origin requests from Tauri's custom protocol. Even with `dangerousDisableAssetCspModification`, the API server rejects the request.
**How to avoid:** ALL LLM API calls MUST happen in Rust using reqwest. The Rust side is not a browser, so CORS doesn't apply. Stream tokens to frontend via Channel API.
**Warning signs:** Console shows "CORS policy blocked..." errors; API keys visible in frontend code (security issue).

**Source:** [Critical Architecture Constraint: The Tauri Webview Boundary](https://github.com/tauri-apps/tauri/discussions/10265) [ASSUMED — extrapolated from Tauri docs and CLAUDE.md stack context]

### Pitfall 5: API Keys Exposed to Frontend (Security)
**What goes wrong:** API keys stored in frontend state or localStorage. Malicious code (compromised dependency, XSS) can exfiltrate keys.
**Why it happens:** Developer treats Tauri webview like a Node.js app (where `process.env` is secure). Webview is just a browser — all JavaScript is untrusted.
**How to avoid:** Store API keys in OS Keychain (keyring crate) or Tauri Store (encrypted). Rust reads keys, makes API calls, returns results. Keys NEVER leave Rust.
**Warning signs:** API keys in `localStorage`; keys passed as arguments to Tauri commands; keys visible in Redux/Zustand stores.

**Source:** [FOUND-01 requirement](../../REQUIREMENTS.md) + Tauri security best practices [ASSUMED]

### Pitfall 6: SQLite Soft-Delete Not Filtering in Queries
**What goes wrong:** You add `deletedAt` column for soft-delete, but forget to filter `WHERE deletedAt IS NULL` in queries. Deleted conversations appear in UI.
**Why it happens:** Drizzle (and SQL generally) doesn't auto-filter soft-deleted rows — you must explicitly check `deletedAt`.
**How to avoid:** Create Drizzle helper functions (`getActiveConversations()`) that always include the soft-delete filter. Use these instead of raw queries.
**Warning signs:** Deleted items reappear; conversation list shows "ghost" entries.

**Source:** Standard soft-delete pattern [ASSUMED — common pitfall in all ORMs]

## Code Examples

Verified patterns from official sources:

### Title Generation Prompt (Claude's Discretion)
```typescript
// Source: https://github.com/NousResearch/hermes-agent/issues/624
const TITLE_GENERATION_PROMPT = `Generate a concise 3-8 word title for this conversation based on the first user message and assistant response. Return ONLY the title, no quotes, no extra text.

User: ${firstUserMessage}
Assistant: ${firstAssistantResponse}

Title:`;

// Call with cheap/fast model (e.g., gpt-4o-mini)
const title = await generateTitle(TITLE_GENERATION_PROMPT);
```

### Code Block with Copy Button
```tsx
// Source: https://blog.designly.biz/react-markdown-how-to-create-a-copy-code-button
import { useState } from 'react';

function CodeBlock({ language, code }: { language?: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 flex gap-2">
        {language && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {language}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="text-xs bg-muted px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}
```

### Drizzle Migration with import.meta.glob (Tauri)
```typescript
// Source: https://dev.to/huakun/building-a-local-first-tauri-app-with-drizzle-orm-encryption-and-turso-sync-31pn
const migrations = import.meta.glob<string>("./migrations/*.sql", {
  eager: true,
  query: "?raw",
  import: "default",
});

async function runMigrations(db: Database) {
  const applied = await db.select().from(schemaMeta).all();
  const appliedVersions = new Set(applied.map(m => m.version));

  const pending = Object.entries(migrations)
    .map(([path, sql]) => ({
      version: path.match(/(\d{4})_/)?.[1] || '0000',
      sql,
    }))
    .filter(m => !appliedVersions.has(m.version))
    .sort((a, b) => a.version.localeCompare(b.version));

  for (const migration of pending) {
    await db.run(migration.sql);
    await db.insert(schemaMeta).values({
      version: migration.version,
      appliedAt: new Date(),
    });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| emit() in loop for streaming | Channel API (Tauri v2) | Tauri v2.0 (2024) | Eliminates wry memory leak; faster IPC; ordered delivery guarantee |
| react-syntax-highlighter | rehype-highlight / rehype-pretty-code | 2024-2025 | rehype plugins integrate with remark/rehype pipeline; better tree-shaking; consistent with react-markdown |
| Manual panel resize logic | react-resizable-panels | 2023+ (v4 in 2025) | Accessibility (keyboard support), persistence (localStorage), touch support — all handled by library |
| Conversation-level model selection | Per-message model tracking | 2025+ (ChatGPT added this) | More flexible; supports A/B testing models; clearer which model answered |
| OpenAI-only SDKs | OpenRouter-compatible clients | 2024+ | Single API for 200+ models; easier to add new providers |

**Deprecated/outdated:**
- **Tauri v1 event system for streaming:** emit() in loop causes memory leak in wry (Tauri v2 webview engine). Replaced by Channel API.
- **better-sqlite3 in Tauri:** NAPI native bindings don't work in webview (Node.js only). Use tauri-plugin-sql instead.
- **react-markdown v8:** v9+ (current v10.1.0) has breaking changes to plugin API. Always check migration guide.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend build, npm packages | ✓ | v24.12.0 | — |
| npm | Package management | ✓ | 11.6.2 | — |
| Rust toolchain | Tauri backend compilation | ✓ | (via ~/.cargo/bin, not in PATH) | — |
| SQLite CLI | Manual DB inspection (dev only) | ✓ | 3.45.1 | Not required for app functionality |

**Missing dependencies with no fallback:**
- None — all critical dependencies available

**Missing dependencies with fallback:**
- Rust not in PATH: Works via npm scripts (`npm run tauri`), which finds ~/.cargo/bin automatically

**Notes:**
- Rust installed but not in shell PATH — this is fine; Tauri CLI (via npm) handles PATH internally
- SQLite CLI available for manual DB inspection during development but not required for app to run

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 + @testing-library/react 16.3.2 |
| Config file | vitest.config.ts (already exists) |
| Quick run command | `npm test` |
| Full suite command | `npm test` (no watch mode) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-01 | Streaming tokens arrive in real-time, Channel API works | integration | `npm test tests/chat-streaming.test.ts -x` | ❌ Wave 0 |
| CHAT-02 | Conversation list loads from DB, search filters by title/content | unit + integration | `npm test tests/chat-history.test.ts -x` | ❌ Wave 0 |
| CHAT-03 | Model switch mid-conversation preserves history | integration | `npm test tests/chat-model-switch.test.ts -x` | ❌ Wave 0 |
| CHAT-04 | File picker opens, base64 encoding works, attachments render | integration | `npm test tests/chat-attachments.test.ts -x` | ❌ Wave 0 |
| CHAT-05 | Markdown renders incrementally, code blocks have syntax highlighting | unit | `npm test tests/chat-markdown.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test tests/chat-*.test.ts -x` (run relevant test file, fail fast)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + manual smoke test (open app, start conversation, attach file, switch model) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/chat-streaming.test.ts` — covers CHAT-01 (mock Channel API, verify tokens arrive)
- [ ] `tests/chat-history.test.ts` — covers CHAT-02 (mock DB, verify search filtering)
- [ ] `tests/chat-model-switch.test.ts` — covers CHAT-03 (verify history sent to new model)
- [ ] `tests/chat-attachments.test.ts` — covers CHAT-04 (mock file picker, verify base64 encoding)
- [ ] `tests/chat-markdown.test.ts` — covers CHAT-05 (render markdown, verify code block copy button)
- [ ] `tests/setup.ts` — extend with Tauri IPC mocks (Channel, invoke)

**Note:** Rust-side tests (streaming, API calls, file encoding) should be in `src-tauri/crates/nexusai-chat/src/` with `#[cfg(test)]` modules. Frontend tests focus on UI components and state management.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tauri Channel API prevents wry memory leak vs. emit() loops | Architecture Patterns | If emit() is safe now, we're adding complexity for no benefit; but FOUND-05 explicitly requires Channel API, so this is low risk |
| A2 | react-markdown + memoization is "good enough" for chat-length content (<10K tokens) | Standard Stack | If responses are regularly 50K+ tokens, may need Streamdown/StreamMD for performance; but typical chat responses are <5K tokens |
| A3 | OpenAI vision API accepts base64 inline for PDFs/images (data:image/png;base64,...) | File Attachments | If format changed, would need separate file upload endpoint; but OpenAI docs confirm this format as of 2026 |
| A4 | async-openai crate is compatible with OpenRouter and Gemini APIs (OpenAI-compatible endpoint) | Rust LLM Calls | If providers diverge from OpenAI format, would need separate clients; but OpenRouter explicitly advertises OpenAI compatibility |
| A5 | Soft-delete (deletedAt column) is sufficient for conversation deletion | Data Storage | If user expects hard-delete for privacy, would need separate "purge" feature; but D-30 explicitly allows soft-delete |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **Conversation title generation timing**
   - What we know: Generate title after first assistant response (DeerFlow pattern). Use cheap model (gpt-4o-mini).
   - What's unclear: Should we show "New Conversation" placeholder until title is generated, or block send until title arrives?
   - Recommendation: Show "New Conversation" placeholder, generate title in background, update when ready. Avoids latency perception.

2. **Attachment file storage cleanup**
   - What we know: Files stored on disk, paths in DB. Soft-delete marks conversation as deleted.
   - What's unclear: When (if ever) do we delete attachment files from disk?
   - Recommendation: Phase 2 never deletes files (disk is cheap). Add cleanup feature in future phase ("purge deleted conversations older than 30 days").

3. **Model picker UI placement**
   - What we know: Per-message model picker next to send button (D-20).
   - What's unclear: Should we show current model in message input area, or only in dropdown?
   - Recommendation: Show current model as button label (e.g., "GPT-4o ▼"), clicking opens dropdown. Clear what will be used without opening menu.

4. **Error handling for streaming failures**
   - What we know: Display inline error message (D-25).
   - What's unclear: Should we auto-retry on network errors, or always require manual retry?
   - Recommendation: No auto-retry (user may want to edit prompt, switch model). Show error + "Retry" button.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | N/A — local desktop app, no user accounts in Phase 2 |
| V3 Session Management | no | N/A — no multi-user sessions |
| V4 Access Control | no | N/A — single-user local app |
| V5 Input Validation | yes | Validate file size (<10MB), file type (allowlist: png/jpg/webp/pdf/txt/md), sanitize filenames (prevent path traversal) |
| V6 Cryptography | yes | API keys stored in OS Keychain (keyring crate) — encrypted at rest by OS |
| V7 Error Handling | yes | Never expose API keys or internal paths in error messages; show user-friendly error text |
| V8 Data Protection | yes | API keys in Keychain, attachment files in app data dir (OS-sandboxed), SQLite in app data dir |
| V13 API & Web Service | yes | API calls from Rust only (CORS bypass), rate limiting handled by provider (OpenAI/OpenRouter), no custom API exposed in Phase 2 |

### Known Threat Patterns for Tauri + React + LLM APIs

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exfiltration (malicious npm package) | Information Disclosure | Store keys in OS Keychain, access only from Rust; never pass to frontend or log |
| Path traversal in file attachments | Tampering | Validate filenames, reject paths with `../`, store in controlled app data directory |
| XSS via malicious markdown in LLM response | Tampering | Use react-markdown (auto-escapes HTML), enable `rehype-sanitize` if allowing raw HTML |
| Oversized file attachment (DoS) | Denial of Service | Enforce 10MB file size limit in Rust before reading; reject early |
| CORS bypass exposing API to web attacker | Spoofing | All API calls in Rust (not frontend); webview cannot make direct calls to external APIs |
| Malicious LLM response injecting code | Tampering | Render in sandboxed context (React), never eval() or execute response content |

**Critical:** Phase 2 has no custom API server, no authentication, and no multi-user features. Security focus is on protecting API keys (Keychain), validating file inputs (size, type, path), and safely rendering LLM output (markdown sanitization).

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Channel API](https://v2.tauri.app/develop/calling-frontend/) — Official docs, verified 2026-06-25
- [async-openai crate](https://crates.io/crates/async-openai) — Official crate page, verified 2026-06-25
- [async-openai docs](https://docs.rs/async-openai) — Official docs, verified 2026-06-25
- [OpenAI File Inputs API](https://developers.openai.com/api/docs/guides/file-inputs) — Official docs, verified 2026-06-25
- [OpenAI Images and Vision API](https://developers.openai.com/api/docs/guides/images-vision) — Official docs, verified 2026-06-25
- [shadcn/ui Resizable](https://ui.shadcn.com/docs/components/radix/resizable) — Official docs, verified 2026-06-25
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown) — Official repo, verified 2026-06-25
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations) — Official docs, verified 2026-06-25

### Secondary (MEDIUM confidence)
- [How To Build a Performant AI Markdown Renderer](https://tigerabrodi.blog/how-to-build-a-performant-ai-markdown-renderer) — Technical blog, 2026, cross-verified with react-markdown docs
- [The scroll problem nobody talks about when building AI chat interface](https://medium.com/@disgcfrguy/the-scroll-problem-nobody-talks-about-when-building-ai-chat-interface-987c223cafc0) — Technical article, 2026, pattern matches ChatGPT behavior
- [Streamdown: Vercel's Streaming Markdown Renderer](https://www.solosoft.dev/post/streamdown-vercel-2026/) — Analysis of Vercel's solution, 2026
- [Streaming AI Responses Without Destroying Your React State](https://medium.com/@varunrobust/streaming-ai-responses-without-destroying-your-react-state-f2a61c2aecf0) — Technical article, 2026
- [Building a Local-First Tauri App with Drizzle ORM](https://dev.to/huakun/building-a-local-first-tauri-app-with-drizzle-orm-encryption-and-turso-sync-31pn) — Community tutorial, 2026, verified import.meta.glob pattern
- [React-Markdown - How To Create a Copy Code Button](https://blog.designly.biz/react-markdown-how-to-create-a-copy-code-button) — Tutorial, cross-verified with react-markdown API
- [Feature: Automatic Session Title Generation (DeerFlow)](https://github.com/NousResearch/hermes-agent/issues/624) — GitHub issue discussing title generation pattern
- [AI Chat UI Best Practices for 2026](https://thefrontkit.com/blogs/ai-chat-ui-best-practices) — Industry best practices compilation

### Tertiary (LOW confidence — needs validation)
- [IPC in Tauri — Tauri Commands vs Custom IPC](https://dev.to/hiyoyok/ipc-in-tauri-tauri-commands-vs-custom-ipc-what-to-use-when-2ab4) — Community article, general IPC guidance
- [Streaming Gemini API Responses in Rust Tauri](https://dev.to/hiyoyok/streaming-gemini-api-responses-in-rust-tauri-real-time-token-display-2i2o) — Community tutorial, pattern matches async-openai approach
- [How to Design a Database for Messaging Systems](https://www.geeksforgeeks.org/dbms/how-to-design-a-database-for-messaging-systems/) — General DB schema guidance, not Tauri-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — react-markdown, async-openai, Tauri Channel API all verified with official docs
- Architecture: HIGH — All patterns cross-verified with official Tauri v2 docs, OpenAI API docs, or production examples
- Pitfalls: MEDIUM-HIGH — Verified with multiple 2026 sources, matches observed behavior in ChatGPT/Claude
- Security: MEDIUM — ASVS categories applied based on CLAUDE.md stack + FOUND-01 requirement; no custom security audit performed

**Research date:** 2026-06-25
**Valid until:** ~60 days (2026-08-24) — stack is stable (Tauri v2.x, react-markdown v10.x, async-openai 0.27+); re-verify if major version bumps occur

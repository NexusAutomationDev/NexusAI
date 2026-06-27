---
phase: "02"
plan: "08"
subsystem: smoke-test
tags: [chat, smoke-test, bugfix, css, proxy, markdown, conversation-switching]
dependency_graph:
  requires: [02-07]
  provides: [phase-02-complete]
  affects:
    - src/lib/db/proxy.ts
    - src/lib/stores/settings.ts
    - src/routes/chat/route.tsx
    - src/routes/chat/components/ConversationList.tsx
    - src/routes/chat/components/MarkdownRenderer.tsx
    - src/routes/chat/components/MessageInput.tsx
    - src/components/settings/ApiKeysSection.tsx
    - src/index.css
decisions:
  - Drizzle sqlite-proxy fix: tauri-plugin-sql returns row objects {col: val}, Drizzle expects arrays [val, val, ...]; fix with Object.values(row) — order preserved by plugin's IndexMap
  - extractText() for clipboard: rehype-highlight transforms code tokens into React <span> tree before custom code() component runs, so String(children) gives [object Object]; recursive extractText() traverses the React tree to recover plain text
  - refreshAvailableModels() moved to Zustand store: running invoke() inside MessageInput on every keystroke caused freeze; moved to store action called once at startup and after key save/delete
  - navigate({ to: '/chat' }) added to ConversationList handlers: without explicit navigation, ChatView (index child route) does not mount when setActiveConversationId is called from a different route
  - Missing shadcn/ui CSS variables: --popover, --accent, --destructive absent from both @theme inline mappings and :root/.dark HSL values — caused transparent Select dropdowns, hover states, and destructive buttons
metrics:
  duration: "~3h (across two sessions)"
  completed: "2026-06-26"
  tasks_completed: 7
  bugs_fixed: 6
---

# Phase 02 Plan 08: Human Smoke Test — APROVADO

All 7 smoke test scenarios passed after gap-closure bug fixes applied during the session.

## Test Results

| Test | Scenario | Status |
|------|----------|--------|
| 1 | Basic streaming end-to-end with real API key | ✅ PASS |
| 2 | Conversation history persists across reload; switching works | ✅ PASS |
| 3 | Model switching preserves full conversation context | ✅ PASS |
| 4 | File attachment sent and referenced in AI response | ✅ PASS |
| 5 | Markdown rendering with code blocks and "Copiar" button | ✅ PASS |
| 6 | Search filters in real-time; right-click delete with confirmation | ✅ PASS |
| 7 | Ctrl+K new conversation; Shift+Enter multiline input | ✅ PASS |

## Gap-Closure Bugs Fixed During Smoke Test

### Bug 1 — Messages showing empty content (critical)
**Root cause:** `tauri-plugin-sql` `.select()` returns row objects `{ col: val }` but Drizzle's sqlite-proxy expects row arrays `[val, val, ...]`. All columns resolved to `undefined` → `isAi=false`, `content=undefined`.

**Fix (`src/lib/db/proxy.ts`):**
```ts
const rawRows = await sqlite.select(sql, params) as Record<string, unknown>[];
const rows = rawRows.map(row => Object.values(row));
```

**Commits:** `885daeb` area (applied in previous session)

---

### Bug 2 — Code blocks rendering `[object Object]`
**Root cause:** `rehype-highlight` transforms code tokens into React `<span>` elements before the custom `code()` component runs. `String(children)` on a React element tree gives `[object Object]`.

**Fix (`src/routes/chat/components/MarkdownRenderer.tsx`):** Added `extractText(node: ReactNode): string` that recursively traverses React element trees to recover plain text for the clipboard copy button. Display still uses `{children}` (the highlighted React tree).

---

### Bug 3 — Model selector freezing UI
**Root cause:** `useAvailableModels()` hook ran `invoke('get_api_key_status')` calls inside `MessageInput` on every keystroke re-render.

**Fix (`src/lib/stores/settings.ts`):** Moved to `refreshAvailableModels()` Zustand store action — runs once at app startup and after key save/delete in settings. `MessageInput` reads `useSettingsStore(s => s.availableModels)` (no side effects).

Also added `AVAILABLE_MODELS` with latest models (gpt-4.1, gpt-4.1-mini, o4-mini, o3, gemini-2.5-pro-preview, etc.) and grouped `SelectGroup`/`SelectLabel` by provider in the model picker.

---

### Bug 4 — Conversation switching not working (Test 2)
**Root cause:** `ConversationList` handlers only called `setActiveConversationId()`. Without explicit navigation, `ChatView` (the index child route at `/chat`) does not mount or re-render when the store changes from another route.

**Fix (`src/routes/chat/components/ConversationList.tsx`):** Added `navigate({ to: '/chat' })` in both `handleSelectConversation` and `handleNewChat`.

---

### Bug 5 — Transparent component backgrounds (Select dropdowns, buttons)
**Root cause:** `src/index.css` was missing `--popover`, `--popover-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground` in both the `@theme inline` Tailwind v4 mappings and the `:root`/`.dark` HSL value blocks. shadcn/ui `SelectContent` uses `bg-popover`; without it, the background was transparent.

**Fix (`src/index.css`):** Added all 6 missing variable pairs to `@theme inline`, `:root`, and `.dark`. (`commit e504a6d`)

---

### Bug 6 — `autoSaveId` DOM prop warning (react-resizable-panels v4)
**Root cause:** `react-resizable-panels` v4 forwards unknown props to the DOM div. `autoSaveId` caused a React console warning.

**Fix (`src/routes/chat/route.tsx`):** Removed `autoSaveId` prop from `ResizablePanelGroup`.

## Threat Flags

No new security surface introduced during bug fixes. All fixes are internal data flow corrections (proxy mapping, CSS variables, navigation). No new IPC calls or external boundaries.

## Phase 2 Complete

Phase 2 (LLM Chat) is fully implemented and smoke-tested. All CHAT-01 through CHAT-05 requirements are satisfied.

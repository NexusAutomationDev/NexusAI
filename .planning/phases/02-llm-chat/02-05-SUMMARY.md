---
phase: "02"
plan: "05"
subsystem: chat-ui
tags: [react, markdown, streaming, components, chat]
dependency_graph:
  requires: ["02-03"]
  provides: ["MarkdownRenderer", "MessageBubble", "MessageList"]
  affects: ["02-06", "02-07", "02-08"]
tech_stack:
  added:
    - "react-markdown@10.1.0 — incremental markdown rendering via JSX component overrides"
    - "rehype-highlight@7.0.2 — syntax highlighting for code blocks"
    - "remark-gfm@4.x — GFM tables, strikethrough, task lists"
  patterns:
    - "React.memo for streaming performance (prevents quadratic sibling re-renders)"
    - "wheel+scroll event pattern for auto-scroll (distinguishes user scroll from layout expansion)"
    - "Hover-group pattern for on-hover actions (opacity-0 group-hover:opacity-100)"
key_files:
  created:
    - "src/routes/chat/components/MarkdownRenderer.tsx"
    - "src/routes/chat/components/MessageBubble.tsx"
    - "src/routes/chat/components/MessageList.tsx"
  modified:
    - "tests/chat-markdown.test.tsx (renamed from .ts — JSX required .tsx extension)"
decisions:
  - "Non-prose fallback styling: Tailwind v4 setup has no @tailwindcss/typography; all markdown element styles applied via custom component overrides in ReactMarkdown components prop"
  - "MarkdownRenderer detects code blocks by language-* className match OR multi-line content check; avoids false positives for inline code"
  - "Streaming synthetic message rendered via MessageBubble with fabricated Message object containing conversationId, role=assistant, content=streamingContent"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-26"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 02 Plan 05: Message Display Layer Summary

**One-liner:** Memoized MarkdownRenderer with rehype-highlight + CodeBlock copy button, plus full-width MessageBubble and MessageList with wheel-event auto-scroll.

## What Was Built

Three React components implementing the visual core of the chat interface (CHAT-05):

### MarkdownRenderer (`src/routes/chat/components/MarkdownRenderer.tsx`)

Memoized react-markdown renderer with:
- `React.memo` wrapping prevents sibling re-renders during streaming (RESEARCH §Pitfall 3 — quadratic re-parsing)
- `rehype-highlight` for syntax highlighting, `remark-gfm` for GFM tables/strikethrough
- Custom `CodeBlock` component with language badge (top-right) and hover copy button
- "Copiar" → "Copiado!" toggle with 2s timeout (UI-SPEC copywriting)
- Non-prose fallback (Tailwind v4 has no `@tailwindcss/typography`); all element styles via custom component overrides
- `opacity-0 group-hover:opacity-100` on copy button (D-11 — hover-only)
- Security: no `dangerouslySetInnerHTML`; react-markdown renders via AST (T-02-05-01)

### MessageBubble (`src/routes/chat/components/MessageBubble.tsx`)

Single message component with:
- Full-width alternating backgrounds: `bg-secondary` (user) / `bg-card` (AI) per D-08
- `TypingIndicator`: 3-dot pulse animation (600ms cycle per UI-SPEC) when `isStreaming && !streamingContent`
- Model badge on AI messages: `bg-muted text-muted-foreground` (NOT accent — per UI-SPEC explicit constraint)
- Message actions (D-24): Copy (any), Edit (user-only, opens textarea inline), Delete, Regenerate (AI-only)
- Actions hidden by default: `opacity-0 group-hover:opacity-100` (hover-reveal)
- Edit mode: inline textarea with Salvar/Cancelar buttons
- Fade-in animation: `animate-in fade-in duration-150` (UI-SPEC: 150ms)

### MessageList (`src/routes/chat/components/MessageList.tsx`)

Scrollable list with:
- `wheel` event detection distinguishes user-initiated scroll from layout-shift scroll (RESEARCH §Pitfall 2)
- `userScrolledRef` stops auto-scroll when user scrolls up; clears when user reaches bottom
- `isNearBottomRef`: auto-scroll only if within 100px of bottom (D-13)
- Synthetic streaming message injected at bottom when `isThisConversationStreaming`
- Connects to `useChatStore` for `isStreaming`, `streamingContent`, `streamingConversationId`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Renamed test file from .ts to .tsx**
- **Found during:** Task 1 — RED phase test run
- **Issue:** `tests/chat-markdown.test.ts` contained JSX (`<MarkdownRenderer ... />`) but had `.ts` extension; vite/oxc threw parse error ("expected `>`")
- **Fix:** Renamed file to `tests/chat-markdown.test.tsx`; vitest config already includes `.tsx` in `include` glob
- **Files modified:** `tests/chat-markdown.test.tsx`
- **Commit:** 369a744

**2. [Rule 2 - Missing] Non-prose fallback for Tailwind v4**
- **Found during:** Task 1 — plan action noted the check requirement
- **Issue:** Plan included `prose prose-sm max-w-none dark:prose-invert` classes but `@tailwindcss/typography` is not in the project (Tailwind v4 with vite plugin, no external plugins)
- **Fix:** Used non-prose fallback `div className="text-sm leading-relaxed text-foreground space-y-2"` with all markdown element styling via custom component overrides
- **Impact:** All semantic markdown elements (h1-h3, p, ul, ol, table, blockquote) styled via ReactMarkdown `components` prop — functionally equivalent, more explicit

**3. [Rule 3 - Blocking] npm install required in worktree**
- **Found during:** Task 1 — first test run
- **Issue:** Worktree had no `node_modules`; `remark-gfm` import resolved to another worktree's modules
- **Fix:** Ran `npm install` in worktree directory
- **Impact:** Dependencies now available for testing

## Known Stubs

None — all components render from real props. Streaming message uses store state (live data from `useChatStore`).

## Threat Flags

None — no new trust boundaries introduced. LLM response rendering uses react-markdown AST (T-02-05-01 mitigated). Copy button uses `navigator.clipboard.writeText()` — no execution path (T-02-05-02 mitigated).

## Self-Check: PASSED

Files verified:
- `src/routes/chat/components/MarkdownRenderer.tsx` — exists, 198 lines
- `src/routes/chat/components/MessageBubble.tsx` — exists, 191 lines
- `src/routes/chat/components/MessageList.tsx` — exists, 109 lines

Commits verified:
- `369a744` — MarkdownRenderer + test rename
- `41c5eda` — MessageBubble + MessageList

Tests: `npm test tests/chat-markdown.test.tsx` → 4/4 passed

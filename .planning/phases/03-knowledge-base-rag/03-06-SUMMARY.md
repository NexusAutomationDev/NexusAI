---
phase: 03-knowledge-base-rag
plan: 06
subsystem: knowledge-base
tags: [rag, chat-integration, citations, react, zustand, tanstack-query, ui]

# Dependency graph
requires:
  - phase: 03-knowledge-base-rag
    plan: 03
    provides: query_kb command + Citation type (bindings.ts)
  - phase: 02-llm-chat
    plan: 05
    provides: MessageBubble + MarkdownRenderer (react-markdown)
  - phase: 02-llm-chat
    plan: 06
    provides: MessageInput (model picker, send/stream, drag-drop)
provides:
  - "citations.ts: retrieveForQuery (query_kb), buildCitationPrompt (PT-BR Pattern 5), buildCitationMap, embed/splitCitations persistence sentinel, kindLabel"
  - "MessageInput: per-message 'Usar KB' selector (D-03) + grounded send path (retrieve → citation prompt → persist chunks)"
  - "MarkdownRenderer: inline [n] → accent <sup> citation buttons (D-04)"
  - "MessageBubble: 'Fontes' source cards below grounded answers (D-04, D-06 cards-only fallback)"
  - "chat store: kbScope/setKbScope per-message grounding state; ChatMessage.attachments accepts null"
affects: [03-07, agents]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Citations persisted with the assistant message via a trailing HTML-comment sentinel (<!--nexus-citations:JSON-->) — no DB schema migration; splitCitations recovers them on render (survives reload)"
    - "Grounded send injects buildCitationPrompt + the user question as a single user turn into the EXISTING stream_chat pipeline (D-01) — no separate retrieval view"
    - "Source cards driven by the retriever Citation[] (model-independent) → D-06 cards-only fallback; inline [n] markers are a best-effort enhancement on top"

key-files:
  created:
    - src/lib/kb/citations.ts
  modified:
    - src/lib/stores/chat.ts
    - src/routes/chat/components/MessageInput.tsx
    - src/routes/chat/components/MarkdownRenderer.tsx
    - src/routes/chat/components/MessageBubble.tsx

key-decisions:
  - "Persist citations via an HTML-comment sentinel embedded in message.content (embedCitations/splitCitations) instead of a new DB column — avoids a Drizzle migration (owned by parallel plan 03-04) and keeps all edits inside this plan's file set"
  - "Grounding is injected as a single user turn (citation prompt + 'Pergunta: <text>') so the shipped stream pipeline is reused unchanged (D-01); ungrounded sends are byte-for-byte the old path"
  - "Source cards render off the retriever Citation[] (always correct), so a model that omits [n] still shows correct sources (D-06)"
  - "[n] marker buttons use role='link' + aria-label 'Fonte {n}'; clicking scrolls to + briefly ring-highlights the matching [data-citation-card] (1.5s)"
  - "Retrieval failure is non-fatal: the send falls back to ungrounded with an inline D-25 error rather than blocking the message"

requirements-completed: [KB-02]

# Metrics
duration: 8min
completed: 2026-06-27
---

# Phase 3 Plan 06: RAG-Grounded Chat with Citations Summary

**Integrated KB retrieval INTO the existing Phase 2 chat surface (D-01): a per-message "Usar KB" toggle runs `query_kb`, injects a PT-BR citation prompt into the shipped stream, and renders inline `[n]` accent markers + model-independent "Fontes" source cards — delivering the KB-02 query/answer half with the success-criterion citation pattern.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-27T03:52:43Z
- **Completed:** 2026-06-27T04:00:28Z
- **Tasks:** 3
- **Files created/modified:** 5

## Accomplishments

- **src/lib/kb/citations.ts (new)** — the citation bridge:
  - `retrieveForQuery(query, topK=6)` invokes the typed `commands.queryKb` (→ `query_kb`), unwraps the `Result`, returns `Citation[]` (empty on no hits).
  - `buildCitationPrompt(chunks)` — PT-BR Pattern 5 scaffold: the "Responda APENAS com base nos trechos…" instruction + a 1-based numbered list `[n] (arquivo|nota|URL: {title}, seção: {section}) {snippet}`. The number IS the citation id the model emits.
  - `buildCitationMap(chunks)` — `Map<number, Citation>` so `[n]` markers + cards resolve to chunk metadata.
  - `embedCitations` / `splitCitations` — persistence sentinel: append `<!--nexus-citations:JSON-->` to the saved answer, recover it on render. No DB migration.
  - `kindLabel(kind)` — file→"arquivo", note→"nota", url→"URL".
- **chat store (chat.ts)** — `kbScope: boolean` + `setKbScope` per-message grounding state (off by default, D-03). `ChatMessage.attachments` widened to `FileAttachment[] | null` to match the Rust `Option<Vec<T>>` serde shape (fixes a pre-existing type error).
- **MessageInput.tsx** — "Usar KB" / "KB ativa" pill beside the model picker (`h-9`, accent on-state `bg-accent text-accent-foreground` mirroring the send button, `aria-pressed`, focus-visible ring, BookOpen icon). On send with grounding on: `retrieveForQuery` → `buildCitationPrompt` → inject as one user turn → existing `startStream`; on stream-done, `embedCitations` persists the chunks with the assistant message. Ungrounded path untouched.
- **MarkdownRenderer.tsx** — `citationMap` prop; a `CitationMarkers` component splits string leaves on `/\[(\d+)\]/g` and wraps resolvable markers in an accent `<sup>` button (`role="link"`, `aria-label="Fonte {n}"`, keyboard-activatable) that scrolls to + ring-highlights the matching card. Unknown markers / ungrounded messages render `[n]` as plain text. Applied in `p` and `li` renderers.
- **MessageBubble.tsx** — `splitCitations` separates the visible body from citations; passes the map to `MarkdownRenderer`; renders a "Fontes" group of `bg-secondary` source cards (`[n] {itemTitle} · {kind} · {section}` header weight-500, snippet `text-muted-foreground` line-clamped, `data-citation-card={n}`). Cards render whenever `citations.length > 0` regardless of inline markers (D-06). Ungrounded messages render exactly as before.

## KB-02 Citation Flow (for plan 03-07 verification)

1. User toggles "Usar KB" on a message → `kbScope = true`.
2. Send → `query_kb` returns top-6 `Citation[]` → `buildCitationPrompt` → injected as a user turn → `stream_chat` streams the answer.
3. On done, the answer + `<!--nexus-citations:…-->` is persisted to the `messages` table (no schema change).
4. On render, `MessageBubble` splits out citations → `MarkdownRenderer` turns `[n]` into clickable `<sup>` links → "Fontes" cards show the exact retrieved chunks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Persist citations via content sentinel instead of a DB column**
- **Found during:** Task 1
- **Issue:** The plan suggested "a `citations?: Citation[]` field on the persisted message", but the `messages` Drizzle table has no such column and the schema/migration area is owned by the parallel plan 03-04 — adding a column would collide and is arguably architectural.
- **Fix:** `embedCitations`/`splitCitations` round-trip the `Citation[]` through an HTML-comment sentinel inside `message.content`. Cards survive reload, no migration, all changes stay inside this plan's file set.
- **Files modified:** src/lib/kb/citations.ts, src/routes/chat/components/MessageInput.tsx, src/routes/chat/components/MessageBubble.tsx
- **Commits:** 3a918a9, f88d236, f065330

**2. [Rule 3 - Blocking] Fixed pre-existing type errors in files I edited (build was already failing)**
- **Found during:** Tasks 2–3
- **Issue:** `pnpm run build` failed before my edits. Two failures were in files I had to touch: `ChatMessage.attachments` typed `?: FileAttachment[]` (undefined) but the code builds `null` (MessageInput line ~211/242); and `extractText` accessed `.props.children` on an `unknown` (MarkdownRenderer line 30). A third in MessageInput (drag-drop `"cancel"` branch not in the Tauri payload union) blocked compilation.
- **Fix:** Widened `ChatMessage.attachments` to `FileAttachment[] | null` (matches Rust Option); typed `extractText`'s element props; removed the stale `"cancel"` branch (`"leave"` already resets drag state).
- **Files modified:** src/lib/stores/chat.ts, src/routes/chat/components/MarkdownRenderer.tsx, src/routes/chat/components/MessageInput.tsx
- **Commits:** f88d236, f065330

**Out of scope (logged, NOT fixed):** four pre-existing tsc errors in files this plan does not own — `src/lib/queries/chat.ts` (unused var), `src/lib/stores/appearance.ts` + `settings.ts` (Tauri StoreOptions `defaults`), `src/routes/chat/route.tsx` (`direction` prop). Recorded in `.planning/phases/03-knowledge-base-rag/deferred-items.md`.

## Deferred Issues

The four pre-existing tsc errors above mean `pnpm run build` still exits non-zero, but **every file owned by this plan compiles cleanly** (verified by filtering the build output to plan files — no errors in citations.ts / MessageInput / MarkdownRenderer / MessageBubble / chat.ts). The remaining errors belong to other plans/phases.

## Known Stubs

None. The grounded flow is fully wired end-to-end: toggle → `query_kb` → citation prompt → stream → persisted citations → inline markers + source cards. Cards are driven by real retriever output, not mock data.

## Notes / Next Plan Readiness

- **Streaming grounded messages** show source cards only after the answer is saved (citations are embedded on stream-done, not mid-stream) — acceptable; inline `[n]` still appear in the streamed text once the model emits them.
- **Plan 03-07 (manual checkpoint)** should verify: grounded query returns a cited answer, `[n]` markers scroll to the correct card, and the cards-only D-06 fallback shows sources even when the model omits markers.
- Citations live in `message.content` via the sentinel — if a future plan adds a real `citations` column, migrate `splitCitations` output into it and drop the sentinel.

---
*Phase: 03-knowledge-base-rag*
*Completed: 2026-06-27*

## Self-Check: PASSED

- src/lib/kb/citations.ts, MarkdownRenderer.tsx, MessageBubble.tsx, MessageInput.tsx, chat.ts all exist on disk.
- Task commits 3a918a9, f88d236, f065330 (+ docs 7f08aa8) all present in git history.
- All acceptance-criteria greps for Tasks 1–3 matched; all plan files compile (build errors are pre-existing, out-of-scope, documented).

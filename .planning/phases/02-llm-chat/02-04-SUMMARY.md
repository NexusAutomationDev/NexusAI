---
phase: "02"
plan: "04"
subsystem: frontend-chat-layout
tags: [ui, chat, layout, resizable, conversation-list, keyboard-navigation, shadcn]
dependency_graph:
  requires: ["02-03"]
  provides: ["chat-layout-shell", "conversation-list-component", "shadcn-resizable", "shadcn-alert-dialog"]
  affects: ["02-07"]
tech_stack:
  added:
    - "@radix-ui/react-alert-dialog@^1.1.17 — delete confirmation dialog (D-29)"
  patterns:
    - "react-resizable-panels v4 API: Group/Panel/Separator (not PanelGroup/PanelResizeHandle)"
    - "TanStack Router layout route: route.tsx as parent, index.tsx as child"
    - "Keyboard navigation via tabIndex={0} + onKeyDown on container div"
    - "Time grouping: date-fns isToday/isYesterday/isWithinInterval"
key_files:
  created:
    - src/components/ui/resizable.tsx
    - src/components/ui/context-menu.tsx
    - src/components/ui/scroll-area.tsx
    - src/components/ui/dropdown-menu.tsx
    - src/components/ui/alert-dialog.tsx
    - src/routes/chat/route.tsx
    - src/routes/chat/components/ConversationList.tsx
  modified:
    - src/routeTree.gen.ts
    - package.json
decisions:
  - "react-resizable-panels v4 uses orientation not direction, and Group/Panel/Separator not PanelGroup/PanelResizeHandle — wrapper adapted accordingly"
  - "autoSaveId removed from v4 API — layout persistence deferred to useDefaultLayout hook in future iteration"
  - "navigate with search params omitted — search params deferred to Plan 07 when chat view route is created with validateSearch schema"
  - "routeTree.gen.ts manually updated to register /chat layout route as parent of /chat/ index route"
metrics:
  duration: "~35 minutes"
  completed: "2026-06-26"
  tasks_completed: 2
  files_created: 7
  files_modified: 2
---

# Phase 02 Plan 04: Chat Layout Shell and ConversationList Summary

Two-column resizable chat layout with fully-featured conversation list — searchable, time-grouped, keyboard-navigable (ArrowUp/Down), and right-click deletable with AlertDialog confirmation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install shadcn UI components | 7a9260b | resizable.tsx, context-menu.tsx, scroll-area.tsx, dropdown-menu.tsx, alert-dialog.tsx |
| 2 | Chat layout route + ConversationList with ArrowKey navigation | 972220c | route.tsx, ConversationList.tsx, routeTree.gen.ts |

## What Was Built

**Five shadcn UI components** added to `src/components/ui/`:
- `resizable.tsx` — wraps react-resizable-panels v4 (`Group`/`Panel`/`Separator` API)
- `context-menu.tsx` — wraps `@radix-ui/react-context-menu` with full sub-component exports
- `scroll-area.tsx` — wraps `@radix-ui/react-scroll-area`
- `dropdown-menu.tsx` — wraps `@radix-ui/react-dropdown-menu`
- `alert-dialog.tsx` — wraps `@radix-ui/react-alert-dialog` for D-29 delete confirmation

**Chat layout shell** (`src/routes/chat/route.tsx`):
- `createFileRoute("/chat")` as TanStack Router layout route
- `ResizablePanelGroup` with horizontal orientation, two panels
- Left panel: `<ConversationList />` (defaultSize=22, minSize=18, maxSize=35)
- Right panel: `<Outlet />` for child routes (Plan 07 will render chat view here)

**ConversationList** (`src/routes/chat/components/ConversationList.tsx`):
- D-04: Real-time search via `useSearchConversations(searchQuery)`
- D-05: "Nova Conversa" button → `useCreateConversation` → `setActiveConversationId`
- D-07: Time sections — Hoje, Ontem, Últimos 7 dias, Mais antigos (date-fns)
- D-28: `tabIndex={0}` on container + `onKeyDown` handler for ArrowUp/ArrowDown navigation with wrap-around, `focusedIndex` state tracking
- D-29: Right-click `ContextMenu` → "Excluir" → `AlertDialog` confirmation ("Esta ação não pode ser desfeita")
- Active conversation: `ring-2 ring-accent` per UI-SPEC
- Model badge from `conv.lastModel` (truncated after last `/`)
- Skeleton loading state (3 animated placeholders)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] react-resizable-panels v4 API mismatch**
- **Found during:** Task 1 — TypeScript compilation
- **Issue:** Plan specified `PanelGroup`/`PanelResizeHandle` namespace imports and `direction` prop — removed in v4 in favor of named exports (`Group`/`Panel`/`Separator`) and `orientation` prop
- **Fix:** Rewrote `resizable.tsx` to use v4 named exports; updated `route.tsx` to use `orientation="horizontal"`. Removed `autoSaveId` (not in v4 API).
- **Files modified:** `src/components/ui/resizable.tsx`, `src/routes/chat/route.tsx`
- **Commit:** 7a9260b, 972220c

**2. [Rule 2 - Missing] `@radix-ui/react-alert-dialog` not in package.json**
- **Found during:** Task 1 — dependency check
- **Issue:** Package genuinely absent from package.json
- **Fix:** `npm install @radix-ui/react-alert-dialog`
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** 7a9260b

**3. [Rule 2 - Missing] routeTree.gen.ts not updated for /chat layout route**
- **Found during:** Task 2 — TypeScript compilation
- **Issue:** `createFileRoute("/chat")` not in `FileRoutesByPath`; TanStack Router requires the generated route tree to know about layout routes
- **Fix:** Manually added `/chat` layout route, updated `ChatIndexRoute` parent to `ChatRoute`, added `ChatRouteChildren` interface, wired `_addFileChildren`
- **Files modified:** `src/routeTree.gen.ts`
- **Commit:** 972220c

**4. [Rule 3 - Blocked] navigate with search params omitted**
- **Found during:** Task 2 — `/chat` route has no `validateSearch` schema yet
- **Issue:** Plan's `navigate({ to: "/chat", search: { conversationId } })` requires a Zod schema defined in `createFileRoute` — depends on Plan 07's chat view structure
- **Fix:** Removed URL navigation; conversation selection via `setActiveConversationId` (Zustand). Plan 07 will add search params when the chat view route is built.
- **Impact:** No regression — store-based selection is correct interim pattern

## Known Stubs

None — all data flows through real hooks. The `<Outlet />` in the right panel renders the existing `/chat/` index stub until Plan 07 replaces it with the actual chat view.

## Threat Flags

No new threat surface beyond the plan's threat model. Search query flows through Drizzle ORM `like()` (parameterized). Conversation titles rendered in React JSX text nodes (auto-escaped).

## Self-Check: PASSED

All 7 created files verified on disk. Both task commits (7a9260b, 972220c) verified in git log.

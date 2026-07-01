# Phase 4: LLM Benchmarking — Research

**Researched:** 2026-06-28
**Domain:** Parallel Channel API streaming, react-resizable-panels v4, shadcn/ui ToggleGroup + Tabs, SQLite benchmark schema, Zustand per-column state
**Confidence:** HIGH (all core findings verified against codebase or official sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Column Layout:** N dynamic panels using `react-resizable-panels` — supports 2–4 models per benchmark run. Each column has `collapsible={true} collapsedSize={4}` on its `ResizablePanel` so users can collapse a weaker response. `defaultSize={Math.floor(100 / selectedModels.length)}` with `minSize={15}`. The number of columns (models selected) must be fixed before the benchmark starts — `ResizablePanelGroup` does not support adding/removing panels after mount.

**D-02 — Model Selection:** Per-column model pickers — a `Select` dropdown (reusing the Phase 2 model picker component verbatim) in the header of each column. The benchmark starts with 2 columns pre-filled with the defaults configured in Settings (FOUND-02). A "+" button appends a third or fourth column (capped at 4). Each column header also shows a "×" to remove it. No pre-run dialog, no presets.

**D-03 — Scoring UX:** A sticky `ToggleGroup` bar with 3 states: `[Model A name] | [Empate] | [Model B name]` (for N > 2, the bar lists all models + "Empate"). The bar appears disabled while any column is still streaming — it enables automatically when the last model finishes. Persisted to SQLite as: winner model ID, or `null` for tie. `shadcn/ui ToggleGroup` — no new dependency.

**D-04 — History View:** Two tabs in the Benchmark module header: "Nova sessão" and "Histórico". The History tab shows a `shadcn/ui Table` with one row per benchmark session. Columns: prompt (truncated ~60 chars, full text on tooltip) + model badges + winner badge (`default` variant for model name, `secondary` for "Empate", `muted` for "Não avaliado") + relative date (`date-fns`, absolute timestamp on tooltip). Radix Tabs and shadcn Table are already in the project (Phase 3).

### Claude's Discretion

- Exact SQLite schema for benchmark sessions and scores (normalized: `benchmark_sessions` + `benchmark_results` per model)
- Streaming orchestration (whether one Tauri command dispatches all N streams or N separate `stream_chat` invocations)
- Prompt input area design (above the columns or modal-style before rendering columns)
- `autoSaveId` naming for resizable panel persistence
- ToggleGroup positioning (top sticky bar vs floating below the response area)
- History table pagination or infinite scroll (based on expected volume — likely flat list is fine)

### Deferred Ideas (OUT OF SCOPE)

- AI auto-scoring of responses (v2)
- Full response replay of past benchmark sessions (v2)
- Cost/latency comparison (v2)
- 5+ model support (v2)
- Persistent named comparison sets (v2)
- History filtering/search (v2)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BENCH-01 | Usuário pode disparar o mesmo prompt para múltiplos modelos simultaneamente e ver as respostas lado a lado | N parallel `stream_chat` invocations with N independent Channels — each column gets its own `Channel<StreamEvent>` passed to the existing `stream_chat` command; Rust async handles all concurrently |
| BENCH-02 | Usuário pode avaliar manualmente qual resposta foi melhor e registrar o resultado | `ToggleGroup` bar enabled on stream completion → `winner_model` persisted to `benchmark_results` via Drizzle proxy; visible in History tab via `benchmark_sessions` + `benchmark_results` JOIN |
</phase_requirements>

---

## Summary

Phase 4 builds a side-by-side multi-model LLM benchmark directly on top of Phase 2's streaming infrastructure. The core insight is that the existing `stream_chat` Tauri command already supports concurrent invocation: each column creates its own `Channel<StreamEvent>` and calls `invoke('stream_chat', ...)` independently. Rust's `tokio` async runtime handles N parallel HTTP streams with no changes to the Rust side.

The main new work is frontend-only: a Zustand `benchmarkStore` that tracks per-column streaming state (keyed by column index or session ID), a scoring `ToggleGroup` bar that auto-enables when all columns emit `done`, and two new SQLite tables (`benchmark_sessions` + `benchmark_results`) added via Drizzle migration. The route activates the sidebar stub that has existed since Phase 1.

The only new npm packages required are `@radix-ui/react-tabs` and `@radix-ui/react-toggle-group`, plus their shadcn/ui wrappers (`tabs.tsx`, `toggle.tsx`, `toggle-group.tsx`). `react-resizable-panels` v4.11.2 is already installed and the shadcn/ui wrapper already exists. The `shadcn/ui Table`, `Badge`, `Select`, `Tooltip`, and `date-fns` are also already present.

**Primary recommendation:** Reuse `stream_chat` as-is with N parallel invocations (one per column) — this is the cleanest path with zero Rust changes needed, full stop support per column via the existing `stop_streaming` command keyed by a synthetic `conversationId` per column.

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| react-resizable-panels | 4.11.2 (installed) | Side-by-side column layout | Already in project via `src/components/ui/resizable.tsx` |
| shadcn/ui Table | installed | History tab table | `src/components/ui/table.tsx` already exists |
| shadcn/ui Badge | installed | Model/winner badges | `src/components/ui/badge.tsx` already exists |
| shadcn/ui Select | installed | Per-column model picker | `src/components/ui/select.tsx` already exists |
| date-fns | 4.4.0 (installed) | Relative timestamps in history | Already in package.json |
| Zustand | 5.0.14 (installed) | benchmarkStore | Follow same pattern as `chat.ts` / `indexing.ts` |
| Drizzle ORM | 0.45.2 (installed) | SQL queries for history | Same proxy pattern established in Phase 1 |
| tauri-specta | 2.0.0-rc.25 (installed) | TypeScript binding gen | Re-run `export-bindings` if Rust types added |

### New Packages Required
| Library | Version | Purpose | Install Command |
|---------|---------|---------|----------------|
| @radix-ui/react-tabs | 1.1.15 (latest) | Tabs primitive for "Nova sessão" / "Histórico" | `pnpm add @radix-ui/react-tabs` |
| @radix-ui/react-toggle-group | 1.1.13 (latest) | ToggleGroup primitive for scoring bar | `pnpm add @radix-ui/react-toggle-group` |
| @radix-ui/react-toggle | (peer) | Required by toggle-group | Installed as peer |

**shadcn/ui component files to add:**
```bash
pnpm exec shadcn add tabs toggle toggle-group
```
This generates `src/components/ui/tabs.tsx`, `toggle.tsx`, `toggle-group.tsx`.

**Version verification:** [VERIFIED: npm registry]
```bash
npm view @radix-ui/react-tabs version     # 1.1.15
npm view @radix-ui/react-toggle-group version  # 1.1.13
npm view react-resizable-panels version   # 4.12.0 (project has 4.11.2 — fine)
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| N separate `stream_chat` invocations | Single `stream_benchmark` Rust wrapper | Wrapper adds Rust code, solves nothing the frontend can't handle; N invocations is simpler and zero Rust work |
| shadcn/ui ToggleGroup | Custom radio buttons | No advantage; ToggleGroup has built-in `disabled`, keyboard nav, ARIA |
| Tabs primitive | Custom tab state + show/hide | Tabs are already used project-wide; no reason to diverge |

---

## Architecture Patterns

### Streaming Orchestration (Claude's Discretion — Recommendation)

**Use N separate `stream_chat` invocations (one per column).** This requires zero Rust changes.

Each column during a benchmark run:
1. Creates a `Channel<StreamEvent>` with `new Channel()`
2. Calls `invoke('stream_chat', { input: { conversationId: syntheticId, messages, model }, onEvent: channel })`
3. The `syntheticId` is a `benchmarkSessionId + '-' + columnIndex` string used only to key the `CANCEL_MAP` in Rust for per-column stop support

The existing `stop_streaming(conversationId)` command can cancel any individual column — the synthetic `conversationId` keys map cleanly into the existing `CANCEL_MAP`.

```typescript
// Source: src/lib/stores/chat.ts (established Channel pattern)
const channels = selectedModels.map((_, idx) => {
  const ch = new Channel<StreamEvent>();
  const syntheticId = `${sessionId}-col-${idx}`;
  ch.onmessage = (event) => {
    if (event.event === 'token') {
      benchmarkStore.appendToken(idx, event.data.text);
    } else if (event.event === 'done') {
      benchmarkStore.setColumnDone(idx);
    } else if (event.event === 'error') {
      benchmarkStore.setColumnError(idx, event.data.message);
    }
  };
  invoke('stream_chat', {
    input: { conversationId: syntheticId, messages: [{ role: 'user', content: prompt }], model: selectedModels[idx] },
    onEvent: ch,
  });
  return syntheticId;
});
```

**Why not a `stream_benchmark` Rust wrapper?**
- Adds Rust code + specta type re-export + bindings regeneration
- The frontend already handles N-channel orchestration via Promise.all — no benefit
- Per-column stop is already supported by `stop_streaming` with the synthetic ID

### Zustand benchmarkStore Shape

```typescript
// Pattern: one slice per domain (follows chat.ts, indexing.ts)
// src/lib/stores/benchmark.ts

interface ColumnState {
  model: string;
  content: string;          // accumulated token text
  status: 'idle' | 'streaming' | 'done' | 'error';
  error?: string;
  syntheticId?: string;     // for stop_streaming lookup
}

interface BenchmarkSession {
  sessionId: string;
  prompt: string;
  columns: ColumnState[];   // length = 2..4
  winnerId: string | null;  // model ID or null for tie; undefined = not scored yet
  scored: boolean;
}

interface BenchmarkStore {
  // Active session (cleared when user navigates away or starts new)
  activeSession: BenchmarkSession | null;

  // Actions
  startSession: (prompt: string, models: string[]) => string;  // returns sessionId
  appendToken: (colIdx: number, text: string) => void;
  setColumnDone: (colIdx: number) => void;
  setColumnError: (colIdx: number, msg: string) => void;
  stopColumn: (colIdx: number) => Promise<void>;
  stopAll: () => Promise<void>;
  setWinner: (modelId: string | null) => Promise<void>;  // null = tie
  resetSession: () => void;

  // Derived (not stored, computed in selectors)
  // allDone: () => boolean — all columns status === 'done' | 'error'
  // scoringEnabled: () => boolean — allDone && !scored
}
```

**Key design insight:** `allDone` is a computed selector, not stored state — avoids race conditions between per-column `setColumnDone` calls. Use `useStore(benchmarkStore, s => s.activeSession?.columns.every(c => c.status === 'done' || c.status === 'error'))`.

### SQLite Schema (Claude's Discretion — Recommendation)

Normalized: one session row + one result row per model.

```sql
-- Migration: 0003_benchmark.sql
CREATE TABLE IF NOT EXISTS benchmark_sessions (
  id TEXT PRIMARY KEY NOT NULL,              -- crypto.randomUUID()
  prompt TEXT NOT NULL,
  created_at INTEGER NOT NULL,               -- Unix ms
  scored_at INTEGER                          -- NULL until scoring action
);

CREATE TABLE IF NOT EXISTS benchmark_results (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL
    REFERENCES benchmark_sessions(id) ON DELETE CASCADE,
  model TEXT NOT NULL,                       -- e.g. 'gpt-4.1', 'anthropic/claude-opus-4'
  response TEXT NOT NULL,                    -- full accumulated text
  is_winner INTEGER NOT NULL DEFAULT 0,      -- 1 = winner, 0 = not
  is_tie INTEGER NOT NULL DEFAULT 0,         -- 1 = tie selected
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bench_results_session
  ON benchmark_results(session_id);
CREATE INDEX IF NOT EXISTS idx_bench_sessions_created
  ON benchmark_sessions(created_at DESC);
```

**Why this schema:** Separate `is_winner` and `is_tie` columns (not a single nullable `winner_model` field) makes SQL queries for the History tab simple: `WHERE is_winner = 1` gives the winner row, `WHERE is_tie = 1 LIMIT 1` means tie. Avoids `NULL` ambiguity between "not yet scored" (no `scored_at`) and "scored as tie".

**Drizzle schema additions** go in `src/lib/db/schema.ts` following the exact pattern of `conversations`, `messages`, `kbItems`, etc.

### Recommended Project Structure

```
src/routes/benchmark/
├── index.tsx              # Route component — "Nova sessão" / "Histórico" tabs
├── -components/
│   ├── BenchmarkPrompt.tsx     # Prompt textarea + model selectors + "Iniciar" button (pre-run state)
│   ├── BenchmarkColumns.tsx    # ResizablePanelGroup with N columns
│   ├── BenchmarkColumn.tsx     # Single column: header (model picker + state indicator) + streaming response
│   ├── ScoringBar.tsx          # Sticky ToggleGroup bar (enabled when allDone)
│   └── BenchmarkHistory.tsx    # Table view for history tab

src/lib/stores/benchmark.ts     # Zustand store
src/lib/queries/benchmark.ts    # TanStack Query hooks for history (SELECT from SQLite)
src/lib/db/migrations/
└── 0003_benchmark.sql          # New migration

src/components/ui/
├── tabs.tsx                    # NEW: shadcn/ui Tabs (needs install)
├── toggle.tsx                  # NEW: shadcn/ui Toggle (peer of toggle-group)
└── toggle-group.tsx            # NEW: shadcn/ui ToggleGroup (scoring bar)
```

### Pattern 1: Dynamic N-Panel Layout (Pre-Run Selection)

**What:** Column count fixed before benchmark starts. The "pre-run" state shows column headers with model pickers + "+" and "×" controls. "Iniciar" button freezes the selection and renders the `ResizablePanelGroup`.

**When to use:** Separating pre-run config from the running view avoids the `ResizablePanelGroup`-cannot-add-panels-at-runtime limitation.

```tsx
// Source: D-01 (CONTEXT.md), react-resizable-panels v4 verified API
// ResizablePanelGroup uses `Group` from react-resizable-panels under the hood (resizable.tsx)
{isRunning && (
  <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
    {columns.map((col, idx) => (
      <React.Fragment key={col.model}>
        {idx > 0 && <ResizableHandle withHandle />}
        <ResizablePanel
          collapsible={true}
          collapsedSize={4}
          defaultSize={Math.floor(100 / columns.length)}
          minSize={15}
        >
          <BenchmarkColumn column={col} colIdx={idx} />
        </ResizablePanel>
      </React.Fragment>
    ))}
  </ResizablePanelGroup>
)}
```

**Critical:** `collapsedSize` is a percentage (0–100), not pixels, in react-resizable-panels v4. `collapsedSize={4}` means 4% width — enough to show the column header for identification and re-expansion. [VERIFIED: npm registry + community docs]

### Pattern 2: Auto-Enabling ToggleGroup

```tsx
// Source: D-03 (CONTEXT.md), shadcn/ui ToggleGroup
const allDone = useBenchmarkStore(s =>
  s.activeSession?.columns.every(c => c.status === 'done' || c.status === 'error') ?? false
);
const scored = useBenchmarkStore(s => s.activeSession?.scored ?? false);

<ToggleGroup
  type="single"
  disabled={!allDone || scored}
  value={winnerId ?? undefined}
  onValueChange={(val) => setWinner(val || null)}
>
  {columns.map(col => (
    <ToggleGroupItem key={col.model} value={col.model}>
      {getModelLabel(col.model)}
    </ToggleGroupItem>
  ))}
  <ToggleGroupItem value="__tie__">Empate</ToggleGroupItem>
</ToggleGroup>
```

**Note:** Use a sentinel value `"__tie__"` (not `null`) for the ToggleGroup value since the component expects a string. Convert to `null` when writing to SQLite.

### Pattern 3: History Table with TanStack Query

```typescript
// src/lib/queries/benchmark.ts
export function useBenchmarkHistory() {
  return useQuery({
    queryKey: ['benchmark-history'],
    queryFn: async () => {
      const sessions = await db.select().from(benchmarkSessions)
        .orderBy(desc(benchmarkSessions.createdAt))
        .limit(100); // flat list is fine for expected volume (D-04)
      // JOIN results for each session
      const results = await db.select().from(benchmarkResults)
        .where(inArray(benchmarkResults.sessionId, sessions.map(s => s.id)));
      return sessions.map(s => ({
        ...s,
        results: results.filter(r => r.sessionId === s.id),
      }));
    },
  });
}
```

### Anti-Patterns to Avoid

- **Sharing one Channel across N models:** Each column MUST have its own `new Channel()` — channels are not reusable/multiplexed. [ASSUMED from Channel API design; consistent with codebase pattern]
- **Storing `allDone` in Zustand:** Race condition if two columns emit `done` simultaneously and both reads of `columns` see partial state. Compute as a selector instead.
- **Adding/removing panels after `isRunning = true`:** React will remount the `ResizablePanelGroup` tree if panel count changes — this is correct but only possible in the pre-run config state, not mid-stream.
- **Using `app.emit()` for streaming:** FOUND-05 forbids this. All N streams MUST use Channel API.
- **Writing accumulated response to `benchmark_results` during streaming:** Only persist on `done` event to avoid N writes per token. Keep accumulation in Zustand, flush to SQLite once.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible column UI | Custom CSS collapse logic | `ResizablePanel collapsible={true} collapsedSize={4}` | Built-in: threshold auto-collapse, `ImperativePanelHandle.collapse()`/`expand()` |
| Mutually exclusive model winner selection | Custom radio group | `shadcn/ui ToggleGroup type="single"` | ARIA, keyboard nav, `disabled` prop, zero boilerplate |
| Tab navigation ("Nova sessão" / "Histórico") | Custom tab show/hide state | `shadcn/ui Tabs` (Radix Tabs primitive) | Focus management, ARIA, keyboard, consistent with project |
| Relative timestamps | Custom date math | `date-fns formatDistanceToNow` (already installed) | Already a project dep; handles all edge cases |
| Session history queries | Raw SQL in component | TanStack Query + Drizzle (established pattern) | Caching, refetch, loading states — same as all other modules |
| Per-column stop | Custom AbortController or flag | `invoke('stop_streaming', { conversationId: syntheticId })` | The existing CANCEL_MAP in Rust already handles this correctly |

**Key insight:** The Rust streaming layer is 100% reusable. Zero Rust work is needed for Phase 4 beyond the new SQLite migration (which is Drizzle-side JS only).

---

## Common Pitfalls

### Pitfall 1: react-resizable-panels v4 API Rename

**What goes wrong:** Using `direction=` instead of `orientation=`, or `PanelResizeHandle` instead of `Separator`. Code compiles but layout breaks silently.
**Why it happens:** v4 renamed props for ARIA alignment. Training data and older docs show the v3 API.
**How to avoid:** The existing `src/components/ui/resizable.tsx` already uses the correct v4 imports (`Group`, `Panel`, `Separator`). Always go through the shadcn/ui wrapper, never import from `react-resizable-panels` directly in feature code.
**Warning signs:** TypeScript error "Property 'direction' does not exist on type 'GroupProps'".

### Pitfall 2: autoSaveId Removed in v4

**What goes wrong:** Setting `autoSaveId="benchmark-columns"` on `ResizablePanelGroup` expecting localStorage persistence — this prop no longer exists in v4.
**Why it happens:** v4 replaced `autoSaveId` with the `useDefaultLayout` hook. D-01 mentions `autoSaveId` which was a v3 prop.
**How to avoid:** Either omit persistence (the benchmark layout is ephemeral — new session = fresh layout) or implement `useDefaultLayout` from the library. For benchmark columns, omitting persistence is acceptable — column sizes don't need to survive a new session.
**Resolution for planner:** The `autoSaveId` reference in D-01 (CONTEXT.md) should be **ignored** — use v4 `useDefaultLayout` only if persistence is needed; for benchmark this is Claude's discretion and the recommendation is to skip it.

[VERIFIED: npm release notes for v4.0.0, community discussion]

### Pitfall 3: ToggleGroup `disabled` Doesn't Prevent Visual Interaction Without CSS

**What goes wrong:** Setting `disabled={true}` on `ToggleGroup` correctly blocks interaction, but the component may not show a visually disabled state unless `cursor-not-allowed` / `opacity-50` are applied via the className.
**Why it happens:** Radix primitives delegate visual styling to the consumer.
**How to avoid:** Apply `data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed` in the `toggle-group.tsx` shadcn component, or wrap with `cn()` in the feature component.

### Pitfall 4: Forgetting Benchmark is Prompt-Only (No Conversation History)

**What goes wrong:** Passing conversation history format (multi-turn) to `stream_chat` for benchmark — benchmark is always a single-turn call with one user message.
**Why it happens:** `stream_chat` accepts `messages: ChatMessage[]` (full history). Benchmark only sends `[{ role: 'user', content: prompt }]`.
**How to avoid:** `benchmarkStore.startSession` constructs the messages array as a single-item list. No history injection.

### Pitfall 5: Persisting Before `done` Event

**What goes wrong:** Writing tokens to SQLite incrementally (on each `token` event) causes N writes per response and leaves partial rows if the user navigates away mid-stream.
**Why it happens:** Eagerness to "save early". The KB module does progressive saves because indexing can take minutes.
**How to avoid:** Benchmark responses are seconds long — accumulate in Zustand, flush to `benchmark_results` once on `done`. If the user navigates away mid-stream, lose the incomplete session (acceptable per scope).

### Pitfall 6: Sidebar Missing Benchmark Icon

**What goes wrong:** The current Sidebar (`src/components/layout/Sidebar.tsx`) has no `benchmark` entry in the `MODULES` array. Phase 1 created stubs for `chat`, `kb`, `gmail`, `calendar`, `mcp`, `agents` — but benchmark was not in the original module list.
**Why it happens:** The benchmark module was planned but not stubbed in Phase 1's sidebar array (confirmed by reading `Sidebar.tsx`).
**How to avoid:** Phase 4 must add a benchmark module entry to `MODULES`. Suggested icon: `BarChart2` from Lucide. Route: `/benchmark`.
[VERIFIED: read `src/components/layout/Sidebar.tsx` directly]

### Pitfall 7: Route Not Registered in TanStack Router

**What goes wrong:** Creating `src/routes/benchmark/index.tsx` without the corresponding `route.tsx` parent layout file (if needed) — TanStack Router file-based routing requires correct file structure to auto-generate `routeTree.gen.ts`.
**Why it happens:** KB and Chat use different routing structures; benchmark should follow the simpler KB pattern (flat route without a parent `route.tsx`, since there's no nested conversation list).
**How to avoid:** Create `src/routes/benchmark/index.tsx` with `createFileRoute('/benchmark/')`. No parent route file needed unless the module needs a persistent layout wrapper (it doesn't for v1).

---

## Code Examples

### Verified Channel Pattern (Benchmark-Adapted)

```typescript
// Source: src/lib/stores/chat.ts (Phase 2 — verified in codebase)
// Adaptation: N channels for N benchmark columns

async function startBenchmarkStreams(
  sessionId: string,
  prompt: string,
  models: string[],
  benchmarkStore: BenchmarkStoreRef,
) {
  const { appendToken, setColumnDone, setColumnError } = benchmarkStore;

  const streamPromises = models.map((model, colIdx) => {
    const syntheticId = `${sessionId}-col-${colIdx}`;
    const channel = new Channel<StreamEvent>();

    channel.onmessage = (event) => {
      if (event.event === 'token') {
        appendToken(colIdx, event.data.text);
      } else if (event.event === 'done') {
        setColumnDone(colIdx);
      } else if (event.event === 'error') {
        setColumnError(colIdx, event.data.message);
      }
    };

    // Each column fires independently — no await, runs in parallel
    return invoke('stream_chat', {
      input: {
        conversationId: syntheticId,       // keys CANCEL_MAP for per-column stop
        messages: [{ role: 'user', content: prompt, attachments: null }],
        model,
      },
      onEvent: channel,
    });
  });

  // Fire all N streams concurrently; error handling per-column via channel.onmessage
  await Promise.allSettled(streamPromises);
}
```

### Stop Individual Column

```typescript
// Source: streaming.rs stop_streaming_impl (verified in codebase)
async function stopColumn(sessionId: string, colIdx: number) {
  const syntheticId = `${sessionId}-col-${colIdx}`;
  await invoke('stop_streaming', { conversationId: syntheticId });
}
```

### Drizzle Schema Addition

```typescript
// Source: src/lib/db/schema.ts (established pattern — verified in codebase)
export const benchmarkSessions = sqliteTable('benchmark_sessions', {
  id: text('id').primaryKey(),
  prompt: text('prompt').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  scoredAt: integer('scored_at', { mode: 'timestamp' }),
});

export const benchmarkResults = sqliteTable('benchmark_results', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => benchmarkSessions.id, { onDelete: 'cascade' }),
  model: text('model').notNull(),
  response: text('response').notNull(),
  isWinner: integer('is_winner', { mode: 'boolean' }).notNull().default(false),
  isTie: integer('is_tie', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

### History Row Badge Logic

```tsx
// Source: D-04 (CONTEXT.md)
function WinnerBadge({ results }: { results: BenchmarkResult[] }) {
  const winner = results.find(r => r.isWinner);
  const tie = results.find(r => r.isTie);
  if (winner) return <Badge variant="default">{getModelLabel(winner.model)}</Badge>;
  if (tie) return <Badge variant="secondary">Empate</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Não avaliado</Badge>;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `autoSaveId` prop on PanelGroup | `useDefaultLayout` hook with `storage: localStorage` | react-resizable-panels v4.0.0 (2024) | D-01 mentions `autoSaveId` — this is a v3 prop that no longer exists in the installed v4.11.2 |
| `direction="horizontal"` | `orientation="horizontal"` | react-resizable-panels v4.0.0 | The existing `resizable.tsx` wrapper already uses the correct v4 API |
| `PanelResizeHandle` | `Separator` | react-resizable-panels v4.0.0 | Wrapper handles this; feature code should use `ResizableHandle` |
| `onCollapse`/`onExpand` event handlers | `onResize` + `panelRef.isCollapsed()` check | react-resizable-panels v4.0.0 | Use `ImperativePanelHandle` ref for programmatic collapse detection |

**Deprecated/outdated:**
- `autoSaveId` on `PanelGroup`: does not exist in v4. Use `useDefaultLayout` hook or omit persistence.
- `onCollapse`/`onExpand` props: removed in v4. Use `onResize` callback with `panelRef.current?.isCollapsed()` check.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Multiple concurrent `Channel<StreamEvent>` instances from the same webview work independently without interference | Architecture Patterns | If Tauri channels have per-webview concurrency limits, parallel streams may queue or drop events. Mitigation: test with 4 simultaneous streams early in Wave 0 |
| A2 | `stop_streaming` with the synthetic `conversationId` pattern cleanly cancels per-column streams without affecting other columns | Architecture Patterns / Code Examples | If the `CANCEL_MAP` has race conditions with concurrent inserts, stop may cancel wrong column. Mitigation: read `streaming.rs` — CANCEL_MAP uses `Arc<Mutex<HashMap>>`, so concurrent access is safe |
| A3 | `collapsedSize={4}` in v4 is a percentage (4%) not pixels | Standard Stack / Pattern 1 | If the unit interpretation changed, collapsed columns would be too narrow or too wide. Mitigation: verify against live behavior in Wave 0 |
| A4 | `shadcn add tabs toggle toggle-group` generates compatible component files given the project's existing shadcn setup | Standard Stack | If shadcn CLI version conflict exists, generated files may use incompatible Radix versions. Mitigation: check `components.json` for shadcn config before running |
| A5 | Benchmark is single-turn only (no multi-turn history injection) | Pitfall 4 | If a user expects follow-up in benchmark, the single-message design would confuse. Mitigation: scope is clear per CONTEXT.md — one prompt per session |

---

## Open Questions

1. **Per-column stop button in header: should it call `stop_streaming` immediately or wait for user to confirm?**
   - What we know: Chat module has a stop button that calls immediately (D-14)
   - What's unclear: For benchmark, stopping one column mid-stream without stopping others is the desired behavior
   - Recommendation: Immediate stop (same as chat) — column shows an error state "Interrompido" with a retry affordance

2. **Where does the prompt input live: above the columns (always visible) or hidden once streaming starts?**
   - What we know: This is Claude's Discretion
   - What's unclear: Whether the user needs to see the prompt while reading responses
   - Recommendation: Persistent above the columns — a single-line read-only display once streaming starts (prevents accidental edits). Re-editable when starting a new session.

3. **What happens if the user navigates away mid-stream?**
   - What we know: TanStack Router navigation unmounts the component
   - What's unclear: Whether streams are automatically cancelled on unmount
   - Recommendation: `useEffect` cleanup calls `stopAll()` on unmount — ensures Rust streams are cancelled and don't leak memory via dangling CANCEL_MAP entries.

---

## Environment Availability

All dependencies are either already installed or available via pnpm/npm. No external services, databases, or CLIs required beyond the existing Tauri dev setup.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| react-resizable-panels | Column layout | ✓ | 4.11.2 (pnpm-lock.yaml) | — |
| @radix-ui/react-tabs | Tabs | ✗ not yet | 1.1.15 (registry) | shadcn adds it |
| @radix-ui/react-toggle-group | Scoring bar | ✗ not yet | 1.1.13 (registry) | shadcn adds it |
| Rust `stream_chat` command | Parallel streaming | ✓ | Phase 2 implemented | — |
| Rust `stop_streaming` command | Per-column stop | ✓ | Phase 2 implemented | — |
| Drizzle migration runner | New tables | ✓ | proxy.ts Pattern | — |

**Missing with no fallback:** none — both missing packages are standard installs.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `vitest.config.ts` (jsdom, `tests/setup.ts`) |
| Quick run command | `pnpm exec vitest run tests/benchmark-*.test.ts` |
| Full suite command | `pnpm exec vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BENCH-01 | N parallel channels each receive independent token streams without cross-contamination | unit | `pnpm exec vitest run tests/benchmark-streaming.test.ts` | ❌ Wave 0 |
| BENCH-01 | `allDone` selector returns true only after ALL columns emit `done` | unit | `pnpm exec vitest run tests/benchmark-store.test.ts` | ❌ Wave 0 |
| BENCH-01 | Column panel renders streaming content correctly and stops when `done` | component | `pnpm exec vitest run tests/benchmark-store.test.ts` | ❌ Wave 0 |
| BENCH-02 | ToggleGroup is `disabled` while any column is `streaming`, enabled when all `done`/`error` | unit | `pnpm exec vitest run tests/benchmark-store.test.ts` | ❌ Wave 0 |
| BENCH-02 | Scoring a winner persists `is_winner=1` row to `benchmark_results` and triggers query invalidation | unit | `pnpm exec vitest run tests/benchmark-history.test.ts` | ❌ Wave 0 |
| BENCH-02 | History table row shows correct winner badge, model list, truncated prompt | component | `pnpm exec vitest run tests/benchmark-history.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm exec vitest run tests/benchmark-*.test.ts`
- **Per wave merge:** `pnpm exec vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/benchmark-store.test.ts` — covers BENCH-01 (channel isolation, allDone selector) and BENCH-02 (ToggleGroup enabled state)
- [ ] `tests/benchmark-streaming.test.ts` — covers BENCH-01 (parallel channel event isolation, token accumulation per column)
- [ ] `tests/benchmark-history.test.ts` — covers BENCH-02 (persist winner, history table render)
- [ ] `tests/setup.ts` — add IPC mock for `stream_benchmark` if a thin wrapper is added; existing `stream_chat` mock already present

**IPC mocks needed in `tests/setup.ts`:**
```typescript
// Add to existing mockIPC in tests/setup.ts:
// stream_chat is Channel-based — mock per-test with vi.fn() (same as existing pattern)
// benchmark_save_score is a new invoke command — mock returns null
if (cmd === 'benchmark_save_score') return null;
```

---

## Security Domain

> `security_enforcement` not explicitly set to `false` in config.json — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — (no new auth) |
| V3 Session Management | No | — (no new sessions) |
| V4 Access Control | No | — (local-only app) |
| V5 Input Validation | Yes (LOW risk) | Prompt text: no injection risk via Tauri IPC; model IDs validated against `AVAILABLE_MODELS` allowlist in settings |
| V6 Cryptography | No | — (no new secrets) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection into LLM context | Information Disclosure | Not a security issue at this layer — user controls their own prompt |
| Model ID spoofing (user passes arbitrary model string) | Tampering | Rust `build_client()` validates model routing by prefix; no need to allowlist in frontend |
| XSS in rendered benchmark responses | Tampering | `MarkdownRenderer` (from Phase 2) already uses `react-markdown` with no `dangerouslySetInnerHTML`; reuse it unchanged |

**No new security surface added.** Phase 4 reuses existing Rust streaming (API keys in Keychain, never in IPC args) and frontend rendering (MarkdownRenderer).

---

## Project Constraints (from CLAUDE.md)

| Constraint | Impact on Phase 4 |
|------------|-------------------|
| Tauri Webview Boundary: CORS + key security | LLM calls happen in Rust only; benchmark columns use same `stream_chat` command — no direct API calls from frontend |
| FOUND-05: Channel API only, never `emit()` in loop | Each column's `Channel<StreamEvent>` is correct; never call `app.emit()` for token streaming |
| Local-first: no external server | Benchmark history stays in SQLite; no sync service |
| React 19 + Vite + TypeScript 5.5+ | All new code follows project conventions |
| Biome for lint/format | Run `pnpm exec biome check --write src/routes/benchmark/ src/lib/stores/benchmark.ts` after each task |
| tauri-specta for type gen | Only needed if new Rust commands are added; if pure frontend + existing commands, no specta re-export needed |
| Drizzle migration pattern | New tables go in `0003_benchmark.sql`; schema types go in `src/lib/db/schema.ts`; `proxy.ts` picks up new migration via `import.meta.glob` automatically |
| Commit message format | `✨ feat(benchmark): <description>` — no Co-Authored-By lines |

---

## Sources

### Primary (HIGH confidence)
- `src/lib/stores/chat.ts` — Channel API streaming pattern, Zustand store shape [VERIFIED: read directly]
- `src-tauri/crates/nexusai-chat/src/streaming.rs` — CANCEL_MAP pattern, stop_streaming_impl [VERIFIED: read directly]
- `src/components/ui/resizable.tsx` — v4 react-resizable-panels wrapper (Group/Panel/Separator) [VERIFIED: read directly]
- `src/lib/db/schema.ts` — Drizzle schema pattern [VERIFIED: read directly]
- `src/lib/db/proxy.ts` — Migration runner pattern [VERIFIED: read directly]
- `src/lib/bindings.ts` — StreamEvent type, existing commands [VERIFIED: read directly]
- `pnpm-lock.yaml` — react-resizable-panels 4.11.2 confirmed [VERIFIED: grep]
- `package.json` — all installed deps confirmed [VERIFIED: read directly]

### Secondary (MEDIUM confidence)
- npm registry: `@radix-ui/react-tabs@1.1.15`, `@radix-ui/react-toggle-group@1.1.13` [VERIFIED: npm view]
- react-resizable-panels v4.0.0 release notes: `autoSaveId` removed, `onCollapse`/`onExpand` removed [CITED: newreleases.io/project/github/bvaughn/react-resizable-panels/release/4.0.0]
- shadcn/ui CLI commands: `pnpm exec shadcn add tabs toggle toggle-group` [CITED: ui.shadcn.com/docs/cli]
- Tauri v2 Channel API: channels are self-contained, don't interfere with each other [CITED: v2.tauri.app/develop/calling-frontend/]

### Tertiary (LOW confidence — tagged [ASSUMED] in Assumptions Log)
- Multiple concurrent Channels from same webview confirmed safe: [ASSUMED] from Channel API design and codebase usage pattern; not explicitly documented for the N-concurrent case

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against installed versions and npm registry
- Architecture: HIGH — patterns directly derived from existing Phase 2/3 codebase (streaming.rs, chat.ts, indexing.ts)
- Pitfalls: HIGH for codebase-derived pitfalls (Sidebar.tsx missing benchmark entry, v4 API rename); MEDIUM for runtime behavior pitfalls (concurrent channels)
- SQLite schema: HIGH — follows exact same patterns as Phase 1-3 migrations

**Research date:** 2026-06-28
**Valid until:** 2026-09-28 (stable libraries; react-resizable-panels v4 API stable)

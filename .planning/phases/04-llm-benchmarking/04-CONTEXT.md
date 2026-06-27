# Phase 4: LLM Benchmarking - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 delivers a side-by-side multi-model benchmark UI. The user enters a prompt, selects 2–4 LLM models (each in its own column), and sees all responses arrive via independent parallel streams. After all streams complete, the user marks a winner or declares a tie — that manual score is persisted to SQLite and visible in a benchmark history tab.

Out of scope: AI auto-scoring of responses (v2), full replay of past benchmark sessions (v2), cost/latency comparison, anything beyond BENCH-01 and BENCH-02.

</domain>

<decisions>
## Implementation Decisions

### Column Layout
- **D-01:** N dynamic panels using `react-resizable-panels` — supports 2–4 models per benchmark run. Each column has a native `collapsible={true} collapsedSize={4}` prop on its `ResizablePanel` so users can collapse a weaker response and focus on the top candidates. `defaultSize={Math.floor(100 / selectedModels.length)}` with `minSize={15}`. The number of columns (models selected) must be fixed before the benchmark starts — `ResizablePanelGroup` does not support adding/removing panels after mount.

### Model Selection
- **D-02:** Per-column model pickers — a `Select` dropdown (reusing the Phase 2 model picker component verbatim) in the header of each column. The benchmark starts with 2 columns pre-filled with the defaults configured in Settings (FOUND-02). A "+" button appends a third or fourth column (capped at 4). Each column header also shows a "×" to remove it. No pre-run dialog, no presets.

### Scoring UX
- **D-03:** A sticky `ToggleGroup` bar with 3 states: `[Model A name] | [Empate] | [Model B name]` (for N > 2, the bar lists all models + "Empate"). The bar appears disabled while any column is still streaming — it enables automatically when the last model finishes. Persisted to SQLite as: winner model ID, or `null` for tie. `shadcn/ui ToggleGroup` — no new dependency.

### History View
- **D-04:** Two tabs in the Benchmark module header: "Nova sessão" and "Histórico". The History tab shows a `shadcn/ui Table` with one row per benchmark session. Columns: prompt (truncated ~60 chars, full text on tooltip) + model badges + winner badge (`default` variant for model name, `secondary` for "Empate", `muted` for "Não avaliado") + relative date (`date-fns`, absolute timestamp on tooltip). Radix Tabs and shadcn Table are already in the project (Phase 3).

### Claude's Discretion
- Exact SQLite schema for benchmark sessions and scores (normalized: `benchmark_sessions` + `benchmark_results` per model)
- Streaming orchestration (whether one Tauri command dispatches all N streams or N separate `stream_chat` invocations)
- Prompt input area design (above the columns or modal-style before rendering columns)
- `autoSaveId` naming for resizable panel persistence
- ToggleGroup positioning (top sticky bar vs floating below the response area)
- History table pagination or infinite scroll (based on expected volume — likely flat list is fine)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §LLM Benchmarking (BENCH-01, BENCH-02) — the 2 requirements for this phase; success criteria are the acceptance bar
- `.planning/ROADMAP.md` §Phase 4: LLM Benchmarking — goal, 2 success criteria, dependency on Phase 2

### Architecture & Stack
- `CLAUDE.md` §Technology Stack — react-resizable-panels, shadcn/ui (ToggleGroup, Tabs, Table, Badge, Select), Channel API streaming, Tauri commands
- `CLAUDE.md` §Critical Architecture Constraint: The Tauri Webview Boundary — Channel API for streaming, never emit() in loop (FOUND-05)
- `.planning/REQUIREMENTS.md` §v2 Requirements — "Score automático por IA no benchmark" and "Histórico persistente de sessões de benchmark" are explicitly v2; v1 scope is manual scoring only

### Prior Phase Context (established patterns to reuse)
- `.planning/phases/02-llm-chat/02-CONTEXT.md` — `stream_chat` Tauri command, Channel API streaming pattern, model picker Select component (D-20 through D-23), `MarkdownRenderer`, streaming with stop/regenerate controls. D-01..D-03 build directly on Phase 2's streaming infrastructure.
- `.planning/phases/01-foundation/01-CONTEXT.md` — Sidebar nav registration, AppShell layout, dark-first Linear/Raycast aesthetic (D-02), shadcn/ui setup, Drizzle migration pattern, `FOUND-02` default model per task type (used to pre-fill benchmark column defaults).

### No external ADRs — requirements fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/routes/chat/components/MessageInput.tsx` — model picker Select grouped by provider; reuse almost verbatim as the per-column picker in D-02
- `src/components/chat/MarkdownRenderer.tsx` — drop in directly for rendering streaming responses per column
- `src/components/chat/MessageBubble.tsx` — reference for streaming token display; may extract just the streaming text display portion
- `src/components/ui/resizable.tsx` — `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` — already in use in Chat and KB modules
- `src/lib/stores/settings.ts` — `PROVIDER_LABELS` and model list; provides defaults for D-02 column pre-fill (FOUND-02)
- `src/lib/bindings.ts` — `StreamEvent`, `StreamChatInput` — canonical streaming types; benchmark columns will consume the same event shape

### Established Patterns
- **Channel API streaming:** one channel per stream; `stream_chat` command invoked once per model column — N parallel streams = N channel listeners
- **Zustand stores:** one slice per domain (chat.ts, settings.ts, indexing.ts); benchmark needs its own `benchmarkStore` slice following this pattern
- **Drizzle ORM migrations:** schema migrations via `import.meta.glob` pattern (established in Phase 1–3)
- **shadcn/ui Tabs:** Radix Tabs already used in KB module — same import pattern applies

### Integration Points
- **Sidebar:** Benchmark route already stubbed in the sidebar (Phase 1, D-03 — "Em breve" tooltip). Phase 4 activates it.
- **Settings (FOUND-02):** Default model per task type includes "benchmark" — the per-column picker should read this default on mount.
- **SQLite:** New migration needed for `benchmark_sessions` and `benchmark_results` tables — follows Drizzle proxy pattern.
- **Rust side:** Either reuse `stream_chat` directly (N invocations for N columns) or create a thin `stream_benchmark` wrapper — planner decides.

</code_context>

<specifics>
## Specific Ideas

- **ToggleGroup timing:** The scoring bar should enable automatically when all streams complete — not require the user to click anything. `disabled` state tracked in `benchmarkStore` keyed by session ID.
- **Column header design:** Each column shows [Model Select] + [Provider badge] + [× remove] + streaming state indicator (dots animation during streaming, checkmark when done) — all within the same header row.
- **2 pre-filled columns:** Default to the top-2 most recently used models in the benchmark module (or Settings defaults if no prior benchmark exists).
- **`collapsedSize={4}`:** When collapsed, column shows only the header — enough to identify the model and expand again. Not zero-width.

</specifics>

<deferred>
## Deferred Ideas

- **AI auto-scoring:** LLM judges which response was better — explicitly v2 per REQUIREMENTS.md
- **Full response replay:** Clicking a history entry shows the full responses again — v2 (tab "Histórico" is designed to evolve into this naturally)
- **Cost/latency comparison:** Token cost and time-to-complete per column — v2 enhancement
- **5+ model support:** Beyond 4 columns — horizontal scroll or pagination approach needed; out of scope for v1 layout decision
- **Persistent model slots:** Save a named "comparison set" (e.g., "My OpenAI vs Gemini") — deferred from D-02 discussion (Option E)
- **History filtering/search:** Filter history by model, winner, date range — v2 table enhancement

</deferred>

---

*Phase: 04-llm-benchmarking*
*Context gathered: 2026-06-27*

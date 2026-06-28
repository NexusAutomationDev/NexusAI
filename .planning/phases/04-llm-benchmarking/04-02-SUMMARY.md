---
phase: "04-llm-benchmarking"
plan: "02"
subsystem: "benchmark-ui"
tags: ["ui", "benchmark", "streaming", "shadcn", "react-resizable-panels"]
dependency_graph:
  requires:
    - "04-01: benchmark store + TanStack Query hooks"
    - "02-05: MarkdownRenderer (src/routes/chat/components/MarkdownRenderer.tsx)"
    - "01-01: shadcn/ui + resizable.tsx"
  provides:
    - "/benchmark route with pre-run and running states"
    - "3 new shadcn/ui primitives: Tabs, Toggle, ToggleGroup"
    - "BenchmarkPrompt: prompt + model selection UI"
    - "BenchmarkColumns: N-panel resizable layout"
    - "BenchmarkColumn: per-model streaming column"
  affects:
    - "04-03: ScoringBar and BenchmarkHistory stubs to be implemented"
tech_stack:
  added:
    - "@radix-ui/react-tabs 1.1.15 — Tabs primitive"
    - "@radix-ui/react-toggle — Toggle primitive"
    - "@radix-ui/react-toggle-group 1.1.13 — ToggleGroup primitive"
  patterns:
    - "react-resizable-panels v4: orientation= (not direction=), no autoSaveId, collapsible panels"
    - "Channel API: one Channel<StreamEvent> per column, Promise.allSettled for parallelism"
    - "Single-turn benchmark: messages=[{role:'user', content, attachments:null}]"
key_files:
  created:
    - src/components/ui/tabs.tsx
    - src/components/ui/toggle.tsx
    - src/components/ui/toggle-group.tsx
    - src/routes/benchmark/index.tsx
    - src/routes/benchmark/-components/BenchmarkPrompt.tsx
    - src/routes/benchmark/-components/BenchmarkColumns.tsx
    - src/routes/benchmark/-components/BenchmarkColumn.tsx
    - src/routes/benchmark/-components/ScoringBar.tsx
    - src/routes/benchmark/-components/BenchmarkHistory.tsx
  modified: []
decisions:
  - "MarkdownRenderer imported from @/routes/chat/components/MarkdownRenderer (not @/components/chat/) — corrected path from plan spec"
  - "Model list uses OpenRouter slugs (anthropic/claude-opus-4) matching settings.ts AVAILABLE_MODELS"
  - "ScoringBar and BenchmarkHistory created as stubs (export function returning null/empty state) for Plano 04-03"
metrics:
  duration: "~15min"
  completed_at: "2026-06-28"
  tasks_completed: 2
  files_created: 9
  files_modified: 0
---

# Phase 4 Plan 02: Benchmark UI Components Summary

Componentes shadcn/ui (Tabs, Toggle, ToggleGroup) instalados manualmente e rota /benchmark criada com estado pré-run (prompt + seletores de modelo) e estado running (N colunas com streaming paralelo via Channel API).

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Instalar componentes shadcn/ui Tabs, Toggle, ToggleGroup | `aac4709` |
| 2 | Criar rota /benchmark + BenchmarkPrompt, BenchmarkColumns, BenchmarkColumn | `9a158a1` |

## What Was Built

### Task 1 — shadcn/ui Primitives

- `tabs.tsx`: Tabs, TabsList, TabsTrigger, TabsContent (Radix Tabs v1.1.15)
- `toggle.tsx`: Toggle + toggleVariants CVA (size/variant)
- `toggle-group.tsx`: ToggleGroup + ToggleGroupItem com `data-[disabled]:opacity-50` obrigatório (UI-SPEC D-03); selected state usa `bg-primary` em vez de `bg-accent` (accent reservado para winner no scoring)

### Task 2 — Rota /benchmark

**`/benchmark/index.tsx`**: Tabs com "Nova sessão" / "Histórico". Quando `activeSession !== null`, substitui BenchmarkPrompt por BenchmarkColumns+ScoringBar.

**`BenchmarkPrompt.tsx`**: Estado pré-run:
- Textarea com placeholder PT-BR, Cmd/Ctrl+Enter ativa
- 2–4 seletores de modelo (D-02) pré-preenchidos com `useSettingsStore().benchmarkModel`
- Botões + (adicionar coluna, máx 4) e × (remover, mín 2)
- CTA "Iniciar benchmark" desabilitado até prompt+modelos válidos
- Dispara N streams paralelos via `Channel<StreamEvent>` + `Promise.allSettled`

**`BenchmarkColumns.tsx`**: Estado running:
- `ResizablePanelGroup orientation="horizontal"` (v4 API correta, sem `autoSaveId`)
- N `ResizablePanel` com `collapsible={true} collapsedSize={4} minSize={15}` (D-01)
- Cleanup de streams no unmount via `stopAll()`

**`BenchmarkColumn.tsx`**: Coluna individual:
- Header h-11 com Select desabilitado (model display), provider badge, StreamingIndicator, stop button
- StreamingIndicator: `Loader2 animate-spin` (streaming) / `Check` (done) / `AlertCircle` (error)
- Content: MarkdownRenderer para conteúdo, cursor ▋ animado durante streaming, mensagem de erro

## Deviations from Plan

**[Rule 1 - Bug] MarkdownRenderer import path corrected**
- **Found during:** Task 2
- **Issue:** Plano referenciava `@/components/chat/MarkdownRenderer` — esse path não existe. MarkdownRenderer fica em `src/routes/chat/components/MarkdownRenderer.tsx`
- **Fix:** Import corrigido para `@/routes/chat/components/MarkdownRenderer`
- **Files modified:** `src/routes/benchmark/-components/BenchmarkColumn.tsx`

**[Rule 2 - Missing] Model list uses OpenRouter slugs**
- **Found during:** Task 2
- **Issue:** Plano listava `claude-opus-4` como valor de modelo; settings.ts usa slugs OpenRouter `anthropic/claude-opus-4`
- **Fix:** AVAILABLE_MODELS usa slugs corretos compatíveis com o Rust `stream_chat` command

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| `src/routes/benchmark/-components/ScoringBar.tsx` | `export function ScoringBar() { return null; }` | Implementado no Plano 04-03 |
| `src/routes/benchmark/-components/BenchmarkHistory.tsx` | Retorna estado vazio "Nenhum benchmark registrado" | Implementado no Plano 04-03 |

Esses stubs NÃO impedem o objetivo do plano (BENCH-01: prompt + streaming colunas). O objetivo está completamente funcional.

## Self-Check: PASSED

- tabs.tsx: FOUND
- toggle.tsx: FOUND
- toggle-group.tsx: FOUND
- benchmark/index.tsx: FOUND
- BenchmarkPrompt.tsx: FOUND
- BenchmarkColumns.tsx: FOUND
- BenchmarkColumn.tsx: FOUND
- Commit aac4709: FOUND
- Commit 9a158a1: FOUND

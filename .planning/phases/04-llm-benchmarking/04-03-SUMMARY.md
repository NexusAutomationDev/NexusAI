---
phase: 04-llm-benchmarking
plan: "03"
subsystem: ui
tags: [react, zustand, tanstack-query, shadcn-ui, date-fns, sonner, tailwind]

# Dependency graph
requires:
  - phase: 04-llm-benchmarking (04-01)
    provides: benchmark Zustand store (useBenchmarkStore, setWinner, activeSession, ColumnState)
  - phase: 04-llm-benchmarking (04-02)
    provides: BenchmarkColumns streaming UI, ToggleGroup/Toggle/Tabs shadcn components installed

provides:
  - ScoringBar: sticky ToggleGroup bar with allDone auto-enable, __tie__ sentinel, toast confirmation
  - BenchmarkHistory: tabela D-04 com prompt truncado/tooltip, badges de modelos, WinnerBadge 3 variantes, data relativa ptBR
  - Sidebar: entrada benchmark (BarChart2, /benchmark, implemented=true) entre KB e Gmail

affects:
  - phase 05 and later: Sidebar.tsx MODULES array pattern established for adding new module entries

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "allDone computed as selector (columns.every) not stored state — avoids race conditions"
    - "__tie__ sentinel string for ToggleGroup null/uncontrolled workaround"
    - "WinnerBadge component with 3 variants: default (winner), secondary (tie), outline (unscored)"
    - "formatDistanceToNow + ptBR locale for relative dates with absolute tooltip fallback"
    - "MODEL_LABELS inline Record<string,string> — shared pattern across ScoringBar, BenchmarkHistory, BenchmarkColumn"

key-files:
  created:
    - src/routes/benchmark/-components/ScoringBar.tsx
    - src/routes/benchmark/-components/BenchmarkHistory.tsx
  modified:
    - src/components/layout/Sidebar.tsx

key-decisions:
  - "allDone computed inline via columns.every() selector, NOT useState — prevents race condition where state update lags behind last column completing"
  - "__tie__ sentinel string in ToggleGroup.value converts to null before setWinner() call for SQLite storage (null = isTie in DB)"
  - "ScoringBar shows 'Qual resposta foi melhor?' pre-score and 'Avaliação registrada' post-score (single label area, no toast duplication)"
  - "type='button' added to disabled stub buttons in Sidebar (biome a11y/useButtonType) — pre-existing gap fixed as Rule 2 deviation"

patterns-established:
  - "Sidebar MODULES array: add new module with id/icon/label/route/implemented — Sidebar.tsx renders automatically"
  - "Score sentinel pattern: ToggleGroup.__tie__ → null for DB, null → __tie__ for display"

requirements-completed:
  - BENCH-01
  - BENCH-02

# Metrics
duration: 55min
completed: 2026-06-28
---

# Phase 4 Plan 03: LLM Benchmarking Wave 3 Summary

**ScoringBar com ToggleGroup auto-enable via allDone selector, BenchmarkHistory com tabela D-04 em PT-BR, e módulo benchmark ativado na Sidebar com BarChart2**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-06-28T19:45:00Z
- **Completed:** 2026-06-28T20:38:29Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- ScoringBar implementada: disabled durante streaming, habilita automaticamente quando `allDone` (selector computado, não estado), toast 'Avaliação registrada.' via sonner após scoring
- BenchmarkHistory: tabela completa com prompt truncado em 60 chars (tooltip), badges de modelos, WinnerBadge com 3 variantes (winner/empate/não avaliado), data relativa em PT-BR com tooltip absoluto
- Sidebar atualizada: benchmark com BarChart2 inserido entre KB e Gmail, `implemented: true`, rota `/benchmark` ativa

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: ScoringBar com ToggleGroup auto-enable e persistência** - `dec06e6` (feat)
2. **Task 2: BenchmarkHistory tabela D-04 + Sidebar ativação** - `dc002ab` (feat)

**Plan metadata (SUMMARY):** commited after this file creation

## Files Created/Modified

- `src/routes/benchmark/-components/ScoringBar.tsx` - Barra sticky h-[52px] com ToggleGroup auto-enable, __tie__ sentinel, toast de confirmação
- `src/routes/benchmark/-components/BenchmarkHistory.tsx` - Tabela 4 colunas: prompt/modelos/vencedor/data com WinnerBadge e ptBR locale
- `src/components/layout/Sidebar.tsx` - BarChart2 import + entrada benchmark no MODULES array (posição: após kb, antes gmail)

## Decisions Made

- `allDone` computado como `columns.every(c => c.status === 'done' || c.status === 'error')` inline no componente — seguindo a nota crítica do store que diz explicitamente "allDone is NOT stored state — compute as selector to avoid race conditions"
- Sentinel `__tie__` usado como valor do ToggleGroup quando empate (null não é válido em ToggleGroup controlado); convertido de volta para null ao chamar `setWinner(null)` para persistência correta no SQLite
- `WinnerBadge` extraído como subcomponente para isolar lógica de variante (default/secondary/outline) e reutilizabilidade

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Biome a11y/useButtonType em Sidebar.tsx**
- **Found during:** Task 2 (atualização do Sidebar)
- **Issue:** O `<button>` dos stubs disabled no Sidebar não tinha `type="button"` — biome reportou `lint/a11y/useButtonType` como erro
- **Fix:** Adicionado `type="button"` ao botão de stub disabled existente
- **Files modified:** src/components/layout/Sidebar.tsx
- **Verification:** `pnpm exec biome check` sem erros
- **Committed in:** dc002ab (Task 2 commit)

**2. [Rule 1 - Bug] Biome organizeImports em ambos os arquivos novos**
- **Found during:** Task 1 e Task 2 (verificação de lint)
- **Issue:** Ordem dos imports não seguia a ordenação alfabética/modular esperada pelo biome
- **Fix:** `pnpm exec biome check --fix --unsafe` aplicado automaticamente nos dois arquivos
- **Files modified:** ScoringBar.tsx, BenchmarkHistory.tsx
- **Verification:** `pnpm exec biome check` limpo em ambos
- **Committed in:** dec06e6, dc002ab (task commits)

---

**Total deviations:** 2 auto-fixed (1 Rule 2 - a11y critical, 1 Rule 1 - biome import ordering)
**Impact on plan:** Ambas as correções necessárias para código correto e sem erros de lint. Sem scope creep.

## Issues Encountered

- **Pré-existente (não corrigido):** `tests/kb-notes-editor.test.tsx` falha com `Error: Failed to resolve import "@codemirror/view"` — falha pré-existente da Phase 3, não relacionada a este plano. Todos os 107 testes relevantes passam; apenas este arquivo de teste pré-existente falha.

## Known Stubs

Nenhum stub. Todos os componentes têm implementação completa e dados reais via Zustand store e TanStack Query.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Módulo benchmark completo (Wave 1 + Wave 2 + Wave 3): store, streaming, UI, scoring, histórico, sidebar
- BENCH-01 e BENCH-02 entregues
- ScoringBar plug-in in `src/routes/benchmark/index.tsx` já estava wired (Wave 2 route importa `ScoringBar`)
- BenchmarkHistory plug-in in `src/routes/benchmark/index.tsx` já estava wired (Wave 2 route importa `BenchmarkHistory`)
- Próxima fase pode adicionar novos módulos à Sidebar seguindo o mesmo padrão MODULES array

---
*Phase: 04-llm-benchmarking*
*Completed: 2026-06-28*

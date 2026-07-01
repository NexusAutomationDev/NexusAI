---
phase: 04-llm-benchmarking
plan: "01"
subsystem: benchmark-store
tags: [zustand, tanstack-query, drizzle, benchmark, tdd]
dependency_graph:
  requires: [04-00]
  provides: [useBenchmarkStore, useBenchmarkHistory, saveBenchmarkScore]
  affects: [04-02, 04-03, 04-04]
tech_stack:
  added: []
  patterns: [zustand-store, tanstack-query-hooks, drizzle-proxy, dynamic-import]
key_files:
  created:
    - src/lib/stores/benchmark.ts
    - src/lib/queries/benchmark.ts
  modified: []
decisions:
  - "allDone é selector externo (não estado armazenado) para evitar race condition quando múltiplas colunas emitem done simultaneamente"
  - "T-04-01-01 mitigado: setWinner valida winnerId contra column model IDs antes de persistir"
  - "Import dinâmico de queries/benchmark dentro de setWinner evita dependência circular store→queries"
  - "Plano 04-00 executado como bloqueador antes do 04-01 (wave 0 não tinha sido executado)"
metrics:
  duration: "15min"
  completed: "2026-06-28"
  tasks: 2
  files: 2
---

# Phase 04 Plan 01: Benchmark Store and Query Hooks Summary

Zustand benchmarkStore com gestão de sessão por coluna e TanStack Query hooks para histórico e persistência — com validação de segurança T-04-01-01 implementada.

## What Was Built

### `src/lib/stores/benchmark.ts`

Zustand store seguindo o padrão de `chat.ts`:

- `startSession(prompt, models)`: cria `ActiveBenchmarkSession` com colunas inicializadas como `idle`, retorna `sessionId`
- `appendToken(colIdx, text)`: acumula tokens imutavelmente (spread + novo array) na coluna correta
- `setColumnDone/Error/Streaming(colIdx)`: atualiza status da coluna sem afetar as outras
- `setColumnSyntheticId(colIdx, id)`: registra o `sessionId-col-N` para `stop_streaming`
- `stopColumn(colIdx)` / `stopAll()`: invoca `stop_streaming` via Tauri IPC com syntheticId
- `setWinner(modelId | null)`: valida modelId contra columns, atualiza UI sincronamente, persiste via import dinâmico
- `resetSession()`: limpa estado ativo

**Segurança (T-04-01-01):** `setWinner` rejeita `modelId` que não seja `null` nem um dos modelos registrados nas colunas, prevenindo tampering.

**`allDone` NÃO é stored state** — deve ser calculado como selector: `s.activeSession?.columns.every(c => c.status === 'done' || c.status === 'error')`.

### `src/lib/queries/benchmark.ts`

TanStack Query hooks seguindo o padrão de `chat.ts`:

- `useBenchmarkHistory()`: queryKey `['benchmark-history']`, staleTime 30s, busca até 100 sessões ordenadas por `created_at DESC`, aninha `results` por `sessionId`
- `saveBenchmarkScore({ session, winnerId })`: insere `benchmark_sessions` + N rows em `benchmark_results`; `winnerId=null` → `isTie=true` em todas as linhas; `winnerId=modelId` → `isWinner=true` apenas na linha do vencedor
- `useSaveBenchmarkScore()`: versão hook que invalida `['benchmark-history']` após persistência

## Test Results

```
Test Files  3 passed (3)
Tests       22 passed (22)

- benchmark-store.test.ts:    11/11 passed (GREEN)
- benchmark-streaming.test.ts: 5/5 passed (GREEN)
- benchmark-history.test.ts:   6/6 passed (GREEN)

Full suite: 1 pre-existing failure (kb-notes-editor.test.tsx — unrelated CodeMirror issue)
No new failures introduced.
```

## Commits

| Hash | Description |
|------|-------------|
| c641fb2 | feat(database): migração SQL + schema Drizzle (04-00 blocker) |
| 9141f2e | test(benchmark): testes RED para BENCH-01 e BENCH-02 (04-00 blocker) |
| ab559cf | chore(deps): package.json com Radix deps (04-00 blocker) |
| 902b626 | feat(benchmark): benchmarkStore e TanStack Query hooks |

## Deviations from Plan

### [Rule 3 - Blocker] Executado plano 04-00 antes do 04-01

**Found during:** Início da execução  
**Issue:** O plano 04-00 (wave 0) não havia sido executado — os arquivos de migração SQL, schema Drizzle e testes RED não existiam, bloqueando totalmente o 04-01  
**Fix:** Executei as 2 tarefas do plano 04-00 antes de iniciar o 04-01 (migração SQL, schema Drizzle, 3 testes RED, package.json com Radix deps)  
**Files modified:** src/lib/db/migrations/0003_benchmark.sql, src/lib/db/schema.ts, tests/benchmark-*.test.ts, package.json  
**Commits:** c641fb2, 9141f2e, ab559cf

### [Rule 2 - Security] Validação T-04-01-01 implementada em setWinner

**Found during:** Revisão da threat model do plano  
**Issue:** T-04-01-01 marcado como `mitigate` — setWinner precisava validar winnerId contra column model IDs  
**Fix:** Adicionada verificação `if (modelId !== null && !activeSession.columns.find(c => c.model === modelId)) return;` com console.warn  
**Files modified:** src/lib/stores/benchmark.ts

## Known Stubs

Nenhum stub detectado. Os dois arquivos criados são implementações completas que serão consumidas pelos planos 04-02 a 04-04.

## Threat Flags

Nenhuma nova superfície de segurança além do que está no threat model do plano.

## Self-Check: PASSED

- [x] `src/lib/stores/benchmark.ts` existe com `useBenchmarkStore`, `ColumnState`, `ActiveBenchmarkSession` exportados
- [x] `src/lib/queries/benchmark.ts` existe com `useBenchmarkHistory`, `saveBenchmarkScore`, `useSaveBenchmarkScore` exportados
- [x] `allDone` aparece apenas em comentário, não como stored state
- [x] 22/22 testes de benchmark passam
- [x] Biome check: 0 erros nos dois novos arquivos
- [x] Commit 902b626 existe

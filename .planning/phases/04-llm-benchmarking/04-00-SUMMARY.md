---
phase: 04-llm-benchmarking
plan: "00"
subsystem: benchmark-foundation
tags: [tdd, database, schema, migration, testing]
dependency_graph:
  requires: []
  provides: [benchmark-schema, benchmark-tests-red, radix-deps]
  affects: [04-01, 04-02, 04-03, 04-04]
tech_stack:
  added: ["@radix-ui/react-tabs@1.1.15", "@radix-ui/react-toggle-group@1.1.13", "@radix-ui/react-toggle"]
  patterns: [drizzle-schema, vitest-red-tests, sqlite-migration]
key_files:
  created:
    - src/lib/db/migrations/0003_benchmark.sql
    - tests/benchmark-store.test.ts
    - tests/benchmark-streaming.test.ts
    - tests/benchmark-history.test.ts
  modified:
    - src/lib/db/schema.ts
    - package.json
decisions:
  - "Testes RED criados antes de implementar módulos (Nyquist Rule) — benchmark-store e benchmark-history importam módulos inexistentes e falham intencionalmente"
  - "Schema normalizado: benchmark_sessions (1 row/sessão) + benchmark_results (N rows/modelo) com FK CASCADE"
  - "Índice em benchmark_results(session_id) e benchmark_sessions(created_at DESC) para performance de histórico"
metrics:
  duration: "11min"
  completed: "2026-06-28"
  tasks: 2
  files: 5
---

# Phase 04 Plan 00: Benchmark Foundation Summary

Fundação TDD para Phase 4: migração SQLite, schema Drizzle e 3 arquivos de teste RED criados antes da implementação.

## What Was Built

- **SQLite migration** (`0003_benchmark.sql`): tabelas `benchmark_sessions` e `benchmark_results` com FK `ON DELETE CASCADE` e índices para performance
- **Drizzle schema** (`schema.ts`): `benchmarkSessions`, `benchmarkResults` + 4 tipos inferidos (`BenchmarkSession`, `BenchmarkResult`, `NewBenchmarkSession`, `NewBenchmarkResult`)
- **Testes RED** (3 arquivos): testes que falham por imports de módulos inexistentes + testes de lógica pura que passam imediatamente
- **Dependências Radix** instaladas: `@radix-ui/react-tabs@1.1.15`, `@radix-ui/react-toggle-group@1.1.13`, `@radix-ui/react-toggle`

## Test State After This Plan

| File | State | Reason |
|------|-------|--------|
| benchmark-store.test.ts | RED | `src/lib/stores/benchmark.ts` não existe |
| benchmark-streaming.test.ts | GREEN | Lógica pura sem imports externos |
| benchmark-history.test.ts | RED (1 test) | `src/lib/queries/benchmark.ts` não existe; outros testes passam |

## Commits

| Hash | Description |
|------|-------------|
| c641fb2 | feat(database): migração SQL + schema Drizzle para benchmark |
| 9141f2e | test(benchmark): 3 arquivos de teste RED para BENCH-01 e BENCH-02 |
| ab559cf | chore(deps): package.json atualizado com Radix deps |

## Deviations from Plan

None — plano executado exatamente como especificado. Os testes RED estão no estado correto: falham com "Failed to resolve import" para módulos não implementados.

## Self-Check: PASSED

- [x] `src/lib/db/migrations/0003_benchmark.sql` existe com DDL correto
- [x] `src/lib/db/schema.ts` exporta benchmarkSessions, benchmarkResults, BenchmarkSession, BenchmarkResult
- [x] 3 arquivos de teste criados no diretório `tests/`
- [x] package.json atualizado com Radix deps
- [x] Commits c641fb2, 9141f2e, ab559cf existem

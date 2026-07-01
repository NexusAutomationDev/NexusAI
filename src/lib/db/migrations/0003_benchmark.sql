-- Phase 4: LLM Benchmarking tables

CREATE TABLE IF NOT EXISTS benchmark_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  prompt TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  scored_at INTEGER
);

CREATE TABLE IF NOT EXISTS benchmark_results (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL
    REFERENCES benchmark_sessions(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  response TEXT NOT NULL,
  is_winner INTEGER NOT NULL DEFAULT 0,
  is_tie INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bench_results_session
  ON benchmark_results(session_id);

CREATE INDEX IF NOT EXISTS idx_bench_sessions_created
  ON benchmark_sessions(created_at DESC);

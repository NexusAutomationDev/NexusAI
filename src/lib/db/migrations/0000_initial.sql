-- 0000_initial: Create schema_meta tracking table
-- WAL mode is initialized via Rust (src-tauri/src/lib.rs) before this runs
CREATE TABLE IF NOT EXISTS schema_meta (
  id INTEGER PRIMARY KEY,
  version TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);

-- Record that Phase 1 schema has been applied
INSERT OR IGNORE INTO schema_meta (id, version, applied_at)
VALUES (1, '01-foundation', strftime('%s', 'now') * 1000);

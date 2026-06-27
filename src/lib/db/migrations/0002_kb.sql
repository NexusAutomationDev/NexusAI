-- 0002_kb: Knowledge Base relational tables (Phase 3)
-- kb_folders → kb_items → kb_chunks
-- Drizzle manages these relational tables. The virtual tables kb_vectors (vec0)
-- and kb_fts (fts5) are created in Rust (vector.rs / search.rs, Plan 03-02),
-- since they live outside Drizzle's model.
-- kb_chunks.rowid is the shared integer join key across vec0 + fts5.

CREATE TABLE IF NOT EXISTS kb_folders (            -- notes organization (D-09, notes-only)
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES kb_folders(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS kb_items (              -- files, notes, URLs (one row per KB item)
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('file','note','url')),   -- D-10 type
  title TEXT NOT NULL,
  source_path TEXT,                  -- disk path (file/note) or URL
  folder_id TEXT REFERENCES kb_folders(id) ON DELETE SET NULL, -- notes only
  status TEXT NOT NULL DEFAULT 'pending'                        -- D-11 reconcile-on-reload
    CHECK(status IN ('pending','indexing','indexed','failed')),
  error_reason TEXT,                 -- D-12 tooltip text
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS kb_chunks (             -- rowid INTEGER PK links to kb_vectors.rowid & kb_fts.rowid
  rowid INTEGER PRIMARY KEY,         -- shared rowid across vec0 + fts5
  id TEXT NOT NULL UNIQUE,
  item_id TEXT NOT NULL REFERENCES kb_items(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  content TEXT NOT NULL,
  section TEXT,                      -- heading/page for citations (D-04)
  char_start INTEGER,
  char_end INTEGER
);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_item ON kb_chunks(item_id);
CREATE INDEX IF NOT EXISTS idx_kb_items_status ON kb_items(status);
-- kb_vectors (vec0) and kb_fts (fts5) + sync triggers are created in Rust.

-- 0001_chat: LLM Chat tables (Phase 2)
-- conversations → messages → attachments (cascade delete)
-- All tables use UUID primary keys (text), integer timestamps (Unix ms)
-- Soft-delete pattern: deleted_at IS NULL = active, NOT NULL = deleted (D-30)

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nova Conversa',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER, -- NULL = active, NOT NULL = soft-deleted
  last_model TEXT     -- last model used in this conversation (for badge display)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  model TEXT,         -- NULL for user messages; model ID for assistant messages
  created_at INTEGER NOT NULL,
  deleted_at INTEGER  -- NULL = visible, NOT NULL = soft-deleted
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_path TEXT NOT NULL, -- absolute path in Tauri app data directory
  file_size_bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);

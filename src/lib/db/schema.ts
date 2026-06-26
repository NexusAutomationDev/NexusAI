import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Phase 1: metadata table — records last-seen schema version
// Future phases add their own tables in new migration files
export const schemaMeta = sqliteTable('schema_meta', {
  id: integer('id').primaryKey(),
  version: text('version').notNull(),
  appliedAt: integer('applied_at', { mode: 'timestamp' }).notNull(),
});

// Re-export all tables for use in runMigrations type checking
export type SchemaMeta = typeof schemaMeta.$inferSelect;
export type NewSchemaMeta = typeof schemaMeta.$inferInsert;

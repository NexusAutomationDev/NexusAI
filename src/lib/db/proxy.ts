import Database from '@tauri-apps/plugin-sql';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from './schema';

let _db: Awaited<ReturnType<typeof Database.load>> | null = null;

async function getDb() {
  if (!_db) _db = await Database.load('sqlite:nexusai.db');
  return _db;
}

export const db = drizzle(
  async (sql, params, method) => {
    const sqlite = await getDb();
    if (method === 'run') {
      await sqlite.execute(sql, params as unknown[]);
      return { rows: [] };
    }
    const rows = await sqlite.select(sql, params as unknown[]);
    return {
      rows: method === 'get' ? (rows.length > 0 ? [rows[0]] : []) : rows,
    };
  },
  { schema }
);

// Migration runner using import.meta.glob — no Node.js fs access needed
// eager: true is REQUIRED to avoid async timing issues at app boot
const migrationFiles = import.meta.glob<string>(
  './migrations/*.sql',
  { query: '?raw', import: 'default', eager: true }
);

export async function runMigrations(): Promise<void> {
  const sqlite = await getDb();

  // Ensure migrations tracking table exists
  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    )
  `, []);

  const applied = (await sqlite.select(
    'SELECT hash FROM __drizzle_migrations', []
  )) as Array<{ hash: string }>;
  const appliedHashes = new Set(applied.map((r) => r.hash));

  const sorted = Object.keys(migrationFiles).sort();
  for (const path of sorted) {
    const hash = path.split('/').pop()!.replace('.sql', '');
    if (!appliedHashes.has(hash)) {
      await sqlite.execute(migrationFiles[path], []);
      await sqlite.execute(
        'INSERT INTO __drizzle_migrations (hash, applied_at) VALUES (?, ?)',
        [hash, Date.now()]
      );
    }
  }
}

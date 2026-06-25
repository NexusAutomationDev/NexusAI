import { describe, it, expect } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

describe('FOUND-06 — Drizzle proxy (requires Plan 01 Task 2)', () => {
  it('TODO: SELECT via proxy calls plugin:sql|select IPC command', async () => {
    // Real test: call db.select(schema.someTable) and verify plugin:sql|select was invoked
    // mockIPC already intercepts it and returns []
    const result = await invoke('plugin:sql|select', { db: 'sqlite:nexusai.db', query: 'SELECT 1', values: [] });
    expect(Array.isArray(result)).toBe(true);
  });

  it('TODO: proxy returns empty array for SELECT with no rows', async () => {
    const result = await invoke('plugin:sql|select', { db: 'sqlite:nexusai.db', query: 'SELECT * FROM non_existent', values: [] });
    expect(result).toEqual([]);
  });
});

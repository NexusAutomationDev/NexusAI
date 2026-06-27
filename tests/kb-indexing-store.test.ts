import { describe, it, expect, beforeEach, vi } from 'vitest';
// setup.ts handles mockIPC for Tauri commands.
// RED (Wave 0): ../src/lib/stores/indexing does not exist yet → import fails.
// Turned green by Plan 03-04 (D-11 indexing store).

describe('03-00 — KB indexing store (D-11)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('useIndexingStore is exported from stores/indexing', async () => {
    const mod = await import('../src/lib/stores/indexing');
    expect(typeof mod.useIndexingStore).toBe('function');
  });

  it('initial state: items is an empty record/map', async () => {
    const { useIndexingStore } = await import('../src/lib/stores/indexing');
    const items = useIndexingStore.getState().items;
    // empty whether it's a plain record or a Map
    const size = items instanceof Map ? items.size : Object.keys(items).length;
    expect(size).toBe(0);
  });

  it('applying a "started" event sets the item status to indexing', async () => {
    const { useIndexingStore } = await import('../src/lib/stores/indexing');
    useIndexingStore.getState().apply({
      event: 'started',
      data: { itemId: 'item-1', totalChunks: null },
    });
    const items = useIndexingStore.getState().items;
    const entry = items instanceof Map ? items.get('item-1') : items['item-1'];
    expect(entry?.status).toBe('indexing');
  });

  it('applying "indexed" → indexed, "failed" → failed with reason', async () => {
    const { useIndexingStore } = await import('../src/lib/stores/indexing');
    const store = useIndexingStore.getState();

    store.apply({ event: 'indexed', data: { itemId: 'item-2' } });
    let items = useIndexingStore.getState().items;
    let entry = items instanceof Map ? items.get('item-2') : items['item-2'];
    expect(entry?.status).toBe('indexed');

    store.apply({
      event: 'failed',
      data: { itemId: 'item-3', reason: 'conteúdo não encontrado' },
    });
    items = useIndexingStore.getState().items;
    entry = items instanceof Map ? items.get('item-3') : items['item-3'];
    expect(entry?.status).toBe('failed');
    expect(entry?.reason).toBe('conteúdo não encontrado');
  });
});

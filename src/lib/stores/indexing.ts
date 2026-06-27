/**
 * Indexing Zustand store (D-11) — THE single source of truth for KB indexing UI.
 *
 * Reconciliation point between:
 *  - transient Channel<IndexProgress> events streamed by Rust during ingest, and
 *  - the durable kb_items.status column (queried via TanStack Query in queries/kb.ts).
 *
 * Every status surface (IndexStatusBadge, the global Progress panel, toasts) selects
 * off this store so they never disagree. On reload the store is reconciled with the DB
 * via hydrateFromDb (Pitfall 5: any item left 'indexing' = a dropped event → 'failed').
 *
 * Mirrors the chat store's Zustand + Channel pattern (src/lib/stores/chat.ts).
 */

import { create } from 'zustand';
import { invoke, Channel } from '@tauri-apps/api/core';

export type IndexStatus = 'pending' | 'indexing' | 'indexed' | 'failed';

/**
 * IndexProgress mirrors the Rust tagged enum, normalized to camelCase for the UI.
 * NOTE: the raw Channel payload from bindings.ts uses snake_case (item_id, total_chunks);
 * `startIndexing` normalizes those into this shape before calling `apply`.
 */
export type IndexProgress =
  | { event: 'started'; data: { itemId: string; totalChunks: number | null } }
  | { event: 'chunk'; data: { itemId: string; done: number; total: number | null } }
  | { event: 'indexed'; data: { itemId: string } }
  | { event: 'failed'; data: { itemId: string; reason: string } };

/** Raw Channel payload as emitted by Rust (snake_case — see bindings.ts IndexProgress). */
type RawIndexProgress =
  | { event: 'started'; data: { item_id: string; total_chunks: number | null } }
  | { event: 'chunk'; data: { item_id: string; done: number; total: number | null } }
  | { event: 'indexed'; data: { item_id: string } }
  | { event: 'failed'; data: { item_id: string; reason: string } };

export interface IndexEntry {
  status: IndexStatus;
  reason?: string;
  done?: number;
  total?: number | null;
}

/** Minimal DB row shape used to hydrate/reconcile on reload. */
export interface HydrateRow {
  id: string;
  status: IndexStatus;
  errorReason?: string | null;
}

interface IndexingStore {
  /** itemId → live indexing state. Empty record initially. */
  items: Record<string, IndexEntry>;

  /** Apply a normalized progress event (state-machine transition). */
  apply: (ev: IndexProgress) => void;
  /** Seed a row as 'pending' the moment an item is added (before the Channel fires). */
  setPending: (itemId: string) => void;
  /** Reconcile with the DB on reload; 'indexing' rows are forced to 'failed' (Pitfall 5). */
  hydrateFromDb: (rows: HydrateRow[]) => void;
  /**
   * Helper mirroring chat.ts startStream: create a Channel, normalize each event into
   * `apply`, and invoke the indexing command. Returns the invoke promise.
   */
  startIndexing: (commandName: string, input: Record<string, unknown>) => Promise<void>;
}

/** Normalize a raw snake_case Channel event into the camelCase UI event. */
function normalize(raw: RawIndexProgress): IndexProgress {
  switch (raw.event) {
    case 'started':
      return {
        event: 'started',
        data: { itemId: raw.data.item_id, totalChunks: raw.data.total_chunks },
      };
    case 'chunk':
      return {
        event: 'chunk',
        data: { itemId: raw.data.item_id, done: raw.data.done, total: raw.data.total },
      };
    case 'indexed':
      return { event: 'indexed', data: { itemId: raw.data.item_id } };
    case 'failed':
      return { event: 'failed', data: { itemId: raw.data.item_id, reason: raw.data.reason } };
  }
}

export const useIndexingStore = create<IndexingStore>((set) => ({
  items: {},

  apply: (ev) =>
    set((s) => {
      const prev = s.items[ev.data.itemId] ?? { status: 'pending' as IndexStatus };
      let next: IndexEntry;
      switch (ev.event) {
        case 'started':
          next = { ...prev, status: 'indexing', total: ev.data.totalChunks, done: 0 };
          break;
        case 'chunk':
          next = { ...prev, status: 'indexing', done: ev.data.done, total: ev.data.total };
          break;
        case 'indexed':
          next = { ...prev, status: 'indexed', reason: undefined };
          break;
        case 'failed':
          next = { ...prev, status: 'failed', reason: ev.data.reason };
          break;
      }
      return { items: { ...s.items, [ev.data.itemId]: next } };
    }),

  setPending: (itemId) =>
    set((s) => ({
      items: { ...s.items, [itemId]: { status: 'pending' } },
    })),

  hydrateFromDb: (rows) =>
    set(() => {
      const items: Record<string, IndexEntry> = {};
      for (const row of rows) {
        // Pitfall 5: a row left 'indexing' at hydrate = a dropped Channel event → 'failed'.
        if (row.status === 'indexing') {
          items[row.id] = {
            status: 'failed',
            reason: row.errorReason ?? 'Indexação interrompida. Tente reindexar.',
          };
        } else {
          items[row.id] = {
            status: row.status,
            reason: row.status === 'failed' ? row.errorReason ?? undefined : undefined,
          };
        }
      }
      return { items };
    }),

  startIndexing: async (commandName, input) => {
    const apply = useIndexingStore.getState().apply;
    const channel = new Channel<RawIndexProgress>();
    channel.onmessage = (raw) => apply(normalize(raw));
    await invoke(commandName, { input, onEvent: channel });
  },
}));

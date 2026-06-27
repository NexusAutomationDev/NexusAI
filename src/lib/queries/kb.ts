/**
 * TanStack Query hooks for Knowledge Base data (items, folders, notes).
 * Reads go through the Drizzle ORM proxy → tauri-plugin-sql → SQLite.
 * Writes (import/url/note/reindex) stream IndexProgress through the indexingStore;
 * delete goes straight to the Rust command.
 *
 * CRITICAL: All item reads MUST filter deleted_at IS NULL (soft-delete pattern).
 * Mirrors queries/chat.ts (key factory + db proxy + isNull soft-delete filter).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/db/proxy';
import { kbItems, kbFolders } from '@/lib/db/schema';
import type { KbItem, KbFolder } from '@/lib/db/schema';
import { eq, isNull, desc, and } from 'drizzle-orm';
import { useIndexingStore } from '@/lib/stores/indexing';

// ─── Query Key Factory ──────────────────────────────────────────────────────
export const kbKeys = {
  all: ['kb'] as const,
  items: () => [...kbKeys.all, 'items'] as const,
  item: (id: string) => [...kbKeys.items(), id] as const,
  folders: () => [...kbKeys.all, 'folders'] as const,
  notesInFolder: (folderId: string | null) =>
    [...kbKeys.all, 'notes', folderId ?? 'root'] as const,
};

// ─── Reads ───────────────────────────────────────────────────────────────────

/**
 * Fetch all active (non-deleted) KB items, newest first.
 * Feeds the ItemsTable rows; status reconciled with indexingStore in the UI.
 */
export function useKbItems() {
  return useQuery({
    queryKey: kbKeys.items(),
    queryFn: async (): Promise<KbItem[]> => {
      return db
        .select()
        .from(kbItems)
        .where(isNull(kbItems.deletedAt)) // soft-delete filter
        .orderBy(desc(kbItems.updatedAt))
        .all();
    },
  });
}

/** Fetch all folders for the left-pane tree. */
export function useKbFolders() {
  return useQuery({
    queryKey: kbKeys.folders(),
    queryFn: async (): Promise<KbFolder[]> => {
      return db.select().from(kbFolders).all();
    },
  });
}

/**
 * Fetch all note items within a folder (or root when folderId is null).
 * Notes-only — the tree (D-10) never lists files/URLs.
 */
export function useNotesInFolder(folderId: string | null) {
  return useQuery({
    queryKey: kbKeys.notesInFolder(folderId),
    queryFn: async (): Promise<KbItem[]> => {
      return db
        .select()
        .from(kbItems)
        .where(
          and(
            isNull(kbItems.deletedAt),
            eq(kbItems.kind, 'note'),
            folderId === null ? isNull(kbItems.folderId) : eq(kbItems.folderId, folderId)
          )
        )
        .orderBy(desc(kbItems.updatedAt))
        .all();
    },
  });
}

/**
 * Fetch a single note item row by id.
 * NOTE: the markdown content lives on disk (app-data/kb-notes/<id>.md, D-08); the
 * editor wiring (Plan 03-05) owns reading the file. This exposes the item row only.
 */
export function useKbNote(id: string | null) {
  return useQuery({
    queryKey: kbKeys.item(id ?? ''),
    queryFn: async (): Promise<KbItem | null> => {
      if (!id) return null;
      const rows = await db
        .select()
        .from(kbItems)
        .where(and(eq(kbItems.id, id), isNull(kbItems.deletedAt)))
        .all();
      return rows[0] ?? null;
    },
    enabled: !!id,
  });
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Import a local file: seed pending, then stream IndexProgress via the indexingStore.
 * Maps to commands.importFile → import_file (ImportFileInput { itemId, path, title }).
 */
export function useImportFiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: { itemId: string; path: string; title: string }[]): Promise<void> => {
      const { setPending, startIndexing } = useIndexingStore.getState();
      for (const f of files) {
        setPending(f.itemId);
        await startIndexing('import_file', { itemId: f.itemId, path: f.path, title: f.title });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kbKeys.items() });
    },
  });
}

/**
 * Add a URL: seed pending, then stream IndexProgress via the indexingStore.
 * Maps to commands.addUrl → add_url (AddUrlInput { itemId, url }).
 */
export function useAddUrl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { itemId: string; url: string }): Promise<void> => {
      const { setPending, startIndexing } = useIndexingStore.getState();
      setPending(input.itemId);
      await startIndexing('add_url', { itemId: input.itemId, url: input.url });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kbKeys.items() });
    },
  });
}

/**
 * Re-index an item idempotently (D-12): badge returns to 'indexing' via the Channel.
 * Maps to commands.reindexItem → reindex_item (ReindexInput { itemId }).
 */
export function useReindexItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string): Promise<void> => {
      const { startIndexing } = useIndexingStore.getState();
      await startIndexing('reindex_item', { itemId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kbKeys.items() });
    },
  });
}

/**
 * Delete an item + purge its chunks/vectors (Rust soft-delete + cascade).
 * NOTE: delete_item takes the bare itemId (NOT an input wrapper) — see bindings.ts.
 */
export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string): Promise<void> => {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_item', { itemId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kbKeys.items() });
    },
  });
}

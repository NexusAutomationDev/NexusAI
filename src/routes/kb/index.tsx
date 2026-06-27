/**
 * KB browser route (/kb) — the hybrid two-pane Knowledge Base management surface (KB-05, D-09):
 *  - left: FolderTree (notes + folders only, D-10) — selecting a note opens it in the editor;
 *  - right: NoteEditor (when a note is selected) OR ItemsTable (all items, faceted filters)
 *           OR the ImportDropzone empty state when the KB is empty (D-13).
 *
 * Integration point: wires the TanStack Query reads (useKbItems / useKbNote / useNoteContent)
 * into the pure components, owns the mutations (reindex / delete / create-note save), and
 * reconciles the indexingStore with the DB status column on load (D-11, Pitfall 5).
 */

import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { FolderTree } from './-components/FolderTree';
import { ItemsTable, type ItemRow } from './-components/ItemsTable';
import { ImportDropzone } from './-components/ImportDropzone';
import { NoteEditor } from './-components/NoteEditor';
import {
  useKbItems,
  useKbNote,
  useNoteContent,
  useReindexItem,
  useDeleteItem,
  useCreateNote,
} from '@/lib/queries/kb';
import { useIndexingStore } from '@/lib/stores/indexing';

/**
 * Right-pane note editor: reads the note row + its on-disk Markdown, keeps a local draft, and
 * saves the EXACT text back through create_note (which re-embeds, D-08). A "Voltar" affordance
 * returns to the table.
 */
function NotePane({
  noteId,
  onClose,
}: {
  noteId: string;
  onClose: () => void;
}) {
  const { data: note } = useKbNote(noteId);
  const { data: content = '' } = useNoteContent(noteId);
  const createNote = useCreateNote();
  const [draft, setDraft] = React.useState<string>(content);

  // Re-seed the draft when the loaded note (or its on-disk content) changes.
  React.useEffect(() => {
    setDraft(content);
  }, [content, noteId]);

  const handleSave = React.useCallback(
    (md: string) => {
      createNote.mutate({
        itemId: noteId,
        title: note?.title ?? 'Nova nota',
        content: md, // verbatim — no mutation (D-08)
        folderId: note?.folderId ?? null,
      });
    },
    [createNote, noteId, note?.title, note?.folderId]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Button size="sm" variant="ghost" onClick={onClose}>
          <ArrowLeft size={14} className="mr-1" />
          Voltar
        </Button>
        <span className="truncate text-sm font-medium">{note?.title ?? 'Nova nota'}</span>
      </div>
      <div className="min-h-0 flex-1">
        <NoteEditor
          value={draft}
          onChange={setDraft}
          onSave={handleSave}
          saving={createNote.isPending}
        />
      </div>
    </div>
  );
}

function KbBrowser() {
  const { data: items = [], isLoading } = useKbItems();
  const reindex = useReindexItem();
  const deleteItem = useDeleteItem();
  const hydrateFromDb = useIndexingStore((s) => s.hydrateFromDb);
  const [selectedNoteId, setSelectedNoteId] = React.useState<string | null>(null);

  // Reconcile the indexingStore with the DB status column on load (D-11, Pitfall 5).
  React.useEffect(() => {
    hydrateFromDb(
      items.map((i) => ({ id: i.id, status: i.status, errorReason: i.errorReason }))
    );
  }, [items, hydrateFromDb]);

  const rows: ItemRow[] = items.map((i) => ({
    id: i.id,
    kind: i.kind,
    title: i.title,
    status: i.status,
    errorReason: i.errorReason,
  }));

  // Empty KB → full-pane import affordance (D-13).
  if (!isLoading && items.length === 0) {
    return <ImportDropzone />;
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
        <ScrollArea className="h-full">
          {/* Selecting a note opens it in the right pane editor (D-09). */}
          <FolderTree onSelectNote={setSelectedNoteId} />
        </ScrollArea>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={75}>
        {selectedNoteId ? (
          // Editor opens in place of the table when a note is selected (UI-SPEC §Layout).
          <NotePane noteId={selectedNoteId} onClose={() => setSelectedNoteId(null)} />
        ) : (
          <ScrollArea className="h-full">
            <ItemsTable
              items={rows}
              onReindex={(id) => reindex.mutate(id)}
              onDelete={(id) => deleteItem.mutate(id)}
              reindexPending={reindex.isPending}
            />
          </ScrollArea>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export const Route = createFileRoute('/kb/')({
  component: KbBrowser,
});

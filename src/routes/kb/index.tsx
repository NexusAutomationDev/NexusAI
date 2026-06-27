/**
 * KB browser route (/kb) — the two-pane Knowledge Base management surface (KB-05, D-09):
 *  - left: FolderTree (notes + folders only, D-10),
 *  - right: ItemsTable (all items, faceted filters) OR the ImportDropzone empty state.
 *
 * This is the integration point that wires the TanStack Query reads (useKbItems) into the
 * pure components and reconciles the indexingStore with the DB status on load (D-11).
 */

import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FolderTree } from './-components/FolderTree';
import { ItemsTable, type ItemRow } from './-components/ItemsTable';
import { ImportDropzone } from './-components/ImportDropzone';
import { useKbItems, useReindexItem, useDeleteItem } from '@/lib/queries/kb';
import { useIndexingStore } from '@/lib/stores/indexing';

function KbBrowser() {
  const { data: items = [], isLoading } = useKbItems();
  const reindex = useReindexItem();
  const deleteItem = useDeleteItem();
  const hydrateFromDb = useIndexingStore((s) => s.hydrateFromDb);

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
          <FolderTree />
        </ScrollArea>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={75}>
        <ScrollArea className="h-full">
          <ItemsTable
            items={rows}
            onReindex={(id) => reindex.mutate(id)}
            onDelete={(id) => deleteItem.mutate(id)}
            reindexPending={reindex.isPending}
          />
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export const Route = createFileRoute('/kb/')({
  component: KbBrowser,
});

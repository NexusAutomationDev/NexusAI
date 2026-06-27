/**
 * FolderTree (D-09 left pane, D-10 notes/folders ONLY) — a dense react-arborist tree of
 * folders and note items. Files and URLs are NEVER placed here; they live only in the
 * flat ItemsTable. Selecting a note calls onSelectNote (consumed by Plan 03-05's editor);
 * selecting a folder optionally filters the table via onSelectFolder.
 */

import * as React from 'react';
import { Tree, type NodeRendererProps } from 'react-arborist';
import { ChevronRight, ChevronDown, Folder, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKbFolders, useKbItems } from '@/lib/queries/kb';
import type { KbFolder, KbItem } from '@/lib/db/schema';

interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'note';
  children?: TreeNode[];
}

/** Build a folder hierarchy with note children; folders without parents are roots. */
function buildTree(folders: KbFolder[], notes: KbItem[]): TreeNode[] {
  const folderNodes = new Map<string, TreeNode>();
  for (const f of folders) {
    folderNodes.set(f.id, { id: f.id, name: f.name, type: 'folder', children: [] });
  }
  // Attach notes to their folder (or to root when folderId is null).
  const rootNotes: TreeNode[] = [];
  for (const n of notes) {
    const node: TreeNode = { id: n.id, name: n.title, type: 'note' };
    if (n.folderId && folderNodes.has(n.folderId)) {
      folderNodes.get(n.folderId)!.children!.push(node);
    } else {
      rootNotes.push(node);
    }
  }
  // Nest folders under their parents.
  const roots: TreeNode[] = [];
  for (const f of folders) {
    const node = folderNodes.get(f.id)!;
    if (f.parentId && folderNodes.has(f.parentId)) {
      folderNodes.get(f.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }
  return [...roots, ...rootNotes];
}

export interface FolderTreeProps {
  onSelectNote?: (id: string) => void;
  onSelectFolder?: (id: string | null) => void;
}

export function FolderTree({ onSelectNote, onSelectFolder }: FolderTreeProps) {
  const { data: folders = [] } = useKbFolders();
  const { data: items = [] } = useKbItems();

  // D-10: notes ONLY in the tree.
  const notes = React.useMemo(() => items.filter((i) => i.kind === 'note'), [items]);
  const data = React.useMemo(() => buildTree(folders, notes), [folders, notes]);

  return (
    <div className="flex h-full flex-col gap-1 p-4">
      <h2 className="text-sm font-medium">Notas e pastas</h2>
      <div className="flex-1">
        <Tree<TreeNode>
          data={data}
          rowHeight={28}
          openByDefault
          width="100%"
          indent={16}
          onActivate={(node) => {
            if (node.data.type === 'note') onSelectNote?.(node.data.id);
            else onSelectFolder?.(node.data.id);
          }}
        >
          {Node}
        </Tree>
      </div>
    </div>
  );
}

function Node({ node, style, dragHandle }: NodeRendererProps<TreeNode>) {
  const isFolder = node.data.type === 'folder';
  const Icon = isFolder ? Folder : StickyNote;
  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        'flex h-7 items-center gap-1 rounded px-1 text-sm',
        'cursor-pointer hover:bg-secondary',
        node.isSelected && 'bg-secondary ring-2 ring-ring'
      )}
      onClick={() => (isFolder ? node.toggle() : node.activate())}
    >
      {isFolder ? (
        node.isOpen ? (
          <ChevronDown size={14} className="text-muted-foreground" />
        ) : (
          <ChevronRight size={14} className="text-muted-foreground" />
        )
      ) : (
        <span className="w-[14px]" />
      )}
      <Icon size={14} className="text-muted-foreground" />
      <span className="truncate">{node.data.name}</span>
    </div>
  );
}

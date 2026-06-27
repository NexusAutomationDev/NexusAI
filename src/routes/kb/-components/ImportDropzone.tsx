/**
 * ImportDropzone (D-13 empty state) — the affordance shown when the KB has no items.
 * One headline, a dashed drop zone, a file picker, and a URL paste field. No demo/sample
 * seeding (local-first). Drops use the Tauri-native onDragDropEvent (the browser
 * DataTransfer API is empty in Tauri webviews — same approach as chat MessageInput).
 *
 * Each added item seeds indexingStore.setPending immediately, then streams IndexProgress.
 */

import * as React from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { toast } from 'sonner';
import { FileText, FolderOpen, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useImportFiles, useAddUrl } from '@/lib/queries/kb';

/** Derive a display title from an absolute file path (basename). */
function basename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export interface ImportDropzoneProps {
  /** Compact toolbar variant — rendered above the items table so knowledge can be added anytime. */
  compact?: boolean;
  /** Open a blank note in the editor (persisted on first save). */
  onCreateNote?: () => void;
}

export function ImportDropzone({ compact = false, onCreateNote }: ImportDropzoneProps = {}) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [url, setUrl] = React.useState('');
  const importFiles = useImportFiles();
  const addUrl = useAddUrl();

  const importPaths = React.useCallback(
    (paths: string[]) => {
      if (paths.length === 0) return;
      importFiles.mutate(
        paths.map((path) => ({ itemId: crypto.randomUUID(), path, title: basename(path) }))
      );
    },
    [importFiles]
  );

  // Tauri-native drag-drop (DataTransfer is empty in webviews).
  React.useEffect(() => {
    let unlisten: (() => void) | null = null;
    (async () => {
      const win = getCurrentWebviewWindow();
      unlisten = await win.onDragDropEvent((event) => {
        if (event.payload.type === 'over') setIsDragOver(true);
        else if (event.payload.type === 'leave') setIsDragOver(false);
        else if (event.payload.type === 'drop') {
          setIsDragOver(false);
          importPaths(event.payload.paths ?? []);
        }
      });
    })();
    return () => {
      if (unlisten) unlisten();
    };
  }, [importPaths]);

  const handleChooseFiles = async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: 'Documentos', extensions: ['pdf', 'md', 'markdown', 'docx', 'txt'] }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    importPaths(paths);
  };

  const handleAddUrl = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    addUrl.mutate({ itemId: crypto.randomUUID(), url: trimmed });
    toast('URL adicionada. Indexando...');
    setUrl('');
  };

  // Compact toolbar: persistent "add knowledge" bar shown above the items table.
  if (compact) {
    return (
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 transition-colors',
          isDragOver && 'bg-accent/5'
        )}
      >
        <Button size="sm" onClick={handleChooseFiles} disabled={importFiles.isPending}>
          <FolderOpen size={14} className="mr-1" />
          Adicionar arquivos
        </Button>
        {onCreateNote && (
          <Button size="sm" variant="outline" onClick={onCreateNote}>
            <StickyNote size={14} className="mr-1" />
            Nova nota
          </Button>
        )}
        <div className="flex min-w-[16rem] flex-1 items-center gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddUrl();
            }}
            placeholder="Cole uma URL para indexar..."
            aria-label="URL para indexar"
            className="h-8"
          />
          <Button size="sm" variant="default" onClick={handleAddUrl} disabled={addUrl.isPending}>
            Adicionar
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          {isDragOver ? 'Solte para indexar...' : 'ou arraste arquivos aqui'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-12">
      <FileText size={32} className="text-muted-foreground" aria-hidden="true" />
      <h2 className="text-base font-medium">Sua base de conhecimento está vazia</h2>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Arraste PDF, Markdown, DOCX ou TXT aqui — ou escolha arquivos e cole uma URL para
        indexar.
      </p>

      {/* Dashed drop zone */}
      <div
        className={cn(
          'flex w-full max-w-md items-center justify-center rounded-lg border-2 border-dashed p-12 text-sm text-muted-foreground transition-colors',
          isDragOver ? 'border-accent bg-accent/5' : 'border-border'
        )}
      >
        Arraste PDF, Markdown, DOCX ou TXT aqui
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={handleChooseFiles} disabled={importFiles.isPending}>
          <FolderOpen size={16} className="mr-1" />
          Escolher arquivos
        </Button>
        {onCreateNote && (
          <Button variant="outline" onClick={onCreateNote}>
            <StickyNote size={16} className="mr-1" />
            Nova nota
          </Button>
        )}
      </div>

      {/* URL paste */}
      <div className="flex w-full max-w-md items-center gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddUrl();
          }}
          placeholder="Cole uma URL para indexar..."
          aria-label="URL para indexar"
        />
        <Button variant="default" onClick={handleAddUrl} disabled={addUrl.isPending}>
          Adicionar
        </Button>
      </div>
    </div>
  );
}

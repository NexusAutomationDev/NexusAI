/**
 * ItemsTable (D-09/D-10) — the flat "Todos os itens" view: ALL KB items (files + notes
 * + URLs) in a TanStack Table v8 + shadcn Table, with faceted Tipo/Status filters and
 * per-row actions (Reindexar / Excluir). Status reflects the indexingStore reconciled
 * with the row's DB status (via IndexStatusBadge).
 *
 * Rows are supplied via the `items` prop (the route wires `useKbItems()` into it),
 * which keeps the component pure/testable (see tests/kb-items-table.test.tsx).
 */

import * as React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { FileText, StickyNote, Link as LinkIcon, MoreHorizontal } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { IndexStatusBadge } from './IndexStatusBadge';
import type { IndexStatus } from '@/lib/stores/indexing';

type Kind = 'file' | 'note' | 'url';

export interface ItemRow {
  id: string;
  kind: Kind;
  title: string;
  status: IndexStatus;
  errorReason?: string | null;
}

export interface ItemsTableProps {
  items: ItemRow[];
  /** Reindex handler (D-12). Wired by the route (which owns the QueryClient). */
  onReindex?: (itemId: string) => void;
  /** Delete handler. Wired by the route. */
  onDelete?: (itemId: string) => void;
  /** True while a reindex mutation is in flight (disables the Reindexar button). */
  reindexPending?: boolean;
}

const KIND_ICON: Record<Kind, React.ComponentType<{ size?: number; className?: string }>> = {
  file: FileText,
  note: StickyNote,
  url: LinkIcon,
};

const KIND_LABEL: Record<Kind, string> = { file: 'Arquivo', note: 'Nota', url: 'URL' };

const STATUS_FACETS: { value: IndexStatus; label: string }[] = [
  { value: 'pending', label: 'Pendente' },
  { value: 'indexing', label: 'Indexando' },
  { value: 'indexed', label: 'Indexado' },
  { value: 'failed', label: 'Falhou' },
];

const TYPE_FACETS: { value: Kind; label: string }[] = [
  { value: 'file', label: 'Arquivo' },
  { value: 'note', label: 'Nota' },
  { value: 'url', label: 'URL' },
];

/** A faceted filter group: each value is a toggle button (accessible, keyboard-first). */
function FacetGroup<T extends string>({
  label,
  facets,
  active,
  onToggle,
}: {
  label: string;
  facets: { value: T; label: string }[];
  active: Set<T>;
  onToggle: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {facets.map((f) => (
        <Button
          key={f.value}
          type="button"
          size="sm"
          variant={active.has(f.value) ? 'secondary' : 'ghost'}
          className="h-7"
          aria-pressed={active.has(f.value)}
          onClick={() => onToggle(f.value)}
        >
          {f.label}
        </Button>
      ))}
    </div>
  );
}

export function ItemsTable({
  items,
  onReindex,
  onDelete,
  reindexPending,
}: ItemsTableProps) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const columns = React.useMemo<ColumnDef<ItemRow>[]>(
    () => [
      {
        id: 'kind',
        accessorKey: 'kind',
        header: 'Tipo',
        filterFn: (row, _id, value: string[]) =>
          value.length === 0 || value.includes(row.original.kind),
        cell: ({ row }) => {
          const Icon = KIND_ICON[row.original.kind];
          return (
            <span
              className="inline-flex items-center text-muted-foreground"
              aria-label={KIND_LABEL[row.original.kind]}
              title={KIND_LABEL[row.original.kind]}
            >
              <Icon size={16} />
            </span>
          );
        },
      },
      {
        accessorKey: 'title',
        header: 'Título',
        cell: ({ row }) => <span className="text-sm">{row.original.title}</span>,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        filterFn: (row, _id, value: string[]) =>
          value.length === 0 || value.includes(row.original.status),
        cell: ({ row }) => (
          <IndexStatusBadge
            itemId={row.original.id}
            dbStatus={row.original.status}
            dbErrorReason={row.original.errorReason}
            onReindex={onReindex}
            reindexPending={reindexPending}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <RowActions
            itemId={row.original.id}
            onReindex={() => onReindex?.(row.original.id)}
            onDelete={() => onDelete?.(row.original.id)}
          />
        ),
      },
    ],
    [onReindex, onDelete, reindexPending]
  );

  const table = useReactTable({
    data: items,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Faceted filter state derived from column filters.
  const typeFilter = (table.getColumn('kind')?.getFilterValue() as Kind[]) ?? [];
  const statusFilter = (table.getColumn('status')?.getFilterValue() as IndexStatus[]) ?? [];

  const toggleType = (value: Kind) => {
    const next = new Set(typeFilter);
    next.has(value) ? next.delete(value) : next.add(value);
    table.getColumn('kind')?.setFilterValue([...next]);
  };
  const toggleStatus = (value: IndexStatus) => {
    const next = new Set(statusFilter);
    next.has(value) ? next.delete(value) : next.add(value);
    table.getColumn('status')?.setFilterValue([...next]);
  };

  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-2 p-4">
      <h2 className="text-sm font-medium">Todos os itens</h2>

      {/* Faceted filter toolbar (gap-2) */}
      <div className="flex flex-wrap items-center gap-4">
        <FacetGroup
          label="Tipo"
          facets={TYPE_FACETS}
          active={new Set(typeFilter)}
          onToggle={toggleType}
        />
        <FacetGroup
          label="Status"
          facets={STATUS_FACETS}
          active={new Set(statusFilter)}
          onToggle={toggleStatus}
        />
      </div>

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className={cn('py-8 text-center text-sm text-muted-foreground')}
              >
                Nenhum item encontrado para esse filtro.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function RowActions({
  itemId,
  onReindex,
  onDelete,
}: {
  itemId: string;
  onReindex: () => void;
  onDelete: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Ações do item">
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onReindex}>Reindexar</DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
          >
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogTrigger asChild>
          <span data-item={itemId} className="sr-only" />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir item da base? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * IndexStatusBadge (D-11/D-12) — a PURE selector off the indexingStore, reconciled
 * with the row's durable DB `status`. The store is the live source; if no live entry
 * exists yet (e.g. just loaded), it falls back to the DB status passed in.
 *
 * Implements the 03-UI-SPEC status color/label table EXACTLY:
 *   pending  → secondary muted  "Pendente"
 *   indexing → secondary muted  "Indexando" + Loader2 spinner
 *   indexed  → outline muted    "Indexado"  + Check glyph
 *   failed   → destructive      "Falhou"    + AlertCircle, tooltip(error_reason) + "Reindexar"
 *
 * Accessibility: color is never the only signal — every badge carries text + glyph + aria-label.
 */

import { useIndexingStore } from '@/lib/stores/indexing';
import type { IndexStatus } from '@/lib/stores/indexing';
import { useReindexItem } from '@/lib/queries/kb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Loader2, Check, AlertCircle } from 'lucide-react';

const STATUS_LABEL: Record<IndexStatus, string> = {
  pending: 'Pendente',
  indexing: 'Indexando',
  indexed: 'Indexado',
  failed: 'Falhou',
};

export interface IndexStatusBadgeProps {
  itemId: string;
  /** DB-persisted status — used as the reconciliation fallback when no live event exists. */
  dbStatus: IndexStatus;
  /** DB-persisted error reason — fallback for the failed tooltip. */
  dbErrorReason?: string | null;
}

export function IndexStatusBadge({ itemId, dbStatus, dbErrorReason }: IndexStatusBadgeProps) {
  const live = useIndexingStore((s) => s.items[itemId]);
  const reindex = useReindexItem();

  // Reconcile: live store wins; otherwise fall back to the DB row.
  const status: IndexStatus = live?.status ?? dbStatus;
  const reason = live?.reason ?? dbErrorReason ?? undefined;
  const label = STATUS_LABEL[status];

  if (status === 'pending') {
    return (
      <Badge variant="secondary" className="bg-muted text-muted-foreground" aria-label={label}>
        {label}
      </Badge>
    );
  }

  if (status === 'indexing') {
    return (
      <Badge
        variant="secondary"
        className="gap-1 bg-muted text-muted-foreground"
        aria-label={label}
      >
        <Loader2 className="animate-spin" size={14} aria-hidden="true" />
        {label}
      </Badge>
    );
  }

  if (status === 'indexed') {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground" aria-label={label}>
        <Check size={14} aria-hidden="true" />
        {label}
      </Badge>
    );
  }

  // failed: destructive badge + tooltip(reason) + Reindexar action (D-12)
  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="gap-1" aria-label={label}>
              <AlertCircle size={14} aria-hidden="true" />
              {label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {reason ?? 'Falha ao indexar. Tente reindexar.'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Button
        variant="ghost"
        size="sm"
        className="h-7"
        disabled={reindex.isPending}
        onClick={() => reindex.mutate(itemId)}
      >
        Reindexar
      </Button>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { format, isToday, isYesterday, isWithinInterval, subDays, isValid } from "date-fns";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/lib/stores/chat";
import {
  useSearchConversations,
  useDeleteConversation,
  useCreateConversation,
} from "@/lib/queries/chat";
import type { Conversation } from "@/lib/db/schema";

// Drizzle sqlite-proxy may return mode:'timestamp' columns as raw Unix-second integers,
// Date objects, or undefined. This normalizes all cases to a valid Date or null.
function toSafeDate(val: unknown): Date | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return isValid(val) ? val : null;
  if (typeof val === "number") {
    // SQLite stores timestamps as Unix seconds; JS Date uses milliseconds.
    // Values < 1e10 are seconds (year ~2286 in seconds); >= 1e10 are already ms.
    const d = val < 1e10 ? new Date(val * 1000) : new Date(val);
    return isValid(d) ? d : null;
  }
  const d = new Date(String(val));
  return isValid(d) ? d : null;
}

// D-07: Time-based section labels (Brazilian Portuguese per UI-SPEC)
function getTimeSection(conversation: Conversation): string {
  const date = toSafeDate(conversation.updatedAt);
  if (!date) return "Mais antigos";
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  const sevenDaysAgo = subDays(new Date(), 7);
  if (isWithinInterval(date, { start: sevenDaysAgo, end: new Date() }))
    return "Últimos 7 dias";
  return "Mais antigos";
}

// Section ordering (Hoje first, Mais antigos last)
const SECTION_ORDER = ["Hoje", "Ontem", "Últimos 7 dias", "Mais antigos"];

function groupConversations(convs: Conversation[]): [string, Conversation[]][] {
  const groups: Record<string, Conversation[]> = {};
  for (const conv of convs) {
    const section = getTimeSection(conv);
    if (!groups[section]) groups[section] = [];
    groups[section].push(conv);
  }
  return SECTION_ORDER.filter((s) => groups[s]?.length > 0).map((s) => [
    s,
    groups[s],
  ]);
}

export function ConversationList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  // D-28: focusedIndex tracks which conversation is keyboard-focused (ArrowUp/Down)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const { activeConversationId, setActiveConversationId } = useChatStore();
  const { data: conversations = [], isLoading } =
    useSearchConversations(searchQuery);
  const { mutateAsync: deleteConversation } = useDeleteConversation();
  const { mutateAsync: createConversation } = useCreateConversation();

  // D-28: flat ordered list for arrow navigation (same order as displayed, across all sections)
  const grouped = groupConversations(conversations);
  const flatConversations: Conversation[] = grouped.flatMap(
    ([, convs]) => convs
  );

  // D-28: Sync focusedIndex with activeConversationId when list changes
  useEffect(() => {
    const activeIdx = flatConversations.findIndex(
      (c) => c.id === activeConversationId
    );
    setFocusedIndex(activeIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, conversations.length]);

  // D-28: ArrowUp / ArrowDown keyboard navigation on the list container
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (flatConversations.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex =
          focusedIndex < flatConversations.length - 1 ? focusedIndex + 1 : 0;
        setFocusedIndex(nextIndex);
        const next = flatConversations[nextIndex];
        setActiveConversationId(next.id);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex =
          focusedIndex > 0 ? focusedIndex - 1 : flatConversations.length - 1;
        setFocusedIndex(prevIndex);
        const prev = flatConversations[prevIndex];
        setActiveConversationId(prev.id);
      }
    },
    [flatConversations, focusedIndex, setActiveConversationId]
  );

  // D-05: Create new conversation and activate it
  const handleNewChat = async () => {
    const conv = await createConversation();
    setActiveConversationId(conv.id);
  };

  const handleSelectConversation = (conv: Conversation) => {
    const idx = flatConversations.findIndex((c) => c.id === conv.id);
    setFocusedIndex(idx);
    setActiveConversationId(conv.id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteConversation(deleteTarget);
    if (activeConversationId === deleteTarget) {
      setActiveConversationId(null);
    }
    setDeleteTarget(null);
  };

  return (
    // D-08 from UI-SPEC: conversation list uses bg-secondary (slightly elevated)
    // tabIndex={0}: required for the div to receive keyboard events (D-28 ArrowUp/Down)
    <div
      className="flex h-full flex-col bg-secondary border-r border-border outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Lista de conversas"
    >
      {/* D-05: New Chat button — above search */}
      <div className="p-2">
        <Button
          onClick={handleNewChat}
          variant="default"
          className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Plus size={16} />
          Nova Conversa
        </Button>
      </div>

      {/* D-04: Search bar */}
      <div className="px-2 pb-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-2.5 text-muted-foreground"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar conversas..."
            className="pl-8 h-8 text-sm bg-background"
          />
        </div>
      </div>

      {/* Conversation list — scrollable */}
      <ScrollArea className="flex-1">
        {isLoading && (
          <div className="px-2 space-y-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && conversations.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {searchQuery
              ? "Nenhuma conversa encontrada"
              : "Nenhuma conversa ainda"}
          </div>
        )}

        {!isLoading &&
          grouped.map(([section, sectionConvs], groupIdx) => (
            <div key={section}>
              {/* D-07: Time section label */}
              <div className="px-3 py-1.5 flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {section}
                </span>
                <Separator className="flex-1" />
              </div>

              {/* Conversation items */}
              <div className="px-2 space-y-0.5">
                {sectionConvs.map((conv) => {
                  const flatIdx = flatConversations.findIndex(
                    (c) => c.id === conv.id
                  );
                  const isActive = activeConversationId === conv.id;
                  const isFocused = focusedIndex === flatIdx;
                  const updatedDate = toSafeDate(conv.updatedAt);
                  return (
                    <ContextMenu key={conv.id}>
                      <ContextMenuTrigger asChild>
                        <button
                          onClick={() => handleSelectConversation(conv)}
                          data-conversation-index={flatIdx}
                          className={cn(
                            "w-full rounded-md px-3 py-2 text-left text-sm",
                            "hover:bg-muted transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            // D-01 UI-SPEC: accent ring for active conversation
                            isActive ? "ring-2 ring-accent bg-muted" : "",
                            // D-28: visual indicator for keyboard-focused item (when not also active)
                            isFocused && !isActive ? "bg-muted/60" : ""
                          )}
                        >
                          {/* D-03: title + timestamp + model badge */}
                          <div className="flex items-start justify-between gap-2">
                            <span className="truncate font-medium text-foreground leading-tight">
                              {conv.title}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {updatedDate ? format(updatedDate, "HH:mm") : ""}
                            </span>
                          </div>
                          {/* Model badge — only shown when lastModel is set */}
                          {conv.lastModel && (
                            <div className="mt-1">
                              <Badge
                                variant="secondary"
                                className="text-xs px-1.5 py-0 h-4 bg-muted text-muted-foreground"
                              >
                                {conv.lastModel.split("/").pop() ??
                                  conv.lastModel}
                              </Badge>
                            </div>
                          )}
                        </button>
                      </ContextMenuTrigger>

                      {/* D-29: Right-click context menu with delete */}
                      <ContextMenuContent className="w-40">
                        <ContextMenuItem
                          className="text-destructive focus:text-destructive gap-2"
                          onClick={() => setDeleteTarget(conv.id)}
                        >
                          <Trash2 size={14} />
                          Excluir
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>

              {/* Spacer between groups (except last) */}
              {groupIdx < grouped.length - 1 && <div className="h-2" />}
            </div>
          ))}
      </ScrollArea>

      {/* D-29: Delete confirmation dialog (AlertDialog from @radix-ui/react-alert-dialog) */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

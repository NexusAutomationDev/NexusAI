/**
 * TanStack Query hooks for chat data (conversations, messages).
 * All queries go through Drizzle ORM proxy → tauri-plugin-sql → SQLite.
 *
 * CRITICAL: All queries MUST filter deleted_at IS NULL (soft-delete pattern, D-30).
 * Never expose deleted rows to the UI. Use isNull() on deletedAt columns.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/db/proxy';
import { conversations, messages } from '@/lib/db/schema';
import type { Conversation, Message, NewConversation, NewMessage } from '@/lib/db/schema';
import { eq, isNull, desc, asc, like, and } from 'drizzle-orm';

// ─── Query Key Factory ────────────────────────────────────────────────────────
// Consistent query keys for cache invalidation
export const chatKeys = {
  all: ['chat'] as const,
  conversations: () => [...chatKeys.all, 'conversations'] as const,
  conversation: (id: string) => [...chatKeys.conversations(), id] as const,
  messages: (conversationId: string) =>
    [...chatKeys.all, 'messages', conversationId] as const,
  search: (query: string) =>
    [...chatKeys.conversations(), 'search', query] as const,
};

// ─── Conversations ────────────────────────────────────────────────────────────

/**
 * Fetch all active (non-deleted) conversations, newest first.
 * D-07: grouped by time in UI, but fetched flat here.
 * T-02-03-01: always filters deleted_at IS NULL.
 */
export function useConversations() {
  return useQuery({
    queryKey: chatKeys.conversations(),
    queryFn: async (): Promise<Conversation[]> => {
      return db
        .select()
        .from(conversations)
        .where(isNull(conversations.deletedAt))  // D-30: soft-delete filter
        .orderBy(desc(conversations.updatedAt))
        .all();
    },
  });
}

/**
 * Search conversations by title or message content.
 * D-04: real-time search in conversation list.
 * Empty query returns all (same as useConversations).
 */
export function useSearchConversations(query: string) {
  return useQuery({
    queryKey: chatKeys.search(query),
    queryFn: async (): Promise<Conversation[]> => {
      if (!query.trim()) {
        return db
          .select()
          .from(conversations)
          .where(isNull(conversations.deletedAt))
          .orderBy(desc(conversations.updatedAt))
          .all();
      }
      const pattern = `%${query.toLowerCase()}%`;
      // Search by title
      const byTitle = await db
        .select()
        .from(conversations)
        .where(and(isNull(conversations.deletedAt), like(conversations.title, pattern)))
        .orderBy(desc(conversations.updatedAt))
        .all();

      // Search by message content (join)
      const byContent = await db
        .select({
          id: conversations.id,
          title: conversations.title,
          createdAt: conversations.createdAt,
          updatedAt: conversations.updatedAt,
          deletedAt: conversations.deletedAt,
          lastModel: conversations.lastModel,
        })
        .from(conversations)
        .innerJoin(messages, eq(messages.conversationId, conversations.id))
        .where(
          and(
            isNull(conversations.deletedAt),
            isNull(messages.deletedAt),
            like(messages.content, pattern)
          )
        )
        .orderBy(desc(conversations.updatedAt))
        .all();

      // Deduplicate by id
      const seen = new Set<string>();
      const results: Conversation[] = [];
      for (const row of [...byTitle, ...byContent]) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          results.push(row as Conversation);
        }
      }
      return results;
    },
    enabled: true, // Always active — query manages empty state
  });
}

// ─── Messages ─────────────────────────────────────────────────────────────────

/**
 * Fetch all active messages for a conversation, oldest first (chronological order).
 * D-32: messages persisted immediately; this query reflects real-time state.
 */
export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: chatKeys.messages(conversationId ?? ''),
    queryFn: async (): Promise<Message[]> => {
      if (!conversationId) return [];
      return db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            isNull(messages.deletedAt)  // D-30: soft-delete filter
          )
        )
        .orderBy(asc(messages.createdAt))
        .all();
    },
    enabled: !!conversationId,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Create a new conversation. Returns the new conversation ID.
 * D-34: auto-navigates on creation (handled by caller).
 * D-06: title starts as 'Nova Conversa', updated after first AI response.
 */
export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Conversation> => {
      const now = new Date(Date.now());
      const newConv: NewConversation = {
        id: crypto.randomUUID(),
        title: 'Nova Conversa',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        lastModel: null,
      };
      await db.insert(conversations).values(newConv);
      return newConv as unknown as Conversation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

/**
 * Insert a user message immediately on send (D-32: real-time persistence).
 */
export function useInsertUserMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (msg: NewMessage): Promise<Message> => {
      await db.insert(messages).values(msg);
      // Update conversation updatedAt
      await db
        .update(conversations)
        .set({ updatedAt: new Date(Date.now()) })
        .where(eq(conversations.id, msg.conversationId));
      return msg as unknown as Message;
    },
    onSuccess: (_, msg) => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(msg.conversationId) });
      qc.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

/**
 * Insert completed AI message after stream ends (D-32: save on completion).
 * Also updates conversation.lastModel for badge display (D-03).
 */
export function useInsertAiMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (msg: NewMessage & { _conversationModel: string }): Promise<Message> => {
      const { _conversationModel, ...msgData } = msg;
      await db.insert(messages).values(msgData);
      // Update conversation lastModel + updatedAt (D-03, D-22)
      await db
        .update(conversations)
        .set({
          updatedAt: new Date(Date.now()),
          lastModel: _conversationModel,
        })
        .where(eq(conversations.id, msgData.conversationId));
      return msgData as unknown as Message;
    },
    onSuccess: (_, msg) => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(msg.conversationId) });
      qc.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

/**
 * Soft-delete a conversation (D-30: no hard delete).
 * Sets deletedAt = now; conversation disappears from all queries.
 */
export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string): Promise<void> => {
      await db
        .update(conversations)
        .set({ deletedAt: new Date(Date.now()) })
        .where(eq(conversations.id, conversationId));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

/**
 * Update conversation title (D-06: auto-generated title or user edit).
 */
export function useUpdateConversationTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }): Promise<void> => {
      await db
        .update(conversations)
        .set({ title, updatedAt: new Date(Date.now()) })
        .where(eq(conversations.id, id));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

/**
 * Soft-delete a single message (D-24: delete message action).
 */
export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, conversationId }: { messageId: string; conversationId: string }): Promise<void> => {
      await db
        .update(messages)
        .set({ deletedAt: new Date(Date.now()) })
        .where(eq(messages.id, messageId));
    },
    onSuccess: (_, { conversationId }) => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
    },
  });
}

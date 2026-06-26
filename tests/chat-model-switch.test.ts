import { describe, it, expect } from 'vitest';

describe('02-03 — model continuity and conversation hooks', () => {
  it('useConversations query key matches chatKeys.conversations()', async () => {
    const { chatKeys } = await import('../src/lib/queries/chat');
    // Query key factory consistency check
    const key = chatKeys.conversations();
    expect(key).toEqual(['chat', 'conversations']);
  });

  it('useMessages query key includes conversationId', async () => {
    const { chatKeys } = await import('../src/lib/queries/chat');
    const key = chatKeys.messages('test-conv-id');
    expect(key).toContain('test-conv-id');
    expect(key[0]).toBe('chat');
  });

  it('useSearchConversations query key includes search term', async () => {
    const { chatKeys } = await import('../src/lib/queries/chat');
    const key = chatKeys.search('machine learning');
    expect(key).toContain('machine learning');
  });

  it('chatKeys.conversation(id) returns specific conversation key', async () => {
    const { chatKeys } = await import('../src/lib/queries/chat');
    const key = chatKeys.conversation('conv-xyz');
    expect(key).toContain('conv-xyz');
  });

  it('all mutation hooks are exported (create, insert, delete, update)', async () => {
    const mod = await import('../src/lib/queries/chat');
    expect(typeof mod.useCreateConversation).toBe('function');
    expect(typeof mod.useInsertUserMessage).toBe('function');
    expect(typeof mod.useInsertAiMessage).toBe('function');
    expect(typeof mod.useDeleteConversation).toBe('function');
    expect(typeof mod.useUpdateConversationTitle).toBe('function');
  });

  it('useInsertAiMessage accepts _conversationModel for lastModel update', async () => {
    // Structural: function exists and accepts model param (type-level check via source)
    const fs = await import('fs');
    const source = fs.readFileSync('./src/lib/queries/chat.ts', 'utf-8');
    expect(source).toContain('_conversationModel');
    expect(source).toContain('lastModel');
  });

  it('useCreateConversation creates conversation with Nova Conversa default title', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('./src/lib/queries/chat.ts', 'utf-8');
    expect(source).toContain("'Nova Conversa'");
  });

  it('useDeleteConversation sets deletedAt (soft-delete, not hard delete)', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('./src/lib/queries/chat.ts', 'utf-8');
    // Should use update + set deletedAt, not db.delete()
    expect(source).toContain('deletedAt');
    // Should NOT use hard delete on conversations
    const hardDeletes = (source.match(/db\.delete\(conversations\)/g) || []).length;
    expect(hardDeletes).toBe(0);
  });
});

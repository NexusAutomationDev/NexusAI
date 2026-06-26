import { describe, it, expect } from 'vitest';
// setup.ts handles mockIPC for plugin:sql|select etc.

describe('02-03 — TanStack Query hooks: chat-history', () => {
  it('chatKeys query key factory is exported', async () => {
    const mod = await import('../src/lib/queries/chat');
    expect(mod.chatKeys).toBeDefined();
    expect(Array.isArray(mod.chatKeys.all)).toBe(true);
    expect(typeof mod.chatKeys.conversations).toBe('function');
    expect(typeof mod.chatKeys.messages).toBe('function');
    expect(typeof mod.chatKeys.search).toBe('function');
  });

  it('chatKeys.conversations() returns array with correct prefix', async () => {
    const { chatKeys } = await import('../src/lib/queries/chat');
    const key = chatKeys.conversations();
    expect(key[0]).toBe('chat');
    expect(key[1]).toBe('conversations');
  });

  it('chatKeys.messages(id) returns array including conversationId', async () => {
    const { chatKeys } = await import('../src/lib/queries/chat');
    const key = chatKeys.messages('conv-abc');
    expect(key).toContain('conv-abc');
  });

  it('chatKeys.search(query) returns array including query', async () => {
    const { chatKeys } = await import('../src/lib/queries/chat');
    const key = chatKeys.search('hello');
    expect(key).toContain('hello');
  });

  it('useConversations is exported and is a function', async () => {
    const mod = await import('../src/lib/queries/chat');
    expect(typeof mod.useConversations).toBe('function');
  });

  it('useMessages is exported and is a function', async () => {
    const mod = await import('../src/lib/queries/chat');
    expect(typeof mod.useMessages).toBe('function');
  });

  it('useSearchConversations is exported and is a function', async () => {
    const mod = await import('../src/lib/queries/chat');
    expect(typeof mod.useSearchConversations).toBe('function');
  });

  it('useCreateConversation is exported and is a function', async () => {
    const mod = await import('../src/lib/queries/chat');
    expect(typeof mod.useCreateConversation).toBe('function');
  });

  it('useInsertUserMessage is exported and is a function', async () => {
    const mod = await import('../src/lib/queries/chat');
    expect(typeof mod.useInsertUserMessage).toBe('function');
  });

  it('useInsertAiMessage is exported and is a function', async () => {
    const mod = await import('../src/lib/queries/chat');
    expect(typeof mod.useInsertAiMessage).toBe('function');
  });

  it('useDeleteConversation is exported and is a function', async () => {
    const mod = await import('../src/lib/queries/chat');
    expect(typeof mod.useDeleteConversation).toBe('function');
  });

  it('useUpdateConversationTitle is exported and is a function', async () => {
    const mod = await import('../src/lib/queries/chat');
    expect(typeof mod.useUpdateConversationTitle).toBe('function');
  });

  it('useDeleteMessage is exported and is a function', async () => {
    const mod = await import('../src/lib/queries/chat');
    expect(typeof mod.useDeleteMessage).toBe('function');
  });

  it('soft-delete filter present: isNull(conversations.deletedAt) used in queries', async () => {
    // Verify the source contains the soft-delete guard
    const fs = await import('fs');
    const source = fs.readFileSync('./src/lib/queries/chat.ts', 'utf-8');
    const count = (source.match(/isNull.*deletedAt/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('exports at least 8 named hook functions', async () => {
    const mod = await import('../src/lib/queries/chat');
    const hookExports = Object.keys(mod).filter(k => k.startsWith('use'));
    expect(hookExports.length).toBeGreaterThanOrEqual(8);
  });
});

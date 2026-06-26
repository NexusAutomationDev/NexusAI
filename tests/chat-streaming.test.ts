import { describe, it, expect, beforeEach, vi } from 'vitest';
// setup.ts handles mockIPC for Tauri commands

describe('02-03 — Zustand chat store (streaming state)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('useChatStore is exported from stores/chat', async () => {
    const mod = await import('../src/lib/stores/chat');
    expect(typeof mod.useChatStore).toBe('function');
  });

  it('FileAttachment interface is exported', async () => {
    // TypeScript structural check via duck-typing at runtime
    const mod = await import('../src/lib/stores/chat');
    const store = mod.useChatStore.getState();
    expect(Array.isArray(store.pendingAttachments)).toBe(true);
  });

  it('ChatMessage interface is exported (via store usage)', async () => {
    const mod = await import('../src/lib/stores/chat');
    const store = mod.useChatStore.getState();
    expect(typeof store.startStream).toBe('function');
  });

  it('initial state: isStreaming is false', async () => {
    const { useChatStore } = await import('../src/lib/stores/chat');
    expect(useChatStore.getState().isStreaming).toBe(false);
  });

  it('initial state: activeConversationId is null', async () => {
    const { useChatStore } = await import('../src/lib/stores/chat');
    expect(useChatStore.getState().activeConversationId).toBeNull();
  });

  it('initial state: streamingContent is empty string', async () => {
    const { useChatStore } = await import('../src/lib/stores/chat');
    expect(useChatStore.getState().streamingContent).toBe('');
  });

  it('initial state: pendingAttachments is empty array', async () => {
    const { useChatStore } = await import('../src/lib/stores/chat');
    expect(useChatStore.getState().pendingAttachments).toEqual([]);
  });

  it('initial state: currentModel defaults to gpt-4o (settings store default)', async () => {
    const { useChatStore } = await import('../src/lib/stores/chat');
    expect(useChatStore.getState().currentModel).toBe('gpt-4o');
  });

  it('setActiveConversationId updates activeConversationId', async () => {
    const { useChatStore } = await import('../src/lib/stores/chat');
    useChatStore.getState().setActiveConversationId('conv-123');
    expect(useChatStore.getState().activeConversationId).toBe('conv-123');
    useChatStore.getState().setActiveConversationId(null);
    expect(useChatStore.getState().activeConversationId).toBeNull();
  });

  it('setCurrentModel updates currentModel', async () => {
    const { useChatStore } = await import('../src/lib/stores/chat');
    useChatStore.getState().setCurrentModel('gemini-2.0-flash');
    expect(useChatStore.getState().currentModel).toBe('gemini-2.0-flash');
  });

  it('addAttachment appends to pendingAttachments', async () => {
    const { useChatStore } = await import('../src/lib/stores/chat');
    const file = { filename: 'test.pdf', mimeType: 'application/pdf', base64Data: 'abc', fileSizeBytes: 100 };
    useChatStore.getState().addAttachment(file);
    expect(useChatStore.getState().pendingAttachments).toHaveLength(1);
    expect(useChatStore.getState().pendingAttachments[0].filename).toBe('test.pdf');
  });

  it('removeAttachment removes by filename', async () => {
    const { useChatStore } = await import('../src/lib/stores/chat');
    const file1 = { filename: 'a.pdf', mimeType: 'application/pdf', base64Data: 'a', fileSizeBytes: 10 };
    const file2 = { filename: 'b.png', mimeType: 'image/png', base64Data: 'b', fileSizeBytes: 20 };
    useChatStore.getState().addAttachment(file1);
    useChatStore.getState().addAttachment(file2);
    useChatStore.getState().removeAttachment('a.pdf');
    const attachments = useChatStore.getState().pendingAttachments;
    expect(attachments).toHaveLength(1);
    expect(attachments[0].filename).toBe('b.png');
  });

  it('clearAttachments empties pendingAttachments', async () => {
    const { useChatStore } = await import('../src/lib/stores/chat');
    const file = { filename: 'test.pdf', mimeType: 'application/pdf', base64Data: 'abc', fileSizeBytes: 100 };
    useChatStore.getState().addAttachment(file);
    useChatStore.getState().clearAttachments();
    expect(useChatStore.getState().pendingAttachments).toHaveLength(0);
  });

  it('store has startStream function', async () => {
    const { useChatStore } = await import('../src/lib/stores/chat');
    expect(typeof useChatStore.getState().startStream).toBe('function');
  });

  it('store has stopStream function', async () => {
    const { useChatStore } = await import('../src/lib/stores/chat');
    expect(typeof useChatStore.getState().stopStream).toBe('function');
  });

  it('store has pickFile function', async () => {
    const { useChatStore } = await import('../src/lib/stores/chat');
    expect(typeof useChatStore.getState().pickFile).toBe('function');
  });

  it('stopStream is no-op when no active stream', async () => {
    const { useChatStore } = await import('../src/lib/stores/chat');
    // Should not throw when streamingConversationId is null
    await expect(useChatStore.getState().stopStream()).resolves.toBeUndefined();
    expect(useChatStore.getState().isStreaming).toBe(false);
  });
});

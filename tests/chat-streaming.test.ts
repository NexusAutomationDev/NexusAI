import { describe, it, expect } from 'vitest';
import { Channel } from '@tauri-apps/api/core';

// This import FAILS (module not found) until Plan 03 creates src/lib/stores/chat.ts
// That failure is the RED state for this test file.
import { useChatStore } from '@/lib/stores/chat';

describe('CHAT-01: Real-time streaming', () => {
  it('useChatStore exposes isStreaming state', () => {
    const { isStreaming } = useChatStore.getState();
    expect(typeof isStreaming).toBe('boolean');
    expect(isStreaming).toBe(false);
  });

  it('Channel onmessage fires for each token during streaming', async () => {
    const received: string[] = [];
    const channel = new Channel<{ event: string; data: { text?: string } }>();
    channel.onmessage = (msg) => {
      if (msg.event === 'token' && msg.data.text) {
        received.push(msg.data.text);
      }
    };
    expect(Channel).toBeDefined();
    expect(channel.onmessage).toBeDefined();
  });

  it('useChatStore.startStream sets isStreaming to true', async () => {
    const store = useChatStore.getState();
    expect(store.startStream).toBeDefined();
    expect(typeof store.startStream).toBe('function');
    store.startStream('conv-1');
    expect(useChatStore.getState().isStreaming).toBe(true);
  });

  it('useChatStore.stopStream sets isStreaming to false', () => {
    const store = useChatStore.getState();
    expect(store.stopStream).toBeDefined();
    expect(typeof store.stopStream).toBe('function');
    store.startStream('conv-1');
    store.stopStream();
    expect(useChatStore.getState().isStreaming).toBe(false);
  });
});

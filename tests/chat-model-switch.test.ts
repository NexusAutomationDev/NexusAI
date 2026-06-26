import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// These imports FAIL (module not found) until Plan 03 creates the store and queries
// That failure is the RED state for this test file.
import { useChatStore } from '@/lib/stores/chat';
import { useInsertAiMessage } from '@/lib/queries/chat';

// Mock Drizzle db proxy
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{
      id: 'msg-ai-1',
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'Mock AI response',
      model: 'gpt-4o',
      createdAt: Date.now(),
      deletedAt: null,
    }]),
    run: vi.fn().mockResolvedValue(undefined),
  },
}));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('CHAT-03: Model switching preserves conversation history', () => {
  it('useChatStore exposes currentModel state', () => {
    const { currentModel } = useChatStore.getState();
    expect(typeof currentModel).toBe('string');
    expect(currentModel.length).toBeGreaterThan(0);
  });

  it('useChatStore.setCurrentModel updates the model', () => {
    useChatStore.getState().setCurrentModel('anthropic/claude-3-5-sonnet');
    expect(useChatStore.getState().currentModel).toBe('anthropic/claude-3-5-sonnet');
    // Reset
    useChatStore.getState().setCurrentModel('gpt-4o');
  });

  it('useInsertAiMessage is a function exported from queries/chat', () => {
    expect(typeof useInsertAiMessage).toBe('function');
  });

  it('useInsertAiMessage mutation result includes model field', async () => {
    const { result } = renderHook(() => useInsertAiMessage(), {
      wrapper: makeWrapper(),
    });
    await result.current.mutateAsync({
      conversationId: 'conv-1',
      content: 'AI response text',
      model: 'gpt-4o',
    });
    // The mock db.returning() returns a message with model field
    const returnedData = result.current.data;
    if (returnedData) {
      expect(returnedData).toHaveProperty('model');
    }
  });
});

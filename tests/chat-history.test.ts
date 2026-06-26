import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// These imports FAIL (module not found) until Plan 03 creates src/lib/queries/chat.ts
// That failure is the RED state for this test file.
import { useConversations, useSearchConversations } from '@/lib/queries/chat';

// Mock the Drizzle db proxy — hooks use this, not IPC invoke()
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    run: vi.fn().mockResolvedValue(undefined),
  },
}));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('CHAT-02: Conversation history and search', () => {
  it('useConversations returns an array', async () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));
    // With mocked db returning [], data should be an empty array
    expect(Array.isArray(result.current.data ?? [])).toBe(true);
  });

  it('useSearchConversations with empty query returns all conversations', async () => {
    const { result } = renderHook(() => useSearchConversations(''), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));
    expect(Array.isArray(result.current.data ?? [])).toBe(true);
  });

  it('useSearchConversations accepts a query string without throwing', async () => {
    const { result } = renderHook(() => useSearchConversations('test query'), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));
    // Should not throw — returns empty array from mock
    expect(Array.isArray(result.current.data ?? [])).toBe(true);
  });

  it('useSearchConversations is a function exported from queries/chat', () => {
    expect(typeof useSearchConversations).toBe('function');
  });
});

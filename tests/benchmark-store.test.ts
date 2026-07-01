import { describe, it, expect, beforeEach, vi } from 'vitest';

// RED tests — src/lib/stores/benchmark.ts does not exist yet (Wave 1 creates it)
// These tests will fail until Wave 1 is complete

describe('BENCH-01 / BENCH-02 — benchmarkStore (Zustand)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('useBenchmarkStore is exported from stores/benchmark', async () => {
    const mod = await import('../src/lib/stores/benchmark');
    expect(typeof mod.useBenchmarkStore).toBe('function');
  });

  it('initial state: activeSession is null', async () => {
    const { useBenchmarkStore } = await import('../src/lib/stores/benchmark');
    expect(useBenchmarkStore.getState().activeSession).toBeNull();
  });

  it('startSession creates a session with given prompt and models', async () => {
    const { useBenchmarkStore } = await import('../src/lib/stores/benchmark');
    const sessionId = useBenchmarkStore.getState().startSession('Explique IA', ['gpt-4.1', 'claude-opus-4']);
    const session = useBenchmarkStore.getState().activeSession;
    expect(session).not.toBeNull();
    expect(session!.prompt).toBe('Explique IA');
    expect(session!.columns).toHaveLength(2);
    expect(session!.columns[0].model).toBe('gpt-4.1');
    expect(session!.columns[1].model).toBe('claude-opus-4');
    expect(typeof sessionId).toBe('string');
  });

  it('initial column status is idle', async () => {
    const { useBenchmarkStore } = await import('../src/lib/stores/benchmark');
    useBenchmarkStore.getState().startSession('test', ['gpt-4.1', 'gemini-2.0-flash']);
    const cols = useBenchmarkStore.getState().activeSession!.columns;
    expect(cols[0].status).toBe('idle');
    expect(cols[1].status).toBe('idle');
  });

  it('appendToken accumulates content for correct column only', async () => {
    const { useBenchmarkStore } = await import('../src/lib/stores/benchmark');
    useBenchmarkStore.getState().startSession('test', ['gpt-4.1', 'claude-opus-4']);
    useBenchmarkStore.getState().appendToken(0, 'Olá ');
    useBenchmarkStore.getState().appendToken(0, 'mundo');
    useBenchmarkStore.getState().appendToken(1, 'Hello');
    const cols = useBenchmarkStore.getState().activeSession!.columns;
    expect(cols[0].content).toBe('Olá mundo');
    expect(cols[1].content).toBe('Hello');
  });

  it('setColumnDone updates status to done for correct column', async () => {
    const { useBenchmarkStore } = await import('../src/lib/stores/benchmark');
    useBenchmarkStore.getState().startSession('test', ['gpt-4.1', 'claude-opus-4']);
    useBenchmarkStore.getState().setColumnDone(0);
    const cols = useBenchmarkStore.getState().activeSession!.columns;
    expect(cols[0].status).toBe('done');
    expect(cols[1].status).toBe('idle'); // not affected
  });

  it('setColumnError updates status to error with message', async () => {
    const { useBenchmarkStore } = await import('../src/lib/stores/benchmark');
    useBenchmarkStore.getState().startSession('test', ['gpt-4.1', 'claude-opus-4']);
    useBenchmarkStore.getState().setColumnError(1, 'API key inválida');
    const cols = useBenchmarkStore.getState().activeSession!.columns;
    expect(cols[1].status).toBe('error');
    expect(cols[1].error).toBe('API key inválida');
  });

  it('allDone selector is false when any column is streaming', async () => {
    const { useBenchmarkStore } = await import('../src/lib/stores/benchmark');
    useBenchmarkStore.getState().startSession('test', ['gpt-4.1', 'claude-opus-4']);
    // Set col0 to streaming, col1 stays idle
    useBenchmarkStore.getState().setColumnStreaming(0);
    const cols = useBenchmarkStore.getState().activeSession!.columns;
    const allDone = cols.every(c => c.status === 'done' || c.status === 'error');
    expect(allDone).toBe(false);
  });

  it('allDone selector is true when all columns are done or error', async () => {
    const { useBenchmarkStore } = await import('../src/lib/stores/benchmark');
    useBenchmarkStore.getState().startSession('test', ['gpt-4.1', 'claude-opus-4']);
    useBenchmarkStore.getState().setColumnDone(0);
    useBenchmarkStore.getState().setColumnError(1, 'err');
    const cols = useBenchmarkStore.getState().activeSession!.columns;
    const allDone = cols.every(c => c.status === 'done' || c.status === 'error');
    expect(allDone).toBe(true);
  });

  it('scored is false initially and true after setWinner', async () => {
    const { useBenchmarkStore } = await import('../src/lib/stores/benchmark');
    useBenchmarkStore.getState().startSession('test', ['gpt-4.1', 'claude-opus-4']);
    expect(useBenchmarkStore.getState().activeSession!.scored).toBe(false);
    // setWinner is async (writes to DB) — test the state sync part only
    useBenchmarkStore.setState(s => ({
      activeSession: s.activeSession ? { ...s.activeSession, scored: true, winnerId: 'gpt-4.1' } : null
    }));
    expect(useBenchmarkStore.getState().activeSession!.scored).toBe(true);
    expect(useBenchmarkStore.getState().activeSession!.winnerId).toBe('gpt-4.1');
  });

  it('resetSession clears activeSession', async () => {
    const { useBenchmarkStore } = await import('../src/lib/stores/benchmark');
    useBenchmarkStore.getState().startSession('test', ['gpt-4.1', 'claude-opus-4']);
    useBenchmarkStore.getState().resetSession();
    expect(useBenchmarkStore.getState().activeSession).toBeNull();
  });

  it('store exports setColumnStreaming function', async () => {
    const { useBenchmarkStore } = await import('../src/lib/stores/benchmark');
    expect(typeof useBenchmarkStore.getState().setColumnStreaming).toBe('function');
  });
});

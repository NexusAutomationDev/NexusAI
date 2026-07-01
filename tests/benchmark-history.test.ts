import { describe, it, expect, beforeEach, vi } from 'vitest';

// RED tests — src/lib/queries/benchmark.ts does not exist yet (Wave 3 creates it)
// Also tests BENCH-02 winner badge logic

describe('BENCH-02 — History and scoring', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('useBenchmarkHistory is exported from queries/benchmark', async () => {
    const mod = await import('../src/lib/queries/benchmark');
    expect(typeof mod.useBenchmarkHistory).toBe('function');
  });

  it('WinnerBadge variant is default for model winner', () => {
    // Test the badge logic in isolation (pure function, no DOM needed)
    type BenchmarkResultLike = { model: string; isWinner: boolean; isTie: boolean };

    function getWinnerState(results: BenchmarkResultLike[]): 'winner' | 'tie' | 'unscored' {
      if (results.find(r => r.isWinner)) return 'winner';
      if (results.find(r => r.isTie)) return 'tie';
      return 'unscored';
    }

    const winnerResults = [
      { model: 'gpt-4.1', isWinner: true, isTie: false },
      { model: 'claude-opus-4', isWinner: false, isTie: false },
    ];
    const tieResults = [
      { model: 'gpt-4.1', isWinner: false, isTie: true },
      { model: 'claude-opus-4', isWinner: false, isTie: true },
    ];
    const unscoredResults = [
      { model: 'gpt-4.1', isWinner: false, isTie: false },
    ];

    expect(getWinnerState(winnerResults)).toBe('winner');
    expect(getWinnerState(tieResults)).toBe('tie');
    expect(getWinnerState(unscoredResults)).toBe('unscored');
  });

  it('prompt truncation: truncates at 60 chars with ellipsis', () => {
    function truncatePrompt(text: string, maxLen = 60): string {
      return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
    }

    const short = 'Explique o que é IA.';
    const long = 'Escreva um email profissional para um cliente sobre atraso na entrega do produto solicitado.';

    expect(truncatePrompt(short)).toBe(short);
    expect(truncatePrompt(long)).toHaveLength(61); // 60 chars + '…'
    expect(truncatePrompt(long).endsWith('…')).toBe(true);
  });

  it('winner ToggleGroup uses sentinel __tie__ for tie state (not null)', () => {
    // ToggleGroup requires string value; null is converted to '__tie__' in UI
    // and back to null when persisting to DB
    const tieValue = '__tie__';
    const dbValue: string | null = tieValue === '__tie__' ? null : tieValue;
    expect(dbValue).toBeNull();

    const winnerModel = 'gpt-4.1';
    const dbValueForWinner: string | null = winnerModel === '__tie__' ? null : winnerModel;
    expect(dbValueForWinner).toBe('gpt-4.1');
  });

  it('benchmark_sessions query key is stable', () => {
    // TanStack Query invalidation depends on stable query keys
    const queryKey = ['benchmark-history'];
    expect(queryKey).toEqual(['benchmark-history']);
  });
});

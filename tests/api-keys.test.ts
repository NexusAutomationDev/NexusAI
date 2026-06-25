import { describe, it, expect } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

describe('FOUND-01 — API key status IPC', () => {
  it('get_api_key_status returns { configured: bool } only — not a string key', async () => {
    const result = await invoke<{ configured: boolean }>('get_api_key_status', {
      provider: 'openai',
    });
    expect(typeof result).toBe('object');
    expect(typeof result.configured).toBe('boolean');
    // CRITICAL: must not be a string (which would mean the raw key was returned)
    expect(typeof result).not.toBe('string');
  });

  it('set_api_key does not return the key back', async () => {
    const result = await invoke('set_api_key', { provider: 'openai', key: 'sk-test' });
    // Must return null/void — not echo back the key
    expect(result).not.toBe('sk-test');
    expect((result as string | null)?.includes?.('sk-')).toBeFalsy();
  });
});

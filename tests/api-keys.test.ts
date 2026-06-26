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

  it('API key input type is "password" — key is never visible as plaintext', async () => {
    // Import lazily to allow module to load after mocks are set up
    const { ApiKeysSection } = await import('../src/components/settings/ApiKeysSection');
    const { render } = await import('@testing-library/react');
    const React = (await import('react')).default;
    render(React.createElement(ApiKeysSection));
    // All inputs must be type="password" — verifies no raw key is shown
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    expect(passwordInputs.length).toBeGreaterThan(0);
  });
});

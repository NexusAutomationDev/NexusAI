import { describe, it, expect, beforeEach } from 'vitest';
// mockIPC from tests/setup.ts intercepts 'plugin:store|get' and 'plugin:store|set'

describe('FOUND-02 — model selection store', () => {
  it('useSettingsStore has chatModel, agentsModel, benchmarkModel state', async () => {
    const { useSettingsStore } = await import('../src/lib/stores/settings');
    const store = useSettingsStore.getState();
    expect('chatModel' in store).toBe(true);
    expect('agentsModel' in store).toBe(true);
    expect('benchmarkModel' in store).toBe(true);
  });

  it('default model for all task types is gpt-4o', async () => {
    const { useSettingsStore } = await import('../src/lib/stores/settings');
    const { chatModel, agentsModel, benchmarkModel } = useSettingsStore.getState();
    expect(chatModel).toBe('gpt-4o');
    expect(agentsModel).toBe('gpt-4o');
    expect(benchmarkModel).toBe('gpt-4o');
  });

  it('setChatModel updates chatModel in store', async () => {
    const { useSettingsStore } = await import('../src/lib/stores/settings');
    await useSettingsStore.getState().setChatModel('gpt-4o-mini');
    expect(useSettingsStore.getState().chatModel).toBe('gpt-4o-mini');
  });

  it('setAgentsModel updates agentsModel in store', async () => {
    const { useSettingsStore } = await import('../src/lib/stores/settings');
    await useSettingsStore.getState().setAgentsModel('gemini-pro');
    expect(useSettingsStore.getState().agentsModel).toBe('gemini-pro');
  });

  it('setBenchmarkModel updates benchmarkModel in store', async () => {
    const { useSettingsStore } = await import('../src/lib/stores/settings');
    await useSettingsStore.getState().setBenchmarkModel('gemini-2.0-flash');
    expect(useSettingsStore.getState().benchmarkModel).toBe('gemini-2.0-flash');
  });

  it('store actions are functions', async () => {
    const { useSettingsStore } = await import('../src/lib/stores/settings');
    const state = useSettingsStore.getState();
    expect(typeof state.setChatModel).toBe('function');
    expect(typeof state.setAgentsModel).toBe('function');
    expect(typeof state.setBenchmarkModel).toBe('function');
    expect(typeof state.load).toBe('function');
  });
});

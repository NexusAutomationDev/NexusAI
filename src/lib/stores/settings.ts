import { create } from 'zustand';
import { load } from '@tauri-apps/plugin-store';

// Allowed models by provider (used to populate Select options)
export const AVAILABLE_MODELS = [
  { value: 'gpt-4o',                      label: 'GPT-4o (OpenAI)' },
  { value: 'gpt-4o-mini',                 label: 'GPT-4o Mini (OpenAI)' },
  { value: 'o1-preview',                  label: 'o1 Preview (OpenAI)' },
  { value: 'openrouter/auto',             label: 'Auto (OpenRouter)' },
  { value: 'anthropic/claude-3-5-sonnet', label: 'Claude 3.5 Sonnet (via OpenRouter)' },
  { value: 'google/gemini-2.0-flash',     label: 'Gemini 2.0 Flash (via OpenRouter)' },
  { value: 'gemini-2.0-flash',            label: 'Gemini 2.0 Flash (Gemini)' },
  { value: 'gemini-pro',                  label: 'Gemini Pro (Gemini)' },
] as const;

export type ModelId = typeof AVAILABLE_MODELS[number]['value'];

interface SettingsStore {
  chatModel: ModelId;
  agentsModel: ModelId;
  benchmarkModel: ModelId;
  setChatModel: (model: ModelId) => Promise<void>;
  setAgentsModel: (model: ModelId) => Promise<void>;
  setBenchmarkModel: (model: ModelId) => Promise<void>;
  load: () => Promise<void>;
}

let _store: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
  if (!_store) _store = await load('settings.json', { autoSave: true });
  return _store;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  chatModel: 'gpt-4o',
  agentsModel: 'gpt-4o',
  benchmarkModel: 'gpt-4o',

  setChatModel: async (chatModel) => {
    const s = await getStore();
    await s.set('chatModel', chatModel);
    set({ chatModel });
  },

  setAgentsModel: async (agentsModel) => {
    const s = await getStore();
    await s.set('agentsModel', agentsModel);
    set({ agentsModel });
  },

  setBenchmarkModel: async (benchmarkModel) => {
    const s = await getStore();
    await s.set('benchmarkModel', benchmarkModel);
    set({ benchmarkModel });
  },

  load: async () => {
    const s = await getStore();
    const chatModel = (await s.get<ModelId>('chatModel')) ?? 'gpt-4o';
    const agentsModel = (await s.get<ModelId>('agentsModel')) ?? 'gpt-4o';
    const benchmarkModel = (await s.get<ModelId>('benchmarkModel')) ?? 'gpt-4o';
    set({ chatModel, agentsModel, benchmarkModel });
  },
}));

import { create } from 'zustand';
import { load } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';

export type ProviderId = 'openai' | 'openrouter' | 'gemini';

// All available models grouped by provider (latest first within each group)
export const AVAILABLE_MODELS = [
  // ── OpenAI ─────────────────────────────────────────────────────────────────
  { value: 'gpt-4.1',             label: 'GPT-4.1',              provider: 'openai' as ProviderId },
  { value: 'gpt-4.1-mini',        label: 'GPT-4.1 Mini',         provider: 'openai' as ProviderId },
  { value: 'o4-mini',             label: 'o4 Mini',              provider: 'openai' as ProviderId },
  { value: 'o3',                  label: 'o3',                   provider: 'openai' as ProviderId },
  { value: 'o3-mini',             label: 'o3 Mini',              provider: 'openai' as ProviderId },
  { value: 'gpt-4o',              label: 'GPT-4o',               provider: 'openai' as ProviderId },
  { value: 'gpt-4o-mini',         label: 'GPT-4o Mini',          provider: 'openai' as ProviderId },
  { value: 'o1',                  label: 'o1',                   provider: 'openai' as ProviderId },
  { value: 'o1-mini',             label: 'o1 Mini',              provider: 'openai' as ProviderId },
  // ── OpenRouter ─────────────────────────────────────────────────────────────
  { value: 'openrouter/auto',                             label: 'Auto (melhor disponível)',   provider: 'openrouter' as ProviderId },
  { value: 'anthropic/claude-opus-4',                     label: 'Claude Opus 4',              provider: 'openrouter' as ProviderId },
  { value: 'anthropic/claude-sonnet-4-5',                 label: 'Claude Sonnet 4.5',          provider: 'openrouter' as ProviderId },
  { value: 'anthropic/claude-3-5-sonnet-20241022',        label: 'Claude 3.5 Sonnet',          provider: 'openrouter' as ProviderId },
  { value: 'anthropic/claude-3-5-haiku-20241022',         label: 'Claude 3.5 Haiku',           provider: 'openrouter' as ProviderId },
  { value: 'google/gemini-2.5-pro-preview',               label: 'Gemini 2.5 Pro',             provider: 'openrouter' as ProviderId },
  { value: 'google/gemini-2.0-flash-001',                 label: 'Gemini 2.0 Flash',           provider: 'openrouter' as ProviderId },
  { value: 'meta-llama/llama-3.3-70b-instruct',           label: 'Llama 3.3 70B',              provider: 'openrouter' as ProviderId },
  { value: 'meta-llama/llama-3.1-405b-instruct',          label: 'Llama 3.1 405B',             provider: 'openrouter' as ProviderId },
  { value: 'deepseek/deepseek-r1',                        label: 'DeepSeek R1',                provider: 'openrouter' as ProviderId },
  { value: 'mistralai/mistral-large-2411',                label: 'Mistral Large',              provider: 'openrouter' as ProviderId },
  { value: 'qwen/qwen-2.5-72b-instruct',                  label: 'Qwen 2.5 72B',               provider: 'openrouter' as ProviderId },
  // ── Gemini (direct) ────────────────────────────────────────────────────────
  { value: 'gemini-2.5-pro-preview-06-05', label: 'Gemini 2.5 Pro',   provider: 'gemini' as ProviderId },
  { value: 'gemini-2.0-flash',             label: 'Gemini 2.0 Flash',  provider: 'gemini' as ProviderId },
  { value: 'gemini-1.5-pro',              label: 'Gemini 1.5 Pro',    provider: 'gemini' as ProviderId },
  { value: 'gemini-1.5-flash',            label: 'Gemini 1.5 Flash',  provider: 'gemini' as ProviderId },
];

export type AvailableModel = typeof AVAILABLE_MODELS[number];
export type ModelId = string; // string so any model ID works, not just AVAILABLE_MODELS entries

export function getProviderForModel(modelValue: string): ProviderId {
  if (
    modelValue.startsWith('openrouter/') ||
    modelValue.startsWith('anthropic/') ||
    modelValue.startsWith('google/') ||
    modelValue.startsWith('meta-llama/') ||
    modelValue.startsWith('mistralai/') ||
    modelValue.startsWith('deepseek/') ||
    modelValue.startsWith('qwen/')
  ) return 'openrouter';
  if (modelValue.startsWith('gemini')) return 'gemini';
  return 'openai';
}

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  gemini: 'Google Gemini',
};

interface SettingsStore {
  chatModel: ModelId;
  agentsModel: ModelId;
  benchmarkModel: ModelId;
  // Filtered list of models — only providers with a configured API key
  availableModels: AvailableModel[];
  setChatModel: (model: ModelId) => Promise<void>;
  setAgentsModel: (model: ModelId) => Promise<void>;
  setBenchmarkModel: (model: ModelId) => Promise<void>;
  // Call after adding/removing API keys to update the model list
  refreshAvailableModels: () => Promise<void>;
  load: () => Promise<void>;
}

let _store: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
  if (!_store) _store = await load('settings.json', { autoSave: true, defaults: {} });
  return _store;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  chatModel: 'gpt-4o',
  agentsModel: 'gpt-4o',
  benchmarkModel: 'gpt-4o',
  availableModels: AVAILABLE_MODELS, // show all until first refresh

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

  refreshAvailableModels: async () => {
    const providers: ProviderId[] = ['openai', 'openrouter', 'gemini'];
    const results = await Promise.all(
      providers.map(async (provider): Promise<{ provider: ProviderId; ok: boolean }> => {
        try {
          const res = await invoke<{ configured: boolean }>('get_api_key_status', { provider });
          return { provider, ok: res.configured };
        } catch {
          return { provider, ok: false };
        }
      })
    );
    const configured = new Set(results.filter(r => r.ok).map(r => r.provider));
    const filtered = AVAILABLE_MODELS.filter(m => configured.has(m.provider));
    set({ availableModels: filtered.length > 0 ? filtered : AVAILABLE_MODELS });
  },

  load: async () => {
    const s = await getStore();
    const chatModel = (await s.get<ModelId>('chatModel')) ?? 'gpt-4o';
    const agentsModel = (await s.get<ModelId>('agentsModel')) ?? 'gpt-4o';
    const benchmarkModel = (await s.get<ModelId>('benchmarkModel')) ?? 'gpt-4o';
    set({ chatModel, agentsModel, benchmarkModel });
    // Non-blocking: refresh which providers are configured
    useSettingsStore.getState().refreshAvailableModels();
  },
}));

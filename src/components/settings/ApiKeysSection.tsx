import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

interface Provider {
  id: 'openai' | 'openrouter' | 'gemini';
  label: string;
  description: string;
}

const PROVIDERS: Provider[] = [
  { id: 'openai',     label: 'OpenAI',     description: 'GPT-4o, o1, o3 models' },
  { id: 'openrouter', label: 'OpenRouter', description: 'Acesso unificado a múltiplos provedores' },
  { id: 'gemini',     label: 'Gemini',     description: 'Google Gemini Pro / Flash' },
];

interface KeyState {
  configured: boolean;
  editing: boolean;
  inputValue: string;
  confirmDelete: boolean;
  error: string | null;
}

function useApiKeyState(providerId: string): KeyState & {
  startEdit: () => void;
  cancelEdit: () => void;
  setInputValue: (v: string) => void;
  save: () => Promise<void>;
  startDelete: () => void;
  cancelDelete: () => void;
  confirmDeleteAction: () => Promise<void>;
} {
  const [state, setState] = useState<KeyState>({
    configured: false,
    editing: false,
    inputValue: '',
    confirmDelete: false,
    error: null,
  });

  async function refresh() {
    try {
      const result = await invoke<{ configured: boolean }>('get_api_key_status', {
        provider: providerId,
      });
      setState((s) => ({ ...s, configured: result.configured, error: null }));
    } catch (e) {
      setState((s) => ({ ...s, error: String(e) }));
    }
  }

  useEffect(() => { refresh(); }, [providerId]);

  return {
    ...state,
    startEdit: () => setState((s) => ({ ...s, editing: true, inputValue: '', error: null })),
    cancelEdit: () => setState((s) => ({ ...s, editing: false, inputValue: '' })),
    setInputValue: (v) => setState((s) => ({ ...s, inputValue: v })),
    save: async () => {
      if (!state.inputValue.trim()) return;
      try {
        await invoke('set_api_key', { provider: providerId, key: state.inputValue.trim() });
        setState((s) => ({ ...s, editing: false, inputValue: '', configured: true, error: null }));
      } catch (e) {
        setState((s) => ({ ...s, error: 'Não foi possível salvar a chave. Verifique e tente novamente.' }));
      }
    },
    startDelete: () => setState((s) => ({ ...s, confirmDelete: true })),
    cancelDelete: () => setState((s) => ({ ...s, confirmDelete: false })),
    confirmDeleteAction: async () => {
      try {
        await invoke('delete_api_key', { provider: providerId });
        setState((s) => ({ ...s, configured: false, confirmDelete: false, error: null }));
      } catch (e) {
        setState((s) => ({ ...s, error: String(e), confirmDelete: false }));
      }
    },
  };
}

function ApiKeyRow({ provider }: { provider: Provider }) {
  const key = useApiKeyState(provider.id);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{provider.label}</Label>
          <p className="text-xs text-muted-foreground">{provider.description}</p>
        </div>
        {/* Configured badge (D-06) — color AND text, not color alone (accessibility) */}
        <Badge
          variant="outline"
          className={key.configured ? 'text-green-500 border-green-500/30' : 'text-red-500 border-red-500/30'}
        >
          {key.configured ? 'Configurado' : 'Não configurado'}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        {/* Input: type="password" masked; disabled when not editing (D-06) */}
        <Input
          type="password"
          className="w-72"
          value={key.editing ? key.inputValue : '••••••••••••••••'}
          disabled={!key.editing}
          onChange={(e) => key.setInputValue(e.target.value)}
          placeholder={key.editing ? 'Cole a chave aqui' : ''}
          aria-label={`Chave de API ${provider.label}`}
        />

        {!key.editing && !key.confirmDelete && (
          <>
            {/* "Editar" button (D-06) */}
            <Button variant="outline" size="sm" onClick={key.startEdit}>
              Editar
            </Button>
            {key.configured && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={key.startDelete}
              >
                Remover chave
              </Button>
            )}
          </>
        )}

        {key.editing && (
          <>
            <Button size="sm" onClick={key.save} disabled={!key.inputValue.trim()}>
              Salvar chave
            </Button>
            <Button variant="ghost" size="sm" onClick={key.cancelEdit}>
              Cancelar
            </Button>
          </>
        )}

        {/* Inline destructive confirmation (UI-SPEC §Copywriting Contract) */}
        {key.confirmDelete && (
          <>
            <Button
              variant="destructive"
              size="sm"
              onClick={key.confirmDeleteAction}
            >
              Confirmar remoção
            </Button>
            <Button variant="ghost" size="sm" onClick={key.cancelDelete}>
              Manter chave
            </Button>
          </>
        )}
      </div>

      {key.error && (
        <p className="text-xs text-destructive" role="alert">{key.error}</p>
      )}
    </div>
  );
}

export function ApiKeysSection() {
  return (
    <div className="space-y-6">
      <div>
        {/* UI-SPEC: "Chaves de API" as Display (20px, 600) */}
        <h1 className="text-xl font-semibold">Chaves de API</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          As chaves são armazenadas no sistema operacional. Nunca ficam em disco como texto simples.
        </p>
      </div>
      <Separator />
      <div className="space-y-8">
        {PROVIDERS.map((provider, i) => (
          <div key={provider.id}>
            <ApiKeyRow provider={provider} />
            {i < PROVIDERS.length - 1 && <Separator className="mt-8" />}
          </div>
        ))}
      </div>
    </div>
  );
}

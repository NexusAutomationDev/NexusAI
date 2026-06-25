import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';
import { beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  mockIPC((cmd, _payload) => {
    // FOUND-01: returns configured status only — NEVER the raw key
    if (cmd === 'get_api_key_status') return { configured: false };
    if (cmd === 'set_api_key') return null;
    if (cmd === 'delete_api_key') return null;
    // FOUND-06: SQL plugin mock
    if (cmd === 'plugin:sql|load') return 'sqlite:nexusai.db';
    if (cmd === 'plugin:sql|execute') return { rowsAffected: 0 };
    if (cmd === 'plugin:sql|select') return [];
    // FOUND-09 / appearance persistence
    if (cmd === 'plugin:store|set') return null;
    if (cmd === 'plugin:store|get') return null;
    if (cmd === 'plugin:store|load') return {};
    return null;
  });
});

afterEach(() => clearMocks());

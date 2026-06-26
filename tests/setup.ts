import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';
import { beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';

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
    // Phase 2: Real Tauri IPC commands (registered in nexusai-chat Rust crate)
    // NOTE: Do NOT mock get_conversations, get_messages, search_conversations,
    // send_message, delete_conversation, delete_message, edit_message —
    // these are implemented as Drizzle hooks, not IPC commands.
    if (cmd === 'pick_and_encode_file') return {
      filename: 'test.png',
      mimeType: 'image/png',
      base64Data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      fileSizeBytes: 68,
    };
    if (cmd === 'encode_file_from_path') return {
      filename: 'dropped.png',
      mimeType: 'image/png',
      base64Data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      fileSizeBytes: 68,
    };
    if (cmd === 'generate_conversation_title') return { title: 'Test Conversation' };
    if (cmd === 'stop_streaming') return null;
    // stream_chat — Channel-based; cannot be mocked via mockIPC, mock per-test with vi.fn()
    return null;
  });
});

afterEach(() => clearMocks());

export function createMockChannel() {
  const messages: unknown[] = [];
  return {
    onmessage: vi.fn(),
    send: vi.fn((data: unknown) => { messages.push(data); }),
    getMessages: () => messages,
  };
}

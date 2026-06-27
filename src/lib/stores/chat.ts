/**
 * Chat Zustand store — manages streaming state and active conversation.
 * Streaming state = synchronous, reactive (Zustand).
 * Data fetching (conversations, messages) = async with caching (TanStack Query, in queries/chat.ts).
 *
 * IMPORTANT: This store does NOT persist to Tauri Store.
 * All user data is in SQLite (queried via TanStack Query in queries/chat.ts).
 * This store only holds transient UI state (what's streaming, which conversation is active).
 */

import { create } from 'zustand';
import { invoke, Channel } from '@tauri-apps/api/core';
import { useSettingsStore } from '@/lib/stores/settings';

// StreamEvent matches the Rust StreamEvent enum in nexusai-settings
// (Tag + content serde shape: { event: 'token', data: { text: string } })
type StreamEvent =
  | { event: 'token'; data: { text: string } }
  | { event: 'done'; data: Record<string, never> }
  | { event: 'error'; data: { message: string } };

// FileAttachment from Plan 02 pick_and_encode_file command
export interface FileAttachment {
  filename: string;
  mimeType: string;
  base64Data: string;
  fileSizeBytes: number;
}

// ChatMessage sent to stream_chat (full history for D-23)
// attachments uses `| null` (not just optional) to match the Rust Option<Vec<T>>
// serde shape — absent attachments are sent as null, not undefined.
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: FileAttachment[] | null;
}

export interface StreamChatInput {
  conversationId: string;
  messages: ChatMessage[];
  model: string;
}

interface ChatStore {
  // Active conversation
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;

  // Per-message model selection (D-20, D-22)
  currentModel: string;
  setCurrentModel: (model: string) => void;

  // Per-message KB grounding (D-03, D-04 — Plan 03-06).
  // When on, the next send runs hybrid retrieval and injects a citation prompt.
  // Grounding is per-message: a conversation can mix grounded + ungrounded sends.
  kbScope: boolean;
  setKbScope: (on: boolean) => void;

  // Streaming state (D-14, D-26)
  isStreaming: boolean;
  streamingContent: string;           // Accumulated token text during stream
  streamingConversationId: string | null; // Which conversation is currently streaming

  // Pending attachments for next message (D-15, D-16, D-19)
  pendingAttachments: FileAttachment[];
  addAttachment: (file: FileAttachment) => void;
  removeAttachment: (filename: string) => void;
  clearAttachments: () => void;

  // Stream control
  startStream: (input: StreamChatInput, onToken: (text: string) => void, onDone: () => void, onError: (msg: string) => void) => Promise<void>;
  stopStream: () => Promise<void>;

  // File picker (D-15)
  pickFile: () => Promise<FileAttachment | null>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),

  // Default to settings store chatModel (D-22: continuity)
  currentModel: useSettingsStore.getState().chatModel,
  setCurrentModel: (model) => set({ currentModel: model }),

  // KB grounding off by default (opt-in per message, D-03)
  kbScope: false,
  setKbScope: (on) => set({ kbScope: on }),

  isStreaming: false,
  streamingContent: '',
  streamingConversationId: null,

  pendingAttachments: [],
  addAttachment: (file) =>
    set((s) => ({ pendingAttachments: [...s.pendingAttachments, file] })),
  removeAttachment: (filename) =>
    set((s) => ({
      pendingAttachments: s.pendingAttachments.filter((f) => f.filename !== filename),
    })),
  clearAttachments: () => set({ pendingAttachments: [] }),

  startStream: async (input, onToken, onDone, onError) => {
    set({
      isStreaming: true,
      streamingContent: '',
      streamingConversationId: input.conversationId,
    });

    const channel = new Channel<StreamEvent>();
    channel.onmessage = (event) => {
      if (event.event === 'token') {
        const text = event.data.text;
        set((s) => ({ streamingContent: s.streamingContent + text }));
        onToken(text);
      } else if (event.event === 'done') {
        set({ isStreaming: false, streamingContent: '', streamingConversationId: null });
        onDone();
      } else if (event.event === 'error') {
        set({ isStreaming: false, streamingContent: '', streamingConversationId: null });
        onError(event.data.message);
      }
    };

    try {
      await invoke('stream_chat', { input, onEvent: channel });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      set({ isStreaming: false, streamingContent: '', streamingConversationId: null });
      onError(errorMsg);
    }
  },

  stopStream: async () => {
    const { streamingConversationId } = get();
    if (!streamingConversationId) return;
    try {
      await invoke('stop_streaming', { conversationId: streamingConversationId });
    } catch {
      // Ignore stop errors — stream may have already finished
    }
    set({ isStreaming: false, streamingContent: '', streamingConversationId: null });
  },

  pickFile: async () => {
    try {
      const file = await invoke<FileAttachment>('pick_and_encode_file');
      return file;
    } catch (e) {
      if (String(e) === 'Seleção cancelada') return null;
      throw e;
    }
  },
}));

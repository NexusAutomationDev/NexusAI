import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';
import { beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';

// ─── jsdom geometry polyfills (CodeMirror 6 / kb-notes-editor) ────────────────
// CodeMirror 6 measures the DOM via Range/Element getClientRects + getBoundingClientRect,
// which jsdom does not implement (they throw / return undefined). Without realistic geometry
// the editor crashes on measure ("textRange(...).getClientRects is not a function") and its
// click-to-position resolution misfires, so the D-08 no-mutation test cannot type at the caret.
//
// We model a simple monospace layout: ~8px per character, ~16px line height. Text Ranges get a
// rect derived from their character offsets within the parent text node; element rects span
// their text content. This is enough for posAtCoords/coordsAtPos to resolve consistently in the
// headless environment. Additive only — never affects the real Tauri webview at runtime.
const CHAR_W = 8;
const LINE_H = 16;
const makeRect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({
    x: left, y: top, left, top, width, height,
    right: left + width, bottom: top + height,
    toJSON: () => ({}),
  }) as DOMRect;
const rectList = (rects: DOMRect[]): DOMRectList => {
  const list = rects.slice() as unknown as DOMRectList;
  (list as { item?: (i: number) => DOMRect | null }).item = (i: number) => rects[i] ?? null;
  return list;
};
const textLen = (node: Node | null): number =>
  node && node.nodeType === 3 ? (node.textContent?.length ?? 0) : 0;

// Find the index of the enclosing CodeMirror line (.cm-line) so each line gets a distinct
// vertical band. This lets posAtCoords map a y-coordinate to the right line and a click at
// the content centre resolve to a real (non-zero) document position.
const lineIndexOf = (node: Node | null): number => {
  let el: Element | null = node && node.nodeType === 1 ? (node as Element) : node?.parentElement ?? null;
  while (el && !el.classList?.contains('cm-line')) el = el.parentElement;
  if (!el) return 0;
  const siblings = el.parentElement ? Array.from(el.parentElement.children) : [el];
  const idx = siblings.indexOf(el);
  return idx < 0 ? 0 : idx;
};

if (typeof Range !== 'undefined') {
  Range.prototype.getBoundingClientRect = function (this: Range) {
    const start = this.startOffset;
    const end = this.endContainer === this.startContainer ? this.endOffset : textLen(this.startContainer);
    const left = start * CHAR_W;
    const width = Math.max(1, (end - start) * CHAR_W);
    const top = lineIndexOf(this.startContainer) * LINE_H;
    return makeRect(left, top, width, LINE_H);
  };
  Range.prototype.getClientRects = function (this: Range) {
    return rectList([this.getBoundingClientRect()]);
  };
}
if (typeof Element !== 'undefined') {
  Element.prototype.getClientRects = function (this: Element) {
    const len = this.textContent?.length ?? 0;
    const top = this.classList?.contains('cm-line') ? lineIndexOf(this) * LINE_H : 0;
    return rectList([makeRect(0, top, Math.max(1, len * CHAR_W), LINE_H)]);
  };
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const len = this.textContent?.length ?? 0;
    if (this.classList?.contains('cm-content')) {
      // userEvent clicks at the vertical centre of this rect. Anchor the rect so its centre
      // lands on the LAST line — a notes editor opens ready to "continue writing" at the end,
      // and this keeps the no-mutation test's plain click deterministic. center = top+height/2
      // = lastLineIndex*LINE_H + LINE_H/2  ⇒  with top=0, height = (2*lastIndex+1)*LINE_H.
      const lineCount = Math.max(1, this.querySelectorAll('.cm-line').length);
      const lastIndex = lineCount - 1;
      const height = (2 * lastIndex + 1) * LINE_H;
      return makeRect(0, 0, Math.max(1, len * CHAR_W), height);
    }
    const top = this.classList?.contains('cm-line') ? lineIndexOf(this) * LINE_H : 0;
    return makeRect(0, top, Math.max(1, len * CHAR_W), LINE_H);
  };
}

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

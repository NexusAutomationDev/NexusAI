import { describe, it, expect } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

// pick_and_encode_file and encode_file_from_path ARE real Tauri commands
// registered in the nexusai-chat Rust crate. Testing them via mockIPC is correct.
describe('CHAT-04: File attachments', () => {
  it('pick_and_encode_file returns FileAttachment with base64Data', async () => {
    const result = await invoke<{ filename: string; mimeType: string; base64Data: string; fileSizeBytes: number }>('pick_and_encode_file');
    expect(result).toHaveProperty('filename');
    expect(result).toHaveProperty('mimeType');
    expect(result).toHaveProperty('base64Data');
    expect(result).toHaveProperty('fileSizeBytes');
    expect(typeof result.base64Data).toBe('string');
    expect(result.base64Data.length).toBeGreaterThan(0);
  });

  it('pick_and_encode_file base64Data is valid base64 string', async () => {
    const result = await invoke<{ base64Data: string }>('pick_and_encode_file');
    expect(result.base64Data).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('encode_file_from_path returns FileAttachment (drag-drop path encoding)', async () => {
    const result = await invoke<{ filename: string; mimeType: string; base64Data: string }>('encode_file_from_path', { path: '/tmp/test.png' });
    expect(result).toHaveProperty('filename');
    expect(result).toHaveProperty('mimeType');
    expect(result).toHaveProperty('base64Data');
    expect(result.base64Data.length).toBeGreaterThan(0);
  });

  it('pick_and_encode_file returns fileSizeBytes as a positive number', async () => {
    const result = await invoke<{ fileSizeBytes: number }>('pick_and_encode_file');
    expect(typeof result.fileSizeBytes).toBe('number');
    expect(result.fileSizeBytes).toBeGreaterThan(0);
  });
});

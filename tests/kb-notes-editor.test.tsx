import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// RED (Wave 0): this import FAILS until Plan 03-05 creates NoteEditor (D-07/D-08).
// Do NOT comment it out — the module-not-found is the RED state.
import { NoteEditor } from '@/routes/kb/-components/NoteEditor';

describe('03-00 — KB NoteEditor no-mutation invariant (D-08)', () => {
  it('renders given a markdown value', () => {
    const { container } = render(
      <NoteEditor value={'# Título\n\nconteúdo'} onChange={() => {}} />
    );
    expect(container.querySelector('.cm-editor, textarea, [contenteditable]')).toBeTruthy();
  });

  it('D-08: emits the EXACT raw markdown unchanged (no trim, no blank-line collapse)', async () => {
    const user = userEvent.setup();
    // Intentional non-normalized whitespace + blank lines.
    const input = '# Título  \n\n\n- item';
    const onChange = vi.fn();

    const { container } = render(<NoteEditor value={input} onChange={onChange} />);

    // Trigger an edit so the callback fires (appends a space).
    const editable = container.querySelector(
      '.cm-content, textarea, [contenteditable]'
    ) as HTMLElement;
    await user.click(editable);
    await user.type(editable, ' ');

    // The editor must surface the raw string exactly — no normalization.
    // Assert the original markdown is preserved verbatim as a prefix of the emitted value.
    const lastCall = onChange.mock.calls.at(-1);
    const emitted = lastCall?.[0] as string;
    expect(emitted.startsWith(input)).toBe(true);
    // And explicitly: the exact untouched input round-trips with no mutation.
    expect(emitted).toBe(input + ' ');
  });
});

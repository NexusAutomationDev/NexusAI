import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// This import FAILS (module not found) until Plan 05 creates MarkdownRenderer.
// That failure is the RED state for this test file — do NOT comment it out.
import { MarkdownRenderer } from '@/routes/chat/components/MarkdownRenderer';

describe('CHAT-05: Markdown rendering with syntax highlighting', () => {
  it('MarkdownRenderer renders bold text as <strong>', () => {
    const { container } = render(<MarkdownRenderer content="**bold text**" />);
    expect(container.querySelector('strong')).toBeTruthy();
  });

  it('MarkdownRenderer renders code block with <pre> and <code>', () => {
    const { container } = render(
      <MarkdownRenderer content={"```typescript\nconst x = 1;\n```"} />
    );
    expect(container.querySelector('pre')).toBeTruthy();
    expect(container.querySelector('code')).toBeTruthy();
  });

  it('Code block copy button is present inside code block wrapper', () => {
    const { container } = render(
      <MarkdownRenderer content={"```typescript\nconst x = 1;\n```"} />
    );
    // Per D-11: copy button in the .group wrapper around each code block
    const copyButton = container.querySelector('button');
    expect(copyButton).toBeTruthy();
  });

  it('Code block copy button changes label after click (D-11)', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MarkdownRenderer content={"```typescript\nconst x = 1;\n```"} />
    );
    const button = container.querySelector('button');
    expect(button).toBeTruthy();
    // Before click: button shows copy label
    await user.click(button!);
    // After click: button shows "Copiado!" for 2s per UI-SPEC
    expect(button!.textContent).toMatch(/copiado/i);
  });
});

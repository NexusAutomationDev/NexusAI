import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// RED (Wave 0): this import FAILS until Plan 03-04 creates ItemsTable (D-09/D-10).
// Do NOT comment it out — the module-not-found is the RED state.
import { ItemsTable } from '@/routes/kb/-components/ItemsTable';

const items = [
  { id: '1', kind: 'file', title: 'contrato.pdf', status: 'indexed' },
  { id: '2', kind: 'note', title: 'Reunião 12/05', status: 'indexing' },
  { id: '3', kind: 'url', title: 'artigo.com', status: 'failed' },
];

describe('03-00 — KB ItemsTable faceted filter (D-09/D-10)', () => {
  it('renders a table given a list of items', () => {
    render(<ItemsTable items={items} />);
    expect(screen.getByText('contrato.pdf')).toBeTruthy();
    expect(screen.getByText('Reunião 12/05')).toBeTruthy();
    expect(screen.getByText('artigo.com')).toBeTruthy();
  });

  it('status facet filter "failed" narrows visible rows to failed items only', async () => {
    const user = userEvent.setup();
    render(<ItemsTable items={items} />);

    // Apply the 'failed' status facet (button/checkbox labelled with the status).
    const failedFacet = screen.getByRole('button', { name: /failed|falhou|falha/i });
    await user.click(failedFacet);

    expect(screen.getByText('artigo.com')).toBeTruthy();
    expect(screen.queryByText('contrato.pdf')).toBeNull();
    expect(screen.queryByText('Reunião 12/05')).toBeNull();
  });

  it('empty filtered result renders the PT-BR empty copy', () => {
    render(<ItemsTable items={[]} />);
    expect(
      screen.getByText('Nenhum item encontrado para esse filtro.')
    ).toBeTruthy();
  });
});

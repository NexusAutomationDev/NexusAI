import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ModuleStub } from '../src/components/layout/ModuleStub';

describe('FOUND-04 — module stub routes', () => {
  it('ModuleStub renders module name', () => {
    render(<ModuleStub moduleName="Chat" />);
    expect(screen.getByText('Chat')).toBeTruthy();
  });

  it('ModuleStub renders "Em breve" text', () => {
    render(<ModuleStub moduleName="Gmail" />);
    expect(screen.getByText('Em breve')).toBeTruthy();
  });

  it('ModuleStub renders without throwing for all module names', () => {
    const modules = ['Chat', 'Base de Conhecimento', 'Gmail', 'Calendário', 'MCPs', 'Agentes'];
    modules.forEach((name) => {
      expect(() => render(<ModuleStub moduleName={name} />)).not.toThrow();
    });
  });
});

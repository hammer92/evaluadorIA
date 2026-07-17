// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { beforeAll, describe, expect, it } from 'vitest';

import { ThemeProvider } from './theme-provider';

describe('ThemeProvider', () => {
  beforeAll(() => {
    if (typeof window !== 'undefined' && !window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        }),
      });
    }
  });

  it('renderiza children passthrough', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light">
        <div data-testid="child">contenido</div>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('child').textContent).toBe('contenido');
  });

  it('acepta y forwardea props de next-themes (attribute + defaultTheme)', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <span data-testid="t" />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('t')).toBeTruthy();
  });
});

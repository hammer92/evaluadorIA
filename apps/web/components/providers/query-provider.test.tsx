// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { QueryProvider } from './query-provider';

describe('QueryProvider', () => {
  it('renderiza los children dentro del QueryClientProvider', () => {
    render(
      <QueryProvider>
        <div data-testid="child">hello</div>
      </QueryProvider>,
    );
    const child = screen.getByTestId('child');
    expect(child.textContent).toBe('hello');
    expect(child).toBeTruthy();
  });

  it('provee un QueryClient estable entre renders (no recrea en cada mount)', () => {
    const { rerender } = render(
      <QueryProvider>
        <span data-testid="first" />
      </QueryProvider>,
    );
    expect(screen.getByTestId('first')).toBeTruthy();
    rerender(
      <QueryProvider>
        <span data-testid="second" />
      </QueryProvider>,
    );
    expect(screen.getByTestId('second')).toBeTruthy();
    expect(screen.queryByTestId('first')).toBeNull();
  });
});

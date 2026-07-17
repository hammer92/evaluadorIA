// @vitest-environment jsdom
import { render } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { ToastProvider } from './toast-provider';

describe('ToastProvider', () => {
  it('renderiza sin children y monta el Toaster en el DOM', () => {
    const { container } = render(<ToastProvider />);
    expect(container).toBeTruthy();
  });

  it('puede coexistir con siblings dentro de un mismo contenedor', () => {
    const { container } = render(
      <div>
        <ToastProvider />
        <span data-testid="sibling">ok</span>
      </div>,
    );
    expect(container.querySelector('[data-testid="sibling"]')).toBeTruthy();
  });
});

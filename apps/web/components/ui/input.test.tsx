// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Input } from './input';

describe('Input (forwardRef support)', () => {
  it('forwards ref to the underlying <input> element', () => {
    const ref = vi.fn();
    render(<Input ref={ref} data-testid="x" />);
    // ref is called with the actual <input> DOM element
    expect(ref).toHaveBeenCalledTimes(1);
    const arg = ref.mock.calls[0]?.[0];
    expect(arg).toBeInstanceOf(HTMLInputElement);
  });

  it('spreads additional props (name, onChange)', () => {
    const onChange = vi.fn();
    render(
      <Input
        ref={undefined}
        data-testid="x"
        name="email"
        onChange={onChange}
        placeholder="tu@email.com"
      />,
    );
    const el = screen.getByTestId('x');
    expect(el.getAttribute('name')).toBe('email');
    expect(el.getAttribute('placeholder')).toBe('tu@email.com');
  });
});

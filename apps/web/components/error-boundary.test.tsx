// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './error-boundary';

function ThrowingChild({ message = 'boom' }: { message?: string }): React.JSX.Element {
  throw new Error(message);
}

function SafeChild(): React.JSX.Element {
  return <span data-testid="safe">rendered</span>;
}

describe('ErrorBoundary', () => {
  it('renderiza children cuando no hay error', () => {
    render(
      <ErrorBoundary>
        <SafeChild />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('safe')).toBeTruthy();
  });

  it('muestra el fallback por defecto cuando un child tira', () => {
    // Silenciar console.error del boundary en este test (es esperable).
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <ThrowingChild message="falló el fetch" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Algo salió mal')).toBeTruthy();
    expect(screen.getByText('falló el fetch')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    consoleErrorSpy.mockRestore();
  });

  it('loggea vía console.error con prefijo [ErrorBoundary] cuando un child tira', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <ThrowingChild message="logged" />
      </ErrorBoundary>,
    );
    const sawBoundaryLog = consoleErrorSpy.mock.calls.some((call) =>
      String(call[0] ?? '').includes('[ErrorBoundary]'),
    );
    expect(sawBoundaryLog).toBe(true);
    consoleErrorSpy.mockRestore();
  });

  it('usa el fallback custom cuando se pasa por prop', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const customFallback = (props: {
      error: Error;
      resetErrorBoundary: () => void;
    }): React.JSX.Element => (
      <div data-testid="custom-fallback">
        <span>custom error: {props.error.message}</span>
        <button onClick={props.resetErrorBoundary}>retry</button>
      </div>
    );

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingChild message="custom path" />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('custom-fallback')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('custom error: custom path')).toBeTruthy();
    consoleErrorSpy.mockRestore();
  });

  it('resetErrorBoundary vuelve a montar los children sin error', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let shouldThrow = true;

    function Conditional(): React.JSX.Element {
      if (shouldThrow) {
        throw new Error('condicional');
      }
      return <span data-testid="recovered">recovered</span>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <Conditional />
      </ErrorBoundary>,
    );

    expect(screen.queryByTestId('recovered')).toBeNull();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    // react-error-boundary reset cambia su estado interno; forzar rerender del parent
    // para que el child re-evalúe la closure sobre `shouldThrow`.
    rerender(
      <ErrorBoundary>
        <Conditional />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('recovered')).toBeTruthy();
    consoleErrorSpy.mockRestore();
  });
});

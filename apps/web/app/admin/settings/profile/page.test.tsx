// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ProfileSettingsPage from './page';

describe('/admin/settings/profile', () => {
  it('renderiza heading "Mi perfil"', () => {
    render(<ProfileSettingsPage />);
    expect(screen.getByRole('heading', { name: /mi perfil/i, level: 1 })).toBeInTheDocument();
  });

  it('renderiza form con input displayName y botón Guardar', () => {
    render(<ProfileSettingsPage />);
    expect(screen.getByLabelText(/nombre visible/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();
  });

  it('botón Guardar está deshabilitado cuando form es pristine (no dirty)', () => {
    render(<ProfileSettingsPage />);
    const submit = screen.getByRole('button', { name: /guardar cambios/i });
    expect(submit).toBeDisabled();
  });
});

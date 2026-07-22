// @vitest-environment jsdom
import type { Role } from '@shared/schemas/common';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { RoleGuard } from './role-guard';
import { RoleProvider } from './role-provider';

function renderWithRole(role: Role | null, ui: ReactNode) {
  return render(role === null ? <>{ui}</> : <RoleProvider role={role}>{ui}</RoleProvider>);
}

describe('RoleGuard', () => {
  it('renderiza children si el role está permitido', () => {
    renderWithRole(
      'admin',
      <RoleGuard roles={['admin']}>
        <button>Solo admin</button>
      </RoleGuard>,
    );
    expect(screen.getByRole('button', { name: /solo admin/i })).toBeInTheDocument();
  });

  it('NO renderiza children si el role NO está permitido', () => {
    renderWithRole(
      'recruiter',
      <RoleGuard roles={['admin']}>
        <button>Solo admin</button>
      </RoleGuard>,
    );
    expect(screen.queryByRole('button', { name: /solo admin/i })).not.toBeInTheDocument();
  });

  it('renderiza fallback cuando role NO permitido', () => {
    renderWithRole(
      'recruiter',
      <RoleGuard roles={['admin']} fallback={<p>No autorizado</p>}>
        <button>Solo admin</button>
      </RoleGuard>,
    );
    expect(screen.getByText(/no autorizado/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /solo admin/i })).not.toBeInTheDocument();
  });

  it('NO renderiza children cuando role es null (sin RoleProvider)', () => {
    renderWithRole(
      null,
      <RoleGuard roles={['admin']}>
        <button>Solo admin</button>
      </RoleGuard>,
    );
    expect(screen.queryByRole('button', { name: /solo admin/i })).not.toBeInTheDocument();
  });

  it('acepta múltiples roles permitidos', () => {
    renderWithRole(
      'recruiter',
      <RoleGuard roles={['admin', 'recruiter']}>
        <span>Visible</span>
      </RoleGuard>,
    );
    expect(screen.getByText(/visible/i)).toBeInTheDocument();
  });
});

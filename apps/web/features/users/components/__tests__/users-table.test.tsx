// @vitest-environment jsdom
import type { User } from '@shared/schemas/users';
import { render, screen, within } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { UsersTable } from '../users-table';

const baseUser: User = {
  uid: 'u_1',
  email: 'alice@example.com',
  displayName: 'Alice',
  photoURL: null,
  role: 'recruiter',
  organizationId: 'org_1',
  status: 'active',
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: 'admin',
  deletedAt: null,
};

const users: User[] = [
  baseUser,
  {
    ...baseUser,
    uid: 'u_2',
    email: 'bob@example.com',
    displayName: 'Bob',
    role: 'expert',
    status: 'invited',
  },
];

describe('UsersTable — role-based actions gating', () => {
  it('admin (canEdit+canDelete): muestra columna Acciones con Editar y Eliminar', () => {
    render(
      <UsersTable
        users={users}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        canEdit={true}
        canDelete={true}
      />,
    );

    // Headers: Email, Rol, Estado, Acciones
    expect(screen.getByRole('columnheader', { name: /Email/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Rol/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Estado/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Acciones/i })).toBeInTheDocument();

    // Filas con datos
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();

    // Botones de acción por fila (2 filas × 2 botones = 4)
    expect(screen.getAllByRole('button', { name: /Editar/i })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /Eliminar/i })).toHaveLength(2);

    // Botón "Nuevo usuario" no es parte de esta tabla (sí de page.tsx), así
    // que solo verificamos que NO aparece "Nuevo" aquí.
    expect(screen.queryByRole('button', { name: /Nuevo/i })).not.toBeInTheDocument();
  });

  it('recruiter (canEdit=false, canDelete=false): SOLO lista sin columna Acciones', () => {
    render(
      <UsersTable
        users={users}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        canEdit={false}
        canDelete={false}
      />,
    );

    // Headers: Email, Rol, Estado. NO Acciones.
    expect(screen.getByRole('columnheader', { name: /Email/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Rol/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Estado/i })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Acciones/i })).not.toBeInTheDocument();

    // Filas con datos
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();

    // Sin botones de acción
    expect(screen.queryByRole('button', { name: /Editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Eliminar/i })).not.toBeInTheDocument();
  });

  it('expert (canEdit=false, canDelete=false): SOLO lista sin columna Acciones', () => {
    render(
      <UsersTable
        users={users}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        canEdit={false}
        canDelete={false}
      />,
    );

    expect(screen.queryByRole('columnheader', { name: /Acciones/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Eliminar/i })).not.toBeInTheDocument();
  });

  it('expert con solo canEdit=true: muestra Acciones + Editar pero NO Eliminar', () => {
    render(
      <UsersTable
        users={users}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        canEdit={true}
        canDelete={false}
      />,
    );

    expect(screen.getByRole('columnheader', { name: /Acciones/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Editar/i })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Eliminar/i })).not.toBeInTheDocument();
  });

  it('expert con solo canDelete=true: muestra Acciones + Eliminar pero NO Editar', () => {
    render(
      <UsersTable
        users={users}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        canEdit={false}
        canDelete={true}
      />,
    );

    expect(screen.getByRole('columnheader', { name: /Acciones/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Eliminar/i })).toHaveLength(2);
  });

  it('tabla vacía con canEdit=false: muestra empty state sin Acciones', () => {
    render(
      <UsersTable
        users={[]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        canEdit={false}
        canDelete={false}
      />,
    );

    expect(screen.getByText(/No hay usuarios para los filtros seleccionados/i)).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Acciones/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/i })).not.toBeInTheDocument();
  });

  it('click en Editar invoca onEdit con el user correcto', () => {
    const onEdit = vi.fn();
    render(
      <UsersTable
        users={users}
        onEdit={onEdit}
        onDelete={vi.fn()}
        canEdit={true}
        canDelete={false}
      />,
    );

    const editButtons = screen.getAllByRole('button', { name: /Editar/i });
    editButtons[0]!.click();
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ email: 'alice@example.com' }));
  });

  it('click en Eliminar invoca onDelete con el user correcto', () => {
    const onDelete = vi.fn();
    render(
      <UsersTable
        users={users}
        onEdit={vi.fn()}
        onDelete={onDelete}
        canEdit={false}
        canDelete={true}
      />,
    );

    const deleteButtons = screen.getAllByRole('button', { name: /Eliminar/i });
    deleteButtons[1]!.click();
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ email: 'bob@example.com' }));
  });

  it('columnas de la primera fila (recruiter sin acciones): 3 celdas (sin Acciones)', () => {
    render(
      <UsersTable
        users={users}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        canEdit={false}
        canDelete={false}
      />,
    );

    const rows = screen.getAllByRole('row');
    // Header row + 2 data rows = 3 filas totales
    expect(rows.length).toBeGreaterThanOrEqual(3);

    // Primera fila de datos: email, rol, estado. Sin celda de acciones.
    const firstDataRow = rows[1]!;
    const cells = within(firstDataRow).getAllByRole('cell');
    expect(cells).toHaveLength(3);
    expect(within(firstDataRow).queryByRole('button')).not.toBeInTheDocument();
  });
});

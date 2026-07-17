// @vitest-environment jsdom
import type { User } from '@shared/schemas/users';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import * as React from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import UsersPage from '../page';

import { RoleProvider } from '@/features/auth/components/role-provider';

// Mocks de los hooks y APIs que la page usa.
const { listUsersMock, useUsersListMock, useCreateUserMock, useUpdateUserMock, useDeleteUserMock } =
  vi.hoisted(() => ({
    listUsersMock: vi.fn(),
    useUsersListMock: vi.fn(),
    useCreateUserMock: vi.fn(),
    useUpdateUserMock: vi.fn(),
    useDeleteUserMock: vi.fn(),
  }));

vi.mock('@/features/users/hooks/use-users-list', () => ({
  useUsersList: (...args: unknown[]) => useUsersListMock(...args),
}));

vi.mock('@/features/users/hooks/use-create-user', () => ({
  useCreateUser: () => useCreateUserMock(),
}));

vi.mock('@/features/users/hooks/use-update-user', () => ({
  useUpdateUser: () => useUpdateUserMock(),
}));

vi.mock('@/features/users/hooks/use-delete-user', () => ({
  useDeleteUser: () => useDeleteUserMock(),
}));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const baseUser: User = {
  uid: 'u_admin',
  email: 'admin@empresa.com',
  displayName: 'empresa',
  photoURL: null,
  role: 'admin',
  organizationId: 'org_1',
  status: 'active',
  lastLoginAt: new Date('2026-01-01T00:00:00Z'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: 'system',
  deletedAt: null,
};

const users: User[] = [baseUser];

beforeEach(() => {
  listUsersMock.mockReset();
  useUsersListMock.mockReset();
  useCreateUserMock.mockReset();
  useUpdateUserMock.mockReset();
  useDeleteUserMock.mockReset();

  useUsersListMock.mockReturnValue({
    data: { items: users, page: 1, pageSize: 20, total: 1, hasMore: false },
    isLoading: false,
    isError: false,
    error: null,
  });
  useCreateUserMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  useUpdateUserMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  useDeleteUserMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderWithRole(role: 'admin' | 'recruiter' | 'expert') {
  const Wrapper = makeWrapper();
  return render(
    <Wrapper>
      <RoleProvider role={role}>
        <UsersPage />
      </RoleProvider>
    </Wrapper>,
  );
}

describe('UsersPage — role-based UI gating (RoleProvider como source of truth)', () => {
  it('admin: muestra botón "Nuevo usuario" + columna Acciones + Editar/Eliminar', () => {
    renderWithRole('admin');

    expect(screen.getByRole('button', { name: /Nuevo usuario/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Acciones/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Editar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Eliminar/i })).toBeInTheDocument();
  });

  it('recruiter: NO muestra "Nuevo usuario" + NO columna Acciones', () => {
    renderWithRole('recruiter');

    expect(screen.queryByRole('button', { name: /Nuevo usuario/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Acciones/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Eliminar/i })).not.toBeInTheDocument();
  });

  it('expert: NO muestra "Nuevo usuario" + NO columna Acciones', () => {
    renderWithRole('expert');

    expect(screen.queryByRole('button', { name: /Nuevo usuario/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Acciones/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Eliminar/i })).not.toBeInTheDocument();
  });

  it('admin ve Email, Rol, Estado Y Acciones (4 columnas)', () => {
    renderWithRole('admin');

    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(4);
    expect(within(headers[0]!).getByText(/Email/i)).toBeInTheDocument();
    expect(within(headers[1]!).getByText(/Rol/i)).toBeInTheDocument();
    expect(within(headers[2]!).getByText(/Estado/i)).toBeInTheDocument();
    expect(within(headers[3]!).getByText(/Acciones/i)).toBeInTheDocument();
  });

  it('recruiter ve SOLO Email, Rol, Estado (3 columnas, sin Acciones)', () => {
    renderWithRole('recruiter');

    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(3);
    expect(within(headers[0]!).getByText(/Email/i)).toBeInTheDocument();
    expect(within(headers[1]!).getByText(/Rol/i)).toBeInTheDocument();
    expect(within(headers[2]!).getByText(/Estado/i)).toBeInTheDocument();
  });

  it('admin: la fila del usuario tiene 4 celdas (incluye Acciones)', () => {
    renderWithRole('admin');

    const rows = screen.getAllByRole('row');
    // header + 1 data row = 2 rows
    const dataRow = rows[1]!;
    const cells = within(dataRow).getAllByRole('cell');
    expect(cells).toHaveLength(4);
    expect(within(dataRow).getByRole('button', { name: /Editar/i })).toBeInTheDocument();
    expect(within(dataRow).getByRole('button', { name: /Eliminar/i })).toBeInTheDocument();
  });

  it('recruiter: la fila del usuario tiene 3 celdas (sin Acciones)', () => {
    renderWithRole('recruiter');

    const rows = screen.getAllByRole('row');
    const dataRow = rows[1]!;
    const cells = within(dataRow).getAllByRole('cell');
    expect(cells).toHaveLength(3);
    expect(within(dataRow).queryByRole('button')).not.toBeInTheDocument();
  });

  it('datos del usuario (email, role, status) SIEMPRE se muestran independientemente del rol', () => {
    renderWithRole('recruiter');

    expect(screen.getByText('admin@empresa.com')).toBeInTheDocument();
    // displayName se renderiza como subtexto bajo el email
    expect(screen.getByText('empresa')).toBeInTheDocument();
    // RoleBadge "Admin"
    expect(screen.getByText('Admin')).toBeInTheDocument();
    // StatusBadge "Activo"
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });
});

'use client';

import type { User } from '@shared/schemas/users';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { DeleteUserDialog } from '@/features/users/components/delete-user-dialog';
import { UsersFilters } from '@/features/users/components/user-filters';
import { UserFormModal } from '@/features/users/components/user-form-modal';
import { UsersTable } from '@/features/users/components/users-table';
import { useUsersList } from '@/features/users/hooks/use-users-list';
import { defaultFilters, type UserFilters } from '@/features/users/schemas';

export default function UsersPage() {
  const [filters, setFilters] = useState<UserFilters>(defaultFilters);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);

  const { data, isLoading, isError, error } = useUsersList(filters);
  const { claims } = useAuth();
  const role = claims?.role;
  const canEdit = role === 'admin';
  const canDelete = role === 'admin';

  const onPageChange = (page: number) => setFilters((f) => ({ ...f, page }));
  const pageStart = ((data?.page ?? 1) - 1) * (data?.pageSize ?? 20);

  return (
    <div className="space-y-stack-lg">
      <header className="flex flex-wrap items-end justify-between gap-stack-md">
        <div className="space-y-stack-sm">
          <p className="text-label-sm text-outline-tv">ADMINISTRACIÓN</p>
          <h1 className="font-hanken text-display-lg text-on-surface">Usuarios</h1>
          <p className="text-body-lg text-on-surface-variant">
            Gestioná los miembros de tu organización.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo usuario
          </Button>
        )}
      </header>

      <UsersFilters value={filters} onChange={setFilters} />

      {isLoading && (
        <div className="space-y-stack-sm rounded-tv border border-border-standard bg-white p-stack-md shadow-tv-card">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 bg-surface-subtle" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-tv border border-status-error/30 bg-status-error/5 p-stack-md text-body-md text-status-error">
          Error cargando usuarios: {error?.message}
        </div>
      )}

      {data && (
        <>
          <UsersTable
            users={data.items}
            onEdit={(u) => setEditing(u)}
            onDelete={(u) => setDeleting(u)}
            canEdit={canEdit}
            canDelete={canDelete}
          />
          <div className="flex items-center justify-between text-body-md text-on-surface-variant">
            <span>
              Mostrando {data.items.length === 0 ? 0 : pageStart + 1}–
              {pageStart + data.items.length} de {data.total}
            </span>
            <div className="flex gap-stack-sm">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.max(1, (data.page ?? 1) - 1))}
                disabled={(data.page ?? 1) <= 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange((data.page ?? 1) + 1)}
                disabled={!data.hasMore}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}

      <UserFormModal open={createOpen} onOpenChange={setCreateOpen} mode="create" />
      <UserFormModal
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        mode="edit"
        user={editing ?? undefined}
      />
      <DeleteUserDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        user={deleting}
      />
    </div>
  );
}

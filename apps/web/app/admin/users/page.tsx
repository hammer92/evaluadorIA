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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Usuarios</h1>
          <p className="text-muted-foreground text-sm">Gestioná los miembros de tu organización.</p>
        </div>
        {canEdit && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo
          </Button>
        )}
      </div>

      <UsersFilters value={filters} onChange={setFilters} />

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive">Error cargando usuarios: {error?.message}</p>
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
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Mostrando {data.items.length === 0 ? 0 : pageStart + 1}–
              {pageStart + data.items.length} de {data.total}
            </span>
            <div className="flex gap-2">
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

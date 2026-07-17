# SDD-07: Admin UI (Dashboard, Users, Settings)

> **Estado:** Draft
> **Owner:** Solution Architect
> **Sprint objetivo:** Sprint 3 (semanas 7-8)
> **Depende de:** SDD-04, SDD-05, SDD-06
> **Bloquea a:** —

---

## 1. Contexto

Con auth, repositorios y Cloud Functions listos, este SDD arma las pantallas que el usuario final ve. El shell (sidebar, header, theme, providers) ya está en SDD-02. Acá agregamos contenido: dashboard con métricas, gestión de usuarios (tabla, filtros, paginación, modal de create/edit), settings con tabs, sistema de notificaciones y páginas de error.

Todo consume repositorios vía services y Cloud Functions vía `httpsCallable`. Cero acceso directo a Firebase desde componentes.

## 2. Goals y Non-Goals

### Goals

- `/admin` dashboard con 4 stats cards (total users, active, invited, suspended) + recent activity.
- `/admin/users` con tabla (TanStack Table), filtros (status, role, search), paginación.
- Modal de crear usuario con validación (React Hook Form + Zod).
- Modal de editar usuario.
- Botón de soft delete con confirmación.
- `/admin/settings` con 3 tabs: Profile (displayName, photoURL), Team (lista resumida), Billing (placeholder).
- Notificaciones vía `sonner` (success/error).
- Loading states (skeleton) y error boundaries.
- Página 404 + 500 personalizadas.
- Dark mode funcional en todas las páginas.

### Non-Goals

- Data table con ordenamiento por múltiples columnas (solo una columna por vez).
- Bulk operations (selección múltiple + acciones en masa). No en MVP.
- Export CSV desde la UI (botón placeholder; el export real es `v1_reports_generate`).
- Avatar upload UI (campo URL por ahora, upload a Storage en SDD futuro).
- Audit log expert (otro SDD).
- Real-time updates (`onSnapshot` no en MVP).

## 3. Decisiones de arquitectura

| #   | Decisión                                           | Justificación                                                                                                                           |
| --- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | TanStack Table v8 para `/users`                    | Headless, composable, accesible.                                                                                                        |
| 2   | React Hook Form + Zod (resolvers) en modales       | Mismas schemas que Cloud Functions (DRY).                                                                                               |
| 3   | TanStack Query para data fetching                  | Cache, invalidación, refetch declarativos.                                                                                              |
| 4   | Skeletons (no spinners) para loading               | Mejor UX percibida.                                                                                                                     |
| 5   | Confirmaciones con `<Dialog>` (Radix)              | Accesible, customizable.                                                                                                                |
| 6   | Cloud Functions vía `httpsCallable` desde features | No se llama Firebase directamente.                                                                                                      |
| 7   | UI muestra capabilities por rol (no jerarquía)     | El usuario ve qué puede hacer, no su nivel abstracto. Ver [ADR-0006](../01-architecture/decisions/0006-role-naming-and-permissions.md). |

## 4. Spec detallada

### 4.1 Estructura de archivos a crear

```
apps/web/
├── features/
│   ├── dashboard/
│   │   ├── components/
│   │   │   ├── stats-card.tsx
│   │   │   ├── recent-activity.tsx
│   │   │   └── activity-item.tsx
│   │   ├── hooks/
│   │   │   └── use-dashboard-stats.ts
│   │   ├── api/
│   │   │   └── dashboard-api.ts        # usa repos + functions
│   │   └── schemas.ts
│   ├── users/
│   │   ├── components/
│   │   │   ├── users-table.tsx
│   │   │   ├── user-form-modal.tsx
│   │   │   ├── delete-user-dialog.tsx
│   │   │   ├── user-filters.tsx
│   │   │   ├── role-badge.tsx
│   │   │   └── status-badge.tsx
│   │   ├── hooks/
│   │   │   ├── use-users-list.ts
│   │   │   ├── use-create-user.ts
│   │   │   ├── use-update-user.ts
│   │   │   └── use-delete-user.ts
│   │   ├── api/
│   │   │   └── users-api.ts
│   │   └── schemas.ts                  # filtros, validación
│   └── settings/
│       ├── components/
│       │   ├── profile-form.tsx
│       │   ├── team-list.tsx
│       │   └── billing-card.tsx
│       └── hooks/
│           └── use-update-profile.ts
├── app/admin/
│   ├── page.tsx                        # dashboard
│   ├── users/
│   │   ├── page.tsx
│   │   └── error.tsx
│   ├── settings/
│   │   ├── page.tsx                    # tabs layout
│   │   ├── profile/page.tsx
│   │   ├── team/page.tsx
│   │   └── billing/page.tsx
│   ├── loading.tsx
│   └── error.tsx                       # ya existe en root
└── components/
    └── ui/                             # shadcn additions: dialog, tabs, badge, skeleton, table, select
```

### 4.2 Componentes shadcn adicionales a instalar

```bash
cd apps/web
pnpm dlx shadcn@latest add dialog tabs badge skeleton table select sheet textarea
```

### 4.3 Stats Card (dashboard)

```tsx
// apps/web/features/dashboard/components/stats-card.tsx
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

export function StatsCard({
  label,
  value,
  icon: Icon,
  trend,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  trend?: { value: number; label: string };
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold">{value}</p>
          {trend && (
            <p className="text-xs text-muted-foreground mt-1">
              {trend.value > 0 ? '+' : ''}
              {trend.value} {trend.label}
            </p>
          )}
        </div>
        <Icon className="h-8 w-8 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}
```

### 4.4 `useDashboardStats`

```ts
// apps/web/features/dashboard/hooks/use-dashboard-stats.ts
import { useQuery } from '@tanstack/react-query';
import { getUsersStats } from '../api/dashboard-api';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: getUsersStats,
    staleTime: 30_000,
  });
}
```

```ts
// apps/web/features/dashboard/api/dashboard-api.ts
import { getUserRepository } from '@/repositories';
import { verifyAuth } from '@/services/auth-service';
import { requireAuth } from '@/services/auth-service';
import 'server-only'; // si se usa en RSC

export async function getUsersStats() {
  const ctx = await requireAuth();
  const repo = getUserRepository();
  const [active, invited, suspended] = await Promise.all([
    repo.list({ status: 'active', page: 1, pageSize: 1 }, ctx),
    repo.list({ status: 'invited', page: 1, pageSize: 1 }, ctx),
    repo.list({ status: 'suspended', page: 1, pageSize: 1 }, ctx),
  ]);
  return {
    total: active.total + invited.total + suspended.total,
    active: active.total,
    invited: invited.total,
    suspended: suspended.total,
  };
}
```

### 4.5 `/admin` dashboard page

```tsx
// apps/web/app/admin/page.tsx
import { Users, UserCheck, UserPlus, UserX } from 'lucide-react';
import { StatsCard } from '@/features/dashboard/components/stats-card';
import { RecentActivity } from '@/features/dashboard/components/recent-activity';
import { getUsersStats } from '@/features/dashboard/api/dashboard-api';
import { getRecentAuditLogs } from '@/features/dashboard/api/dashboard-api';

export default async function DashboardPage() {
  const [stats, activity] = await Promise.all([getUsersStats(), getRecentAuditLogs(5)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Vista general del sistema</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total usuarios" value={stats.total} icon={Users} />
        <StatsCard label="Activos" value={stats.active} icon={UserCheck} />
        <StatsCard label="Invitados" value={stats.invited} icon={UserPlus} />
        <StatsCard label="Suspendidos" value={stats.suspended} icon={UserX} />
      </div>
      <RecentActivity items={activity} />
    </div>
  );
}
```

### 4.6 Users Table

```tsx
// apps/web/features/users/components/users-table.tsx
'use client';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';
import type { User } from '@shared/schemas/users';
import { RoleBadge } from './role-badge';
import { StatusBadge } from './status-badge';

export function UsersTable({
  users,
  onEdit,
  onDelete,
}: {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting()}>
          Email <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
    },
    {
      accessorKey: 'displayName',
      header: 'Nombre',
      cell: ({ row }) => row.original.displayName ?? '—',
    },
    {
      accessorKey: 'role',
      header: 'Rol',
      cell: ({ row }) => <RoleBadge role={row.original.role} />,
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => onEdit(row.original)}>
            Editar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(row.original)}>
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: users,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {hg.headers.map((h) => (
              <TableHead key={h.id}>
                {flexRender(h.column.columnDef.header, h.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((r) => (
          <TableRow key={r.id}>
            {r.getVisibleCells().map((c) => (
              <TableCell key={c.id}>
                {flexRender(c.column.columnDef.cell, c.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### 4.7 Hooks de Users

```ts
// apps/web/features/users/hooks/use-users-list.ts
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { listUsers } from '../api/users-api';
import type { ListUsersFilters } from '../schemas';

export function useUsersList(filters: ListUsersFilters) {
  return useQuery({
    queryKey: ['users', 'list', filters],
    queryFn: () => listUsers(filters),
    placeholderData: keepPreviousData,
  });
}
```

```ts
// apps/web/features/users/hooks/use-create-user.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createUser } from '../api/users-api';
import { toast } from 'sonner';

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario creado');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
```

```ts
// apps/web/features/users/hooks/use-update-user.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateUser } from '../api/users-api';

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, input }: { uid: string; input: Parameters<typeof updateUser>[1] }) =>
      updateUser(uid, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
```

### 4.8 User API (cliente)

```ts
// apps/web/features/users/api/users-api.ts
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/client';
import type { CreateUserInput, UpdateUserInput, User } from '@shared/schemas/users';
import type { ListUsersFilters } from '../schemas';

const createUserFn = httpsCallable<CreateUserInput, User>(functions, 'v1UsersCreate');
const listUsersFn = httpsCallable<
  ListUsersFilters,
  { items: User[]; page: number; pageSize: number; total: number; hasMore: boolean }
>(functions, 'v1UsersList');

export async function listUsers(filters: ListUsersFilters) {
  const r = await listUsersFn(filters);
  return r.data;
}
export async function createUser(input: CreateUserInput) {
  const r = await createUserFn(input);
  return r.data;
}
export async function updateUser(uid: string, input: UpdateUserInput) {
  // httpsCallable(functions, 'v1UsersUpdate')(...);
  throw new Error('TODO SDD-07');
}
export async function deleteUser(uid: string) {
  // httpsCallable(functions, 'v1UsersDelete')(uid);
  throw new Error('TODO SDD-07');
}
```

### 4.9 User Form Modal

```tsx
// apps/web/features/users/components/user-form-modal.tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createUserInputSchema, type CreateUserInput } from '@shared/schemas/users';
import { useCreateUser } from '../hooks/use-create-user';
import { Loader2 } from 'lucide-react';

export function UserFormModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const create = useCreateUser();
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserInputSchema),
    defaultValues: { role: 'recruiter', sendInviteEmail: true },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync(values);
      form.reset();
      onOpenChange(false);
    } catch {
      /* toast ya se mostró en el hook */
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" {...form.register('email')} />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="displayName">Nombre</label>
            <input id="displayName" {...form.register('displayName')} />
          </div>
          <div>
            <label htmlFor="role">Rol</label>
            <select id="role" {...form.register('role')}>
              <option value="recruiter">Recruiter</option>
              <option value="expert">Expert</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input id="sendInviteEmail" type="checkbox" {...form.register('sendInviteEmail')} />
            <label htmlFor="sendInviteEmail">Enviar email de invitación</label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 4.10 `/admin/users` page

```tsx
// apps/web/app/admin/users/page.tsx
'use client';
import { useState } from 'react';
import { useUsersList } from '@/features/users/hooks/use-users-list';
import { UsersTable } from '@/features/users/components/users-table';
import { UserFormModal } from '@/features/users/components/user-form-modal';
import { UserFilters, defaultFilters } from '@/features/users/components/user-filters';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';

export default function UsersPage() {
  const [filters, setFilters] = useState(defaultFilters);
  const [modalOpen, setModalOpen] = useState(false);
  const { data, isLoading, error } = useUsersList(filters);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo
        </Button>
      </div>
      <UserFilters value={filters} onChange={setFilters} />
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      )}
      {error && <p className="text-destructive">Error: {error.message}</p>}
      {data && <UsersTable users={data.items} onEdit={() => {}} onDelete={() => {}} />}
      <UserFormModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
```

### 4.11 Settings — Tabs layout

```tsx
// apps/web/app/admin/settings/page.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileForm } from '@/features/settings/components/profile-form';
import { TeamList } from '@/features/settings/components/team-list';
import { BillingCard } from '@/features/settings/components/billing-card';

export default function SettingsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = searchParams.tab ?? 'profile';
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileForm />
        </TabsContent>
        <TabsContent value="team">
          <TeamList />
        </TabsContent>
        <TabsContent value="billing">
          <BillingCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### 4.12 Loading + Error en `/admin/users`

```tsx
// apps/web/app/admin/users/loading.tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-12" />
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}
```

```tsx
// apps/web/app/admin/users/error.tsx
'use client';
import { Button } from '@/components/ui/button';

export default function UsersError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Error cargando usuarios</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
```

### 4.13 Comportamiento esperado

- `/admin` carga con stats reales (RSC hace fetch en server, hidrata con datos).
- `/admin/users` lista users con tabla. Click "Editar" abre modal con datos precargados. Click "Eliminar" abre confirm dialog.
- Filtros (status, role, search) actualizan la query. Paginación con prev/next.
- `/admin/settings?tab=billing` renderiza directo en tab billing.
- Dark mode funciona en todas las páginas.
- 404 + 500 personalizadas.

### 4.14 Errores y excepciones

| Error                | UX                                                        |
| -------------------- | --------------------------------------------------------- |
| Cloud Function falla | toast.error + tabla muestra "Error cargando"              |
| Email duplicado      | toast.error con mensaje específico (ya viene del backend) |
| Validación cliente   | mensajes inline en form                                   |
| Network offline      | toast.error "Sin conexión" (futuro: retry queue)          |

## 5. Criterios de aceptación

- [ ] `/admin` muestra 4 stats cards con datos reales.
- [ ] `/admin/users` lista usuarios en tabla con paginación.
- [ ] Filtros (status, role, search) funcionan.
- [ ] Modal de crear usuario valida y muestra errores inline.
- [ ] Submit de crear usuario invoca Cloud Function y refresca la tabla.
- [ ] Botón de signOut en header limpia sesión.
- [ ] `/admin/settings` con 3 tabs funcional.
- [ ] Dark mode toggle persiste.
- [ ] 404 page se muestra en rutas inexistentes.
- [ ] Error boundary se muestra si una ruta falla.
- [ ] Lighthouse score > 90 en `/admin/users`.
- [ ] ESLint rechaza `import { collection } from 'firebase/firestore'` en `features/users/`.
- [ ] No hay N+1 queries (verificable con `console.time`).
- [ ] Loading skeletons visibles durante fetch.

## 6. Plan de testing

- **Unit**: schemas (filtros), badges.
- **Component (Testing Library)**: `UsersTable`, `UserFormModal` (validación, submit).
- **Integration** (con emulador + mocked httpsCallable): flujo crear → aparece en lista.

## 7. Riesgos y mitigaciones

| Riesgo                                   | Probabilidad | Impacto | Mitigación                                                                 |
| ---------------------------------------- | ------------ | ------- | -------------------------------------------------------------------------- |
| Bundle inicial > 200KB                   | M            | M       | Dynamic import de tabla pesada + `next/dynamic`.                           |
| Tabla lenta con muchos users             | M            | M       | Server-side pagination ya está; documentar cap de 100/página.              |
| Form re-renderiza en cada keystroke      | B            | B       | React Hook Form usa uncontrolled por default, ya optimiza.                 |
| TanStack Query no invalida tras mutation | M            | M       | `invalidateQueries({ queryKey: ['users'] })` en cada mutation hook.        |
| Dark mode FCL en algún componente        | B            | B       | Auditoría visual; usar siempre tokens de Tailwind (`bg-background`, etc.). |

## 8. Out of scope

- Audit log expert (otro SDD).
- Bulk actions.
- Avatar upload (futuro).
- Real-time updates con `onSnapshot`.
- Export CSV (botón placeholder; real en SDD de reports).
- Drag & drop para reordenar (no aplica).

## 9. Open Questions

- [ ] ¿El dashboard debe hacer 4 queries (uno por stats card) o 1 query agregada? **Decisión**: 4 queries simples (más simple, paralelizable). Optimizar si aparece problema.
- [ ] ¿Settings/Team requiere rol admin? **Decisión**: sí.
- [ ] ¿El modal de Editar tiene los mismos campos que Crear (excepto email)? **Decisión**: sí, con email disabled.

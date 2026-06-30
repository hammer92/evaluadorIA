'use client';

import type { User } from '@shared/schemas/users';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import { useState } from 'react';

import { RoleBadge } from './role-badge';
import { StatusBadge } from './status-badge';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export function UsersTable({
  users,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  canEdit: boolean;
  canDelete: boolean;
}): React.JSX.Element {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting()}
          className="-ml-3 font-hanken text-label-sm uppercase tracking-wider text-outline-tv hover:text-navy"
        >
          Email
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate text-body-md font-medium text-on-surface">{row.original.email}</p>
          {row.original.displayName && (
            <p className="truncate text-xs text-on-surface-variant">{row.original.displayName}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: () => (
        <span className="font-hanken text-label-sm uppercase tracking-wider text-outline-tv">
          Rol
        </span>
      ),
      cell: ({ row }) => <RoleBadge role={row.original.role} />,
    },
    {
      accessorKey: 'status',
      header: () => (
        <span className="font-hanken text-label-sm uppercase tracking-wider text-outline-tv">
          Estado
        </span>
      ),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: () => (
        <div className="text-right font-hanken text-label-sm uppercase tracking-wider text-outline-tv">
          Acciones
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(row.original)}
              className="text-on-surface-variant hover:text-navy"
            >
              Editar
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(row.original)}
              className="text-on-surface-variant hover:text-status-error"
            >
              Eliminar
            </Button>
          )}
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
  });

  return (
    <div className="overflow-hidden rounded-tv border border-border-standard bg-white shadow-tv-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="border-b border-border-standard bg-surface-subtle">
              {hg.headers.map((h) => (
                <TableHead key={h.id} className="h-12">
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-body-md text-on-surface-variant"
              >
                No hay usuarios para los filtros seleccionados.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((r) => (
              <TableRow
                key={r.id}
                className={cn(
                  'border-b border-border-standard last:border-0 hover:bg-surface-subtle',
                )}
              >
                {r.getVisibleCells().map((c) => (
                  <TableCell key={c.id} className="py-stack-md">
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

'use client';

import type { Template } from '@shared/schemas/templates';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, Edit, Eye, MoreHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { NicheBadge } from '@/components/niche-badge';
import { TemplateStatusBadge } from '@/components/template-status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function TemplatesTable({
  templates,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  templates: Template[];
  onEdit: (template: Template) => void;
  onDelete: (template: Template) => void;
  canEdit: boolean;
  canDelete: boolean;
}): React.JSX.Element {
  const [sorting, setSorting] = useState<SortingState>([]);

  const showActions = canEdit || canDelete;

  const columns: ColumnDef<Template>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Nombre
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => (
        <Link
          href={`/admin/templates/detail?templateId=${row.original.templateId}`}
          className="font-medium text-navy hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => <TemplateStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'niche',
      header: 'Nicho',
      cell: ({ row }) => <NicheBadge niche={row.original.niche} />,
    },
    {
      accessorKey: 'recipes',
      header: 'Recetas',
      cell: ({ row }) => (
        <span className="text-body-sm text-navy/70">
          {row.original.recipes.length} {row.original.recipes.length === 1 ? 'receta' : 'recetas'}
        </span>
      ),
    },
    {
      accessorKey: 'timeLimitMinutes',
      header: 'Duración',
      cell: ({ row }) => <span className="text-body-sm">{row.original.timeLimitMinutes} min</span>,
    },
    {
      accessorKey: 'createdBy',
      header: 'Creado por',
      cell: ({ row }) => (
        <span className="text-body-sm text-navy/70">{row.original.createdBy}</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Creado
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-body-sm text-navy/70">{formatDate(row.original.createdAt)}</span>
      ),
    },
  ];

  if (showActions) {
    columns.push({
      id: 'actions',
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => {
        const template = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Acciones para ${template.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/admin/templates/detail?templateId=${template.templateId}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver detalle
                </Link>
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem onClick={() => onEdit(template)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(template)}
                  className="text-status-error focus:text-status-error"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    });
  }

  const table = useReactTable({
    data: templates,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (templates.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface-container-lowest p-12 text-center">
        <h3 className="text-headline-sm font-semibold text-navy">No hay templates</h3>
        <p className="mt-1 text-body-sm text-navy/60">
          Creá tu primer template para empezar a gestionar evaluaciones técnicas.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className={cn('hover:bg-surface-container-low')}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

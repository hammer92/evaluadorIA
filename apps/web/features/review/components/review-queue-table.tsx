'use client';

import type { Template } from '@shared/schemas/templates';
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import Link from 'next/link';

import { NicheBadge } from '@/components/niche-badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ReviewQueueTable({ templates }: { templates: Template[] }): React.JSX.Element {
  const columns: ColumnDef<Template>[] = [
    {
      accessorKey: 'name',
      header: 'Template',
      cell: ({ row }) => (
        <Link
          href={`/admin/templates/detail?templateId=${row.original.templateId}&from=review`}
          className="font-medium text-navy hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: 'niche',
      header: 'Nicho',
      cell: ({ row }) => <NicheBadge niche={row.original.niche} />,
    },
    {
      accessorKey: 'createdBy',
      header: 'Enviado por',
      cell: ({ row }) => (
        <span className="text-body-sm text-navy/70">{row.original.createdBy}</span>
      ),
    },
    {
      accessorKey: 'updatedAt',
      header: 'Fecha de envío',
      cell: ({ row }) => (
        <span className="text-body-sm text-navy/70">{formatDate(row.original.updatedAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => {
        const template = row.original;
        return (
          <Button asChild variant="ghost" size="sm" aria-label={`Ver detalle de ${template.name}`}>
            <Link href={`/admin/templates/detail?templateId=${template.templateId}&from=review`}>
              <Eye className="mr-2 h-4 w-4" />
              Revisar
            </Link>
          </Button>
        );
      },
    },
  ];

  const table = useReactTable({
    data: templates,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (templates.length === 0) {
    return (
      <div
        className="rounded-md border border-border bg-surface-container-lowest p-12 text-center"
        role="status"
      >
        <h3 className="text-headline-sm font-semibold text-navy">
          No hay templates esperando revisión
        </h3>
        <p className="mt-1 text-body-sm text-navy/60">
          Cuando un recruiter envíe un template a revisión, aparecerá acá.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-md border border-border"
      role="region"
      aria-label="Cola de templates en revisión"
    >
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
            <TableRow key={row.id} className="hover:bg-surface-container-low">
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

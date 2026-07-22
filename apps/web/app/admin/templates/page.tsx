'use client';

import type { Template } from '@shared/schemas/templates';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRole } from '@/features/auth/components/role-provider';
import type { ListTemplatesFilters } from '@/features/templates/api/templates-api';
import { TemplateFiltersBar } from '@/features/templates/components/template-filters';
import { TemplatesTable } from '@/features/templates/components/templates-table';
import { useTemplatesList } from '@/features/templates/hooks/use-templates';

const INITIAL_FILTERS: ListTemplatesFilters = {
  status: 'all',
  niche: 'all',
  createdBy: '',
  search: '',
  page: 1,
  pageSize: 20,
};

export default function TemplatesPage() {
  const [filters, setFilters] = useState<ListTemplatesFilters>(INITIAL_FILTERS);
  const [editing, setEditing] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, isError, error } = useTemplatesList(filters);
  const role = useRole();
  const canEdit = role === 'admin' || role === 'recruiter';
  const canDelete = role === 'admin';

  const onPageChange = (page: number) => setFilters((f) => ({ ...f, page }));
  const pageStart = ((data?.page ?? 1) - 1) * (data?.pageSize ?? 20);

  return (
    <div className="space-y-stack-lg">
      <header className="flex flex-wrap items-end justify-between gap-stack-md">
        <div className="space-y-stack-sm">
          <p className="text-label-sm text-outline-tv">ADMINISTRACIÓN</p>
          <h1 className="font-hanken text-display-lg text-on-surface">Templates</h1>
          <p className="text-body-lg text-on-surface-variant">
            Gestioná los templates de evaluación técnica de tu organización.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo template
          </Button>
        )}
      </header>

      <TemplateFiltersBar
        initialSearch={filters.search ?? ''}
        initialStatus={filters.status ?? 'all'}
        initialNiche={filters.niche ?? 'all'}
        initialCreatedBy={filters.createdBy ?? ''}
        onApply={(next) =>
          setFilters((f) => ({
            ...f,
            search: next.search,
            status: next.status,
            niche: next.niche,
            createdBy: next.createdBy,
            page: 1,
          }))
        }
      />

      {isLoading && (
        <div className="space-y-stack-sm rounded-tv border border-border-standard bg-white p-stack-md shadow-tv-card">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 bg-surface-subtle" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-tv border border-status-error/30 bg-status-error/5 p-stack-md text-body-md text-status-error">
          Error al cargar templates: {error?.message ?? 'desconocido'}
        </div>
      )}

      {data && !isLoading && !isError && (
        <>
          <TemplatesTable
            templates={data.items}
            onEdit={(t) => setEditing(t)}
            onDelete={(t) => setDeleting(t)}
            canEdit={canEdit}
            canDelete={canDelete}
          />
          <div className="flex items-center justify-between text-body-md text-on-surface-variant">
            <span>
              Mostrando {data.items.length === 0 ? 0 : pageStart + 1}–
              {pageStart + data.items.length} de {data.total} templates
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

      {/*
       * Form modal + delete dialog wired up in slice 7+8 (this PR).
       * Placeholder action stubs to keep this slice focused on list+filters+table.
       */}
      {createOpen && (
        <div className="text-body-sm text-on-surface-variant">Form modal pendiente (slice 7).</div>
      )}
      {editing && (
        <div className="text-body-sm text-on-surface-variant">
          Edit modal pendiente (slice 7). Template: {editing.name}
        </div>
      )}
      {deleting && (
        <div className="text-body-sm text-on-surface-variant">
          Delete dialog pendiente (slice 8). Template: {deleting.name}
        </div>
      )}
    </div>
  );
}

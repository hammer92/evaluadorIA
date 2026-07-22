'use client';

import { Search, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'draft', label: 'Borrador' },
  { value: 'in_review', label: 'En revisión' },
  { value: 'changes_requested', label: 'Cambios solicitados' },
  { value: 'approved', label: 'Aprobado' },
  { value: 'rejected', label: 'Rechazado' },
];

const NICHE_OPTIONS = [
  { value: 'all', label: 'Todos los nichos' },
  { value: 'school', label: 'Escolar' },
  { value: 'university', label: 'Universitario' },
  { value: 'exam_practice', label: 'Simulacro' },
];

export interface TemplateFiltersBarProps {
  initialSearch: string;
  initialStatus: string;
  initialNiche: string;
  initialCreatedBy: string;
  onApply: (next: { search: string; status: string; niche: string; createdBy: string }) => void;
}

export function TemplateFiltersBar({
  initialSearch,
  initialStatus,
  initialNiche,
  initialCreatedBy,
  onApply,
}: TemplateFiltersBarProps): React.JSX.Element {
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);
  const [niche, setNiche] = useState(initialNiche);
  const [createdBy, setCreatedBy] = useState(initialCreatedBy);

  const hasFilters =
    status !== 'all' || niche !== 'all' || createdBy.length > 0 || search.length > 0;

  function apply(): void {
    onApply({ search, status, niche, createdBy });
  }

  function clear(): void {
    setSearch('');
    setStatus('all');
    setNiche('all');
    setCreatedBy('');
    onApply({ search: '', status: 'all', niche: 'all', createdBy: '' });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-container-lowest p-4 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40"
        />
        <Input
          type="search"
          placeholder="Buscar templates por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onBlur={apply}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply();
          }}
          className="pl-9"
          aria-label="Buscar templates"
        />
      </div>
      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v);
          onApply({ search, status: v, niche, createdBy });
        }}
      >
        <SelectTrigger className="w-full md:w-[180px]" aria-label="Filtrar por estado">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={niche}
        onValueChange={(v) => {
          setNiche(v);
          onApply({ search, status, niche: v, createdBy });
        }}
      >
        <SelectTrigger className="w-full md:w-[180px]" aria-label="Filtrar por nicho">
          <SelectValue placeholder="Nicho" />
        </SelectTrigger>
        <SelectContent>
          {NICHE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="text"
        placeholder="Creado por..."
        value={createdBy}
        onChange={(e) => setCreatedBy(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => {
          if (e.key === 'Enter') apply();
        }}
        className="w-full md:w-[180px]"
        aria-label="Filtrar por autor"
      />
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clear} className="gap-1">
          <X className="h-3.5 w-3.5" />
          Limpiar
        </Button>
      )}
    </div>
  );
}

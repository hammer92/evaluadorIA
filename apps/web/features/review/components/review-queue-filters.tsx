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

const NICHE_OPTIONS = [
  { value: 'all', label: 'Todos los nichos' },
  { value: 'school', label: 'Escolar' },
  { value: 'university', label: 'Universitario' },
  { value: 'exam_practice', label: 'Simulacro' },
];

export interface ReviewQueueFiltersBarProps {
  initialSearch: string;
  initialNiche: string;
  onApply: (next: { search: string; niche: string }) => void;
}

export function ReviewQueueFiltersBar({
  initialSearch,
  initialNiche,
  onApply,
}: ReviewQueueFiltersBarProps): React.JSX.Element {
  const [search, setSearch] = useState(initialSearch);
  const [niche, setNiche] = useState(initialNiche);

  const hasFilters = niche !== 'all' || search.length > 0;

  function apply(): void {
    onApply({ search, niche });
  }

  function clear(): void {
    setSearch('');
    setNiche('all');
    onApply({ search: '', niche: 'all' });
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
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onBlur={apply}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply();
          }}
          className="pl-9"
          aria-label="Buscar templates en revisión"
        />
      </div>
      <Select
        value={niche}
        onValueChange={(v) => {
          setNiche(v);
          onApply({ search, niche: v });
        }}
      >
        <SelectTrigger className="w-full md:w-[200px]" aria-label="Filtrar por nicho">
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
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clear} className="gap-1">
          <X className="h-3.5 w-3.5" />
          Limpiar
        </Button>
      )}
    </div>
  );
}

'use client';

import { Search, X } from 'lucide-react';
import { useState, useEffect } from 'react';

import type { UserFilters } from '../schemas';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_OPTIONS: { value: 'all' | 'active' | 'invited' | 'suspended'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'invited', label: 'Invitados' },
  { value: 'suspended', label: 'Suspendidos' },
];

const ROLE_OPTIONS: { value: 'all' | 'admin' | 'recruiter' | 'expert'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'admin', label: 'Admin' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'expert', label: 'Expert' },
];

export function UsersFilters({
  value,
  onChange,
}: {
  value: UserFilters;
  onChange: (next: UserFilters) => void;
}): React.JSX.Element {
  const [searchInput, setSearchInput] = useState(value.search ?? '');

  useEffect(() => {
    setSearchInput(value.search ?? '');
  }, [value.search]);

  const hasActiveFilter =
    (value.search ?? '') !== '' ||
    (value.status ?? 'all') !== 'all' ||
    (value.role ?? 'all') !== 'all';

  return (
    <section className="rounded-tv border border-border-standard bg-white p-stack-md shadow-tv-card">
      <div className="mb-stack-sm flex items-center justify-between">
        <p className="text-label-sm text-outline-tv">FILTROS</p>
        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...value, search: '', status: 'all', role: 'all', page: 1 })}
            className="text-status-error hover:text-status-error"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Limpiar filtros
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-stack-md">
        <div className="min-w-[240px] flex-1">
          <label htmlFor="filter-search" className="mb-1 block text-label-sm text-outline-tv">
            Buscar
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline-tv" />
            <Input
              id="filter-search"
              placeholder="email o nombre…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onBlur={() => onChange({ ...value, search: searchInput, page: 1 })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onChange({ ...value, search: searchInput, page: 1 });
              }}
              className="border-border-standard pl-9 focus-visible:ring-navy"
            />
          </div>
        </div>
        <div>
          <label htmlFor="filter-status" className="mb-1 block text-label-sm text-outline-tv">
            Estado
          </label>
          <Select
            value={value.status ?? 'all'}
            onValueChange={(v) =>
              onChange({ ...value, status: v as UserFilters['status'], page: 1 })
            }
          >
            <SelectTrigger id="filter-status" className="w-[180px] border-border-standard">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="filter-role" className="mb-1 block text-label-sm text-outline-tv">
            Rol
          </label>
          <Select
            value={value.role ?? 'all'}
            onValueChange={(v) => onChange({ ...value, role: v as UserFilters['role'], page: 1 })}
          >
            <SelectTrigger id="filter-role" className="w-[180px] border-border-standard">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}

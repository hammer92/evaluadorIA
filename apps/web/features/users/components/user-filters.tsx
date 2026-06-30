'use client';

import { Search } from 'lucide-react';
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

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <label className="text-xs text-muted-foreground block mb-1">Buscar</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="email o nombre…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onBlur={() => onChange({ ...value, search: searchInput, page: 1 })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onChange({ ...value, search: searchInput, page: 1 });
            }}
            className="pl-9"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Estado</label>
        <Select
          value={value.status ?? 'all'}
          onValueChange={(v) => onChange({ ...value, status: v as UserFilters['status'], page: 1 })}
        >
          <SelectTrigger className="w-[160px]">
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
        <label className="text-xs text-muted-foreground block mb-1">Rol</label>
        <Select
          value={value.role ?? 'all'}
          onValueChange={(v) => onChange({ ...value, role: v as UserFilters['role'], page: 1 })}
        >
          <SelectTrigger className="w-[160px]">
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
      <Button
        variant="ghost"
        onClick={() => onChange({ ...value, search: '', status: 'all', role: 'all', page: 1 })}
      >
        Limpiar
      </Button>
    </div>
  );
}

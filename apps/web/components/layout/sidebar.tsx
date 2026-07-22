'use client';

'use client';

import type { Role } from '@shared/schemas/common';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV_ITEMS, type NavItem } from '@/config/constants';
import { useReviewQueue } from '@/features/review/hooks/use-review-hooks';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/ui-store';

function isItemActive(itemHref: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (itemHref === '/admin') {
    return pathname === '/admin';
  }
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}

// Hook para badge counts. Se expone como componente separado para mantener el
// sidebar component-level clean (no rompe SSR por query que requiere auth).
function NavItemBadge({ item }: { item: NavItem }) {
  // Solo admins ven reviewCount badge (ya filtrado por requiredRoles).
  const { data } = useReviewQueue({ page: 1, pageSize: 1 });
  if (item.badge === 'reviewCount') {
    const count = data?.total ?? 0;
    if (count === 0) return null;
    return (
      <span
        aria-label={`${count} templates esperando revisión`}
        className="ml-auto rounded-full bg-status-warning px-2 py-0.5 text-label-sm font-bold text-white"
      >
        {count}
      </span>
    );
  }
  return null;
}

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.requiredRoles || item.requiredRoles.includes(role),
  );

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen flex-col border-r border-border-standard bg-surface-subtle transition-all',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-border-standard px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-navy flex items-center justify-center">
              <span className="font-hanken text-sm font-bold text-white">KS</span>
            </div>
            <span className="font-hanken text-base font-semibold text-on-surface">
              KnowledgeSync
            </span>
          </div>
        )}
        <button
          onClick={toggle}
          aria-label="Toggle sidebar"
          className="ml-auto rounded-md p-1 text-on-surface-variant hover:bg-navy/5 hover:text-navy"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {visibleItems.map((item) => {
          const active = isItemActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-navy/10 text-navy'
                  : 'text-on-surface-variant hover:bg-navy/5 hover:text-navy',
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-brand-secondary"
                />
              )}
              <item.icon
                size={18}
                className={cn(
                  'shrink-0',
                  active ? 'text-navy' : 'text-on-surface-variant group-hover:text-navy',
                )}
              />
              {!collapsed && (
                <>
                  <span>{item.label}</span>
                  <NavItemBadge item={item} />
                </>
              )}
            </Link>
          );
        })}
      </nav>
      {!collapsed && (
        <div className="border-t border-border-standard p-3 text-label-sm text-outline-tv">
          Technical Validation System
        </div>
      )}
    </aside>
  );
}

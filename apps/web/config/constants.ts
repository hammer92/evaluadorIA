import type { Role } from '@shared/schemas/common';
import { ClipboardCheck, LayoutDashboard, Settings, Users, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  requiredRoles?: Role[];
  /** Optional badge type — renders a count next to the label. */
  badge?: 'reviewCount';
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  {
    href: '/admin/templates',
    label: 'Templates',
    icon: FileText,
    requiredRoles: ['admin', 'recruiter'],
  },
  {
    href: '/admin/review',
    label: 'Revisión',
    icon: ClipboardCheck,
    requiredRoles: ['admin'],
    badge: 'reviewCount',
  },
  {
    href: '/admin/users',
    label: 'Usuarios',
    icon: Users,
    requiredRoles: ['admin', 'recruiter'],
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    icon: Settings,
    requiredRoles: ['admin'],
  },
];

export const ROLES: readonly Role[] = ['admin', 'recruiter', 'expert'];

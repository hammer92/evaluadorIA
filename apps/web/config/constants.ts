import type { Role } from '@shared/schemas/common';
import { LayoutDashboard, Users, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  requiredRoles?: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
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

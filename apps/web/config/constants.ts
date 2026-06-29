import { LayoutDashboard, Users, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Usuarios', icon: Users },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export const ROLES = ['admin', 'recruiter', 'expert'] as const;
export type Role = (typeof ROLES)[number];

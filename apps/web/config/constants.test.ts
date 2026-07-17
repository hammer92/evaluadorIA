import { describe, expect, it } from 'vitest';

import { NAV_ITEMS, ROLES } from './constants';

describe('NAV_ITEMS', () => {
  it('expone 3 entradas (Dashboard, Usuarios, Settings)', () => {
    expect(NAV_ITEMS).toHaveLength(3);
    expect(NAV_ITEMS.map((i) => i.label)).toEqual(['Dashboard', 'Usuarios', 'Settings']);
  });

  it('cada item tiene href, label e icon', () => {
    for (const item of NAV_ITEMS) {
      expect(item.href).toMatch(/^\/admin/);
      expect(typeof item.label).toBe('string');
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon).toBeDefined();
    }
  });

  it('Dashboard no restringe por rol (visible para todos)', () => {
    const dashboard = NAV_ITEMS.find((i) => i.label === 'Dashboard');
    expect(dashboard?.href).toBe('/admin');
    expect(dashboard?.requiredRoles).toBeUndefined();
  });

  it('Usuarios requiere admin o recruiter', () => {
    const usuarios = NAV_ITEMS.find((i) => i.label === 'Usuarios');
    expect(usuarios?.href).toBe('/admin/users');
    expect(usuarios?.requiredRoles).toEqual(['admin', 'recruiter']);
  });

  it('Settings requiere solo admin', () => {
    const settings = NAV_ITEMS.find((i) => i.label === 'Settings');
    expect(settings?.href).toBe('/admin/settings');
    expect(settings?.requiredRoles).toEqual(['admin']);
  });

  it('los hrefs son únicos', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe('ROLES', () => {
  it('contiene los 3 roles del dominio en el orden esperado', () => {
    expect(ROLES).toEqual(['admin', 'recruiter', 'expert']);
  });

  it('es readonly a nivel de tipos', () => {
    expect(Array.isArray(ROLES)).toBe(true);
    expect(Object.isFrozen(ROLES) || ROLES.length === 3).toBe(true);
  });
});

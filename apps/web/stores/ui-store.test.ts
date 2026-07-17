// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from './ui-store';

const resetStore = (): void => {
  useUiStore.setState({ sidebarCollapsed: false });
};

describe('useUiStore', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('arranca con sidebarCollapsed=false', () => {
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  });

  it('toggleSidebar cambia de false a true', () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  });

  it('toggleSidebar alterna entre true y false en llamadas sucesivas', () => {
    const { toggleSidebar } = useUiStore.getState();
    toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
    toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  });

  it('persiste el estado bajo la key "ui-store"', () => {
    useUiStore.getState().toggleSidebar();
    const raw = localStorage.getItem('ui-store');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { state?: { sidebarCollapsed?: boolean } };
    expect(parsed.state?.sidebarCollapsed).toBe(true);
  });

  it('rehidrata desde localStorage si hay valor persistido', async () => {
    localStorage.setItem(
      'ui-store',
      JSON.stringify({ state: { sidebarCollapsed: true }, version: 0 }),
    );
    await useUiStore.persist.rehydrate();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  });
});

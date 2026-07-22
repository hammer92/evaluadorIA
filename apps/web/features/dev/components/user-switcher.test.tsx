// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UserSwitcher, type DevUser } from './user-switcher';

const users: DevUser[] = [
  { uid: 'u-1', email: 'admin@x.com', displayName: 'Admin User', role: 'admin' },
  { uid: 'u-2', email: 'rec@x.com', displayName: 'Recruiter User', role: 'recruiter' },
];

describe('UserSwitcher', () => {
  it('renderiza badge DEV ONLY y current user email', () => {
    render(
      <UserSwitcher currentUserEmail="admin@x.com" users={users} onSwitch={() => undefined} />,
    );
    expect(screen.getByText('DEV ONLY')).toBeInTheDocument();
    expect(screen.getByText('admin@x.com')).toBeInTheDocument();
  });

  it('expone region ARIA con label "User switcher dev only"', () => {
    render(
      <UserSwitcher currentUserEmail="admin@x.com" users={users} onSwitch={() => undefined} />,
    );
    expect(screen.getByRole('region', { name: /user switcher dev only/i })).toBeInTheDocument();
  });

  it('trigger button tiene aria-haspopup="menu" (Radix dropdown semántico)', () => {
    render(
      <UserSwitcher currentUserEmail="admin@x.com" users={users} onSwitch={() => undefined} />,
    );
    const trigger = screen.getByRole('button', { name: /admin@x.com/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('recibe lista de users como prop y muestra email truncado', () => {
    render(
      <UserSwitcher
        currentUserEmail="very-long-admin-email@example.com"
        users={users}
        onSwitch={() => undefined}
      />,
    );
    expect(screen.getByText('very-long-admin-email@example.com')).toBeInTheDocument();
  });
});

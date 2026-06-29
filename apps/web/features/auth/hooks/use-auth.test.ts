// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AuthCallback = (user: unknown) => Promise<void> | void;

let authListener: AuthCallback | null = null;
const triggerAuthChange = async (user: unknown): Promise<void> => {
  if (authListener) await authListener(user);
};

vi.mock('@/lib/firebase/auth', () => ({
  auth: { currentUser: null },
  onAuthStateChanged: (_auth: unknown, cb: AuthCallback) => {
    authListener = cb;
    return () => {
      authListener = null;
    };
  },
}));

import { useAuth } from './use-auth';

const fakeAuthUser = {
  uid: 'u_1',
  email: 'admin@example.com',
  displayName: 'Admin',
  photoURL: null,
  getIdTokenResult: vi.fn().mockResolvedValue({
    claims: { role: 'admin', organizationId: 'org_1' },
  }),
};

const fakeExpertUser = {
  uid: 'u_2',
  email: 'expert@example.com',
  displayName: 'Expert',
  photoURL: null,
  getIdTokenResult: vi.fn().mockResolvedValue({
    claims: { role: 'expert', organizationId: null },
  }),
};

beforeEach(() => {
  fakeAuthUser.getIdTokenResult.mockClear();
  fakeExpertUser.getIdTokenResult.mockClear();
  fakeAuthUser.getIdTokenResult.mockResolvedValue({
    claims: { role: 'admin', organizationId: 'org_1' },
  });
  fakeExpertUser.getIdTokenResult.mockResolvedValue({
    claims: { role: 'expert', organizationId: null },
  });
});

afterEach(() => {
  authListener = null;
});

describe('useAuth', () => {
  it('starts in loading state with null user/claims', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.claims).toBeNull();
  });

  it('updates state when a signed-in user emits', async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await triggerAuthChange(fakeAuthUser);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.uid).toBe('u_1');
    expect(result.current.claims).toEqual({ role: 'admin', organizationId: 'org_1' });
  });

  it('clears state on sign-out', async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await triggerAuthChange(fakeAuthUser);
    });
    await waitFor(() => expect(result.current.user).not.toBeNull());
    await act(async () => {
      await triggerAuthChange(null);
    });
    await waitFor(() => expect(result.current.user).toBeNull());
    expect(result.current.claims).toBeNull();
  });

  it('handles user without role claim (claims=null)', async () => {
    const noRoleUser = {
      uid: 'u_3',
      email: 'no-role@example.com',
      displayName: null,
      photoURL: null,
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
    };
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await triggerAuthChange(noRoleUser);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.uid).toBe('u_3');
    expect(result.current.claims).toBeNull();
  });

  it('extracts role=expert + organizationId=null', async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await triggerAuthChange(fakeExpertUser);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.claims).toEqual({ role: 'expert', organizationId: null });
  });
});

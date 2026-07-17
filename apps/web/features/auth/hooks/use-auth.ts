'use client';

import { useEffect, useState } from 'react';

import type { AuthClaims, AuthState, AuthUser } from '../types';

import { auth, onAuthStateChanged, type User as FbUser } from '@/lib/firebase/auth';

// =============================================================================
// useAuth — hook cliente que expone el estado de autenticación + custom claims.
// =============================================================================
// Suscripción a `onAuthStateChanged` (Firebase Auth). Cuando el user está
// autenticado, fuerza refresh del idToken y extrae role/organizationId
// de los custom claims (source of truth, ver ADR-0006).
// =============================================================================

interface FirebaseUserClaims {
  role?: unknown;
  organizationId?: unknown;
}

function toAuthUser(u: FbUser): AuthUser {
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL,
  };
}

function extractClaims(raw: FirebaseUserClaims): AuthClaims | null {
  if (typeof raw.role !== 'string') return null;
  if (raw.role !== 'admin' && raw.role !== 'recruiter' && raw.role !== 'expert') return null;
  const role = raw.role;
  const orgId = raw.organizationId;
  if (orgId !== undefined && orgId !== null && typeof orgId !== 'string') return null;
  return { role, organizationId: (orgId) ?? null };
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    claims: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, (user) => {
      void (async () => {
        if (cancelled) return;
        if (!user) {
          setState({ user: null, claims: null, loading: false, error: null });
          return;
        }
        try {
          // forceRefresh=true para que los claims seteados por la CF (server-side)
          // se reflejen en el cliente.
          const tokenResult = await user.getIdTokenResult(true);
          if (cancelled) return;
          const claims = extractClaims(tokenResult.claims as FirebaseUserClaims);
          setState({
            user: toAuthUser(user),
            claims,
            loading: false,
            error: null,
          });
        } catch (e) {
          if (cancelled) return;
          setState({ user: null, claims: null, loading: false, error: e as Error });
        }
      })();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return state;
}

# SDD-05: Auth & Authorization

> **Estado:** Draft
> **Owner:** Solution Architect
> **Sprint objetivo:** Sprint 2 (semanas 4-5)
> **Depende de:** SDD-03, SDD-04
> **Bloquea a:** SDD-07

---

## 1. Contexto

Necesitamos que un usuario pueda registrarse, loguearse y acceder a `/admin/**`, con su rol siendo la **única** fuente de verdad para permisos. El modelo es:

- **Firebase Auth** maneja identidad (email + password, Google provider).
- **Custom Claims** (`role`, `organizationId`) son server-authoritative.
- **Middleware Next.js** valida la sesión antes de cada request a `/admin/**`.
- **`useAuth` hook** expone `user`, `claims`, `signOut` para la UI.

Esto es el puente entre "tengo la base y los repositorios" y "puedo empezar a construir pantallas".

## 2. Goals y Non-Goals

### Goals

- SignUp con email + password.
- SignIn con email + password y Google.
- SignOut.
- Custom Claims: set/get vía Cloud Function (admin only).
- `useAuth` hook que expone `{ user, claims, loading, error }`.
- Middleware Next.js completo que valida sesión y claims para `/admin/**`.
- Página `/login` funcional.
- Server-side: `verifyAuth()` helper.
- Sesión persiste entre reloads.
- Reglas de Firestore leen claims correctamente (verificable con tests de SDD-03).

### Non-Goals

- MFA / 2FA (futuro).
- Passwordless (magic link) — se puede agregar como provider.
- OAuth con Apple/Microsoft (no en MVP).
- Phone auth.
- SSO empresarial (SAML/OIDC).

## 3. Decisiones de arquitectura

| #   | Decisión                                                                                            | Justificación                                                                            |
| --- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Email/password + Google en MVP                                                                      | Cubre el 95% de los casos. Otros providers se agregan sin refactor.                      |
| 2   | Custom Claims en vez de leer `users/{uid}.role`                                                     | Performance: claims se leen en el JWT sin round-trip a Firestore.                        |
| 3   | Sesión = cookie `__session` httpOnly seteada por Cloud Function en signIn                           | Más seguro que `localStorage`; CSRF mitigado por SameSite=Lax.                           |
| 4   | Custom Claims se setean vía Cloud Function `v1_users_set_role` (admin only)                         | Cliente nunca toca el SDK Admin directamente.                                            |
| 5   | Middleware Next.js corre en el edge (rápido) y solo verifica JWT decodificado (sin verificar firma) | Verificación real se hace en Cloud Functions. Middleware filtra antes de gastar compute. |
| 6   | SignUp crea user en Auth + doc en Firestore vía Cloud Function `v1_users_create`                    | Atomicidad desde el cliente.                                                             |

## 4. Spec detallada

### 4.1 Estructura de archivos a crear

```
apps/web/
├── features/
│   └── auth/
│       ├── components/
│       │   ├── login-form.tsx
│       │   ├── signup-form.tsx
│       │   └── social-buttons.tsx
│       ├── hooks/
│       │   ├── use-auth.ts
│       │   └── use-sign-in.ts
│       ├── api/
│       │   └── auth-api.ts         # signIn/signUp/signOut helpers
│       ├── schemas.ts              # Zod para forms
│       └── types.ts
├── app/
│   ├── login/
│   │   └── page.tsx                # usa login-form
│   ├── signup/
│   │   └── page.tsx                # usa signup-form
│   ├── (auth)/                     # route group con layout mínimo
│   │   └── layout.tsx
│   └── admin/                      # ya creado en SDD-02
│       └── layout.tsx              # actualizar para usar useAuth
├── lib/
│   └── firebase/
│       └── auth.ts                 # SDK cliente de Auth
├── middleware.ts                   # actualizar del stub
└── services/
    └── auth-service.ts             # orquesta Auth + Claims + user doc

apps/functions/src/v1/auth/
└── session.ts                      # crea cookie de sesión post-login
```

### 4.2 `lib/firebase/auth.ts` (helpers cliente)

```ts
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
  type Auth,
} from 'firebase/auth';
import { auth } from './client';

export { auth };
export { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider };
export { signInWithPopup, fbSignOut as signOut, onAuthStateChanged };
export type { User, Auth };
```

> Re-exports nombrados. Cero lógica.

### 4.3 `useAuth` hook

```ts
// apps/web/features/auth/hooks/use-auth.ts
'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/auth';
import type { User } from 'firebase/auth';
import type { Role } from '@shared/schemas/common';

export type AuthState = {
  user: User | null;
  claims: { role: Role; organizationId: string | null } | null;
  loading: boolean;
  error: Error | null;
};

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    claims: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, claims: null, loading: false, error: null });
        return;
      }
      try {
        const tokenResult = await user.getIdTokenResult(true);
        const role = tokenResult.claims.role as Role | undefined;
        const organizationId = (tokenResult.claims.organizationId as string | undefined) ?? null;
        setState({
          user,
          claims: role ? { role, organizationId } : null,
          loading: false,
          error: null,
        });
      } catch (e) {
        setState({ user: null, claims: null, loading: false, error: e as Error });
      }
    });
    return unsub;
  }, []);

  return state;
}
```

### 4.4 `auth-api.ts`

```ts
// apps/web/features/auth/api/auth-api.ts
'use client';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from '@/lib/firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/client'; // agregar export de functions en SDD-03

export async function signInWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await createSession(cred.user);
  return cred.user;
}

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await cred.user.updateProfile({ displayName });
  // Crear doc en Firestore via Cloud Function (atómico)
  await httpsCallable(
    functions,
    'v1_users_create',
  )({
    email,
    displayName,
    role: 'expert',
    sendInviteEmail: false,
  });
  await createSession(cred.user);
  return cred.user;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  await createSession(cred.user);
  return cred.user;
}

export async function signOutCurrent() {
  await signOut(auth);
  // Cloud Function borra cookie también
  await httpsCallable(functions, 'v1_auth_clear_session')();
}

async function createSession(user: import('firebase/auth').User) {
  const idToken = await user.getIdToken();
  await httpsCallable(functions, 'v1_auth_create_session')({ idToken });
  // La cookie es set httpOnly por la Cloud Function.
}
```

### 4.5 `services/auth-service.ts` (server-side helpers)

```ts
// apps/web/services/auth-service.ts
import 'server-only';
import { cookies } from 'next/headers';
import { getAdminAuth } from '@functions/firebase-admin';
import type { Role } from '@shared/schemas/common';

const COOKIE_NAME = '__session';
const MAX_AGE = 60 * 60 * 24 * 5; // 5 días

export async function verifyAuth(): Promise<{
  uid: string;
  email: string;
  role: Role;
  organizationId: string | null;
} | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionCookie) return null;
  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? '',
      role: (decoded.role as Role) ?? 'expert',
      organizationId: (decoded.organizationId as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const auth = await verifyAuth();
  if (!auth) throw new Error('UNAUTHORIZED');
  return auth;
}

export async function requireRole(role: Role | Role[]) {
  const auth = await requireAuth();
  const roles = Array.isArray(role) ? role : [role];
  if (!roles.includes(auth.role)) throw new Error('FORBIDDEN');
  return auth;
}
```

> `import 'server-only'` falla el build si se importa desde un Client Component.

### 4.6 Cloud Function `v1_auth_create_session`

```ts
// apps/functions/src/v1/auth/create-session.ts
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getAdminAuth } from '../../firebase-admin';

const COOKIE_NAME = '__session';
const MAX_AGE_MS = 60 * 60 * 24 * 5 * 1000; // 5 días

export const createSession = onCall(
  { cors: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'] },
  async (req) => {
    const idToken = req.data?.idToken as string | undefined;
    if (!idToken) throw new HttpsError('invalid-argument', 'idToken required');
    if (!req.rawRequest.cookies) {
      // callable functions no siempre tienen cookie jar del browser.
      // Para MVP, retornamos el session cookie y el front lo setea via Set-Cookie response.
    }
    const auth = getAdminAuth();
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: MAX_AGE_MS });
    // Seteamos Set-Cookie via response
    req.rawRequest.res?.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${sessionCookie}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor(MAX_AGE_MS / 1000)}`,
    );
    return { success: true };
  },
);
```

> Nota: `onCall` no es ideal para setear cookies en el response. **Decisión alternativa** (preferida): usar HTTPS `onRequest` para `create-session`. Esto se ajusta en SDD-06. En este SDD dejamos la firma pero advertimos.

### 4.7 Middleware Next.js (versión completa)

```ts
// apps/web/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose'; // para verificar firma, o usar `firebase-admin/auth` en edge via fetch

const PUBLIC_ROUTES = ['/login', '/signup', '/forgot-password', '/'];
const ADMIN_PREFIX = '/admin';
const PUBLIC_API = ['/api/health'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_ROUTES.some((p) => pathname === p) || PUBLIC_API.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!pathname.startsWith(ADMIN_PREFIX)) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get('__session')?.value;
  if (!sessionCookie) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Verificar JWT (en edge runtime)
  try {
    const { payload } = await jwtVerify(sessionCookie, getSecret(), { algorithms: ['HS256'] });
    // claims disponibles en payload.role, payload.organizationId
    if (!payload.role) {
      return NextResponse.redirect(new URL('/login?error=no-claims', req.url));
    }
    return NextResponse.next();
  } catch {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
}

function getSecret(): Uint8Array {
  const s = process.env.SESSION_COOKIE_SECRET;
  if (!s) throw new Error('SESSION_COOKIE_SECRET required');
  return new TextEncoder().encode(s);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
```

> **Decisión**: para MVP, la verificación real del JWT se hace en el middleware con un secret compartido con Cloud Functions (`jose` HS256). Alternativa: usar `getSessionCookie` desde `@/lib/firebase/admin-edge` (más estricto pero más lento). Decisión en Sprint 2 después de medir.

### 4.8 `/login` page

```tsx
// apps/web/app/(auth)/login/page.tsx
import { LoginForm } from '@/features/auth/components/login-form';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
        {searchParams.error && (
          <p className="text-destructive text-sm">Error: {searchParams.error}</p>
        )}
        <LoginForm nextUrl={searchParams.next} />
      </div>
    </div>
  );
}
```

```tsx
// apps/web/features/auth/components/login-form.tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { loginSchema, type LoginInput } from '../schemas';
import { signInWithEmail, signInWithGoogle } from '../api/auth-api';
import { toast } from 'sonner';

export function LoginForm({ nextUrl }: { nextUrl?: string }) {
  const router = useRouter();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await signInWithEmail(values.email, values.password);
      toast.success('Sesión iniciada');
      router.push(nextUrl || '/admin');
    } catch (e) {
      toast.error((e as Error).message ?? 'Error al iniciar sesión');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" {...form.register('email')} />
      </div>
      <div>
        <label htmlFor="password">Contraseña</label>
        <input id="password" type="password" {...form.register('password')} />
      </div>
      <button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Ingresando...' : 'Ingresar'}
      </button>
      <button
        type="button"
        onClick={() => signInWithGoogle().then(() => router.push(nextUrl || '/admin'))}
      >
        Continuar con Google
      </button>
    </form>
  );
}
```

### 4.9 `/signup` y schema

```ts
// apps/web/features/auth/schemas.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = loginSchema.extend({
  displayName: z.string().min(1).max(120),
});
export type SignupInput = z.infer<typeof signupSchema>;
```

### 4.10 `app/admin/layout.tsx` actualizado

```tsx
import { redirect } from 'next/navigation';
import { verifyAuth } from '@/services/auth-service';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await verifyAuth();
  if (!auth) redirect('/login?next=/admin');
  return (
    <div className="flex min-h-screen">
      <Sidebar role={auth.role} />
      <div className="flex flex-1 flex-col">
        <Header email={auth.email} role={auth.role} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

### 4.11 Actualizar `components/layout/header.tsx`

```tsx
// agregar botón de signOut
import { signOutCurrent } from '@/features/auth/api/auth-api';
// ... en el user menu:
<DropdownMenuItem onClick={() => signOutCurrent()}>Cerrar sesión</DropdownMenuItem>;
```

### 4.12 Test del flujo completo

```ts
// apps/web/features/auth/__tests__/auth-flow.test.ts
import { describe, it, expect } from 'vitest';
import { setup, loginAs } from '@/test-utils/emulator';

describe('auth flow', () => {
  it('signup crea user en auth + firestore + claims', async () => {
    const { auth, db } = await setup();
    await auth.signUp({ email: 'a@x.com', password: '12345678', displayName: 'Ana' });
    const userDoc = await db.getById('a_uid');
    expect(userDoc.email).toBe('a@x.com');
    expect(userDoc.role).toBe('expert');
  });

  it('admin puede cambiar rol de otro user', async () => {
    const ctx = await loginAs('u_admin');
    await ctx.users.setRole('u_expert', 'recruiter');
    const updated = await ctx.db.getById('u_expert');
    expect(updated.role).toBe('recruiter');
  });
});
```

### 4.13 Comportamiento esperado

1. Usuario entra a `/admin` sin sesión → redirect a `/login?next=/admin`.
2. Login exitoso → cookie `__session` set httpOnly → redirect a `/admin`.
3. Header muestra email + role badge.
4. SignOut → cookie borrada → redirect a `/login`.
5. Custom Claims del JWT tienen `role` y `organizationId`.
6. Firestore Rules aceptan lectura/escritura según claims (tests de SDD-03).

### 4.14 Errores y excepciones

| Error                       | Mensaje al usuario                                |
| --------------------------- | ------------------------------------------------- |
| `auth/invalid-credential`   | "Email o contraseña incorrectos"                  |
| `auth/email-already-in-use` | "Ese email ya está registrado"                    |
| `auth/weak-password`        | "La contraseña debe tener al menos 8 caracteres"  |
| `auth/popup-closed-by-user` | Silencioso                                        |
| Custom Claims no presentes  | "Tu cuenta no tiene permisos. Contactá al admin." |

## 5. Criterios de aceptación

- [ ] `/login` renderiza formulario funcional.
- [ ] `/signup` renderiza formulario funcional.
- [ ] SignIn con email/password funciona contra emuladores.
- [ ] SignIn con Google funciona (configurar provider en Firebase Console).
- [ ] SignUp crea user en Auth + Firestore + setea claims en una transacción.
- [ ] Cookie `__session` se setea httpOnly post-login.
- [ ] Middleware redirige a `/login?next=...` si no hay cookie.
- [ ] Middleware rechaza acceso si claims no tienen `role`.
- [ ] `useAuth()` retorna `{ user, claims, loading, error }`.
- [ ] `/admin` muestra email + role del usuario logueado.
- [ ] SignOut limpia cookie y redirige a `/login`.
- [ ] Server-side: `verifyAuth()` retorna los datos correctos desde la cookie.
- [ ] Server-side: `requireRole('admin')` lanza si el rol no es admin.
- [ ] Tests del flujo pasan contra emuladores.

## 6. Plan de testing

- **Unit**: `schemas.test.ts` (Zod).
- **Integration (con emuladores)**:
  - SignUp → verifica doc + claims.
  - SignIn → verifica cookie (mock req/res).
  - SignOut → verifica que cookie se limpia.
  - `verifyAuth()` con cookie válida / inválida / ausente.
  - `requireRole` con cada rol.

## 7. Riesgos y mitigaciones

| Riesgo                                                               | Probabilidad | Impacto | Mitigación                                                                      |
| -------------------------------------------------------------------- | ------------ | ------- | ------------------------------------------------------------------------------- |
| Cookie no se setea en callable HTTPS                                 | A            | A       | Usar `onRequest` para `create-session` (ajuste en SDD-06).                      |
| Claims desincronizados con `users.role`                              | M            | M       | `v1_users_update_role` actualiza ambos en una sola Cloud Function.              |
| Sesión más larga que el JWT ID (5 días vs 1 hora)                    | B            | B       | Refresh silencioso si JWT está por expirar (cliente) + logout si refresh falla. |
| Google provider no configurado en proyecto nuevo                     | M            | B       | README documenta setup; emulador lo acepta por default.                         |
| `verifyAuth` llamado desde RSC que también se sirve vía SSR cacheado | M            | M       | `export const dynamic = 'force-dynamic'` en rutas que usan `verifyAuth`.        |

## 8. Out of scope

- MFA / 2FA.
- Passwordless / magic link.
- SAML / OIDC SSO.
- Bloqueo de cuenta tras N intentos fallidos (Firebase Auth tiene protección básica, suficiente para MVP).
- Auditoría de sesiones activas (futuro).

## 9. Open Questions

- [ ] ¿Usamos `jose` (HS256) o `firebase-admin/auth` (verifySessionCookie) en middleware? **Decisión tentativa**: HS256 para velocidad; documentar riesgo de compromiso de secret.
- [ ] ¿SignUp público o solo por invitación? **Decisión**: público para MVP, se cierra en SDD-07 si requiere.
- [ ] ¿Cookie domain `.example.com` o específico por subdominio? Depende del hosting final (SDD-08).

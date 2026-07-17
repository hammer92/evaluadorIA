/**
 * verify-auth.ts — Integration test del flujo completo contra emuladores.
 * Actualizado para SDD-06 (nombres v1XxxYyy).
 *
 * Asume que los emuladores están corriendo (auth:9099, firestore:8080,
 * functions:5001) y que las functions están construidas (pnpm --filter
 * functions build).
 *
 * Verifica:
 *   1. First user signup vía v1AuthSignUp → role='admin' (bootstrap) + cookie
 *   2. v1AuthCreateSession returns Set-Cookie con __session JWT firmado con jose
 *   3. verifySessionCookie + jose roundtrip
 *   4. Second user signup sin invitación → rejected (permission-denied)
 *   5. Admin invite vía v1UsersCreate → Auth + Firestore + claims
 *      (password no se setea — SDD-06 spec, se setea manualmente vía Admin SDK
 *       hasta SDD-08 integre email magic link)
 *   6. Invited user signin con password seteado por Admin SDK
 *   7. v1AuthClearSession borra cookie (Max-Age=0)
 *   8. setUserRole(invited, recruiter) actualiza claims
 *   9. Firestore rules con custom claims (subset SDD-03)
 *  10. Audit log entries (user.created)
 *
 * Uso:
 *   pnpm verify:auth
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import { setUserRole } from '../apps/functions/src/v1/users/set-role.js';
import {
  signSessionWithSecret,
  verifySessionCookieWithSecret,
} from '../apps/web/features/auth/server/jose-utils';

// =============================================================================
// Setup: Admin SDK contra emuladores
// =============================================================================
process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080';
process.env['FIREBASE_AUTH_EMULATOR_HOST'] = '127.0.0.1:9099';
process.env['FIREBASE_STORAGE_EMULATOR_HOST'] = '127.0.0.1:9199';
// Mismo default que scripts/emulators.sh (para que las CFs firmen con el
// mismo secret que usamos acá para verificar).
process.env['SESSION_COOKIE_SECRET'] =
  process.env['SESSION_COOKIE_SECRET'] ??
  'dev-secret-shared-by-cf-and-middleware-must-be-at-least-32-chars-long';

if (getApps().length === 0) {
  initializeApp({ projectId: 'admin-platform-dev' });
}

const auth = getAuth();
const db = getFirestore();
const FUNCTIONS_BASE = 'http://127.0.0.1:5001/admin-platform-dev/us-central1';

// =============================================================================
// Helpers
// =============================================================================
let _testId = 0;
let _pass = 0;
let _fail = 0;

function nextId(): string {
  return `verify_${Date.now()}_${++_testId}`;
}

async function step(name: string, fn: () => Promise<void>): Promise<void> {
  process.stdout.write(`  ${name} ... `);
  try {
    await fn();
    console.warn('\x1b[32mOK\x1b[0m');
    _pass++;
  } catch (e) {
    console.warn('\x1b[31mFAIL\x1b[0m');
    console.warn(`    ${(e as Error).message}`);
    _fail++;
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg: string): void {
  if (actual !== expected) {
    throw new Error(`${msg} — expected ${String(expected)}, got ${String(actual)}`);
  }
}

async function callOnCall<T>(name: string, data: unknown, idToken?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    result?: T;
    error?: { message: string; status?: string };
  };
  if (!res.ok) {
    throw new Error(`CF ${name} failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.result as T;
}

async function callOnRequest<T>(
  name: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; data: T; setCookie: string | null }> {
  const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const setCookie = res.headers.get('set-cookie');
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data, setCookie };
}

async function signInForToken(
  email: string,
  password: string,
): Promise<{ uid: string; idToken: string }> {
  // SignIn via REST (no createUser — la CF createUser se encarga en el flow real).
  const res = await fetch(
    `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!res.ok) {
    throw new Error(`signInWithPassword failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { localId: string; idToken: string };
  return { uid: json.localId, idToken: json.idToken };
}

// =============================================================================
// Tests
// =============================================================================

async function main(): Promise<void> {
  console.warn('\n\x1b[1m=== verify-auth: SDD-05 integration test suite ===\x1b[0m\n');

  // Limpiar state
  console.warn('[setup] Limpiando usuarios de tests previos…');
  try {
    const list = await auth.listUsers();
    for (const u of list.users) {
      if (u.email?.endsWith('@verify.test')) {
        await auth.deleteUser(u.uid);
      }
    }
  } catch (e) {
    console.warn(`  (warn) No se pudo limpiar: ${(e as Error).message}`);
  }

  // Limpiar users collection
  const usersSnap = await db.collection('users').get();
  for (const d of usersSnap.docs) {
    await d.ref.delete();
  }
  // Limpiar audit_logs
  const auditSnap = await db.collection('audit_logs').get();
  for (const d of auditSnap.docs) {
    await d.ref.delete();
  }

  let firstUser: { uid: string; idToken: string } | undefined;
  let sessionCookie: string | undefined;

  // === Test 1: First user signup → role='admin' ===
  // La CF v1AuthSignUp es PUBLICA: el cliente no necesita estar autenticado.
  // La CF crea el user en Auth via Admin SDK + setea claims + crea doc.
  console.warn('\n[1] First user signup (bootstrap admin)');
  await step('v1AuthSignUp CF assigns role=admin for first user', async () => {
    const email = `first-admin@verify.test`;
    const password = '12345678';
    // NO pre-creamos el user: la CF lo hace via Admin SDK
    const result = await callOnCall<{ uid: string; role: string; isFirstUser: boolean }>(
      'v1AuthSignUp',
      { email, password, displayName: 'First Admin' },
    );
    assertEq(result.role, 'admin', 'first user role');
    assertEq(result.isFirstUser, true, 'isFirstUser flag');
    // Ahora hacemos signIn para obtener el idToken (igual que el cliente)
    firstUser = await signInForToken(email, password);
    assertEq(result.uid, firstUser.uid, 'uid match');
  });

  // === Test 2: Claims set + createSession returns cookie ===
  console.warn('\n[2] Session cookie');
  await step('v1AuthCreateSession returns Set-Cookie with __session JWT', async () => {
    assert(firstUser, 'firstUser defined');
    // Re-signin el admin para refrescar idToken con role=admin claim
    // (v1AuthSignUp CF setea custom claims vía Admin SDK, pero el idToken
    // original fue emitido antes. Necesitamos un token con los claims nuevos).
    const adminReSignin = await signInForToken('first-admin@verify.test', '12345678');
    const adminIdTokenWithClaims = adminReSignin.idToken;
    const { status, setCookie } = await callOnRequest('v1AuthCreateSession', {
      idToken: adminIdTokenWithClaims,
    });
    assertEq(status, 200, 'createSession status');
    assert(setCookie, 'setCookie present');
    assert(setCookie?.includes('__session='), 'cookie name');
    const match = setCookie?.match(/__session=([^;]+)/);
    assert(match, 'session cookie value');
    sessionCookie = match?.[1];
  });

  // === Test 3: verifySessionCookie + jose roundtrip ===
  console.warn('\n[3] JWT verification with jose');
  await step('verifySessionCookie returns valid payload', async () => {
    assert(sessionCookie, 'sessionCookie defined');
    const payload = await verifySessionCookieWithSecret(
      sessionCookie,
      process.env['SESSION_COOKIE_SECRET']!,
    );
    assert(payload, 'payload is not null');
    assertEq(payload?.uid, firstUser?.uid, 'uid in payload');
    assertEq(payload?.role, 'admin', 'role in payload');
  });
  await step('signSession + verifySessionCookie roundtrip works', async () => {
    const jwt = await signSessionWithSecret(
      {
        uid: 'u_test',
        email: 't@x.com',
        role: 'expert',
        organizationId: null,
      },
      process.env['SESSION_COOKIE_SECRET']!,
    );
    const payload = await verifySessionCookieWithSecret(jwt, process.env['SESSION_COOKIE_SECRET']!);
    assert(payload, 'roundtrip payload');
    assertEq(payload?.uid, 'u_test', 'roundtrip uid');
  });

  // === Test 4: Second user signup sin invitación → rejected ===
  console.warn('\n[4] Second user signup rejected (Q3=C)');
  await step('v1AuthSignUp CF rejects second user (count > 0)', async () => {
    const email = `second-wo-invite@verify.test`;
    const password = '12345678';
    const res = await fetch(`${FUNCTIONS_BASE}/v1AuthSignUp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { email, password, displayName: 'Second' } }),
    });
    assert(res.status === 403, `expected 403, got ${res.status}`);
    const body = (await res.json()) as { error?: { message: string } };
    assert(
      body.error?.message.toLowerCase().includes('invit') ||
        body.error?.message.toLowerCase().includes('admin'),
      `rejection message contains invitación/admin: ${body.error?.message}`,
    );
  });

  // === Test 5: Admin invite user ===
  console.warn('\n[5] Admin v1UsersCreate CF');
  let invitedUid: string | undefined;
  await step('v1UsersCreate (admin) creates Auth user + Firestore doc + claims', async () => {
    assert(firstUser, 'firstUser defined');
    // IMPORTANTE: re-signIn el admin para refrescar idToken con role=admin claim
    // (los claims se setearon via setCustomUserClaims después del signin inicial).
    const adminReSignin = await signInForToken('first-admin@verify.test', '12345678');
    const adminTokenWithClaims = adminReSignin.idToken;
    // v1UsersCreate ya no acepta password (SDD-06 spec 4.8 — el invited user
    // debe resetear su password vía email magic link, TODO SDD-08). Para que
    // el test E2E siga funcionando, seteamos la password manualmente con
    // Admin SDK después del invite.
    const result = await callOnCall<{ uid: string; email: string; role: string }>(
      'v1UsersCreate',
      {
        email: 'invited@verify.test',
        displayName: 'Invited',
        role: 'expert',
      },
      adminTokenWithClaims,
    );
    invitedUid = result.uid;
    assertEq(result.role, 'expert', 'invited role');
    const userRecord = await auth.getUser(invitedUid);
    assertEq(userRecord.email, 'invited@verify.test', 'auth user email');
    const firestoreDoc = await db.collection('users').doc(invitedUid).get();
    assert(firestoreDoc.exists, 'firestore user doc exists');
    assertEq(firestoreDoc.data()?.status, 'invited', 'user status=invited');
    assertEq(firestoreDoc.data()?.created_by, firstUser?.uid, 'created_by = admin uid');
    // Workaround: setear password via Admin SDK (TODO: eliminar en SDD-08)
    await auth.updateUser(invitedUid, { password: '12345678' });
  });

  // === Test 6: Invited user signs in (login con creds) ===
  console.warn('\n[6] Invited user signin');
  await step('invited user can signIn with password set by Admin SDK', async () => {
    assert(invitedUid, 'invitedUid defined');
    await signInForToken('invited@verify.test', '12345678');
  });

  // === Test 7: clearSession borra cookie ===
  console.warn('\n[7] v1AuthClearSession');
  await step('v1AuthClearSession sets Max-Age=0', async () => {
    const { setCookie } = await callOnRequest('v1AuthClearSession', {});
    assert(setCookie, 'setCookie present');
    assert(setCookie?.includes('Max-Age=0'), 'Max-Age=0 in clear');
  });

  // === Test 8: setUserRole actualiza claims ===
  console.warn('\n[8] setUserRole updates claims');
  await step('setUserRole(invited, recruiter) updates custom claims', async () => {
    assert(invitedUid, 'invitedUid defined');
    await setUserRole(invitedUid, 'recruiter');
    const userRecord = await auth.getUser(invitedUid);
    assertEq(userRecord.customClaims?.['role'], 'recruiter', 'role claim updated');
  });

  // === Test 9: Firestore rules con custom claims ===
  console.warn('\n[9] Firestore rules with custom claims');
  await step('admin can read /users/{uid}', async () => {
    assert(firstUser?.idToken, 'firstUser.idToken defined');
    // Firestore REST API: GET /v1/projects/{project}/databases/(default)/documents/users/{uid}
    const res = await fetch(
      `http://127.0.0.1:8080/v1/projects/admin-platform-dev/databases/(default)/documents/users/${firstUser.uid}`,
      { headers: { Authorization: `Bearer ${firstUser.idToken}` } },
    );
    assert(res.ok, `firestore read ok (status ${res.status})`);
  });

  // === Test 10: Audit log entries ===
  console.warn('\n[10] Audit logs');
  await step('user.created entries exist (first + invited)', async () => {
    const auditSnap = await db.collection('audit_logs').get();
    // Esperado: 2 (first user created + invited user created)
    assert(auditSnap.size >= 2, `expected >=2 audit logs, got ${auditSnap.size}`);
    const actions = auditSnap.docs.map((d) => d.data()['action']);
    assert(actions.includes('user.created'), 'has user.created entries');
    const userCreatedDocs = auditSnap.docs.filter((d) => d.data()['action'] === 'user.created');
    assert(userCreatedDocs.length === 2, `expected 2 user.created, got ${userCreatedDocs.length}`);
  });

  // === Summary ===
  console.warn(`\n\x1b[1m=== Result: ${_pass} passed, ${_fail} failed ===\x1b[0m\n`);
  if (_fail > 0) {
    process.exit(1);
  }
  // Helper: ensure _testId is used to avoid unused warning
  void nextId;
}

main().catch((e) => {
  console.error('\x1b[31mFATAL:\x1b[0m', e);
  process.exit(1);
});

/* eslint-disable no-console */
/**
 * Seed script — puebla los emuladores de Firebase con datos de demo.
 *
 * Por defecto crea:
 *   - 1 organización: org_default / "Empresa Demo"
 *   - 1 usuario admin: admin@empresa.com  pass=1234567890  role=admin
 *   - 1 usuario recruiter: recruiter@empresa.com  role=recruiter
 *   - 1 usuario expert: expert@empresa.com       role=expert
 *
 * Idempotente: corre N veces y los registros quedan consistentes. Si un user
 * ya existe en Auth, se le setea la password (para que sobreviva a un
 * export/import) y se re-aplican los custom claims.
 *
 * Conectarse a emuladores locales: requiere que los emuladores estén corriendo.
 *
 * Uso:
 *   pnpm seed:emulators
 */

import { FieldValue } from 'firebase-admin/firestore';

import { getAdminApp, getAdminAuth, getAdminDb } from '../apps/functions/src/firebase-admin.js';

const ORG_ID = 'org_default';

const DEFAULT_ADMIN_PASSWORD = '1234567890';

type SeedUser = {
  uid: string;
  email: string;
  role: 'admin' | 'recruiter' | 'expert';
  password?: string;
  displayName: string;
};

const SEED_USERS: SeedUser[] = [
  {
    uid: 'u_admin',
    email: 'admin@empresa.com',
    role: 'admin',
    password: DEFAULT_ADMIN_PASSWORD,
    displayName: 'Admin Empresa',
  },
  { uid: 'u_recruiter', email: 'recruiter@empresa.com', role: 'recruiter', displayName: 'Recruiter' },
  { uid: 'u_expert', email: 'expert@empresa.com', role: 'expert', displayName: 'Expert' },
];

async function ensureAuthUser(
  auth: ReturnType<typeof getAdminAuth>,
  u: SeedUser,
): Promise<void> {
  try {
    await auth.createUser({
      uid: u.uid,
      email: u.email,
      ...(u.password ? { password: u.password } : {}),
      displayName: u.displayName,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('already exists')) {
      throw e;
    }
    // El user ya existe: si tenemos password, la re-aplicamos para garantizar
    // que sobrevive a export/import del emulador (la password no se persiste
    // en el export por default, hay que re-setearla).
    if (u.password) {
      await auth.updateUser(u.uid, { password: u.password });
    }
  }
}

async function main(): Promise<void> {
  // Apuntar Admin SDK a los emuladores locales ANTES de instanciar.
  process.env['FIRESTORE_EMULATOR_HOST'] =
    process.env['FIRESTORE_EMULATOR_HOST'] ?? '127.0.0.1:8080';
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] =
    process.env['FIREBASE_AUTH_EMULATOR_HOST'] ?? '127.0.0.1:9099';
  process.env['FIREBASE_STORAGE_EMULATOR_HOST'] =
    process.env['FIREBASE_STORAGE_EMULATOR_HOST'] ?? '127.0.0.1:9199';

  const auth = getAdminAuth();
  const db = getAdminDb();

  // ============ 1. Organización por defecto ============
  await db
    .collection('organizations')
    .doc(ORG_ID)
    .set(
      {
        name: 'Empresa Demo',
        slug: 'default',
        plan: 'free',
        settings: { timezone: 'UTC', locale: 'es' },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: 'system',
        deletedAt: null,
      },
      { merge: true },
    );

  // ============ 2. Usuarios seed ============
  for (const u of SEED_USERS) {
    await ensureAuthUser(auth, u);

    // Custom Claims (server-authoritative)
    await auth.setCustomUserClaims(u.uid, {
      role: u.role,
      organizationId: ORG_ID,
    });

    // Mirror en Firestore
    await db
      .collection('users')
      .doc(u.uid)
      .set(
        {
          email: u.email,
          display_name: u.displayName,
          photo_url: null,
          role: u.role,
          organization_id: ORG_ID,
          status: 'active',
          last_login_at: null,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
          created_by: 'system',
          deleted_at: null,
        },
        { merge: true },
      );
  }

  // Touch app para forzar inicialización lazy y detectar errores temprano.
  void getAdminApp();

  console.log('Seed complete: 1 organization + 3 users');
  console.log(`  ${ORG_ID.padEnd(11)}  (Empresa Demo)`);
  for (const u of SEED_USERS) {
    const pwd = u.password ? ` pass=${u.password}` : '';
    console.log(`  ${u.uid.padEnd(11)}  ${u.email.padEnd(28)} role=${u.role}${pwd}`);
  }
  console.log('UI del emulador: http://localhost:4000');
}

main().catch((e: unknown) => {
  console.error('[seed] failed:', e);
  process.exit(1);
});
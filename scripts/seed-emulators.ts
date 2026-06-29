/* eslint-disable no-console */
/**
 * Seed script — puebla los emuladores de Firebase con 1 org + 3 users.
 *
 * Idempotente: corre N veces y el resultado es el mismo.
 * Conectarse a emuladores locales: requiere que `pnpm emulators` esté corriendo.
 *
 * Uso:
 *   pnpm seed:emulators
 */

import { FieldValue } from 'firebase-admin/firestore';

import { getAdminApp, getAdminAuth, getAdminDb } from '../apps/functions/src/firebase-admin.js';

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
    .doc('org_default')
    .set(
      {
        name: 'Default Org',
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
  const seedUsers = [
    { uid: 'u_admin', email: 'admin@example.com', role: 'admin' as const },
    { uid: 'u_recruiter', email: 'recruiter@example.com', role: 'recruiter' as const },
    { uid: 'u_expert', email: 'expert@example.com', role: 'expert' as const },
  ];

  for (const u of seedUsers) {
    // Crear/recuperar user en Auth (idempotente: 'already exists' se ignora)
    try {
      await auth.createUser({ uid: u.uid, email: u.email });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('already exists')) {
        throw e;
      }
    }

    // Custom Claims (server-authoritative)
    await auth.setCustomUserClaims(u.uid, {
      role: u.role,
      organizationId: 'org_default',
    });

    // Mirror en Firestore
    await db
      .collection('users')
      .doc(u.uid)
      .set(
        {
          email: u.email,
          display_name: u.email.split('@')[0],
          photo_url: null,
          role: u.role,
          organization_id: 'org_default',
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
  console.log('  org_default  (admin-platform-dev)');
  console.log('  u_admin      admin@example.com     role=admin');
  console.log('  u_recruiter  recruiter@example.com role=recruiter');
  console.log('  u_expert     expert@example.com    role=expert');
  console.log('UI del emulador: http://localhost:4000');
}

main().catch((e: unknown) => {
  console.error('[seed] failed:', e);
  process.exit(1);
});

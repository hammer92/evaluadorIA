/* eslint-disable no-console */
/**
 * Validación runtime de firestore.rules + storage.rules contra emuladores.
 * Usa firebase-admin para setear Custom Claims (el Auth emulator permite
 * el flujo Admin SDK sin credenciales).
 *
 * Uso: tsx scripts/verify-rules.ts
 */

import { initializeApp as initClientApp, deleteApp } from 'firebase/app';
import {
  getAuth as getClientAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  getFirestore as getClientFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import {
  getStorage as getClientStorage,
  connectStorageEmulator,
  ref as storageRef,
  uploadBytes,
  getBytes,
  uploadString,
} from 'firebase/storage';
import cert from 'firebase-admin/app';
import { initializeApp as initAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

const PROJECT_ID = 'admin-platform-dev';

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function expectFails(name: string, p: Promise<unknown>): Promise<void> {
  try {
    await p;
    check(name, false, 'expected to fail but succeeded');
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    const msg = e instanceof Error ? e.message : String(e);
    const ok = code === 'permission-denied' || /permission/i.test(msg);
    check(name, ok, `code=${code} msg=${msg.slice(0, 80)}`);
  }
}

async function expectOk(name: string, p: Promise<unknown>): Promise<void> {
  try {
    await p;
    check(name, true);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    check(name, false, msg.slice(0, 120));
  }
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SDD-03 Rules Verification — emulators on 127.0.0.1');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Admin SDK apunta a emuladores automáticamente
  process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080';
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] = '127.0.0.1:9099';
  process.env['FIREBASE_STORAGE_EMULATOR_HOST'] = '127.0.0.1:9199';

  const adminApp = initAdminApp({ projectId: PROJECT_ID });
  const adminAuth = getAdminAuth(adminApp);

  // Crear 3 usuarios con custom claims vía Admin SDK
  const ADMIN_EMAIL = 'admin-verify@test.local';
  const EXPERT_EMAIL = 'expert-verify@test.local';
  const RECRUITER_EMAIL = 'recruiter-verify@test.local';

  const ensureUser = async (email: string): Promise<string> => {
    try {
      const u = await adminAuth.createUser({ email, password: 'password123' });
      return u.uid;
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/email-already-exists' || code === 'auth/email-already-in-use') {
        const u = await adminAuth.getUserByEmail(email);
        return u.uid;
      }
      throw e;
    }
  };

  const adminUid = await ensureUser(ADMIN_EMAIL);
  const expertUid = await ensureUser(EXPERT_EMAIL);
  const recruiterUid = await ensureUser(RECRUITER_EMAIL);

  await adminAuth.setCustomUserClaims(adminUid, { role: 'admin', organizationId: 'org_default' });
  await adminAuth.setCustomUserClaims(expertUid, { role: 'expert', organizationId: 'org_default' });
  await adminAuth.setCustomUserClaims(recruiterUid, {
    role: 'recruiter',
    organizationId: 'org_default',
  });

  console.log(`Users + custom claims:`);
  console.log(`  admin     ${adminUid}  role=admin`);
  console.log(`  expert    ${expertUid}  role=expert`);
  console.log(`  recruiter ${recruiterUid}  role=recruiter\n`);

  // Cliente SDK
  const clientApp = initClientApp(
    {
      apiKey: 'fake-api-key',
      authDomain: `${PROJECT_ID}.firebaseapp.com`,
      projectId: PROJECT_ID,
      storageBucket: `${PROJECT_ID}.appspot.com`,
      messagingSenderId: '0',
      appId: '1:0:web:0',
    },
    'verify-client',
  );
  const auth = getClientAuth(clientApp);
  const db = getClientFirestore(clientApp);
  const storage = getClientStorage(clientApp);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);

  // ==========================================================================
  // FIRESTORE: users/{uid}
  // ==========================================================================
  console.log('─── Firestore: users/{uid} ───');

  // Sin autenticar — todo debe fallar
  await expectFails('read users/u_admin sin auth', getDoc(doc(db, 'users/u_admin')));
  await expectFails(
    'create users/u_x sin auth',
    setDoc(doc(db, 'users/u_x'), {
      email: 'x@x.com',
      role: 'recruiter',
      status: 'invited',
      createdAt: serverTimestamp(),
    }),
  );

  // Login admin
  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, 'password123');
  console.log('\n  [logged in as admin]');

  await expectOk('admin read users/u_expert', getDoc(doc(db, 'users/u_expert')));
  await expectOk(
    'admin create users/u_new1',
    setDoc(doc(db, 'users/u_new1'), {
      email: 'new1@x.com',
      role: 'recruiter',
      status: 'invited',
      createdAt: serverTimestamp(),
    }),
  );
  await expectOk(
    'admin update users/u_new1 role',
    updateDoc(doc(db, 'users/u_new1'), { role: 'expert' as never }),
  );
  await expectOk('admin delete users/u_new1', deleteDoc(doc(db, 'users/u_new1')));
  await expectOk('admin list users', getDocs(collection(db, 'users')));

  await signOut(auth);

  // Login expert
  await signInWithEmailAndPassword(auth, EXPERT_EMAIL, 'password123');
  console.log('\n  [logged in as expert]');

  // Setup: el doc del expert debe existir antes de updatear (en prod lo crea admin).
  // Re-login admin momentáneamente para crear el doc.
  await signOut(auth);
  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, 'password123');
  await expectOk(
    'admin setup: crear doc de expert',
    setDoc(doc(db, `users/${expertUid}`), {
      email: EXPERT_EMAIL,
      displayName: 'Expert Original',
      role: 'expert',
      status: 'active',
      createdAt: serverTimestamp(),
    }),
  );
  await signOut(auth);
  await signInWithEmailAndPassword(auth, EXPERT_EMAIL, 'password123');

  await expectOk('expert read users/u_recruiter', getDoc(doc(db, 'users/u_recruiter')));
  await expectFails(
    'expert create users/u_x (criterio SDD-03 #4)',
    setDoc(doc(db, 'users/u_x'), {
      email: 'x@x.com',
      role: 'recruiter',
      status: 'invited',
      createdAt: serverTimestamp(),
    }),
  );
  await expectFails(
    'expert update role de u_recruiter (criterio SDD-03 #6)',
    updateDoc(doc(db, 'users/u_recruiter'), { role: 'admin' as never }),
  );
  await expectOk(
    'expert update own displayName',
    updateDoc(doc(db, `users/${expertUid}`), { displayName: 'Updated Expert' }),
  );

  await signOut(auth);

  // Login recruiter
  await signInWithEmailAndPassword(auth, RECRUITER_EMAIL, 'password123');
  console.log('\n  [logged in as recruiter]');

  // UIDs únicos por run para evitar conflictos con state stale del emulador
  const recruiterDocId = `u_recruiter_test_${Date.now()}`;

  await expectOk(
    'recruiter create users/u_new2',
    setDoc(doc(db, `users/${recruiterDocId}`), {
      email: 'new2@x.com',
      role: 'expert',
      status: 'invited',
      createdAt: serverTimestamp(),
    }),
  );
  await expectFails(
    'recruiter change role de u_new2',
    updateDoc(doc(db, `users/${recruiterDocId}`), { role: 'admin' as never }),
  );
  await expectOk(
    'recruiter change status de u_new2',
    updateDoc(doc(db, `users/${recruiterDocId}`), { status: 'suspended' as never }),
  );

  await signOut(auth);

  // ==========================================================================
  // FIRESTORE: auditLogs (append-only, write=false)
  // ==========================================================================
  console.log('\n─── Firestore: auditLogs (append-only) ───');
  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, 'password123');
  await expectFails(
    'cliente NO puede escribir auditLogs (write=false)',
    setDoc(doc(db, 'auditLogs/log1'), {
      action: 'user.created',
      actorId: 'x',
      actorEmail: 'x@x.com',
      targetType: 'user',
      targetId: 'y',
      organizationId: null,
      metadata: {},
      ip: null,
      userAgent: null,
      createdAt: serverTimestamp(),
    }),
  );

  // ==========================================================================
  // FIRESTORE: organizaciones (default-deny en path no existente)
  // ==========================================================================
  console.log('\n─── Firestore: organizations + default-deny ───');
  await expectOk(
    'admin create organizations/org_test',
    setDoc(doc(db, 'organizations/org_test'), {
      name: 'Test Org',
      slug: 'test',
      plan: 'free',
      createdAt: serverTimestamp(),
    }),
  );
  await expectFails(
    'admin create en path no declarado (collection random)',
    setDoc(doc(db, 'randomCollection/x'), {
      foo: 'bar',
      createdAt: serverTimestamp(),
    }),
  );
  await signOut(auth);

  // ==========================================================================
  // STORAGE: avatars/{uid}/...
  // ==========================================================================
  console.log('\n─── Storage: avatars/{uid}/{file} ───');

  // Sin auth: lectura de avatar falla (default deny)
  await expectFails(
    'storage: read avatar sin auth',
    getBytes(storageRef(storage, `avatars/${adminUid}/avatar.jpg`)),
  );

  // Login admin
  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, 'password123');
  await expectOk(
    'admin read avatar de expert (404 si no existe pero regla pasa)',
    getBytes(storageRef(storage, `avatars/${expertUid}/avatar.jpg`)).catch((e: unknown) => {
      const code = (e as { code?: string }).code;
      if (code === 'storage/object-not-found') return;
      throw e;
    }),
  );

  // Expert puede escribir su propio avatar
  await signOut(auth);
  await signInWithEmailAndPassword(auth, EXPERT_EMAIL, 'password123');
  await expectOk(
    'expert upload a SU avatar',
    uploadBytes(
      storageRef(storage, `avatars/${expertUid}/avatar.jpg`),
      new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' }),
      { contentType: 'image/jpeg' },
    ),
  );
  await expectFails(
    'expert upload a avatar de OTRO',
    uploadString(storageRef(storage, `avatars/${adminUid}/avatar.jpg`), 'data', 'raw'),
  );

  // Archivo > 2MB debe fallar
  const bigBlob = new Blob([new Uint8Array(3 * 1024 * 1024)], { type: 'image/jpeg' });
  await expectFails(
    'expert upload > 2MB',
    uploadBytes(storageRef(storage, `avatars/${expertUid}/big.jpg`), bigBlob),
  );

  // reports/ solo admin puede leer
  await expectFails(
    'expert read reports/',
    getBytes(storageRef(storage, 'reports/test.pdf')).then(
      () => {
        throw new Error('expected fail');
      },
      (e: unknown) => {
        const code = (e as { code?: string }).code;
        if (code === 'storage/object-not-found') throw new Error('expected permission-denied');
        throw e;
      },
    ),
  );
  await signOut(auth);

  // Admin puede leer reports/
  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, 'password123');
  await expectOk(
    'admin read reports/test.pdf',
    getBytes(storageRef(storage, 'reports/test.pdf')).catch((e: unknown) => {
      const code = (e as { code?: string }).code;
      if (code === 'storage/object-not-found') return;
      throw e;
    }),
  );

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  RESULTADO: ${passed} ✅ / ${failed} ❌`);
  console.log('═══════════════════════════════════════════════════════════════');

  await deleteApp(clientApp);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e: unknown) => {
  console.error('verify-rules failed:', e);
  process.exit(2);
});
// Reference unused import to avoid TS6133
void cert;

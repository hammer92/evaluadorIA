import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

// =============================================================================
// Firebase Admin SDK — singleton wrapper
// =============================================================================
// Decisión Q3 (requirements-verification-questions.md):
//   Si detectamos FIRESTORE_EMULATOR_HOST o FIREBASE_AUTH_EMULATOR_HOST,
//   inicializamos lightweight (sin credenciales, projectId ficticio).
//   En staging/prod, exigimos credenciales completas vía env vars.
// =============================================================================

const EMULATOR_PROJECT_ID_FALLBACK = 'admin-platform-dev';

let _app: App | undefined;

export function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    const existing = getApps()[0];
    if (existing) {
      _app = existing;
      return _app;
    }
  }

  const isEmulator = Boolean(
    process.env['FIRESTORE_EMULATOR_HOST'] || process.env['FIREBASE_AUTH_EMULATOR_HOST'],
  );

  if (isEmulator) {
    // El functions emulator setea GCLOUD_PROJECT automáticamente. Si no,
    // usamos FIREBASE_ADMIN_PROJECT_ID o el fallback.
    const projectId =
      process.env['GCLOUD_PROJECT'] ??
      process.env['FIREBASE_ADMIN_PROJECT_ID'] ??
      EMULATOR_PROJECT_ID_FALLBACK;
    _app = initializeApp({ projectId });
  } else {
    const projectId = process.env['FIREBASE_ADMIN_PROJECT_ID'];
    const clientEmail = process.env['FIREBASE_ADMIN_CLIENT_EMAIL'];
    const privateKey = process.env['FIREBASE_ADMIN_PRIVATE_KEY'];

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        '[firebase-admin] FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and ' +
          'FIREBASE_ADMIN_PRIVATE_KEY are required when not running against emulators.',
      );
    }

    _app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  }

  return _app;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function getAdminStorage(): Storage {
  return getStorage(getAdminApp());
}

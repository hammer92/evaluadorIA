import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

// =============================================================================
// Firebase Admin SDK — singleton wrapper
// =============================================================================
// En CFv2 Cloud Run, el runtime SA (configurado en la SA del deploy SA)
// provee las credenciales automáticamente via applicationDefault().
// NO requiere env vars adicionales en producción — solo projectId.
//
// En emuladores (functions + firestore + auth emulators), se inicializa
// lightweight con projectId ficticio.
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
    process.env['FIRESTORE_EMULATOR_HOST'] ?? process.env['FIREBASE_AUTH_EMULATOR_HOST'],
  );

  const projectId =
    process.env['FIREBASE_ADMIN_PROJECT_ID'] ??
    process.env['GCLOUD_PROJECT'] ??
    EMULATOR_PROJECT_ID_FALLBACK;

  if (isEmulator) {
    _app = initializeApp({ projectId });
  } else {
    // En CFv2 Cloud Run, el runtime SA provee credenciales vía
    // applicationDefault() (no requiere env vars adicionales).
    _app = initializeApp({ projectId });
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

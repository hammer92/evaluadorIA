import { getApps, getApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';

import { clientEnv } from '@/env';

// =============================================================================
// Firebase Client SDK — singleton wrapper (Next.js client-side)
// =============================================================================
// Único punto de acceso a Firebase desde el cliente. Cualquier uso del SDK
// fuera de este archivo es violación arquitectónica (enforced por ESLint
// via `no-restricted-imports` en apps/web).
//
// En entorno `dev` se conecta automáticamente a los emuladores
// (auth:9099, firestore:8080, storage:9199) — el guard evita reconectar
// durante HMR.
// =============================================================================

function createFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();
  return initializeApp({
    apiKey: clientEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: clientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: clientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: clientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: clientEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: clientEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
    ...(clientEnv.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
      ? { measurementId: clientEnv.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID }
      : {}),
  });
}

export const firebaseApp = createFirebaseApp();
export const auth: Auth = getAuth(firebaseApp);
export const db: Firestore = getFirestore(firebaseApp);
export const storage: FirebaseStorage = getStorage(firebaseApp);

// Conectar a emuladores solo en dev y solo en el cliente (no SSR).
// El guard `_emulatorConfig` evita reconectar en HMR.
if (clientEnv.NEXT_PUBLIC_APP_ENV === 'dev' && typeof window !== 'undefined') {
  if (!(auth as unknown as { _emulatorConfig?: unknown })._emulatorConfig) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  if (!(db as unknown as { _emulatorConfig?: unknown })._emulatorConfig) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  if (!(storage as unknown as { _emulatorConfig?: unknown })._emulatorConfig) {
    connectStorageEmulator(storage, '127.0.0.1', 9199);
  }
}

export type { FirebaseApp, Auth, Firestore, FirebaseStorage };

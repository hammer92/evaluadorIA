import { getApps, getApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
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
//
// Inicialización LAZY: `firebaseApp`/`auth`/`db`/`storage` se crean en el
// primer access, no al cargar el módulo. Esto permite que tests inyecten
// sus propias instancias vía `__setFirebaseApp` o que el módulo se cargue
// sin env vars disponibles (e.g. typecheck, build en CI).
// =============================================================================

let _app: FirebaseApp | undefined;

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

function ensureApp(): FirebaseApp {
  _app ??= createFirebaseApp();
  return _app;
}

let _auth: Auth | undefined;
let _db: Firestore | undefined;
let _storage: FirebaseStorage | undefined;
let _functions: Functions | undefined;

function ensureAuth(): Auth {
  _auth ??= getAuth(ensureApp());
  return _auth;
}
function ensureDb(): Firestore {
  _db ??= getFirestore(ensureApp());
  return _db;
}
function ensureStorage(): FirebaseStorage {
  _storage ??= getStorage(ensureApp());
  return _storage;
}
function ensureFunctions(): Functions {
  _functions ??= getFunctions(ensureApp(), 'us-central1');
  return _functions;
}

// Conectar a emuladores una sola vez, EAGERLY al primer access de CUALQUIER
// servicio (no lazy-after-call). El auth SDK marca `_canInitEmulator = false`
// en la primera network call (e.g. onAuthStateChanged), y connectAuthEmulator
// falla con `auth/emulator-config-failed` si se llama después. Por eso la
// conexión tiene que ocurrir ANTES del primer access al servicio.
let _emulatorsConnected = false;
function connectEmulatorsOnce(): void {
  if (_emulatorsConnected) return;
  if (typeof window === 'undefined') return; // SSR no aplica
  if (clientEnv.NEXT_PUBLIC_APP_ENV !== 'dev') return;
  const a = ensureAuth();
  const d = ensureDb();
  const s = ensureStorage();
  const fns = ensureFunctions();
  try {
    connectAuthEmulator(a, 'http://127.0.0.1:9099', { disableWarnings: true });
  } catch {
    // Idempotente: si el SDK ya tenía _emulatorUrl seteado (HMR re-import),
    // reconnect puede tirar. Ignorar.
  }
  try {
    connectFirestoreEmulator(d, '127.0.0.1', 8080);
  } catch {
    // Idempotente.
  }
  try {
    connectStorageEmulator(s, '127.0.0.1', 9199);
  } catch {
    // Idempotente.
  }
  try {
    connectFunctionsEmulator(fns, '127.0.0.1', 5001);
  } catch {
    // Idempotente.
  }
  _emulatorsConnected = true;
}

function lazyProxy<T extends object>(ensure: () => T): T {
  return new Proxy({} as T, {
    get(_t, prop) {
      // Conectar ANTES de retornar cualquier propiedad. Esto garantiza que
      // connectAuthEmulator corre antes de la primera network call del SDK
      // (e.g. onAuthStateChanged dispara una llamada implícita al auth
      // server apenas se suscribe).
      connectEmulatorsOnce();
      const obj = ensure();
      return (obj as unknown as Record<string | symbol, unknown>)[prop];
    },
  });
}

export const firebaseApp = lazyProxy<FirebaseApp>(ensureApp);
export const auth = lazyProxy<Auth>(ensureAuth);
export const db = lazyProxy<Firestore>(ensureDb);
export const storage = lazyProxy<FirebaseStorage>(ensureStorage);
export const functions = lazyProxy<Functions>(ensureFunctions);

// Test helpers
export function __resetFirebaseClient(): void {
  _app = undefined;
  _auth = undefined;
  _db = undefined;
  _storage = undefined;
  _functions = undefined;
  _emulatorsConnected = false;
}

export function __setFirebaseApp(app: FirebaseApp): void {
  _app = app;
  _auth = getAuth(app);
  _db = getFirestore(app);
  _storage = getStorage(app);
  _functions = getFunctions(app, 'us-central1');
  _emulatorsConnected = false;
}

// Bootstrap: en dev, conectar a los emuladores en cuanto se carga este módulo
// en el cliente. Sin esto, la primera auth call (típicamente onAuthStateChanged
// desde useEffect) corre antes de que connectEmulatorsOnce haya tenido chance
// de ejecutarse vía el lazy proxy, y el SDK marca _canInitEmulator = false.
if (typeof window !== 'undefined' && clientEnv.NEXT_PUBLIC_APP_ENV === 'dev') {
  connectEmulatorsOnce();
}

export type { FirebaseApp, Auth, Firestore, FirebaseStorage, Functions };

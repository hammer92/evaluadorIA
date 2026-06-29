// =============================================================================
// Firebase Auth + Functions — re-exports nombrados (único punto de acceso desde el cliente).
// =============================================================================
// Cero lógica. Ver SDD-05 spec sección 4.2.
// Las funciones del SDK se importan de `firebase/auth` y `firebase/functions`
// y se re-exportan para que `features/auth/api/auth-api.ts` tenga un único
// path de import.
// =============================================================================

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import { httpsCallable, type Functions } from 'firebase/functions';

import { auth, functions } from './client';

export { auth, functions };
export {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  fbSignOut as signOut,
  updateProfile,
  httpsCallable,
};
export type { Auth, User, Functions };

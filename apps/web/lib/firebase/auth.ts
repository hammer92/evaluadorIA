// =============================================================================
// Firebase Auth — re-exports nombrados (único punto de acceso desde el cliente).
// =============================================================================
// Cero lógica. Ver SDD-05 spec sección 4.2.
// Las funciones del SDK se importan de `firebase/auth` y se re-exportan
// para que `features/auth/api/auth-api.ts` tenga un único path de import.
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

import { auth } from './client';

export { auth };
export {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  fbSignOut as signOut,
  updateProfile,
};
export type { Auth, User };

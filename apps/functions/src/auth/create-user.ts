import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { getAdminAuth, getAdminDb } from '../firebase-admin.js';

// =============================================================================
// Cloud Function: v1_users_create
// =============================================================================
// Q3=C (Híbrido): primer user del sistema se vuelve admin automáticamente.
// Resto: rejected con permission-denied (deben ser invitados por admin).
//
// Atomicidad: la decisión first-user-admin se hace en una transacción
// Firestore (count + create). Si count > 0 al commit, abort. Esto previene
// race conditions en signups simultáneos.
//
// Auth: httpsCallable adjunta automáticamente el idToken del current user
// al header Authorization. La CF lo obtiene via req.auth.token (ya verificado
// por el SDK de Functions). NO pedimos idToken en el body — esa es la forma
// vieja con fetch manual.
// =============================================================================

const usersCol = () => getAdminDb().collection('users');

interface CreateUserInput {
  displayName: string;
}

interface CreateUserOutput {
  uid: string;
  role: 'admin' | 'recruiter' | 'expert';
  isFirstUser: boolean;
}

export const createUser = onCall<CreateUserInput, Promise<CreateUserOutput>>(
  { cors: ['http://localhost:3000'] },
  async (req) => {
    // 1. Validar auth
    if (!req.auth?.token) {
      // eslint-disable-next-line no-console
      console.log('[createUser] no auth — req.context?', typeof req);
      throw new HttpsError('unauthenticated', 'Necesitás estar autenticado');
    }
    const uid = req.auth.token.uid;
    const email = req.auth.token.email;

    // 2. Validar input
    const { displayName } = req.data ?? ({} as CreateUserInput);
    if (typeof displayName !== 'string') {
      throw new HttpsError('invalid-argument', 'displayName required');
    }
    if (displayName.length < 1 || displayName.length > 120) {
      throw new HttpsError('invalid-argument', 'displayName length out of range');
    }

    // 3. Transacción: cuenta users no-deleted y crea el doc del caller.
    const auth = getAdminAuth();
    const db = getAdminDb();
    const userRef = db.collection('users').doc(uid);

    return await db.runTransaction<CreateUserOutput>(async (tx) => {
      // Count de users no-deleted. `select` es liviano (solo docId).
      const existing = await tx.get(usersCol().where('deleted_at', '==', null).select());
      const count = existing.size;

      if (count > 0) {
        throw new HttpsError(
          'permission-denied',
          'El registro público está cerrado. Pedile a un admin que te invite.',
        );
      }

      // Primer user → admin
      const role: CreateUserOutput['role'] = 'admin';
      const now = FieldValue.serverTimestamp();
      tx.set(userRef, {
        email: email ?? '',
        display_name: displayName,
        photo_url: null,
        role,
        organization_id: null,
        status: 'active',
        last_login_at: now,
        created_at: now,
        updated_at: now,
        created_by: uid,
        deleted_at: null,
      });

      // Setea custom claims. La CF corre con Admin SDK, no por las rules.
      await auth.setCustomUserClaims(uid, { role, organizationId: null });

      // Audit log
      tx.set(db.collection('audit_logs').doc(), {
        organizationId: null,
        actorId: uid,
        actorEmail: email ?? '',
        action: 'user.created',
        targetType: 'user',
        targetId: uid,
        metadata: { isFirstUser: true, role },
        ip: null,
        userAgent: null,
        createdAt: FieldValue.serverTimestamp(),
      });

      return { uid, role, isFirstUser: true };
    });
  },
);

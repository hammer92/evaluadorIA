import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { getAdminAuth, getAdminDb } from '../firebase-admin.js';

// =============================================================================
// Cloud Function: v1_users_create (PUBLICA, no requiere auth previa)
// =============================================================================
// Q3=C (Híbrido): el primer user del sistema se vuelve admin automáticamente.
// Resto: rejected con permission-denied (deben ser invitados por admin).
//
// El cliente llama esta CF con { email, password, displayName } — NO necesita
// estar autenticado (el flujo de signup es público). La CF usa Admin SDK
// para:
//   1. Crear user en Auth con email/password (puede fallar si ya existe)
//   2. Contar users existentes en transacción (first-user-admin race-free)
//   3. Set custom claims (role=admin si first, sino rejected)
//   4. Crear user doc en Firestore
//   5. Audit log
//   6. Si no es first user → rollback (delete user de Auth)
//
// Después de que esta CF retorna OK, el cliente hace signInWithPassword
// para obtener un idToken válido, y luego llama createSession para setear
// la cookie httpOnly.
// =============================================================================

const usersCol = () => getAdminDb().collection('users');

interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
}

interface CreateUserOutput {
  uid: string;
  role: 'admin' | 'recruiter' | 'expert';
  isFirstUser: boolean;
}

const validateEmail = (s: unknown): s is string => typeof s === 'string' && /.+@.+\..+/.test(s);

export const createUser = onCall<CreateUserInput, Promise<CreateUserOutput>>(
  { cors: ['http://localhost:3000'] },
  async (req) => {
    const { email, password, displayName } = req.data ?? ({} as CreateUserInput);

    // Validar input
    if (!validateEmail(email)) {
      throw new HttpsError('invalid-argument', 'Email inválido');
    }
    if (typeof password !== 'string' || password.length < 8) {
      throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 8 caracteres');
    }
    if (typeof displayName !== 'string' || displayName.length < 1 || displayName.length > 120) {
      throw new HttpsError('invalid-argument', 'displayName inválido');
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    // 1. Crear user en Auth via Admin SDK (puede fallar si email ya existe)
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email,
        password,
        displayName,
        emailVerified: false,
        disabled: false,
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'Ya existe un user con ese email');
      }
      throw new HttpsError('internal', `No se pudo crear el user: ${(e as Error).message}`);
    }

    const uid = userRecord.uid;

    // 2. Transacción: cuenta users no-deleted y crea el doc. Si count > 0, abort.
    try {
      return await db.runTransaction<CreateUserOutput>(async (tx) => {
        const existing = await tx.get(usersCol().where('deleted_at', '==', null).select());
        const count = existing.size;

        if (count > 0) {
          // No es first user → rollback
          throw new HttpsError(
            'permission-denied',
            'El registro público está cerrado. Pedile a un admin que te invite.',
          );
        }

        // First user → admin
        const role: CreateUserOutput['role'] = 'admin';
        const now = FieldValue.serverTimestamp();
        tx.set(usersCol().doc(uid), {
          email,
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

        // Audit log
        tx.set(db.collection('audit_logs').doc(), {
          organizationId: null,
          actorId: uid,
          actorEmail: email,
          action: 'user.created',
          targetType: 'user',
          targetId: uid,
          metadata: { isFirstUser: true, role },
          ip: null,
          userAgent: null,
          createdAt: FieldValue.serverTimestamp(),
        });

        // Set custom claims (fuera de la tx para no afectar el rollback atomic)
        // Si esto falla, el rollback manual abajo borra el user.
        await auth.setCustomUserClaims(uid, { role, organizationId: null });

        return { uid, role, isFirstUser: true };
      });
    } catch (e) {
      // Rollback: borrar el user que creamos en Auth (no se pudo completar el flow)
      await auth.deleteUser(uid).catch(() => undefined);
      // Si ya se creó el user doc (parcial commit), no se puede deshacer; lo dejamos
      // porque el siguiente signup lo va a encontrar y rechazar correctamente.
      throw e;
    }
  },
);

import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { getAdminAuth, getAdminDb } from '../../firebase-admin.js';
import { writeAuditLog } from '../../shared/audit.js';
import { RepositoryError } from '../../shared/errors.js';

// =============================================================================
// Cloud Function: v1_auth_sign_up (PUBLICA, no requiere auth previa)
// =============================================================================
// Híbrido (Q3 SDD-05): el primer user del sistema se vuelve admin automáticamente.
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

interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
}

export interface SignUpOutput {
  uid: string;
  role: 'admin' | 'recruiter' | 'expert';
  isFirstUser: boolean;
}

const validateEmail = (s: unknown): s is string => typeof s === 'string' && /.+@.+\..+/.test(s);

export const v1AuthSignUp = onCall<SignUpInput, Promise<SignUpOutput>>(
  {
    cors: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3000').split(','),
  },
  async (req) => {
    const { email, password, displayName } = req.data ?? ({} as SignUpInput);

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
        throw new RepositoryError('ALREADY_EXISTS', 'Ya existe un user con ese email', e);
      }
      throw new HttpsError('internal', `No se pudo crear el user: ${(e as Error).message}`);
    }

    const uid = userRecord.uid;

    try {
      return await db.runTransaction<SignUpOutput>(async (tx) => {
        const existing = await tx.get(usersCol().where('deleted_at', '==', null).select());
        const count = existing.size;

        if (count > 0) {
          throw new HttpsError(
            'permission-denied',
            'El registro público está cerrado. Pedile a un admin que te invite.',
          );
        }

        const role: SignUpOutput['role'] = 'admin';
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

        await writeAuditLog({
          actorId: uid,
          actorEmail: email,
          action: 'user.created',
          targetType: 'user',
          targetId: uid,
          organizationId: null,
          metadata: { isFirstUser: true, role },
        });

        await auth.setCustomUserClaims(uid, { role, organizationId: null });

        return { uid, role, isFirstUser: true };
      });
    } catch (e) {
      await auth.deleteUser(uid).catch(() => undefined);
      throw e;
    }
  },
);

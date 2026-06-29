import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { getAdminAuth, getAdminDb } from '../firebase-admin.js';

// =============================================================================
// Cloud Function: v1_users_invite (admin only)
// =============================================================================
// Admin crea un user en Auth + Firestore con status='invited' + custom claims.
// El invitado puede luego hacer signIn con la password que el admin le comparte
// (en SDD-07+，我们将 agregar email con magic link / reset password).
//
// Auth: require admin role en custom claims del caller.
// =============================================================================

interface InviteUserInput {
  email: string;
  password: string;
  displayName: string;
  role: 'admin' | 'recruiter' | 'expert';
  organizationId?: string | null;
}

interface InviteUserOutput {
  uid: string;
  email: string;
  role: 'admin' | 'recruiter' | 'expert';
}

const validateEmail = (s: unknown): s is string => typeof s === 'string' && /.+@.+\..+/.test(s);

export const inviteUser = onCall<InviteUserInput, Promise<InviteUserOutput>>(
  { cors: ['http://localhost:3000'] },
  async (req) => {
    if (!req.auth?.token['role']) {
      throw new HttpsError('unauthenticated', 'Necesitás estar autenticado');
    }
    if (req.auth.token['role'] !== 'admin') {
      throw new HttpsError('permission-denied', 'Solo admin puede invitar usuarios');
    }

    const { email, password, displayName, role, organizationId } =
      req.data ?? ({} as InviteUserInput);
    if (!validateEmail(email)) {
      throw new HttpsError('invalid-argument', 'email inválido');
    }
    if (typeof password !== 'string' || password.length < 8) {
      throw new HttpsError('invalid-argument', 'password debe tener al menos 8 caracteres');
    }
    if (typeof displayName !== 'string' || displayName.length < 1 || displayName.length > 120) {
      throw new HttpsError('invalid-argument', 'displayName length out of range');
    }
    if (role !== 'admin' && role !== 'recruiter' && role !== 'expert') {
      throw new HttpsError('invalid-argument', 'role inválido');
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    // Crear user en Auth. Si email ya existe, falla con 'auth/email-already-exists'.
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
      throw new HttpsError('internal', `No se pudo crear user: ${(e as Error).message}`);
    }

    const uid = userRecord.uid;

    // Setea custom claims
    const claims: { role: 'admin' | 'recruiter' | 'expert'; organizationId?: string | null } = {
      role,
    };
    if (organizationId !== undefined) claims.organizationId = organizationId;
    await auth.setCustomUserClaims(uid, claims);

    // Crea user doc con status='invited' para distinguir de users auto-registrados.
    const now = FieldValue.serverTimestamp();
    await db
      .collection('users')
      .doc(uid)
      .set({
        email,
        display_name: displayName,
        photo_url: null,
        role,
        organization_id: organizationId ?? null,
        status: 'invited',
        last_login_at: null,
        created_at: now,
        updated_at: now,
        created_by: req.auth.uid,
        deleted_at: null,
      });

    // Audit log
    await db
      .collection('audit_logs')
      .doc()
      .set({
        organizationId: organizationId ?? null,
        actorId: req.auth.uid,
        actorEmail: req.auth.token['email'] ?? '',
        action: 'user.created',
        targetType: 'user',
        targetId: uid,
        metadata: { isInvitation: true, role, invitedEmail: email },
        ip: null,
        userAgent: null,
        createdAt: FieldValue.serverTimestamp(),
      });

    return { uid, email, role };
  },
);

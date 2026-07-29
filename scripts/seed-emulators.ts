/* eslint-disable no-console */
/**
 * Seed script — puebla los emuladores de Firebase con datos de demo.
 *
 * Por defecto crea:
 *   - 1 organización: org_default / "Empresa Demo"
 *   - 1 usuario admin: admin@empresa.com  pass=1234567890  role=admin
 *   - 1 usuario recruiter: recruiter@empresa.com  role=recruiter
 *   - 1 usuario expert: expert@empresa.com       role=expert
 *
 * Idempotente: corre N veces y los registros quedan consistentes. Si un user
 * ya existe en Auth, se le setea la password (para que sobreviva a un
 * export/import) y se re-aplican los custom claims.
 *
 * Conectarse a emuladores locales: requiere que los emuladores estén corriendo.
 *
 * Uso:
 *   pnpm seed:emulators
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { getAdminApp, getAdminAuth, getAdminDb } from '../apps/functions/src/firebase-admin.js';

const ORG_ID = 'org_default';

const DEFAULT_ADMIN_PASSWORD = '1234567890';

type SeedUser = {
  uid: string;
  email: string;
  role: 'admin' | 'recruiter' | 'expert';
  password?: string;
  displayName: string;
};

const SEED_USERS: SeedUser[] = [
  {
    uid: 'u_admin',
    email: 'admin@empresa.com',
    role: 'admin',
    password: DEFAULT_ADMIN_PASSWORD,
    displayName: 'Admin Empresa',
  },
  { uid: 'u_recruiter', email: 'recruiter@empresa.com', role: 'recruiter', displayName: 'Recruiter' },
  { uid: 'u_expert', email: 'expert@empresa.com', role: 'expert', displayName: 'Expert' },
];

async function ensureAuthUser(
  auth: ReturnType<typeof getAdminAuth>,
  u: SeedUser,
): Promise<void> {
  try {
    await auth.createUser({
      uid: u.uid,
      email: u.email,
      ...(u.password ? { password: u.password } : {}),
      displayName: u.displayName,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('already exists')) {
      throw e;
    }
    // El user ya existe: si tenemos password, la re-aplicamos para garantizar
    // que sobrevive a export/import del emulador (la password no se persiste
    // en el export por default, hay que re-setearla).
    if (u.password) {
      await auth.updateUser(u.uid, { password: u.password });
    }
  }
}

async function main(): Promise<void> {
  // Apuntar Admin SDK a los emuladores locales ANTES de instanciar.
  process.env['FIRESTORE_EMULATOR_HOST'] =
    process.env['FIRESTORE_EMULATOR_HOST'] ?? '127.0.0.1:8080';
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] =
    process.env['FIREBASE_AUTH_EMULATOR_HOST'] ?? '127.0.0.1:9099';
  process.env['FIREBASE_STORAGE_EMULATOR_HOST'] =
    process.env['FIREBASE_STORAGE_EMULATOR_HOST'] ?? '127.0.0.1:9199';

  const auth = getAdminAuth();
  const db = getAdminDb();

  // ============ 1. Organización por defecto ============
  await db
    .collection('organizations')
    .doc(ORG_ID)
    .set(
      {
        name: 'Empresa Demo',
        slug: 'default',
        plan: 'free',
        settings: { timezone: 'UTC', locale: 'es' },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: 'system',
        deletedAt: null,
      },
      { merge: true },
    );

  // ============ 2. Usuarios seed ============
  for (const u of SEED_USERS) {
    await ensureAuthUser(auth, u);

    // Custom Claims (server-authoritative)
    await auth.setCustomUserClaims(u.uid, {
      role: u.role,
      organizationId: ORG_ID,
    });

    // Mirror en Firestore
    await db
      .collection('users')
      .doc(u.uid)
      .set(
        {
          email: u.email,
          display_name: u.displayName,
          photo_url: null,
          role: u.role,
          organization_id: ORG_ID,
          status: 'active',
          last_login_at: null,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
          created_by: 'system',
          deleted_at: null,
        },
        { merge: true },
      );
  }

  // Touch app para forzar inicialización lazy y detectar errores temprano.
  void getAdminApp();

  // ============ 3. Templates seed ============
  await seedBackendNodeTemplate(db);

  console.log('Seed complete: 1 organization + 3 users + 1 template');
  console.log(`  ${ORG_ID.padEnd(11)}  (Empresa Demo)`);
  for (const u of SEED_USERS) {
    const pwd = u.password ? ` pass=${u.password}` : '';
    console.log(`  ${u.uid.padEnd(11)}  ${u.email.padEnd(28)} role=${u.role}${pwd}`);
  }
  console.log('  template    Backend Node.js — Senior');
  console.log('UI del emulador: http://localhost:4000');
}

/**
 * Crea el template "Backend Node.js — Senior" si no existe.
 * 4 recetas (node core, HTTP/REST, DB, security/auth), 23 preguntas
 * totales. Estado `approved` para que esté inmediatamente usable en el
 * flujo de preview + simulator (SDD-11).
 *
 * Idempotente: si el doc existe, no lo sobreescribe (merge:false en
 * .set con Timestamp.now() resetea created_at; en su lugar usamos
 * `get().exists` para skip).
 */
async function seedBackendNodeTemplate(
  db: ReturnType<typeof getAdminDb>,
): Promise<void> {
  const templateId = 'tpl_backend_node';
  const ref = db.collection('organizations').doc(ORG_ID).collection('templates').doc(templateId);
  const snap = await ref.get();
  if (snap.exists) {
    return;
  }

  const now = Timestamp.now();
  await ref.set({
    organization_id: ORG_ID,
    name: 'Backend Node.js — Senior',
    description:
      'Evaluación técnica para perfil backend senior con Node.js (runtime, HTTP/REST, persistencia, seguridad y autenticación). Idoneo para screening inicial y baseline de upgrade.',
    niche: 'exam_practice',
    time_limit_minutes: 90,
    max_retries: 1,
    passing_score: 75,
    recipes: [
      {
        recipe_id: 'r_node_core',
        competency_name: 'Node.js Core & Async',
        competency_context:
          'Event loop, microtasks/macrotasks, Promises, async/await, streams (Readable/Writable/Transform), Buffers, EventEmitter, workers/worker_threads, error propagation en promesas, unhandledRejection, AbortController, child_process. El examinado debe distinguir cuando bloquea el event loop, como backpressure funciona, y las trampas async comunes.',
        qty_multiple_choice: 4,
        qty_multi_choice: 2,
        difficulty: 'hard',
        topics_covered: [
          'event-loop',
          'promises',
          'streams',
          'buffer',
          'workers',
          'error-handling',
        ],
      },
      {
        recipe_id: 'r_http_api',
        competency_name: 'API HTTP con Express / Fastify',
        competency_context:
          'Diseño de APIs RESTful, routing, middleware, validación de input (zod, joi, ajv), manejo centralizado de errores, status codes correctos, versionado, idempotency keys, paginación (cursor vs offset), CORS, helmet, logging estructurado (pino), request id tracing. Patrones para separar transport de dominio.',
        qty_multiple_choice: 5,
        qty_multi_choice: 1,
        difficulty: 'medium',
        topics_covered: [
          'routing',
          'middleware',
          'validation',
          'rest-conventions',
          'http-status',
          'observability',
        ],
      },
      {
        recipe_id: 'r_database',
        competency_name: 'Persistencia y base de datos',
        competency_context:
          'Modelado relacional, índices (composite, partial, unique), ACID vs eventual consistency, transacciones, isolation levels, N+1 queries, connection pooling, migraciones forward/backward, ORM vs query builder (Prisma, Drizzle, Knex), raw SQL cuando hace falta, locks pesimistas vs optimistas, deadlocks.',
        qty_multiple_choice: 4,
        qty_multi_choice: 2,
        difficulty: 'hard',
        topics_covered: [
          'sql',
          'orm',
          'transactions',
          'migrations',
          'indexing',
          'connection-pool',
        ],
      },
      {
        recipe_id: 'r_security_auth',
        competency_name: 'Seguridad y autenticación',
        competency_context:
          'Hashing de passwords (argon2id, bcrypt cost), JWT (algoritmos, claims estándar, exp/iat/nbf), refresh tokens con rotación, OAuth 2.0 / OIDC, OWASP Top 10 (injection, XSS, CSRF, SSRF), rate limiting por IP/uid, secrets management, secure cookies (httpOnly, SameSite, Secure), input sanitization, output encoding.',
        qty_multiple_choice: 4,
        qty_multi_choice: 1,
        difficulty: 'hard',
        topics_covered: [
          'jwt',
          'oauth',
          'password-hashing',
          'owasp',
          'rate-limiting',
          'cors',
        ],
      },
    ],
    status: 'approved',
    created_by: 'u_admin',
    created_by_role: 'admin',
    created_at: now,
    updated_at: now,
    approved_by: 'u_admin',
    approved_at: now,
    deleted_at: null,
    version: 1,
  });
}

main().catch((e: unknown) => {
  console.error('[seed] failed:', e);
  process.exit(1);
});
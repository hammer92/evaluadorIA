/**
 * firestore.rules.spec.ts — Tests unitarios para las reglas de seguridad de Firestore.
 *
 * SDD-10 Backend Gaps Remediation sprint PR #C.
 * Cubre full matrix para la sección `organizations/{orgId}/templates/{templateId}`
 * de firestore.rules + review_comments sub-collection.
 *
 * Usa @firebase/rules-unit-testing@3.0.4 (instalado en PR #A).
 *
 * Ejecutar:
 *   1) Levantar emuladores: pnpm emulators:detach (background)
 *   2) pnpm --filter @platform/functions test:rules
 *
 * CI: este spec corre dentro del job integration-emulator (PR #D).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { addDoc, collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

// =============================================================================
// Setup: emulador + helpers
// =============================================================================
const PROJECT_ID = 'demo-rules-test';
const RULES_FILE = resolve(__dirname, '../../../../firestore.rules');

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_FILE, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
}, 60_000);

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

// =============================================================================
// Helpers
// =============================================================================
const ORG_ID = 'org_test_rules';
const TEMPLATE_ID = 'tpl_test_rules';

interface AuthClaims {
  role: 'admin' | 'recruiter' | 'expert';
  email?: string;
  organizationId?: string;
}

function adminCtx(uid = 'admin-uid', orgId: string = ORG_ID) {
  return testEnv.authenticatedContext(uid, {
    role: 'admin',
    email: `${uid}@test.local`,
    organizationId: orgId,
  });
}

function recruiterCtx(uid = 'recruiter-uid', orgId: string = ORG_ID) {
  return testEnv.authenticatedContext(uid, {
    role: 'recruiter',
    email: `${uid}@test.local`,
    organizationId: orgId,
  });
}

function expertCtx(uid = 'expert-uid', orgId: string = ORG_ID) {
  return testEnv.authenticatedContext(uid, {
    role: 'expert',
    email: `${uid}@test.local`,
    organizationId: orgId,
  });
}

function unauthCtx() {
  return testEnv.unauthenticatedContext();
}

function memberOfAnotherOrgCtx(role: 'admin' | 'recruiter' | 'expert') {
  // Usuario autenticado pero SIN custom claim organizationId = ORG_ID
  // (por lo tanto NO es miembro de ORG_ID). Las reglas deben rechazar.
  return testEnv.authenticatedContext(`non-member-${role}-uid`, {
    role,
    email: `non-member-${role}@test.local`,
    // NO organizationId
  });
}

interface TemplateSeedFields {
  status: 'draft' | 'in_review' | 'changes_requested' | 'approved' | 'rejected';
  deletedAt?: Date | null;
}

async function seedTemplate(
  templateId: string,
  fields: TemplateSeedFields,
  orgId: string = ORG_ID,
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, `organizations/${orgId}/templates/${templateId}`), {
      organization_id: orgId,
      name: `Test Template ${templateId}`,
      description: null,
      niche: 'school',
      time_limit_minutes: 60,
      max_retries: 2,
      recipes: [],
      status: fields.status,
      created_by: 'admin-uid',
      created_by_role: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
      approved_by: fields.status === 'approved' ? 'admin-uid' : null,
      approved_at: fields.status === 'approved' ? new Date() : null,
      deleted_at: fields.deletedAt ?? null,
    });
  });
}

async function seedOrg(orgId: string): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, `organizations/${orgId}`), {
      name: 'Test Org',
      slug: orgId,
      plan: 'free',
      created_at: new Date(),
    });
  });
}

// =============================================================================
// Setup global del org (bypass rules)
// =============================================================================
beforeAll(async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, `organizations/${ORG_ID}`), {
      name: 'Test Org',
      slug: ORG_ID,
      plan: 'free',
      created_at: new Date(),
    });
  });
});

// =============================================================================
// Tests: ADMIN
// =============================================================================
describe('firestore.rules — admin role', () => {
  describe('read', () => {
    it.each(['draft', 'in_review', 'changes_requested', 'approved', 'rejected'] as const)(
      'admin puede leer template en status=%s',
      async (status) => {
        await seedTemplate(TEMPLATE_ID, { status });
        const db = adminCtx().firestore();
        await assertSucceeds(getDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`)));
      },
    );
  });

  describe('list', () => {
    it('admin puede listar templates de su org', async () => {
      await seedTemplate('tpl_a', { status: 'draft' });
      await seedTemplate('tpl_b', { status: 'approved' });
      const db = adminCtx().firestore();
      await assertSucceeds(getDocs(collection(db, `organizations/${ORG_ID}/templates`)));
    });
  });

  describe('create', () => {
    it('admin puede crear template con status=draft', async () => {
      const db = adminCtx().firestore();
      await assertSucceeds(
        setDoc(doc(db, `organizations/${ORG_ID}/templates/new-tpl`), {
          organization_id: ORG_ID,
          name: 'New template',
          niche: 'school',
          time_limit_minutes: 60,
          max_retries: 2,
          recipes: [],
          status: 'draft',
          created_by: 'admin-uid',
          created_by_role: 'admin',
          created_at: new Date(),
          updated_at: new Date(),
          approved_by: null,
          approved_at: null,
          deleted_at: null,
        }),
      );
    });

    it('admin NO puede crear template con status=approved (must be draft)', async () => {
      const db = adminCtx().firestore();
      await assertFails(
        setDoc(doc(db, `organizations/${ORG_ID}/templates/new-tpl`), {
          organization_id: ORG_ID,
          name: 'New template',
          niche: 'school',
          time_limit_minutes: 60,
          max_retries: 2,
          recipes: [],
          status: 'approved', // ← no permitido en create
          created_by: 'admin-uid',
          created_by_role: 'admin',
          created_at: new Date(),
          updated_at: new Date(),
          approved_by: null,
          approved_at: null,
          deleted_at: null,
        }),
      );
    });
  });

  describe('update', () => {
    it('admin puede actualizar template en status=draft (sin cambiar status)', async () => {
      await seedTemplate(TEMPLATE_ID, { status: 'draft' });
      const db = adminCtx().firestore();
      await assertSucceeds(
        updateDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`), {
          name: 'Updated name',
        }),
      );
    });

    it('admin NO puede actualizar template en status=in_review', async () => {
      await seedTemplate(TEMPLATE_ID, { status: 'in_review' });
      const db = adminCtx().firestore();
      await assertFails(
        updateDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`), {
          name: 'Try to update',
        }),
      );
    });
  });

  describe('delete', () => {
    it('admin puede soft-delete template (delete en rules permite soft)', async () => {
      await seedTemplate(TEMPLATE_ID, { status: 'draft' });
      const db = adminCtx().firestore();
      await assertSucceeds(
        updateDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`), {
          deleted_at: new Date(),
        }),
      );
    });
  });
});

// =============================================================================
// Tests: RECRUITER
// =============================================================================
describe('firestore.rules — recruiter role', () => {
  describe('read', () => {
    it('recruiter puede leer template approved', async () => {
      await seedTemplate(TEMPLATE_ID, { status: 'approved' });
      const db = recruiterCtx().firestore();
      await assertSucceeds(getDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`)));
    });

    it.each(['draft', 'in_review', 'rejected'] as const)(
      'recruiter NO puede leer template en status=%s',
      async (status) => {
        await seedTemplate(TEMPLATE_ID, { status });
        const db = recruiterCtx().firestore();
        await assertFails(getDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`)));
      },
    );

    it('recruiter NO puede leer template soft-deleted (deleted_at != null)', async () => {
      await seedTemplate(TEMPLATE_ID, { status: 'approved', deletedAt: new Date() });
      const db = recruiterCtx().firestore();
      await assertFails(getDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`)));
    });
  });

  describe('list', () => {
    it('recruiter puede listar templates (rules permite list a cualquier role de la org)', async () => {
      await seedTemplate('tpl_a', { status: 'draft' });
      await seedTemplate('tpl_b', { status: 'approved' });
      const db = recruiterCtx().firestore();
      await assertSucceeds(getDocs(collection(db, `organizations/${ORG_ID}/templates`)));
    });
  });

  describe('create', () => {
    it('recruiter NO puede crear template (admin-only)', async () => {
      const db = recruiterCtx().firestore();
      await assertFails(
        setDoc(doc(db, `organizations/${ORG_ID}/templates/new-tpl`), {
          organization_id: ORG_ID,
          name: 'Recruiter attempt',
          niche: 'school',
          time_limit_minutes: 60,
          max_retries: 2,
          recipes: [],
          status: 'draft',
          created_by: 'recruiter-uid',
          created_by_role: 'recruiter',
          created_at: new Date(),
          updated_at: new Date(),
          approved_by: null,
          approved_at: null,
          deleted_at: null,
        }),
      );
    });
  });

  describe('update', () => {
    it('recruiter NO puede actualizar template (admin-only)', async () => {
      await seedTemplate(TEMPLATE_ID, { status: 'approved' });
      const db = recruiterCtx().firestore();
      await assertFails(
        updateDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`), {
          name: 'Recruiter update attempt',
        }),
      );
    });
  });

  describe('delete', () => {
    it('recruiter NO puede soft-delete template (admin-only)', async () => {
      await seedTemplate(TEMPLATE_ID, { status: 'approved' });
      const db = recruiterCtx().firestore();
      await assertFails(
        updateDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`), {
          deleted_at: new Date(),
        }),
      );
    });
  });
});

// =============================================================================
// Tests: EXPERT
// =============================================================================
describe('firestore.rules — expert role', () => {
  describe('read', () => {
    it('expert puede leer template no-archivado (status=draft)', async () => {
      await seedTemplate(TEMPLATE_ID, { status: 'draft' });
      const db = expertCtx().firestore();
      await assertSucceeds(getDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`)));
    });

    it('expert SI puede leer template soft-deleted (no hay restrict en deleted_at para expert)', async () => {
      // El rule `hasAnyRole(['admin','expert'])` no excluye soft-deleted.
      // Solo la rama de recruiter chequea deleted_at == null. Por diseño,
      // expert puede leer cualquier template no-archivado O archivado
      // (no hay logica que lo distinga en la rama hasAnyRole).
      await seedTemplate(TEMPLATE_ID, { status: 'draft', deletedAt: new Date() });
      const db = expertCtx().firestore();
      await assertSucceeds(getDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`)));
    });
  });

  describe('list', () => {
    it('expert puede listar templates', async () => {
      await seedTemplate('tpl_a', { status: 'draft' });
      await seedTemplate('tpl_b', { status: 'in_review' });
      const db = expertCtx().firestore();
      await assertSucceeds(getDocs(collection(db, `organizations/${ORG_ID}/templates`)));
    });
  });

  describe('create', () => {
    it('expert NO puede crear template (admin-only)', async () => {
      const db = expertCtx().firestore();
      await assertFails(
        setDoc(doc(db, `organizations/${ORG_ID}/templates/new-tpl`), {
          organization_id: ORG_ID,
          name: 'Expert attempt',
          niche: 'school',
          time_limit_minutes: 60,
          max_retries: 2,
          recipes: [],
          status: 'draft',
          created_by: 'expert-uid',
          created_by_role: 'expert',
          created_at: new Date(),
          updated_at: new Date(),
          approved_by: null,
          approved_at: null,
          deleted_at: null,
        }),
      );
    });
  });

  describe('update', () => {
    it('expert puede actualizar recipes en status=in_review', async () => {
      await seedTemplate(TEMPLATE_ID, { status: 'in_review' });
      const db = expertCtx().firestore();
      await assertSucceeds(
        updateDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`), {
          recipes: [
            {
              recipe_id: 'r0',
              competency_name: 'Test',
              competency_context: 'Contexto lo suficientemente largo para pasar validación.',
              qty_multiple_choice: 5,
              qty_multi_choice: 0,
              difficulty: 'medium',
              topics_covered: ['topic-1'],
            },
          ],
        }),
      );
    });

    it('expert NO puede actualizar name en in_review (campo no permitido)', async () => {
      await seedTemplate(TEMPLATE_ID, { status: 'in_review' });
      const db = expertCtx().firestore();
      await assertFails(
        updateDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`), {
          name: 'Expert tries to change name',
        }),
      );
    });

    it('expert NO puede actualizar status', async () => {
      await seedTemplate(TEMPLATE_ID, { status: 'in_review' });
      const db = expertCtx().firestore();
      await assertFails(
        updateDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`), {
          status: 'approved',
        }),
      );
    });
  });

  describe('delete', () => {
    it('expert NO puede soft-delete template', async () => {
      await seedTemplate(TEMPLATE_ID, { status: 'in_review' });
      const db = expertCtx().firestore();
      await assertFails(
        updateDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`), {
          deleted_at: new Date(),
        }),
      );
    });
  });
});

// =============================================================================
// Tests: Non-member (cualquier rol sin organizationId claim)
// =============================================================================
describe('firestore.rules — non-member access', () => {
  it('recruiter sin organizationId claim NO puede leer templates de la org', async () => {
    await seedTemplate(TEMPLATE_ID, { status: 'approved' });
    const db = memberOfAnotherOrgCtx('recruiter').firestore();
    await assertFails(getDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`)));
  });

  it('expert sin organizationId claim NO puede leer templates de la org', async () => {
    await seedTemplate(TEMPLATE_ID, { status: 'approved' });
    const db = memberOfAnotherOrgCtx('expert').firestore();
    await assertFails(getDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`)));
  });

  it('admin sin organizationId claim SI puede leer (admin = global, design choice)', async () => {
    // El rule `isMemberOfOrg(orgId)` retorna true para cualquier admin
    // (hasRole('admin') OR organizationId == orgId). Por diseño, admin es
    // global y puede acceder a templates de cualquier org.
    // Esto es una decision arquitectonica documentada — ver firestore.rules:170.
    await seedTemplate(TEMPLATE_ID, { status: 'approved' });
    const db = memberOfAnotherOrgCtx('admin').firestore();
    await assertSucceeds(getDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`)));
  });
});

// =============================================================================
// Tests: Unauthenticated
// =============================================================================
describe('firestore.rules — unauthenticated', () => {
  it('unauthenticated NO puede leer templates', async () => {
    await seedTemplate(TEMPLATE_ID, { status: 'approved' });
    const db = unauthCtx().firestore();
    await assertFails(getDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}`)));
  });

  it('unauthenticated NO puede listar templates', async () => {
    const db = unauthCtx().firestore();
    await assertFails(getDocs(collection(db, `organizations/${ORG_ID}/templates`)));
  });
});

// =============================================================================
// Tests: review_comments sub-collection
// =============================================================================
describe('firestore.rules — review_comments sub-collection', () => {
  it('admin puede leer review_comments de template approved', async () => {
    await seedTemplate(TEMPLATE_ID, { status: 'approved' });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}/reviews/rev_1`), {
        actor_id: 'expert-uid',
        actor_name: 'Expert',
        actor_role: 'expert',
        action: 'changes_requested',
        comment: 'Sample comment',
        changes: null,
        created_at: new Date(),
      });
    });
    const db = adminCtx().firestore();
    await assertSucceeds(
      getDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}/reviews/rev_1`)),
    );
  });

  it('recruiter NO puede leer review_comments de template NO approved', async () => {
    await seedTemplate(TEMPLATE_ID, { status: 'draft' });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}/reviews/rev_1`), {
        actor_id: 'expert-uid',
        actor_name: 'Expert',
        actor_role: 'expert',
        action: 'changes_requested',
        comment: 'Sample',
        changes: null,
        created_at: new Date(),
      });
    });
    const db = recruiterCtx().firestore();
    await assertFails(
      getDoc(doc(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}/reviews/rev_1`)),
    );
  });

  it('cualquier cliente NO puede escribir review_comments (solo CFs via Admin SDK)', async () => {
    await seedTemplate(TEMPLATE_ID, { status: 'approved' });
    const db = adminCtx().firestore();
    await assertFails(
      addDoc(collection(db, `organizations/${ORG_ID}/templates/${TEMPLATE_ID}/reviews`), {
        actor_id: 'admin-uid',
        actor_name: 'Admin',
        actor_role: 'admin',
        action: 'approved',
        comment: 'Try to write',
        changes: null,
        created_at: new Date(),
      }),
    );
  });
});

// =============================================================================
// Sanity check: que testEnv se inicializo OK
// =============================================================================
describe('firestore.rules.spec — environment', () => {
  it('testEnv se inicializo correctamente', () => {
    expect(testEnv).toBeDefined();
  });
});

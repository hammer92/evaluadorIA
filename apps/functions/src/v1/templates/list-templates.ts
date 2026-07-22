import {
  listTemplatesInputSchema,
  type ListTemplatesInput,
  type ListTemplatesResult,
  type Template,
} from '@platform/shared';
import { onCall } from 'firebase-functions/v2/https';

import { ALLOWED_ORIGINS_DEPLOY } from '../../deploy-config.js';
import { getAdminDb } from '../../firebase-admin.js';
import { handleError } from '../../shared/handle-error.js';
import { withAuth, type AuthedContext } from '../../shared/on-call-auth.js';
import { validateInput } from '../../shared/validate-input.js';

import { templateFromFirestore, type TemplateDocRaw } from './mapper.js';

// =============================================================================
// v1TemplatesList — Listar templates con filtros (SDD-10 §7.2)
// =============================================================================
// Auth: admin, expert, recruiter (recruiter forzado a status='approved').
// Paginación offset+limit, orden por updatedAt desc.
// =============================================================================

export type ListTemplatesOutput = ListTemplatesResult;

export const v1TemplatesList = onCall(
  {
    cors: ALLOWED_ORIGINS_DEPLOY,
    enforceAppCheck: false,
  },
  withAuth<ListTemplatesInput, ListTemplatesOutput>(undefined, async (ctx: AuthedContext, data) => {
    try {
      const input = validateInput(listTemplatesInputSchema, data);

      const db = getAdminDb();
      const organizationId = ctx.organizationId ?? 'org_default';

      let query = db
        .collection('organizations')
        .doc(organizationId)
        .collection('templates')
        .where('deleted_at', '==', null);

      // Recruiter solo ve approved.
      if (ctx.role === 'recruiter') {
        query = query.where('status', '==', 'approved');
      } else if (input.status) {
        query = query.where('status', '==', input.status);
      }

      if (input.niche) {
        query = query.where('niche', '==', input.niche);
      }

      // Filtro search por nombre (prefix range, case-sensitive en Firestore).
      if (input.search && input.search.trim().length > 0) {
        const term = input.search.trim();
        query = query.where('name', '>=', term).where('name', '<=', term + '\uf8ff');
      }

      const countSnap = await query.count().get();
      const total = countSnap.data().count;

      const offset = (input.page - 1) * input.pageSize;
      const pageSnap = await query
        .orderBy('updated_at', 'desc')
        .offset(offset)
        .limit(input.pageSize)
        .get();

      const items: Template[] = pageSnap.docs.map((d) =>
        templateFromFirestore(d.id, d.data() as TemplateDocRaw),
      );

      return {
        items,
        page: input.page,
        pageSize: input.pageSize,
        total,
        hasMore: offset + items.length < total,
      };
    } catch (e) {
      handleError(e);
    }
  }),
);

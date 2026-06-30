import { roleSchema, userStatusSchema } from '@platform/shared';
import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

import { getAdminDb } from '../../firebase-admin.js';
import { handleError } from '../../shared/handle-error.js';
import { withAuth } from '../../shared/on-call-auth.js';
import { validateInput } from '../../shared/validate-input.js';

const listUsersInputSchema = z.object({
  organizationId: z.string().optional(),
  status: userStatusSchema.optional(),
  role: roleSchema.optional(),
  search: z.string().max(100).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
type ListUsersInput = z.input<typeof listUsersInputSchema>;

interface UserSummary {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: 'admin' | 'recruiter' | 'expert';
  organizationId: string | null;
  status: 'active' | 'invited' | 'suspended';
  createdAt: string;
}

export interface ListUsersOutput {
  items: UserSummary[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

function mapUserDoc(id: string, raw: Record<string, unknown>): UserSummary {
  const created = raw['created_at'] as { toDate?: () => Date } | undefined;
  return {
    uid: id,
    email: raw['email'] as string,
    displayName: (raw['display_name'] as string | null) ?? null,
    photoURL: (raw['photo_url'] as string | null) ?? null,
    role: raw['role'] as UserSummary['role'],
    organizationId: (raw['organization_id'] as string | null) ?? null,
    status: raw['status'] as UserSummary['status'],
    createdAt: (created?.toDate?.() ?? new Date(0)).toISOString(),
  };
}

export const v1UsersList = onCall(
  {
    cors: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3000').split(','),
    secrets: ['SESSION_COOKIE_SECRET'],
  },
  withAuth<ListUsersInput, ListUsersOutput>(['admin', 'recruiter'], async (ctx, data) => {
    try {
      const input = validateInput(listUsersInputSchema, data);
      const db = getAdminDb();

      const orgId = input.organizationId ?? ctx.organizationId ?? '__none__';

      let query = db
        .collection('users')
        .where('organization_id', '==', orgId)
        .orderBy('created_at', 'desc') as FirebaseFirestore.Query<Record<string, unknown>>;

      if (input.status) query = query.where('status', '==', input.status) as typeof query;
      if (input.role) query = query.where('role', '==', input.role) as typeof query;

      const snap = await query.get();

      const filtered = snap.docs
        .map((d) => mapUserDoc(d.id, d.data()))
        .filter((u) => u.status !== 'suspended')
        .filter((u) =>
          input.search
            ? `${u.email} ${u.displayName ?? ''}`.toLowerCase().includes(input.search.toLowerCase())
            : true,
        );

      const start = (input.page - 1) * input.pageSize;
      const paged = filtered.slice(start, start + input.pageSize);

      return {
        items: paged,
        page: input.page,
        pageSize: input.pageSize,
        total: filtered.length,
        hasMore: start + paged.length < filtered.length,
      };
    } catch (e) {
      handleError(e);
    }
  }),
);

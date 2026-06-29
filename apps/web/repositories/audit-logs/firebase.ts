import {
  auditLogSchema,
  type AuditLog,
  type CreateAuditLogInput,
} from '@shared/schemas/audit-logs';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  setDoc,
  type QueryConstraint,
  type Firestore,
} from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';

import { RepositoryError } from '../errors';

import { toAuditLog, toAuditLogInputRaw, type AuditLogRaw } from './mapper';
import type { Ctx, ListAuditLogsInput, ListAuditLogsResult, AuditLogRepository } from './types';

import { db as defaultDb } from '@/lib/firebase/client';

const COLLECTION = 'auditLogs';

export class FirebaseAuditLogRepository implements AuditLogRepository {
  private readonly _db: Firestore;
  constructor(dbInstance?: Firestore) {
    this._db = dbInstance ?? defaultDb;
  }
  async append(input: CreateAuditLogInput, _ctx: Ctx): Promise<AuditLog> {
    try {
      const ref = doc(collection(this._db, COLLECTION));
      const now = serverTimestamp();
      const raw: AuditLogRaw = {
        ...toAuditLogInputRaw(input),
        created_at: now as unknown as AuditLogRaw['created_at'],
      };
      await setDoc(ref, raw);
      const created = toAuditLog(ref.id, {
        ...raw,
        created_at: Timestamp.now(),
      });
      return auditLogSchema.parse(created);
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      throw RepositoryError.internal(`Error al registrar audit log`, e);
    }
  }

  async list(input: ListAuditLogsInput, _ctx: Ctx): Promise<ListAuditLogsResult> {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
    const filters: QueryConstraint[] = [];
    if (input.organizationId) filters.push(where('organization_id', '==', input.organizationId));
    if (input.actorId) filters.push(where('actor_id', '==', input.actorId));
    if (input.targetType) filters.push(where('target_type', '==', input.targetType));
    if (input.targetId) filters.push(where('target_id', '==', input.targetId));

    try {
      const q = query(
        collection(this._db, COLLECTION),
        ...filters,
        orderBy('created_at', 'desc'),
        limit(pageSize * page),
      );
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => toAuditLog(d.id, d.data() as AuditLogRaw));
      const start = (page - 1) * pageSize;
      const paged = items.slice(start, start + pageSize);
      return {
        items: paged,
        page,
        pageSize,
        total: items.length,
        hasMore: start + paged.length < items.length,
      };
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      throw RepositoryError.internal('Error al listar audit logs', e);
    }
  }

  async getById(logId: string, _ctx: Ctx): Promise<AuditLog | null> {
    try {
      const snap = await getDoc(doc(this._db, COLLECTION, logId));
      if (!snap.exists()) return null;
      return auditLogSchema.parse(toAuditLog(logId, snap.data() as AuditLogRaw));
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      throw RepositoryError.internal(`Error al obtener audit log ${logId}`, e);
    }
  }
}

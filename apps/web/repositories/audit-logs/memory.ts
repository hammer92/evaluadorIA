import {
  auditLogSchema,
  type AuditLog,
  type CreateAuditLogInput,
} from '@shared/schemas/audit-logs';

import type { Ctx, ListAuditLogsInput, ListAuditLogsResult, AuditLogRepository } from './types';

let _seq = 0;
const genId = (): string => `log_${Date.now()}_${++_seq}`;

export class MemoryAuditLogRepository implements AuditLogRepository {
  private store = new Map<string, AuditLog>();

  async append(input: CreateAuditLogInput, _ctx: Ctx): Promise<AuditLog> {
    const logId = genId();
    const log: AuditLog = auditLogSchema.parse({
      logId,
      ...input,
      createdAt: new Date(),
    });
    this.store.set(logId, log);
    return Promise.resolve(log);
  }

  async list(input: ListAuditLogsInput, _ctx: Ctx): Promise<ListAuditLogsResult> {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
    let items = Array.from(this.store.values());
    if (input.organizationId)
      items = items.filter((l) => l.organizationId === input.organizationId);
    if (input.actorId) items = items.filter((l) => l.actorId === input.actorId);
    if (input.targetType) items = items.filter((l) => l.targetType === input.targetType);
    if (input.targetId) items = items.filter((l) => l.targetId === input.targetId);
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = items.length;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);
    return Promise.resolve({ items: paged, page, pageSize, total, hasMore: start + paged.length < total });
  }

  async getById(logId: string, _ctx: Ctx): Promise<AuditLog | null> {
    return Promise.resolve(this.store.get(logId) ?? null);
  }

  __reset(): void {
    this.store.clear();
  }

  __seed(items: AuditLog[]): void {
    items.forEach((l) => this.store.set(l.logId, l));
  }
}

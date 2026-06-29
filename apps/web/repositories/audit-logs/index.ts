import { FirebaseAuditLogRepository } from './firebase';
import { MemoryAuditLogRepository } from './memory';
import type { AuditLogRepository } from './types';

import { env } from '@/env';

export * from './types';

let _instance: AuditLogRepository | undefined;

export function getAuditLogRepository(): AuditLogRepository {
  if (_instance) return _instance;
  _instance =
    env.REPOSITORY_DRIVER === 'firebase'
      ? new FirebaseAuditLogRepository()
      : new MemoryAuditLogRepository();
  return _instance;
}

export function __resetAuditLogRepository(): void {
  _instance = undefined;
}

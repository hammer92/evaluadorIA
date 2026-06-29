import { FirebaseOrganizationRepository } from './firebase';
import { MemoryOrganizationRepository } from './memory';
import type { OrganizationRepository } from './types';

import { env } from '@/env';

export * from './types';

let _instance: OrganizationRepository | undefined;

export function getOrganizationRepository(): OrganizationRepository {
  if (_instance) return _instance;
  _instance =
    env.REPOSITORY_DRIVER === 'firebase'
      ? new FirebaseOrganizationRepository()
      : new MemoryOrganizationRepository();
  return _instance;
}

export function __resetOrganizationRepository(): void {
  _instance = undefined;
}

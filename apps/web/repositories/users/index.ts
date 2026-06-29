import { FirebaseUserRepository } from './firebase';
import { MemoryUserRepository } from './memory';
import type { UserRepository } from './types';

import { env } from '@/env';

export * from './types';
export { RepositoryError } from '../errors';

let _instance: UserRepository | undefined;

export function getUserRepository(): UserRepository {
  if (_instance) return _instance;
  _instance =
    env.REPOSITORY_DRIVER === 'firebase'
      ? new FirebaseUserRepository()
      : new MemoryUserRepository();
  return _instance;
}

export function __resetUserRepository(): void {
  _instance = undefined;
}

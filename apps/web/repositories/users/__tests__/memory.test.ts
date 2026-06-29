import type { User } from '@shared/schemas/users';
import { beforeEach, describe, expect, it } from 'vitest';

import { RepositoryError } from '../../errors';
import { MemoryUserRepository } from '../memory';
import type { Ctx } from '../types';

const ctx: Ctx = {
  uid: 'u_creator',
  email: 'c@x.com',
  role: 'admin',
  organizationId: 'org_x',
  traceId: 't',
};

const seedUser = (overrides: Partial<User> = {}): User => ({
  uid: 'u1',
  email: 'u1@x.com',
  displayName: 'User One',
  photoURL: null,
  role: 'expert',
  organizationId: 'org_x',
  status: 'active',
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'creator',
  deletedAt: null,
  ...overrides,
});

// =============================================================================
// MemoryUserRepository — tests unitarios específicos del comportamiento
// in-memory. Los tests contractuales ya cubren el contrato; estos apuntan
// a detalles de implementación (helpers __reset/__seed, edge cases).
// =============================================================================

describe('MemoryUserRepository', () => {
  let repo: MemoryUserRepository;

  beforeEach(() => {
    repo = new MemoryUserRepository();
  });

  it('__reset limpia store y emails', async () => {
    await repo.create({ email: 'a@x.com', role: 'expert' }, ctx);
    repo.__reset();
    const r = await repo.list({}, ctx);
    expect(r.items.length).toBe(0);
  });

  it('__seed precarga users sin duplicar emails', async () => {
    repo.__seed([seedUser()]);
    await expect(repo.create({ email: 'u1@x.com', role: 'expert' }, ctx)).rejects.toMatchObject({
      code: 'ALREADY_EXISTS',
    });
  });

  it('list excluye users con deletedAt', async () => {
    repo.__seed([
      seedUser({ uid: 'a', email: 'a@x.com' }),
      seedUser({ uid: 'b', email: 'b@x', deletedAt: new Date() }),
    ]);
    const r = await repo.list({}, ctx);
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.uid).toBe('a');
  });

  it('list pageSize se limita a 100', async () => {
    const r = await repo.list({ pageSize: 9999 }, ctx);
    expect(r.pageSize).toBe(100);
  });

  it('RepositoryError ya envuelto no se re-envuelve', async () => {
    const customErr = RepositoryError.notFound('User', 'x');
    try {
      throw customErr;
    } catch (e) {
      expect(e).toBe(customErr);
    }
  });
});

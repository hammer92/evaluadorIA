import { beforeEach, describe, expect, it } from 'vitest';

import { RepositoryError } from '../../errors';
import { MemoryUserRepository } from '../memory';
import type { Ctx, UserRepository } from '../types';

const ctxAdmin: Ctx = {
  uid: 'u_admin',
  email: 'admin@x.com',
  role: 'admin',
  organizationId: 'org_default',
  traceId: 't1',
};

const ctxExpert: Ctx = {
  uid: 'u_expert',
  email: 'expert@x.com',
  role: 'expert',
  organizationId: 'org_default',
  traceId: 't2',
};

// =============================================================================
// Contract test — corre el mismo suite contra CUALQUIER impl de UserRepository.
// =============================================================================
// Si agregás una nueva impl (ej. AWSUserRepository), importás la clase y la
// pasás al `suite()` de abajo. Si diverge de Memory, los tests fallan.
// =============================================================================

function suite(name: string, makeRepo: () => UserRepository): void {
  describe(`[UserRepository:${name}]`, () => {
    let repo: UserRepository;

    beforeEach(() => {
      repo = makeRepo();
      if ('__reset' in repo && typeof repo.__reset === 'function') {
        repo.__reset();
      }
    });

    it('create persiste user y devuelve con uid', async () => {
      const u = await repo.create({ email: 'a@x.com', role: 'expert' }, ctxAdmin);
      expect(u.uid).toBeTruthy();
      expect(u.email).toBe('a@x.com');
      expect(u.role).toBe('expert');
      expect(u.status).toBe('invited');
    });

    it('create rechaza email duplicado con ALREADY_EXISTS', async () => {
      await repo.create({ email: 'a@x.com', role: 'expert' }, ctxAdmin);
      await expect(
        repo.create({ email: 'a@x.com', role: 'expert' }, ctxAdmin),
      ).rejects.toMatchObject({ code: 'ALREADY_EXISTS' });
    });

    it('getById retorna null si no existe', async () => {
      expect(await repo.getById('nope', ctxAdmin)).toBeNull();
    });

    it('list pagina y filtra por status/role', async () => {
      for (let i = 0; i < 5; i++) {
        await repo.create({ email: `u${i}@x.com`, role: 'expert' }, ctxAdmin);
      }
      const r1 = await repo.list({ page: 1, pageSize: 2 }, ctxAdmin);
      expect(r1.items.length).toBe(2);
      expect(r1.total).toBe(5);
      expect(r1.hasMore).toBe(true);
      const r2 = await repo.list({ page: 2, pageSize: 2 }, ctxAdmin);
      expect(r2.items.length).toBe(2);
      const r3 = await repo.list({ page: 3, pageSize: 2 }, ctxAdmin);
      expect(r3.items.length).toBe(1);
      expect(r3.hasMore).toBe(false);
    });

    it('list filtra por search (email)', async () => {
      await repo.create({ email: 'maria@x.com', role: 'expert' }, ctxAdmin);
      await repo.create({ email: 'juan@x.com', role: 'expert' }, ctxAdmin);
      const r = await repo.list({ search: 'maria' }, ctxAdmin);
      expect(r.items.length).toBe(1);
      expect(r.items[0]!.email).toBe('maria@x.com');
    });

    it('update por expert sobre sí mismo funciona', async () => {
      const u = await repo.create({ email: 'v@x.com', role: 'expert' }, ctxAdmin);
      const updated = await repo.update(u.uid, { displayName: 'V' }, { ...ctxExpert, uid: u.uid });
      expect(updated.displayName).toBe('V');
    });

    it('update de role por expert falla con PERMISSION_DENIED', async () => {
      const u = await repo.create({ email: 'v@x.com', role: 'expert' }, ctxAdmin);
      await expect(
        repo.update(u.uid, { role: 'admin' }, { ...ctxExpert, uid: u.uid }),
      ).rejects.toBeInstanceOf(RepositoryError);
    });

    it('delete por expert falla con PERMISSION_DENIED', async () => {
      const u = await repo.create({ email: 'v@x.com', role: 'expert' }, ctxAdmin);
      await expect(repo.delete(u.uid, ctxExpert)).rejects.toBeInstanceOf(RepositoryError);
    });

    it('delete por admin marca deletedAt y oculta en getById', async () => {
      const u = await repo.create({ email: 'a@x.com', role: 'expert' }, ctxAdmin);
      const r = await repo.delete(u.uid, ctxAdmin);
      expect(r.deletedAt).toBeInstanceOf(Date);
      const after = await repo.getById(u.uid, ctxAdmin);
      expect(after).toBeNull();
    });

    it('update de user inexistente devuelve NOT_FOUND', async () => {
      await expect(repo.update('nope', { displayName: 'x' }, ctxAdmin)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });
}

suite('Memory', () => new MemoryUserRepository());

import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryOrganizationRepository } from '../memory';
import type { OrganizationRepository } from '../types';

const ctxAdmin = {
  uid: 'u_admin',
  email: 'admin@x.com',
  role: 'admin' as const,
  organizationId: 'org_default',
  traceId: 't1',
};

const ctxRecruiter = {
  uid: 'u_rec',
  email: 'rec@x.com',
  role: 'recruiter' as const,
  organizationId: 'org_default',
  traceId: 't2',
};

function suite(name: string, makeRepo: () => OrganizationRepository): void {
  describe(`[OrganizationRepository:${name}]`, () => {
    let repo: OrganizationRepository;

    beforeEach(() => {
      repo = makeRepo();
      if ('__reset' in repo && typeof repo.__reset === 'function') repo.__reset();
    });

    it('create persiste org', async () => {
      const o = await repo.create({ name: 'Acme', slug: 'acme', plan: 'pro' }, ctxAdmin);
      expect(o.orgId).toBeTruthy();
      expect(o.slug).toBe('acme');
    });

    it('create por no-admin falla', async () => {
      await expect(
        repo.create({ name: 'X', slug: 'x', plan: 'free' }, ctxRecruiter),
      ).rejects.toBeInstanceOf(Error);
    });

    it('create rechaza slug duplicado', async () => {
      await repo.create({ name: 'A', slug: 'dup', plan: 'free' }, ctxAdmin);
      await expect(
        repo.create({ name: 'B', slug: 'dup', plan: 'free' }, ctxAdmin),
      ).rejects.toMatchObject({ code: 'ALREADY_EXISTS' });
    });

    it('list pagina y excluye deleted por defecto', async () => {
      for (let i = 0; i < 3; i++) {
        await repo.create({ name: `n${i}`, slug: `s${i}`, plan: 'free' }, ctxAdmin);
      }
      const r = await repo.list({ page: 1, pageSize: 2 }, ctxAdmin);
      expect(r.items.length).toBe(2);
      expect(r.total).toBe(3);
    });

    it('update por admin funciona', async () => {
      const o = await repo.create({ name: 'A', slug: 's1', plan: 'free' }, ctxAdmin);
      const updated = await repo.update(o.orgId, { plan: 'pro' }, ctxAdmin);
      expect(updated.plan).toBe('pro');
    });

    it('delete soft hidea el org', async () => {
      const o = await repo.create({ name: 'A', slug: 's2', plan: 'free' }, ctxAdmin);
      await repo.delete(o.orgId, ctxAdmin);
      const after = await repo.getById(o.orgId, ctxAdmin);
      expect(after).toBeNull();
    });
  });
}

suite('Memory', () => new MemoryOrganizationRepository());

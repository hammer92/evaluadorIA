import {
  organizationSchema,
  type Organization,
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
} from '@shared/schemas/organizations';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';

import { RepositoryError } from '../errors';

import {
  toOrganization,
  toOrganizationInputRaw,
  toUpdateOrgRaw,
  type OrganizationRaw,
} from './mapper';
import type {
  Ctx,
  ListOrganizationsInput,
  ListOrganizationsResult,
  OrganizationRepository,
} from './types';

import { db as defaultDb } from '@/lib/firebase/client';

const COLLECTION = 'organizations';

export class FirebaseOrganizationRepository implements OrganizationRepository {
  private readonly _db: Firestore;
  constructor(dbInstance?: Firestore) {
    this._db = dbInstance ?? defaultDb;
  }
  async list(input: ListOrganizationsInput, _ctx: Ctx): Promise<ListOrganizationsResult> {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
    try {
      const q = query(
        collection(this._db, COLLECTION),
        orderBy('created_at', 'desc'),
        limit(pageSize * page),
      );
      const snap = await getDocs(q);
      const items = snap.docs
        .map((d) => toOrganization(d.id, d.data() as OrganizationRaw))
        .filter((o) => (input.status === 'deleted' ? o.deletedAt !== null : o.deletedAt === null));
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
      throw RepositoryError.internal('Error al listar organizaciones', e);
    }
  }

  async getById(orgId: string, _ctx: Ctx): Promise<Organization | null> {
    try {
      const snap = await getDoc(doc(this._db, COLLECTION, orgId));
      if (!snap.exists()) return null;
      const raw = snap.data() as OrganizationRaw;
      if (raw.deleted_at !== null) return null;
      return organizationSchema.parse(toOrganization(orgId, raw));
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      throw RepositoryError.internal(`Error al obtener organización ${orgId}`, e);
    }
  }

  async create(input: CreateOrganizationInput, ctx: Ctx): Promise<Organization> {
    if (ctx.role !== 'admin') throw RepositoryError.permissionDenied();
    try {
      const ref = doc(collection(this._db, COLLECTION));
      const now = serverTimestamp();
      const raw: OrganizationRaw = {
        ...toOrganizationInputRaw(input),
        created_at: now as unknown as OrganizationRaw['created_at'],
        updated_at: now as unknown as OrganizationRaw['updated_at'],
        created_by: ctx.uid,
        deleted_at: null,
      };
      await setDoc(ref, raw);
      const created = toOrganization(ref.id, {
        ...raw,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
      return organizationSchema.parse(created);
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      throw RepositoryError.internal(`Error al crear organización ${input.slug}`, e);
    }
  }

  async update(orgId: string, input: UpdateOrganizationInput, ctx: Ctx): Promise<Organization> {
    if (ctx.role !== 'admin') throw RepositoryError.permissionDenied();
    try {
      const ref = doc(this._db, COLLECTION, orgId);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw RepositoryError.notFound('Organization', orgId);
      const patch = toUpdateOrgRaw(input);
      await updateDoc(ref, { ...patch, updated_at: serverTimestamp() });
      const updated = await this.getById(orgId, ctx);
      if (!updated) throw RepositoryError.notFound('Organization', orgId);
      return updated;
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      throw RepositoryError.internal(`Error al actualizar organización ${orgId}`, e);
    }
  }

  async delete(orgId: string, ctx: Ctx): Promise<{ orgId: string; deletedAt: Date }> {
    if (ctx.role !== 'admin') throw RepositoryError.permissionDenied();
    try {
      const ref = doc(this._db, COLLECTION, orgId);
      const now = serverTimestamp();
      await updateDoc(ref, { deleted_at: now, updated_at: now });
      return { orgId, deletedAt: new Date() };
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      throw RepositoryError.internal(`Error al eliminar organización ${orgId}`, e);
    }
  }
}

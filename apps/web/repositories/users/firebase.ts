import {
  userSchema,
  type User,
  type CreateUserInput,
  type UpdateUserInput,
} from '@shared/schemas/users';
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
  updateDoc,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';

import { RepositoryError } from '../errors';

import { toUpdateRaw, toUser, toUserInputRaw, type UserRaw } from './mapper';
import type { Ctx, ListUsersInput, ListUsersResult, UserRepository } from './types';

import { db as defaultDb } from '@/lib/firebase/client';

const COLLECTION = 'users';

// =============================================================================
// FirebaseUserRepository — impl de producción contra Firestore.
// =============================================================================
// Estrategia:
//   - list: query paginada con orderBy(created_at desc) + filtros where
//   - getById: doc ref directo
//   - create: setDoc con serverTimestamp() para createdAt/updatedAt inmutables
//   - update: defensa en profundidad (rol check antes de patch)
//   - delete: soft delete (deleted_at) por requerimiento de auditoría
// =============================================================================

export class FirebaseUserRepository implements UserRepository {
  private readonly _db: Firestore;
  constructor(dbInstance?: Firestore) {
    this._db = dbInstance ?? defaultDb;
  }
  async list(input: ListUsersInput, _ctx: Ctx): Promise<ListUsersResult> {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
    const filters: QueryConstraint[] = [];
    if (input.organizationId) filters.push(where('organization_id', '==', input.organizationId));
    if (input.status) filters.push(where('status', '==', input.status));
    if (input.role) filters.push(where('role', '==', input.role));

    try {
      const q = query(
        collection(this._db, COLLECTION),
        ...filters,
        orderBy('created_at', 'desc'),
        limit(pageSize * page),
      );
      const snap = await getDocs(q);
      const items = snap.docs
        .map((d) => toUser(d.id, d.data() as UserRaw))
        .filter((u) => u.deletedAt === null)
        .filter((u) =>
          input.search
            ? `${u.email} ${u.displayName ?? ''}`.toLowerCase().includes(input.search.toLowerCase())
            : true,
        );
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
      throw RepositoryError.internal('Error al listar usuarios', e);
    }
  }

  async getById(uid: string, _ctx: Ctx): Promise<User | null> {
    try {
      const snap = await getDoc(doc(this._db, COLLECTION, uid));
      if (!snap.exists()) return null;
      const raw = snap.data() as UserRaw;
      if (raw.deleted_at !== null) return null;
      return userSchema.parse(toUser(uid, raw));
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      throw RepositoryError.internal(`Error al obtener usuario ${uid}`, e);
    }
  }

  async create(input: CreateUserInput, ctx: Ctx): Promise<User> {
    try {
      const ref = doc(collection(this._db, COLLECTION));
      const now = serverTimestamp();
      const raw: UserRaw = {
        ...toUserInputRaw(input),
        photo_url: null,
        last_login_at: null,
        created_at: now as unknown as UserRaw['created_at'],
        updated_at: now as unknown as UserRaw['updated_at'],
        created_by: ctx.uid,
        deleted_at: null,
      };
      await setDoc(ref, raw);
      // serverTimestamp() se resuelve async; reconstruimos localmente para el return
      const created = toUser(ref.id, {
        ...raw,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
      return userSchema.parse(created);
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      if (String(e).includes('already exists')) {
        throw RepositoryError.alreadyExists('User', 'email', input.email);
      }
      throw RepositoryError.internal(`Error al crear usuario ${input.email}`, e);
    }
  }

  async update(uid: string, input: UpdateUserInput, ctx: Ctx): Promise<User> {
    try {
      const ref = doc(this._db, COLLECTION, uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw RepositoryError.notFound('User', uid);
      const current = snap.data() as UserRaw;

      // Defensa en profundidad: rules también lo validan (firestore.rules §USERS)
      if (ctx.uid !== uid && ctx.role !== 'admin') {
        throw RepositoryError.permissionDenied('Solo admin o el propio user pueden modificar');
      }
      if (input.role && input.role !== current.role && ctx.role !== 'admin') {
        throw RepositoryError.permissionDenied('Solo admin puede cambiar role');
      }

      const patch = toUpdateRaw(input);
      await updateDoc(ref, { ...patch, updated_at: serverTimestamp() });
      const updated = await this.getById(uid, ctx);
      if (!updated) throw RepositoryError.notFound('User', uid);
      return updated;
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      throw RepositoryError.internal(`Error al actualizar usuario ${uid}`, e);
    }
  }

  async delete(uid: string, ctx: Ctx): Promise<{ uid: string; deletedAt: Date }> {
    if (ctx.role !== 'admin') throw RepositoryError.permissionDenied();
    try {
      const ref = doc(this._db, COLLECTION, uid);
      const now = serverTimestamp();
      await updateDoc(ref, { deleted_at: now, updated_at: now });
      return { uid, deletedAt: new Date() };
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      throw RepositoryError.internal(`Error al eliminar usuario ${uid}`, e);
    }
  }
}

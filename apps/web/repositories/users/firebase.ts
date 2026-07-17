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

/**
 * Implementación de {@link UserRepository} contra Firestore (producción).
 *
 * Esta es la única clase en `apps/web/repositories/users/` que importa
 * `firebase/firestore`. Mantiene el rule "repositories own the vendor":
 * el dominio consume solo la interfaz agnóstica.
 *
 * **Soft delete**: nunca borra físicamente un documento. Marca
 * `deleted_at` con `serverTimestamp()`. Las queries filtran por
 * `deleted_at == null` para ocultar los soft-deleted.
 *
 * **Server timestamps**: usa `serverTimestamp()` de Firestore para
 * `created_at`, `updated_at` y `deleted_at`. Estos se resuelven async
 * en el server; el método que retorna el doc los reconstruye localmente
 * con `Timestamp.now()` para no devolver valores `null` al cliente.
 *
 * **Permisos**: aplica *defense in depth* — chequea `ctx.role` antes de
 * mutar, además de las reglas de Firestore. Esto evita que un bug en
 * las rules filtre un endpoint admin.
 *
 * @example
 * ```ts
 * import { getUserRepository } from '@/repositories';
 *
 * const repo = getUserRepository();         // factory devuelve Firebase impl
 * const users = await repo.list({ page: 1, pageSize: 20 }, ctx);
 * ```
 *
 * @see UserRepository para el contrato de la interfaz.
 * @see firestore.rules §USERS para las reglas server-side que refuerzan
 *      estos chequeos.
 */
export class FirebaseUserRepository implements UserRepository {
  /** Instancia de Firestore inyectada (DI). Default = singleton de `lib/firebase/client`. */
  private readonly _db: Firestore;

  /**
   * Crea una nueva instancia.
   *
   * @param dbInstance - Instancia opcional de Firestore. Si se omite, usa
   *   el singleton `db` de `@/lib/firebase/client`. Pasar un `db` custom
   *   es útil para tests (mock del SDK) y para emuladores con proyecto
   *   distinto al singleton.
   */
  constructor(dbInstance?: Firestore) {
    this._db = dbInstance ?? defaultDb;
  }

  /**
   * Lista usuarios con paginación y filtros.
   *
   * Comportamiento:
   * - Filtra `deleted_at == null` (soft-deleted ocultos).
   * - Si `search` está presente, hace match case-insensitive sobre
   *   `email + displayName` (en memoria, post-Firestore).
   * - Ordena por `created_at DESC`.
   * - Pagina después del filtro `search` (potencial O(N) si search es
   *   amplio; aceptable para MVP porque `pageSize * page ≤ 100`).
   *
   * @param input - Filtros: `organizationId`, `status`, `role`, `search`,
   *   `page`, `pageSize`.
   * @param _ctx - Contexto de llamada (no se usa en el filtro Firestore
   *   porque las rules se encargan del access control).
   * @returns Items de la página + metadata de paginación.
   * @throws {RepositoryError} `INTERNAL` si la query falla.
   */
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

  /**
   * Obtiene un usuario por UID.
   *
   * Retorna `null` si:
   * - El doc no existe.
   * - El doc tiene `deleted_at != null` (soft-deleted).
   *
   * Valida el resultado contra `userSchema` (Zod) antes de retornar —
   * esto detecta drift entre el shape de Firestore y el contrato TS.
   *
   * @param uid - Firebase Auth UID del usuario.
   * @param _ctx - Contexto (no se usa aquí; las rules validan el acceso).
   * @returns El usuario o `null` si no existe / está borrado.
   * @throws {RepositoryError} `INTERNAL` si la lectura o validación falla.
   */
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

  /**
   * Crea un nuevo usuario en Firestore.
   *
   * **Importante**: este método **NO** crea el usuario en Firebase Auth
   * (eso lo hace `v1AuthSignUp` en Cloud Functions). Aquí solo persiste
   * el doc espejo en la colección `users/`. La consistencia Auth↔Firestore
   * se garantiza en la CF con una transacción atómica.
   *
   * Asigna:
   * - `uid` = nuevo `doc(collection).id`.
   * - `status` = `'invited'` (no puede loguearse hasta que el admin
   *   cambie a `'active'`).
   * - `created_by` = `ctx.uid`.
   * - `created_at` / `updated_at` = `serverTimestamp()` (server, inmutable).
   * - `deleted_at` = `null`.
   *
   * @param input - Datos del usuario a crear (ver `CreateUserInput`).
   * @param ctx - Contexto; `ctx.uid` se persiste como `created_by`.
   * @returns El usuario creado, con `uid` y timestamps locales resueltos.
   * @throws {RepositoryError} `ALREADY_EXISTS` si el email ya existe (en
   *   realidad es raro; la uniqueness la enforce `v1AuthSignUp`).
   * @throws {RepositoryError} `INTERNAL` en otros errores.
   */
  async create(input: CreateUserInput, ctx: Ctx): Promise<User> {
    try {
      const ref = doc(collection(this._db, COLLECTION));
      const now = serverTimestamp();
      const rawInput = {
        email: input.email,
        role: input.role,
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.organizationId !== undefined ? { organizationId: input.organizationId } : {}),
      };
      const raw: UserRaw = {
        ...toUserInputRaw(rawInput),
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

  /**
   * Actualiza un usuario existente.
   *
   * Permisos aplicados (defense in depth):
   * 1. Si `ctx.uid !== uid` y `ctx.role !== 'admin'` → `PERMISSION_DENIED`.
   * 2. Si intenta cambiar `role` y no es admin → `PERMISSION_DENIED`.
   *
   * Las reglas de Firestore (`firestore.rules §USERS`) también lo
   * validan server-side; este chequeo evita una round-trip al server
   * en casos que sabemos que van a fallar.
   *
   * Después de la update, relee el doc para retornar la versión
   * actualizada (con `updated_at` server-side resuelto).
   *
   * @param uid - UID del usuario a actualizar.
   * @param input - Campos a modificar (parcial). Solo `displayName`,
   *   `photoURL`, `role`, `status` son aceptados (ver `UpdateUserInput`).
   * @param ctx - Contexto de auth.
   * @returns El usuario actualizado.
   * @throws {RepositoryError} `NOT_FOUND` si el usuario no existe.
   * @throws {RepositoryError} `PERMISSION_DENIED` si el rol no permite.
   * @throws {RepositoryError} `INTERNAL` en otros errores.
   */
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

  /**
   * Soft-delete de un usuario (solo admin).
   *
   * Marca `deleted_at = serverTimestamp()` y `updated_at`. **No** borra
   * físicamente el documento (esto preserva la auditoría y permite
   * restaurar en caso de error).
   *
   * Permisos: `ctx.role !== 'admin'` → `PERMISSION_DENIED` inmediato
   * (sin round-trip al server).
   *
   * @param uid - UID del usuario a eliminar.
   * @param ctx - Contexto; debe tener `role === 'admin'`.
   * @returns `{ uid, deletedAt: Date }` con el timestamp local de la
   *   eliminación (aproximado; el server puede resolverlo async).
   * @throws {RepositoryError} `PERMISSION_DENIED` si el rol no es admin.
   * @throws {RepositoryError} `INTERNAL` en otros errores.
   */
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

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

/**
 * Implementación de {@link OrganizationRepository} contra Firestore.
 *
 * Solo callable por `role === 'admin'`. Cualquier operación de mutación
 * (`create`, `update`, `delete`) chequea `ctx.role` antes de tocar
 * Firestore; las reglas de Firestore (`firestore.rules §ORGANIZATIONS`)
 * también lo enforce server-side.
 *
 * **Soft delete**: marca `deleted_at` (no borra físicamente) para
 * preservar auditoría. `list()` acepta `status: 'deleted'` para ver
 * las soft-deleted (uso admin).
 *
 * @see OrganizationRepository para el contrato.
 * @see firestore.rules §ORGANIZATIONS para reglas server-side.
 */
export class FirebaseOrganizationRepository implements OrganizationRepository {
  /** Instancia de Firestore inyectada (DI). Default = singleton de `lib/firebase/client`. */
  private readonly _db: Firestore;

  /**
   * Crea una nueva instancia.
   *
   * @param dbInstance - Instancia opcional de Firestore. Si se omite, usa
   *   el singleton `db` de `@/lib/firebase/client`. Útil para tests y
   *   emuladores con proyecto custom.
   */
  constructor(dbInstance?: Firestore) {
    this._db = dbInstance ?? defaultDb;
  }

  /**
   * Lista organizaciones con paginación.
   *
   * Filtros:
   * - `status: 'deleted'` → muestra soft-deleted (uso admin).
   * - otros casos → oculta soft-deleted (`deleted_at == null`).
   *
   * Ordena por `created_at DESC`. Pagina después del filtro.
   *
   * @param input - `{ status?, page?, pageSize? }`.
   * @param _ctx - Contexto (no usado; rules validan acceso).
   * @returns Items + metadata de paginación.
   * @throws {RepositoryError} `INTERNAL` si la query falla.
   */
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

  /**
   * Obtiene una organización por ID.
   *
   * Retorna `null` si:
   * - El doc no existe.
   * - El doc tiene `deleted_at != null` (soft-deleted).
   *
   * Valida el resultado contra `organizationSchema` (Zod) para detectar
   * drift entre Firestore y el contrato TS.
   *
   * @param orgId - ID de la organización.
   * @param _ctx - Contexto (no usado).
   * @returns La organización o `null`.
   * @throws {RepositoryError} `INTERNAL` si la lectura o validación falla.
   */
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

  /**
   * Crea una nueva organización (solo admin).
   *
   * Permisos: `ctx.role !== 'admin'` → `PERMISSION_DENIED` inmediato.
   *
   * Asigna:
   * - `orgId` = nuevo `doc(collection).id`.
   * - `created_by` = `ctx.uid`.
   * - `created_at` / `updated_at` = `serverTimestamp()`.
   * - `deleted_at` = `null`.
   *
   * @param input - Datos de la organización (ver `CreateOrganizationInput`).
   * @param ctx - Contexto; debe tener `role === 'admin'`.
   * @returns La organización creada con timestamps locales resueltos.
   * @throws {RepositoryError} `PERMISSION_DENIED` si el rol no es admin.
   * @throws {RepositoryError} `INTERNAL` en otros errores.
   */
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

  /**
   * Actualiza una organización existente (solo admin).
   *
   * Permisos: `ctx.role !== 'admin'` → `PERMISSION_DENIED`.
   *
   * Relee el doc después de la update para retornar la versión
   * actualizada con `updated_at` resuelto.
   *
   * @param orgId - ID de la organización.
   * @param input - Campos a modificar (ver `UpdateOrganizationInput`).
   * @param ctx - Contexto; debe tener `role === 'admin'`.
   * @returns La organización actualizada.
   * @throws {RepositoryError} `NOT_FOUND` si no existe.
   * @throws {RepositoryError} `PERMISSION_DENIED` si el rol no es admin.
   * @throws {RepositoryError} `INTERNAL` en otros errores.
   */
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

  /**
   * Soft-delete de una organización (solo admin).
   *
   * Marca `deleted_at` y `updated_at`. No borra físicamente.
   *
   * Permisos: `ctx.role !== 'admin'` → `PERMISSION_DENIED`.
   *
   * @param orgId - ID de la organización a eliminar.
   * @param ctx - Contexto; debe tener `role === 'admin'`.
   * @returns `{ orgId, deletedAt: Date }` con timestamp local.
   * @throws {RepositoryError} `PERMISSION_DENIED` si el rol no es admin.
   * @throws {RepositoryError} `INTERNAL` en otros errores.
   */
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

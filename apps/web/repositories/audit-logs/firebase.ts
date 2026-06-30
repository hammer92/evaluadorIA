import {
  auditLogSchema,
  type AuditLog,
  type CreateAuditLogInput,
} from '@shared/schemas/audit-logs';
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
  type QueryConstraint,
  type Firestore,
} from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';

import { RepositoryError } from '../errors';

import { toAuditLog, toAuditLogInputRaw, type AuditLogRaw } from './mapper';
import type { Ctx, ListAuditLogsInput, ListAuditLogsResult, AuditLogRepository } from './types';

import { db as defaultDb } from '@/lib/firebase/client';

const COLLECTION = 'auditLogs';

/**
 * Implementación de {@link AuditLogRepository} contra Firestore.
 *
 * **Append-only**: el cliente **NO** puede escribir a esta colección
 * (`firestore.rules: allow write: if false`). Solo el Admin SDK
 * (Cloud Functions con `firebase-admin`) puede escribir. Este repo
 * se usa únicamente desde CFs con credenciales de service account.
 *
 * **Por lo tanto** en el contexto del front (RSC + Client Components)
 * este repo solo se invoca con `dbInstance` apuntando al Admin SDK;
 * nunca con la SDK cliente.
 *
 * @see AuditLogRepository para el contrato.
 * @see firestore.rules §AUDIT_LOGS para reglas server-side.
 */
export class FirebaseAuditLogRepository implements AuditLogRepository {
  /** Instancia de Firestore inyectada (DI). Default = singleton de `lib/firebase/client`. */
  private readonly _db: Firestore;

  /**
   * Crea una nueva instancia.
   *
   * @param dbInstance - Instancia opcional de Firestore. **Importante**:
   *   en producción este repo se usa con **Admin SDK** (no cliente),
   *   porque el cliente no tiene permisos de escritura en `auditLogs`.
   */
  constructor(dbInstance?: Firestore) {
    this._db = dbInstance ?? defaultDb;
  }

  /**
   * Append de un nuevo audit log (solo Admin SDK).
   *
   * Comportamiento:
   * - Genera `logId = doc(collection).id`.
   * - Asigna `created_at = serverTimestamp()` (server, inmutable).
   * - Retorna el log con `created_at` local resuelto.
   *
   * **Pre-condición**: la invocación debe hacerse desde Cloud Functions
   * con credenciales Admin. Si el cliente intenta llamar esto, las
   * rules lo rechazarán con `permission-denied`.
   *
   * @param input - Datos del evento a registrar (ver `CreateAuditLogInput`).
   * @param _ctx - Contexto; el actor del evento se persiste como `actor_id`.
   * @returns El audit log creado con `logId` y `createdAt`.
   * @throws {RepositoryError} `INTERNAL` si el append falla.
   */
  async append(input: CreateAuditLogInput, _ctx: Ctx): Promise<AuditLog> {
    try {
      const ref = doc(collection(this._db, COLLECTION));
      const now = serverTimestamp();
      const raw: AuditLogRaw = {
        ...toAuditLogInputRaw(input),
        created_at: now as unknown as AuditLogRaw['created_at'],
      };
      await setDoc(ref, raw);
      const created = toAuditLog(ref.id, {
        ...raw,
        created_at: Timestamp.now(),
      });
      return auditLogSchema.parse(created);
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      throw RepositoryError.internal(`Error al registrar audit log`, e);
    }
  }

  /**
   * Lista audit logs con paginación y filtros.
   *
   * Filtros disponibles: `organizationId`, `actorId`, `targetType`,
   * `targetId`. Ordena por `created_at DESC`.
   *
   * Las rules de Firestore limitan el read a `role === 'admin'`
   * (`firestore.rules: hasRole('admin')`). Si un usuario no-admin
   * intenta listar, recibe `permission-denied`.
   *
   * @param input - Filtros + paginación.
   * @param _ctx - Contexto (no usado; las rules validan acceso).
   * @returns Items + metadata de paginación.
   * @throws {RepositoryError} `INTERNAL` si la query falla.
   */
  async list(input: ListAuditLogsInput, _ctx: Ctx): Promise<ListAuditLogsResult> {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
    const filters: QueryConstraint[] = [];
    if (input.organizationId) filters.push(where('organization_id', '==', input.organizationId));
    if (input.actorId) filters.push(where('actor_id', '==', input.actorId));
    if (input.targetType) filters.push(where('target_type', '==', input.targetType));
    if (input.targetId) filters.push(where('target_id', '==', input.targetId));

    try {
      const q = query(
        collection(this._db, COLLECTION),
        ...filters,
        orderBy('created_at', 'desc'),
        limit(pageSize * page),
      );
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => toAuditLog(d.id, d.data() as AuditLogRaw));
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
      throw RepositoryError.internal('Error al listar audit logs', e);
    }
  }

  /**
   * Obtiene un audit log por ID.
   *
   * Valida el resultado contra `auditLogSchema` (Zod) para detectar
   * drift entre Firestore y el contrato TS.
   *
   * Las rules limitan el read a admin (igual que `list`).
   *
   * @param logId - ID del log.
   * @param _ctx - Contexto (no usado).
   * @returns El audit log o `null` si no existe.
   * @throws {RepositoryError} `INTERNAL` si la lectura o validación falla.
   */
  async getById(logId: string, _ctx: Ctx): Promise<AuditLog | null> {
    try {
      const snap = await getDoc(doc(this._db, COLLECTION, logId));
      if (!snap.exists()) return null;
      return auditLogSchema.parse(toAuditLog(logId, snap.data() as AuditLogRaw));
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      throw RepositoryError.internal(`Error al obtener audit log ${logId}`, e);
    }
  }
}

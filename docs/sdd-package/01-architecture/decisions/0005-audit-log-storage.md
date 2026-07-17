# ADR 0005 — Storage de Audit Logs: segunda DB Firestore vs Realtime Database

> **Estado:** Proposed
> **Fecha:** 2026-06-25
> **Decisión propuesta:** mantener Audit Logs en Firestore, pero en una **segunda database** del mismo proyecto (`audit-logs`), no en la database por defecto.
> **Supersede:** parcialmente ADR-0003 (la regla "no usar RTDB" se mantiene; lo que cambia es la estrategia de storage de audit logs dentro de Firestore).

---

## Contexto

El master plan actual modela `auditLogs` como una colección más dentro de Firestore (database `default`), accesible vía reglas estándar y leída por el admin UI (futuro SDD de audit log explorer).

Surge la pregunta arquitectónica de si conviene mover audit logs a **Realtime Database** para:

1. **Separación de dependencias** — que el dominio `auditLogs` no compita con el dominio `users`/`organizations` por los mismos recursos.
2. **Evitar cuello de botella en la DB principal** — si el volumen de audit logs crece, ¿afecta el rendimiento de la app?

Esta ADR analiza la propuesta formalmente.

---

## El problema real (y si existe)

### Volumen esperado

Del master plan y SDD-04:

- **Pico**: ~20K eventos de respuesta/día + eventos de auth/login + acciones admin.
- **Promedio realista MVP**: 50–200 audit logs/día (cada acción admin relevante genera 1 log).
- **Pico realista (cliente enterprise)**: 5K–10K audit logs/día.

### ¿Es eso un cuello de botella para Firestore?

- Firestore escala a **10,000 writes/sec por documento individual** y **1,000 writes/sec sustained en colecciones con sharding automático**.
- 10K writes/día = ~0.12 writes/sec promedio, ~1 write/sec en pico.
- **No hay cuello de botella**. Firestore maneja 4 órdenes de magnitud más.

### ¿Y quota de billing?

- Firestore free tier: 20K writes/día, 1GB storage. Just enough para MVP gratis.
- Blaze plan: $0.18 por millón de writes, $0.026/GB storage/día.
- 10K audit logs/día = $0.06/mes en writes. **Irrelevante.**

**Conclusión: el "cuello de botella" no es real para el caso de uso esperado.** Pero la **separación de dependencias sí es una preocupación válida** por otras razones:

- Blast radius: un bug en una query pesada de audit logs no afecta la app principal.
- Cost visibility: poder atribuir costo por dominio.
- Compliance: poder hacer export/delete selectivo sin tocar datos de negocio.

---

## Opciones consideradas

### Opción A — Mantener en Firestore database `default` (status quo)

- ❌ Comparte quota con datos de negocio.
- ❌ Blast radius acoplado: query pesada de audit impacta usuarios.
- ❌ Cost attribution imposible sin log parsing.
- ✅ Simple, una sola DB.
- ✅ Una sola config de seguridad.

### Opción B — Mover a Realtime Database

- ✅ Separación total (motor distinto).
- ✅ Pricing por bandwidth puede ser conveniente si los audit logs se consultan poco.
- ❌ **Rompe ADR-0003** ("no usar RTDB").
- ❌ Dos SDKs: `firebase/database` + `firebase/firestore`.
- ❌ Reglas RTDB son JSON plano, menos expresivas que Firestore rules (CEL-like).
- ❌ Queries limitadas: no `where` + `orderBy` de campos distintos sin denormalizar.
- ❌ No hay export nativo a BigQuery (analytics pobre).
- ❌ Cognitive load en el equipo: dos mental models de seguridad.
- ❌ Hot key problem en paths jerárquicos: un nodo muy activo se vuelve cuello de botella peor que Firestore.

### Opción C — Segunda database Firestore ✅ (recomendada)

- ✅ **Mismo SDK** (`getFirestore(app, 'audit-logs')`).
- ✅ Mismas reglas, mismo modelo de queries, mismos índices.
- ✅ **Quota independiente** entre DBs.
- ✅ **Blast radius aislado**.
- ✅ **Cost attribution por database** vía billing labels.
- ✅ BigQuery export funciona igual.
- ✅ Si en el futuro queremos migrar audit logs a BigQuery, el código no cambia.
- ⚠️ Requiere declarar la segunda DB en Firebase Console (1-click setup).
- ⚠️ Las reglas Firestore se deployan por separado: `firestore.audit-logs.rules`.

### Opción D — Export directo a BigQuery (complemento, no reemplazo)

- ✅ Costo de storage en BigQuery es prácticamente cero a este volumen.
- ✅ Queries analíticas poderosas (SQL).
- ❌ Latencia de export (batch, no realtime).
- ❌ No es buena para mostrar audit log en UI admin (necesitas queries实时).
- **Decisión**: combinar con Opción C — `audit-logs` Firestore para UI + export batch a BigQuery para analytics.

---

## Decisión recomendada

**Opción C (segunda DB Firestore)** como storage primario de audit logs, con **Opción D (BigQuery export) como complemento opcional** activado cuando aparezca la necesidad de analytics históricas.

Esto:

- Conserva el principio de "vendor consistency" de ADR-0003 (no usamos RTDB).
- Da separación real de quota, blast radius y costo.
- Cero costo cognitivo adicional: el equipo sigue pensando en Firestore.
- Permite evolucionar a BigQuery sin reescribir nada.

---

## Implementación

### 1. Setup en Firebase Console

```
Firebase Console → Firestore → "Create database" → Database ID: "audit-logs"
Location: misma región que `default` (no se puede cambiar después).
```

### 2. Configuración de `firebase.json`

```jsonc
{
  "firestore": [
    {
      "database": "(default)",
      "rules": "firestore.rules",
      "indexes": "firestore.indexes.json",
    },
    {
      "database": "audit-logs",
      "rules": "firestore.audit-logs.rules",
      "indexes": "firestore.audit-logs.indexes.json",
    },
  ],
}
```

### 3. Wrappers SDK

```ts
// apps/web/lib/firebase/audit-logs-client.ts
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseApp } from './client';

let _auditDb: Firestore | undefined;
export function getAuditDb(): Firestore {
  if (_auditDb) return _auditDb;
  _auditDb = getFirestore(firebaseApp, 'audit-logs');
  if (env.NEXT_PUBLIC_APP_ENV === 'dev' && typeof window !== 'undefined') {
    connectFirestoreEmulator(_auditDb, '127.0.0.1', 8080, 'audit-logs');
    8;
  }
  return _auditDb;
}
```

```ts
// apps/functions/src/firebase-admin.ts — agregar
let _auditAdminDb: Firestore | undefined;
export function getAdminAuditDb(): Firestore {
  if (_auditAdminDb) return _auditAdminDb;
  _auditAdminDb = getFirestore(getAdminApp(), 'audit-logs');
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    // El emulador por default sirve solo (default). Para multi-db,
    // hay que usar el parámetro `database` en cada llamada.
  }
  return _auditAdminDb;
}
```

> **Importante con emuladores**: el emulador Firestore soporta multi-database, pero hay que pasar el database ID explícitamente. Ver `firebase emulators:start --database "audit-logs"`.

### 4. Repository para Audit Logs

```ts
// apps/web/repositories/audit-logs/firebase.ts (extracto)
import { collection, doc, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { getAuditDb } from '@/lib/firebase/audit-logs-client';

export class FirebaseAuditLogRepository implements AuditLogRepository {
  private db = getAuditDb();

  async append(input: CreateAuditLogInput, _ctx: Ctx): Promise<AuditLog> {
    const ref = await addDoc(collection(this.db, 'auditLogs'), {
      organization_id: input.organizationId,
      actor_id: input.actorId,
      actor_email: input.actorEmail,
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId,
      metadata: input.metadata ?? {},
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
      created_at: serverTimestamp(),
    });
    return { ...input, logId: ref.id, createdAt: new Date() };
  }

  async list(input: ListAuditLogsInput, _ctx: Ctx): Promise<ListAuditLogsResult> {
    const filters = [];
    if (input.organizationId) filters.push(where('organization_id', '==', input.organizationId));
    if (input.actorId) filters.push(where('actor_id', '==', input.actorId));
    if (input.targetType) filters.push(where('target_type', '==', input.targetType));
    if (input.targetId) filters.push(where('target_id', '==', input.targetId));

    const snap = await getDocs(
      query(
        collection(this.db, 'auditLogs'),
        ...filters,
        orderBy('created_at', 'desc'),
        limit(input.pageSize * input.page),
      ),
    );
    // ... mapping como en UserRepository
  }
}
```

> Nota: como audit logs se escriben desde Cloud Functions (Admin SDK), en realidad este repository cliente solo lo usa el admin UI para _leer_. Las escrituras van por Cloud Functions directamente. Esto encaja con la regla de "auditLogs son append-only".

### 5. Reglas de Firestore para `audit-logs` DB

`firestore.audit-logs.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /{document=**} {
    allow read, write: if false;
  }

  match /auditLogs/{logId} {
    // Lectura: admin de la org a la que pertenece el log
    allow read: if isSignedIn() && hasRole('admin') && (
      resource == null ||
      resource.data.organization_id == request.auth.token.organizationId ||
      request.auth.token.role == 'admin'
    );

    // Escritura: NUNCA desde cliente. Solo Admin SDK en Cloud Functions.
    allow write: if false;
  }

  function isSignedIn() { return request.auth != null; }
  function hasRole(r) { return request.auth.token.role == r; }
}
```

> **Decisión reforzada**: el cliente NO escribe audit logs nunca. Solo Cloud Functions. Esto sigue valiendo con multi-DB.

### 6. BigQuery export (opcional, futuro)

Activar Firebase Extension "Stream Firestore to BigQuery" solo para la DB `audit-logs`. Configurar destination table particionada por día.

Costo: BigQuery storage ~$0.02/GB/mes, queries ~$5/TB escaneado. Para 10K logs/día ≈ 1MB/día = **prácticamente gratis**.

---

## Consecuencias

### Positivas

- **Separación real**: quota, blast radius, costo aislado.
- **Mismo SDK, mismo modelo mental**: el equipo no aprende nada nuevo.
- **Escalabilidad futura**: pasar a BigQuery es aditivo, no reemplazo.
- **Compliance**: se puede borrar la DB `audit-logs` independientemente (ej. para un cliente que pide purge).
- **Cost attribution**: en Firebase billing console se ve separado.

### Negativas

- Setup inicial: crear la DB en Firebase Console (5 min, manual).
- Las reglas Firestore se manejan en 2 archivos (`firestore.rules` + `firestore.audit-logs.rules`).
- Hay que actualizar `firebase deploy` para incluir ambas: `firebase deploy --only firestore:rules,firestore:indexes`.
- Tests de integración con emuladores requieren `--only firestore,auth,firestore:audit-logs` (sintaxis a verificar; documentar en SDD-03 update).

### Neutras

- No requiere tocar SDD-04 (el repository pattern ya soporta múltiples datasources; solo agregamos una nueva instancia del SDK).

---

## Plan de actualización de SDDs afectados

| SDD           | Cambio necesario                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SDD-03        | Agregar setup de segunda DB en Firebase Console + actualizar `firebase.json` + script de emulador para multi-DB. Agregar `firestore.audit-logs.rules` e `indexes`. |
| SDD-04        | `AuditLogRepository` apunta a `getAuditDb()` en vez de `getDb()`. `MemoryAuditLogRepository` no cambia.                                                            |
| data-model.md | Documentar que `auditLogs` vive en DB `audit-logs`, no `(default)`.                                                                                                |
| ADR-0003      | Agregar nota: "Excepción: nada cambia, audit logs se mantienen en Firestore. La separación se logra con multi-DB dentro de Firestore (ver ADR-0005)."              |

---

## Métricas de éxito (cómo validar la decisión)

Después de 3 meses en producción:

- [ ] `audit-logs` DB no tiene errores de quota que afecten `default`.
- [ ] Cost de `audit-logs` DB visible y separado en billing.
- [ ] Queries pesadas de audit (ej. export CSV) no afectan latencia de `/admin/users`.
- [ ] Equipo no reporta fricción por tener 2 DBs.

Si alguno falla, **se reconsidera**. ADR está vivo.

---

## Open Questions

- [ ] ¿Activamos BigQuery export desde el día 1 o cuando tengamos > 100K logs? **Sugerido**: cuando aparezca la necesidad de analytics cross-tenant.
- [ ] ¿La DB `audit-logs` debe vivir en la misma región que `default`? **Decisión**: sí, siempre. Latencia cross-region sería problema.
- [ ] ¿Múltiples databases adicionales para otros dominios (ej. `reports-db`)? **Decisión**: solo si aparece la necesidad. No por adelantado.

# ADR 0003 — Cloud Firestore (no Realtime Database)

> **Estado:** Proposed
> **Fecha:** 2026-06-24
> **Decisión:** usar exclusivamente Cloud Firestore. Realtime Database está prohibido.

---

## Contexto

Firebase ofrece dos bases de datos NoSQL: **Realtime Database** (la original, jerárquica tipo JSON tree) y **Cloud Firestore** (documentos + colecciones, queries más ricas, mejor modelo de seguridad).

El brief lo dice explícitamente:

> NO usar Realtime Database (usar siempre Firestore)

Pero queremos dejar documentado el rationale porque alguien lo va a preguntar.

## Opciones consideradas

### Realtime Database

- ✅ Latencia muy baja en sincronización cliente.
- ❌ Modelo jerárquico inflexible. Anidar datos para queryear es costoso de desanidar.
- ❌ Reglas de seguridad menos expresivas (`.read/.write` plano).
- ❌ Queries limitadas (no `where + orderBy` de campos distintos sin denormalizar).
- ❌ Pricing por GB descargado, fácil de inflar con accidental full-tree reads.
- ❌ Sin índices compuestos (los hacés a mano con `.indexOn`).

### Cloud Firestore ✅

- ✅ Modelo de documentos más natural para entidades (`users/{uid}`).
- ✅ Queries ricas (`where`, `orderBy`, `limit`, paginación por cursor).
- ✅ Reglas de seguridad tipadas y expresivas (`match /users/{uid} { allow ... }`).
- ✅ Índices compuestos declarativos.
- ✅ SDKs consistentes (Web, iOS, Android, Admin).
- ✅ Mejor integración con Firebase Auth y Cloud Functions.
- ⚠️ Latencia ligeramente mayor que RTDB para updates en tiempo real (no relevante para este caso de uso).

## Decisión

Toda la persistencia del proyecto se hace en **Cloud Firestore**. Realtime Database queda explícitamente fuera del scope y prohibido por convención.

### Casos de uso que NO justifican RTDB

Aun cuando alguien diga "necesito real-time para X":

- Si X es "notificar al admin cuando un candidato completa la prueba", eso es notificación push / polling / FCM. No requiere RTDB.
- Si X es "mostrar un contador de usuarios online", eso es una métrica derivada, mejor con un counter en Firestore (`/stats/online` con `runTransaction`).
- Si X es colaboración multi-usuario en un doc, evaluamos Firebase Extensions o Realtime Queries de Firestore (que están en beta pero cubren esto sin RTDB).

## Consecuencias

**Positivas**:

- Un solo modelo mental para todos los datos.
- Reglas de seguridad pueden ser estrictas y aún así expresivas.
- Queries SQL-like (`where`, `orderBy`, `limit`).

**Negativas**:

- Latencia ~1-2x mayor que RTDB para writes muy frecuentes (no es un caso de uso nuestro).
- Costos por read/write pueden acumularse si no se modelan bien las queries (mitigable con índice y `limit`).

**Mitigaciones**:

- Code review verifica que toda query tenga `limit` cuando aplique.
- Índices compuestos declarados en `firestore.indexes.json` para todas las queries reales.

## Implementación

- SDK cliente: `firebase/firestore`.
- SDK admin (en Cloud Functions): `firebase-admin/firestore`.
- Reglas en `firestore.rules` (ver SDD-03).
- Índices en `firestore.indexes.json`.

## Excepción documentada: separación por multi-database (no por motor)

La regla "no usar RTDB" se mantiene firme. Pero cuando surge la necesidad de **separar dominios** dentro de Firestore (ej. `auditLogs` con volumen alto independiente del negocio, o un tenant que requiere DB dedicada por compliance), la solución correcta **no es RTDB** sino usar **múltiples databases dentro del mismo proyecto Firebase**.

Firebase soporta múltiples databases por proyecto nativamente desde 2023 (hasta 5 por proyecto). Cada una tiene su propio quota, su propio set de reglas, su propio billing label. Pero el SDK, las queries, los índices y el modelo de seguridad son idénticos.

**No se introduce RTDB ni ningún otro motor** — seguimos 100% en Firestore, solo cambiamos la granularidad de la unidad de aislamiento.

Ver [ADR-0005](./0005-audit-log-storage.md) para el caso concreto de `auditLogs`.

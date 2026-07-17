# Dependency Map

> Grafo de dependencias entre SDDs. Define qué se puede paralelizar y qué tiene que esperar.

---

## 1. Vista general

```
                  ┌─────────────┐
                  │  SDD-01     │  ← base, prerequisito de todo
                  │  Monorepo   │
                  └──────┬──────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
      ┌──────────┐ ┌──────────┐ ┌──────────┐
      │  SDD-02  │ │  SDD-03  │ │  SDD-09  │
      │ Frontend │ │ Firebase │ │   Docs   │
      │  Base    │ │  Setup   │ │ (rolling)│
      └────┬─────┘ └────┬─────┘ └──────────┘
           │            │
           └─────┬──────┘
                 ▼
           ┌──────────┐
           │  SDD-04  │  ← crítico, requiere emuladores + base
           │Repository│
           └────┬─────┘
                │
       ┌────────┼────────┐
       ▼        ▼        ▼
 ┌────────┐ ┌────────┐ ┌────────┐
 │ SDD-05 │ │ SDD-06 │ │ SDD-08 │
 │  Auth  │ │Functions│ │  CI/CD │
 └───┬────┘ └────┬───┘ └────────┘
     │           │
     └─────┬─────┘
           ▼
       ┌────────┐
       │ SDD-07 │
       │ Admin  │
       │  UI    │
       └────────┘
```

---

## 2. Tabla de dependencias explícitas

| SDD                   | Depende de             | Bloqueado por             | Bloquea a              |
| --------------------- | ---------------------- | ------------------------- | ---------------------- |
| **SDD-01** Monorepo   | —                      | —                         | Todos                  |
| **SDD-02** Frontend   | SDD-01                 | —                         | SDD-05, SDD-07         |
| **SDD-03** Firebase   | SDD-01                 | —                         | SDD-04, SDD-05, SDD-06 |
| **SDD-04** Repository | SDD-01, SDD-02, SDD-03 | Emuladores levantados     | SDD-05, SDD-06, SDD-07 |
| **SDD-05** Auth       | SDD-03, SDD-04         | Custom Claims funcionando | SDD-07                 |
| **SDD-06** Functions  | SDD-03, SDD-04         | Wrappers y schemas        | (consumido por SDD-07) |
| **SDD-07** UI Admin   | SDD-04, SDD-05, SDD-06 | Auth + Functions vivos    | —                      |
| **SDD-08** CI/CD      | SDD-01, SDD-02, SDD-06 | Builds estables           | —                      |
| **SDD-09** Docs       | SDD-01                 | —                         | — (continuo)           |

---

## 3. Mapa de capacidades → qué SDD las entrega

| Capacidad                                 | SDD            | Notas    |
| ----------------------------------------- | -------------- | -------- |
| `pnpm install` resuelve todo              | SDD-01         |          |
| `pnpm dev` levanta Next.js                | SDD-02         |          |
| `pnpm emulators` levanta los 4 emuladores | SDD-03         |          |
| Reglas Firestore denegando por defecto    | SDD-03         |          |
| `UserRepository` interface                | SDD-04         |          |
| `MemoryUserRepository` para tests         | SDD-04         |          |
| `FirebaseUserRepository` para prod        | SDD-04         |          |
| Custom Claims seteables                   | SDD-05         |          |
| `useAuth()` hook                          | SDD-05         |          |
| Middleware `/admin/**`                    | SDD-05         |          |
| `verifyAuth()` server-side                | SDD-05         |          |
| `v1_users_create` callable                | SDD-06         |          |
| `v1_reports_generate` callable            | SDD-06         |          |
| `createSession` onRequest                 | SDD-06         |          |
| `/login` funcional                        | SDD-05, SDD-07 |          |
| `/admin/users` con tabla                  | SDD-07         |          |
| `/admin/settings` con tabs                | SDD-07         |          |
| CI en cada PR                             | SDD-08         |          |
| Deploy staging automático                 | SDD-08         |          |
| Deploy prod manual                        | SDD-08         |          |
| README, ARCHITECTURE, CONTRIBUTING        | SDD-09         | continuo |

---

## 4. Orden de ejecución sugerido por sprint

### Sprint 1 (semanas 1-3): cimientos

- **Semana 1**: SDD-01 (setup), arrancar SDD-02 en paralelo.
- **Semana 2**: SDD-02 (frontend shell) + SDD-03 (emuladores).
- **Semana 3**: SDD-04 (repository layer) — pieza más crítica.

### Sprint 2 (semanas 4-6): auth + serverless

- **Semana 4**: SDD-05 (auth) arranca.
- **Semana 5**: SDD-05 + SDD-06 en paralelo (functions + auth).
- **Semana 6**: Cierre de SDD-05 y SDD-06, arranque de SDD-08.

### Sprint 3 (semanas 7-8): UI + deploy

- **Semana 7**: SDD-07 (UI admin).
- **Semana 8**: Cierre de SDD-07 + SDD-08 (CI/CD completo).

### Continuo desde Sprint 1

- **SDD-09**: docs se mantienen en cada PR.

---

## 5. ¿Qué se puede paralelizar entre 2 devs?

| Pair  | SDD A                   | SDD B                   | Compatible                               |
| ----- | ----------------------- | ----------------------- | ---------------------------------------- |
| Dev 1 | SDD-02 (frontend shell) | SDD-03 (Firebase setup) | ✅ sí                                    |
| Dev 1 | SDD-05 (auth)           | SDD-06 (functions)      | ⚠️ parcialmente — auth consume functions |
| Dev 1 | SDD-07 (UI admin)       | SDD-08 (CI/CD)          | ✅ sí                                    |
| Dev 1 | SDD-09 (docs)           | cualquier otro          | ✅ sí                                    |

---

## 6. ¿Qué NO se puede paralelizar?

- **SDD-04 antes de SDD-03**: los repositories necesitan emuladores para integration tests.
- **SDD-05 antes de SDD-04**: `useAuth` consume `UserRepository`.
- **SDD-07 antes de SDD-05 + SDD-06**: la UI consume auth + functions.
- **SDD-08 (deploy workflows) antes de SDD-01 + un build exitoso**: necesita saber qué builda.

---

## 7. Riesgos de bloqueo entre SDDs

| Riesgo                                                                       | Mitigación                                                                                                  |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| SDD-04 tarda más de lo estimado y bloquea SDD-05 y SDD-06                    | Empezar solo con `MemoryUserRepository` y stub de la interfaz en SDD-02; Firebase impl puede venir después. |
| SDD-03 no logra emuladores estables en CI                                    | Hacer CI solo con `Memory*` tests; emuladores solo en pre-merge o nightly.                                  |
| SDD-05 requiere decisiones de SDD-06 que aún no están tomadas (auth cookies) | Alinear SDD-05 y SDD-06 desde el inicio (sprint planning compartido).                                       |
| SDD-07 requiere endpoints que aún no existen en SDD-06                       | Mockear `httpsCallable` en dev con un stub que retorna data fake.                                           |

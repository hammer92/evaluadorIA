# Execution Plan — Trunk-Based Hardening + GitHub Sync

**Fecha**: 2026-07-17T20:05:00Z
**Sprint**: trunk-based-hardening + github-sync
**Workflow**: AI-DLC (Inception → Construction → Operations)
**Modo**: Brownfield, infra-as-code + GitHub sync

---

## 1. Contexto

El proyecto tiene una sola rama (`main`) sin remote de GitHub. La estrategia
trunk-based está documentada en `CONTRIBUTING.md` pero **no enforced**:

- ❌ Sin CODEOWNERS → cualquiera puede mergear sin review
- ❌ Sin branch protection → commits directos a main posibles
- ❌ Sin plantillas de rama para features/fixes
- ❌ Sin remote → código no está respaldado ni compartido

## 2. Decisiones del usuario (2026-07-17T20:00Z)

| Pregunta                         | Respuesta                                    |
| -------------------------------- | -------------------------------------------- |
| Q1 — Cómo sincronizar con GitHub | **B**: Crear repo nuevo con `gh repo create` |
| Q2 — Aplicación trunk-based      | **A**: Endurecer lo existente                |
| Q3 — Detalles del repo           | personal/evaluadorIA + public                |
| Q4 — Auth method                 | Asumir `gh` ya autenticado                   |

## 3. Stages a ejecutar

- [x] INCEPTION — Workspace Detection
- [x] INCEPTION — Requirements Analysis (Q1=B, Q2=A)
- [x] INCEPTION — Workflow Planning (este documento)
- [ ] CONSTRUCTION — Code Generation
- [ ] CONSTRUCTION — Build and Test
- [ ] OPERATIONS — GitHub Sync (push)
- [ ] Audit + state update + commit

### Stages skipped (justificación)

- **User Stories**: infra change, no afecta flujos de usuario.
- **Application Design**: solo tooling/CI/docs.
- **Units Generation / Functional Design**: no hay unidades nuevas.
- **NFR Requirements / NFR Design**: el cambio refuerza NFR de CI (review + checks).

## 4. Plan de cambios

### 4.1 Code Generation (cambios locales)

| Archivo                            | Acción     | Justificación                                               |
| ---------------------------------- | ---------- | ----------------------------------------------------------- |
| `CODEOWNERS`                       | **NUEVO**  | Aprobaci'on autom'atica por @owner en PRs a archivos clave  |
| `.github/PULL_REQUEST_TEMPLATE.md` | **UPDATE** | Agregar secci'on trunk-based (branch name, base=main)       |
| `.github/ISSUE_TEMPLATE/`          | **NUEVO**  | 3 templates: bug, feature, chore                            |
| `CONTRIBUTING.md`                  | **UPDATE** | Secci'on trunk-based + 4 ejemplos de PR titles + CODEOWNERS |
| `docs/CI-CD.md`                    | **UPDATE** | Branch protection setup + required checks                   |
| `.gitignore`                       | verificar  | No subir .env.local, .secret.local, emulator-data/          |
| `.gitattributes`                   | **NUEVO**  | EOL handling (LF for code, no CRLF) + linguist overrides    |

### 4.2 GitHub Sync (Operations phase)

1. `gh repo create evaluadorIA --public --source=. --remote=origin --description="..."`
2. `git push -u origin main`
3. `gh api repos/:owner/:repo/branches/main/protection` con:
   - `required_status_checks.strict: true` (PR no mergea si CI falla)
   - `required_status_checks.contexts: ["lint-typecheck-test-build", "integration-emulator", "coverage"]`
   - `enforce_admins: true`
   - `required_pull_request_reviews.required_approving_review_count: 1`
   - `required_pull_request_reviews.dismiss_stale_reviews: true`
   - `restrictions: null` (cualquier user puede PR; review es el gate)
4. `gh api repos/:owner/:repo -X PATCH` con:
   - `allow_squash_merge: true`
   - `allow_merge_commit: false` (forzar squash)
   - `allow_rebase_merge: true`
   - `delete_branch_on_merge: true`
5. Configurar environments: `staging` (auto via push main) + `production` (manual + 1 reviewer)
6. Verificar que CI corra en GitHub Actions UI

### 4.3 Validación post-sync

- `git remote -v` muestra origin configurado
- `git ls-remote --heads origin` muestra main + tags
- `gh repo view` muestra repo público
- `gh run list --limit 1` muestra CI corriendo en main push
- Branch protection API responde 200 OK

## 5. CODEOWNERS propuesto

```
# Default owners for everything
*                                          @<owner-username>

# Architectural decisions (require owner review)
/ARCHITECTURE.md                           @<owner-username>
/docs/sdd-package/                         @<owner-username>

# CI/CD changes (require owner review)
/.github/workflows/                        @<owner-username>
/firebase.json                             @<owner-username>
/firestore.rules                           @<owner-username>
/storage.rules                             @<owner-username>
/.size-limit.json                          @<owner-username>

# AI-DLC artifacts
/aidlc-docs/                               @<owner-username>
```

> Sustituir `<owner-username>` por el username real durante la ejecución.

## 6. Riesgos

| Riesgo                                         | Mitigación                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| `gh repo create` falla por auth                | Verificar `gh auth status` antes; si falla, pedir `gh auth login`             |
| Push falla por husky hooks                     | `--no-verify` solo si el hook ya fue validado en este commit                  |
| Branch protection API rechaza si no es admin   | Si el user no es admin del org, el flujo funciona igual para repos personales |
| CODEOWNERS apunta a username inexistente       | Sustituir por username real antes de hacer push                               |
| Force-push o amend de main requerido por error | AGENTS.md lo prohíbe; usar solo en commits locales antes del push             |

## 7. Criterios de cierre

- [x] Plan escrito en `aidlc-docs/inception/plans/execution-plan-trunk-based.md`
- [ ] CODEOWNERS, .gitattributes, ISSUE_TEMPLATE creados
- [ ] CONTRIBUTING.md y PULL_REQUEST_TEMPLATE.md actualizados
- [ ] `gh repo create` exitoso
- [ ] `git push -u origin main` exitoso
- [ ] Branch protection activado (verificable via `gh api`)
- [ ] Environments `staging` y `production` configurados
- [ ] CI corre en GitHub Actions UI
- [ ] Commit local con conventional message cierra el sprint
- [ ] aidlc-docs/audit.md + aidlc-state.md actualizados

## 8. Out of scope

- Multi-region deploys
- Canary releases
- Self-hosted runners
- Renovate/Dependabot config changes (ya existe dependabot.yml)

## 9. Métricas esperadas

- Archivos modificados/creados: ~10 (5 nuevos + 2 actualizados + 3 verificados)
- Líneas modificadas: ~150
- Commits al cierre: 1 (con conventional format)
- Tiempo total: ~10 min

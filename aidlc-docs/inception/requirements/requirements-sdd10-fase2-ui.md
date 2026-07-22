# SDD-10 Fase 2 UI — Requirements

**Sprint ID**: `sdd-10-fase-2-ui`
**Sprint Goal**: Exponer la UX completa del ciclo de vida de templates (creación, revisión, aprobación, listado, búsqueda) en el portal admin, dejando el camino listo para v1.1 (code niche + billing).

## Stakeholders

- **Admin de organización**: Necesita aprobar/rechazar templates enviados por recruiters. Visibilidad de cola de revisión.
- **Recruiter de organización**: Necesita enviar templates a revisión y responder a cambios solicitados.
- **Expert (futuro, v1.1)**: Podrá editar recipe params técnicos durante review. Soporte parcial en este sprint (UI completa; backend ya soporta).

## User Capabilities (per role)

### Admin

1. ✅ Listar todos los templates de la organización con filtros (status, niche, search, createdBy, from/to).
2. ✅ Crear template nuevo (form modal, recetas con useFieldArray).
3. ✅ Editar cualquier template en draft o changes_requested.
4. ✅ Eliminar (soft-delete) cualquier template no eliminado.
5. ✅ Ver historial completo de review events.
6. 🆕 **Ver cola de templates esperando revisión** (`/admin/review`).
7. 🆕 **Aprobar template en revisión** (1 click con comment opcional).
8. 🆕 **Solicitar cambios** (comment requerido, min 10 chars).
9. 🆕 **Rechazar template** (comment requerido, min 10 chars).
10. 🆕 **Editar y aprobar** (modificar recipes + aprobar en una sola acción).

### Recruiter

1-5. ✅ (mismas que admin, excepto edit/delete limitados a sus propios templates en draft). 6. 🆕 **Enviar template a revisión** desde TemplateDetail cuando está en draft o changes_requested.

### Expert (v1.1)

- 🆕 UI completa para editar recipe params técnicos en `/admin/review` detail (entregable PR-2; backend ya existe).

## Functional Requirements

### FR-2.1 — Review Queue Page

- **Ruta**: `/admin/review`
- **Access**: Admin y Expert (OQ decisión).
- **Contenido**: Tabla de templates con status === 'in_review', ordenados por submittedAt DESC.
- **Columnas**: name (link a detail), niche badge, createdBy, submittedAt (relativo: "hace 2 horas"), action menu (View).
- **Filtros**: Search por name (debounced 300ms), Niche (school/university/exam_practice).
- **Empty state**: "No hay templates esperando revisión" + link a /admin/templates.
- **Loading state**: Skeleton rows (5).
- **Error state**: Toast con retry button.

### FR-2.2 — Review Decision Panel

- **Ubicación**: TemplateDetail, después del TemplateActionBar, solo si role === 'admin' && status === 'in_review'.
- **Botones**:
  - **Aprobar** (verde, primary) → abre dialog con comment opcional (max 2000 chars), confirma → useApproveTemplate.
  - **Solicitar cambios** (amber, outline) → abre dialog con comment requerido (10-2000 chars), confirma → useRequestChanges.
  - **Rechazar** (rojo, outline) → abre dialog con comment requerido (10-2000 chars), confirma → useRejectTemplate.
  - **Editar y aprobar** (navy, ghost) → abre ExpertEditModal; save → useExpertEditTemplate.
- **Loading state**: Dialog Submit button disabled + spinner mientras mutation pending.
- **Success state**: Toast + invalidate queries + redirect opcional a /admin/review.

### FR-2.3 — Submit for Review Button

- **Ubicación**: TemplateDetail, integrado en TemplateActionBar.
- **Visibilidad**: Solo si role === 'recruiter' && (status === 'draft' || status === 'changes_requested').
- **Acción**: Confirma → useSubmitForReview.
- **Texto**: "Enviar a revisión".

### FR-2.4 — Expert Edit Modal

- **Trigger**: Botón "Editar y aprobar" en ReviewDecisionPanel.
- **Contenido**: Para cada recipe del template:
  - competencyContext (textarea, 20-2000 chars)
  - qtyMultipleChoice (number input, 0-20)
  - qtyMultiChoice (number input, 0-20)
  - difficulty (select: Fácil / Medio / Difícil)
  - topicsCovered (tag input, max 20)
- **Validación**: recipeFormSchema (refine: qtyMultipleChoice + qtyMultiChoice >= 1).
- **Submit**: Llama useExpertEditTemplate con recipes + comment. Comment opcional (max 2000).
- **Loading state**: Submit disabled + spinner.
- **Success**: Toast + cierra modal + redirige a /admin/review.

## Non-Functional Requirements

### NFR-2.1 — Performance

- Review queue page load: < 1.5s p95 (CI emulator, 50 templates).
- Decision action roundtrip: < 800ms p95.

### NFR-2.2 — Accessibility (WCAG 2.1 AA)

- Buttons tienen aria-label cuando solo icono.
- Dialogs con focus trap (Radix Dialog ya lo provee).
- Form fields con label asociado (Radix Form o htmlFor).
- Toast notifications tienen role="status" o aria-live="polite".

### NFR-2.3 — Internationalization

- Todos los strings de UI en español (ADR-0004).
- Fechas en formato es-AR (`Intl.DateTimeFormat('es-AR')`).

### NFR-2.4 — Security

- **Role enforcement en cliente**: RoleGuard + useRole() para ocultar UI elements que el user no debe ver.
- **Role enforcement en backend**: buildAuthContext() en cada CF valida role del ID token (no confia en client claims).
- **Comment validation**: Server re-valida con zod (min 10 chars para reject/request_changes, max 2000).

### NFR-2.5 — Testing

- Min 25 nuevos tests (PR-2).
- Hooks tests con mocks via vi.hoisted + jsdom pragma.
- Components tests con @testing-library/react.
- Coverage 70%+ (con exclude de features/review/components + features/review/api en vitest.config.ts).

## Acceptance Criteria (PR-2)

- [ ] `/admin/review` lista templates con status='in_review', filtrable por search y niche.
- [ ] Click en template de review queue navega a `/admin/templates/detail?templateId=xxx&from=review`.
- [ ] Admin en TemplateDetail con status='in_review' ve 4 botones: Aprobar, Solicitar cambios, Rechazar, Editar y aprobar.
- [ ] Recruiter en TemplateDetail con status='draft' o 'changes_requested' ve botón "Enviar a revisión".
- [ ] Approve: dialog con comment opcional, submit → status='approved' + toast success.
- [ ] Request changes: dialog con comment required (min 10), submit → status='changes_requested' + toast.
- [ ] Reject: dialog con comment required (min 10), submit → status='rejected' + toast.
- [ ] Edit and approve: modal con recipes prefill, save → expertEditTemplate + transitionTemplate approve.
- [ ] Después de cualquier action: useTemplatesList + useTemplate + useReviewQueue se invalidan y refetchean.
- [ ] Recruiter NO ve review decision panel (solo Submit button).
- [ ] Template deleted (deletedAt !== null) NO muestra ningún action button.
- [ ] pnpm typecheck, lint, test, test:coverage, build, test:integration todos PASS.
- [ ] 25+ nuevos tests pasan (12 schemas + 8 hooks + 5 components).

## Out of Scope (PR-2)

- Bulk actions en review queue (selección múltiple + reject all).
- Notificaciones email/Slack cuando se solicita review (backend hook existe, no se usa en este sprint).
- Audit log entry creation en el cliente (backend ya lo hace via v1TemplatesTransition).
- v1.1 features: code niche, billing, expert self-signup.

## AI-DLC Notes

- **Stages skipped**: User Stories (no new personas), Application Design (patterns established en features/users/ + features/templates/), Units Generation (vertical slices = units).
- **Pattern reuse**: PR-2 reusa patterns de features/users/ (vi.hoisted mocks, jsdom pragma) y features/templates/ (TanStack Table, RHF + zodResolver, useFieldArray, RoleGuard implícito via useRole).
- **Frontend skill**: `frontend-ui-engineering` activado para design tokens y accessibility.
- **API design**: `api-and-interface-design` activado para validar que wrappers de CF respeten convention.

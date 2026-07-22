# SDD-10 Fase 2 UI — UI Design Spec

**Sprint ID**: `sdd-10-fase-2-ui`
**Purpose**: Visual language tokens + screen specs para PR-2 (review workflow) y PR-3 (cross-cutting).

## Design Tokens (Tailwind CSS — reutilizados de design system previo)

### Colors

| Token            | Hex       | Uso                                             |
| ---------------- | --------- | ----------------------------------------------- |
| `navy`           | `#232F3E` | Headings, primary buttons                       |
| `orange`         | `#FE9800` | Secondary CTAs, badges                          |
| `status-success` | `#067F68` | Approved state, Approve button                  |
| `status-warning` | `#EB5F07` | Changes requested state, Request Changes button |
| `status-error`   | `#D91515` | Rejected state, Reject button, error toasts     |
| `status-info`    | `#0073BB` | In review state, info toasts                    |

### Typography

- **Headings**: Hanken Grotesk (`font-hanken` utility) — `text-display-lg` (32px/40px), `text-headline-sm` (18px/24px).
- **Body**: Inter — `text-body-md` (14px/20px), `text-body-sm` (13px/18px).
- **Labels**: Inter `font-medium text-label-sm` (12px/16px).
- **Technical**: JetBrains Mono (recipe IDs, review IDs).

### Spacing

- `gap-stack-sm` (8px), `gap-stack-md` (12px), `gap-stack-lg` (24px).
- Card padding: `p-stack-md` (12px).
- Section spacing: `space-y-stack-lg` (24px).

### Shapes

- `rounded-tv` (8px) — cards, dialogs.
- `rounded-md` (6px) — buttons, inputs.

## Screen Specs

### Screen 1: `/admin/review` — Review Queue List ✅ STITCHED

**Stitch screen ID**: `projects/15149830769149114285/screens/c4dac27470d843d485212aca30a18b87` "Admin: Gestión de Plantillas de Evaluación" (shared with `/admin/templates`)

**Layout** (mobile-first responsive):

- Header: `h1` "Cola de revisión" + breadcrumb (Admin > Revisión).
- Filter bar: search input (full-width mobile, 320px desktop) + Niche select + Clear button.
- Tabla (desktop) / Cards (mobile):
  - **Columns**: Template (name + niche badge), Enviado por, Hace, Acciones.
  - **Row hover**: bg-surface-container-low.
  - **Click**: navega a `/admin/templates/detail?templateId=xxx&from=review`.
- Empty state: ilustración + "No hay templates esperando revisión" + CTA "Crear template".
- Loading state: 5 skeleton rows.

### Screen 2: TemplateDetail + ReviewDecisionPanel (PR-2)

**Layout** (existing TemplateDetail + new section):

- Existing header (name + status badge + actions).
- Existing tabs (Overview / Content / History).
- **NEW** ReviewDecisionPanel (above tabs, only visible if status='in_review' && role='admin'):
  - Card con border-left-4 status-info.
  - 4 botones en grid (mobile: 2x2, desktop: 1x4):
    - `Aprobar` — navy filled.
    - `Solicitar cambios` — amber outline.
    - `Rechazar` — red outline.
    - `Editar y aprobar` — navy ghost.
  - Cada botón abre un Dialog (Radix):
    - Title: action verb (e.g., "Aprobar template").
    - Description: contextual warning (e.g., "El template será visible para todos los recruiters de la organización").
    - Textarea: comment (label cambia por acción: "Comentario opcional" vs "Comentario (requerido)").
    - Cancel + Confirm buttons.
    - Confirm disabled si comment inválido.

### Screen 3: ExpertEditModal (PR-2)

**Layout**:

- Dialog max-width 720px, max-height 80vh, scrollable.
- Header: "Editar y aprobar — {templateName}".
- Body: por cada recipe:
  - Card con border surface-variant.
  - competencyContext: textarea (4 rows).
  - 3-column grid: qtyMultipleChoice, qtyMultiChoice, difficulty select.
  - topicsCovered: tag input (chip removable, max 20).
- Footer: Cancel + "Guardar y aprobar" (loading state).

### Screen 4: AdminSidebar (PR-3)

**Layout** (left rail, 240px wide, collapsible):

- Logo + org name (top).
- Nav items (vertical stack):
  - Dashboard (`/admin`)
  - Templates (`/admin/templates`) — badge con total count.
  - **Review** (`/admin/review`) 🆕 — badge con count in_review templates.
  - Users (`/admin/users`) — admin only.
  - Settings (`/admin/settings`).
- User avatar + signout (bottom).

### Screen 5: /admin/settings (PR-3)

**Layout**:

- Header: "Configuración".
- Tabs: Mi perfil | Mi organización.
- **Mi perfil**:
  - Card: Avatar + displayName (editable) + email (read-only) + role (read-only).
  - Save button (disabled si no hay cambios).
- **Mi organización**:
  - Card: org name + plan (free/pro) + member count + createdAt.
  - Upgrade button (admin only, stub).

### Screen 6: UserSwitcher dev-only (PR-3)

**Layout**:

- Floating panel, bottom-right, 16px margin.
- Header: badge "DEV ONLY" + "Switch user".
- Dropdown: lista de todos los users del org (max 10 visible + "Show all").
- Selected user highlighted con navy bg.

## Accessibility

- Todos los interactive elements tienen `aria-label` o visible text.
- Dialogs usan Radix (focus trap + ESC close + aria-describedby para description).
- Color contrast: navy on white = 12.5:1 (AAA), status colors on white = 4.5:1+ (AA).
- Keyboard navigation: Tab order logical, Enter submits forms, ESC closes dialogs.
- Screen reader: status badges con aria-label completo (e.g., "Estado: En revisión").

## Responsive Breakpoints

- Mobile (< 640px): Tabla → Cards stack, sidebar → bottom nav.
- Tablet (640-1024px): Sidebar collapsible.
- Desktop (> 1024px): Full layout.

## Storybook

- (No aplica — sprint sin Storybook; tokens via Tailwind utility classes).

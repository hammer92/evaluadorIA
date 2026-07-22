import { type Role, type TemplateStatus, type ReviewAction } from '@shared/schemas/templates';

// =============================================================================
// Template state machine — SDD-10 §5
// =============================================================================
// Lógica pura, sin dependencias de Next/Firebase. Consumida por:
// - apps/functions/src/v1/templates/transition-template.ts (server-side)
// - apps/web/features/templates/components/* (UI gating)
// - apps/web/features/templates/hooks/use-* (UX optimistics)
// =============================================================================

export interface Transition {
  from: TemplateStatus;
  to: TemplateStatus;
  allowedRoles: Role[];
  requiresComment: boolean;
  auditAction: string;
  reviewAction: ReviewAction;
  label: string;
  variant: 'default' | 'destructive' | 'success' | 'warning';
}

export const TEMPLATE_TRANSITIONS: readonly Transition[] = [
  {
    from: 'draft',
    to: 'in_review',
    allowedRoles: ['admin'],
    requiresComment: false,
    auditAction: 'template.submitted',
    reviewAction: 'submitted',
    label: 'Enviar a revisión',
    variant: 'default',
  },
  {
    from: 'in_review',
    to: 'approved',
    allowedRoles: ['admin', 'expert'],
    requiresComment: false,
    auditAction: 'template.approved',
    reviewAction: 'approved',
    label: 'Aprobar',
    variant: 'success',
  },
  {
    from: 'in_review',
    to: 'changes_requested',
    allowedRoles: ['admin', 'expert'],
    requiresComment: true,
    auditAction: 'template.changes_requested',
    reviewAction: 'changes_requested',
    label: 'Solicitar cambios',
    variant: 'warning',
  },
  {
    from: 'in_review',
    to: 'rejected',
    allowedRoles: ['admin', 'expert'],
    requiresComment: true,
    auditAction: 'template.rejected',
    reviewAction: 'rejected',
    label: 'Rechazar',
    variant: 'destructive',
  },
  {
    from: 'changes_requested',
    to: 'in_review',
    allowedRoles: ['admin'],
    requiresComment: false,
    auditAction: 'template.resubmitted',
    reviewAction: 'resubmitted',
    label: 'Reenviar a revisión',
    variant: 'default',
  },
  {
    from: 'changes_requested',
    to: 'rejected',
    allowedRoles: ['admin'],
    requiresComment: false,
    auditAction: 'template.rejected',
    reviewAction: 'rejected',
    label: 'Cancelar template',
    variant: 'destructive',
  },
  {
    from: 'rejected',
    to: 'draft',
    allowedRoles: ['admin'],
    requiresComment: false,
    auditAction: 'template.reopened',
    reviewAction: 'reopened',
    label: 'Reabrir como borrador',
    variant: 'default',
  },
] as const;

export function getTransition(from: TemplateStatus, to: TemplateStatus): Transition | undefined {
  return TEMPLATE_TRANSITIONS.find((t) => t.from === from && t.to === to);
}

export function getAvailableTransitions(from: TemplateStatus, role: Role): Transition[] {
  return TEMPLATE_TRANSITIONS.filter((t) => t.from === from && t.allowedRoles.includes(role));
}

export function canTransition(from: TemplateStatus, to: TemplateStatus, role: Role): boolean {
  const t = getTransition(from, to);
  if (!t) return false;
  return t.allowedRoles.includes(role);
}

// =============================================================================
// canEdit — gating UI para edición según rol + estado (SDD §2.2)
// =============================================================================
// admin puede editar todo si está en draft o changes_requested.
// expert solo puede editar parámetros técnicos durante in_review.
// =============================================================================

interface EditableTemplate {
  status: TemplateStatus;
  deletedAt?: Date | null;
}

export interface CanEditAllowed {
  canEdit: true;
  editableFields: readonly EditableField[];
}

export interface CanEditDenied {
  canEdit: false;
  reason: string;
}

export type CanEditResult = CanEditAllowed | CanEditDenied;

export type EditableField =
  | 'name'
  | 'description'
  | 'niche'
  | 'timeLimitMinutes'
  | 'maxRetries'
  | 'recipes';

export function canEdit(template: EditableTemplate, role: Role): CanEditResult {
  if (template.deletedAt !== null && template.deletedAt !== undefined) {
    return {
      canEdit: false,
      reason: 'Template archivado — no se puede editar',
    };
  }

  if (
    role === 'admin' &&
    (template.status === 'draft' || template.status === 'changes_requested')
  ) {
    return {
      canEdit: true,
      editableFields: ['name', 'description', 'niche', 'timeLimitMinutes', 'maxRetries', 'recipes'],
    };
  }

  if (role === 'expert' && template.status === 'in_review') {
    return {
      canEdit: true,
      editableFields: ['recipes'],
    };
  }

  return {
    canEdit: false,
    reason: `Tu rol (${role}) no puede editar en estado "${template.status}".`,
  };
}

// =============================================================================
// canViewTemplate — gating de visibilidad por rol + estado + deletedAt (SDD §2.2)
// =============================================================================
// - admin y expert ven todos los templates de su org (incluyendo archived).
// - recruiter solo ve templates con status === 'approved' y deletedAt null.
// - deletedAt != null → solo admin puede ver.
// =============================================================================

interface ViewableTemplate {
  status: TemplateStatus;
  deletedAt: Date | null;
}

export function canViewTemplate(template: ViewableTemplate, role: Role): boolean {
  if (template.deletedAt !== null) {
    return role === 'admin';
  }
  if (role === 'recruiter') {
    return template.status === 'approved';
  }
  return true; // admin y expert ven todos los no-archived
}

// =============================================================================
// validateTransition — server-side validation antes de aplicar (SDD §5.4)
// =============================================================================
// Devuelve { ok: true } o { ok: false, reason } con mensaje en español.
// =============================================================================

export interface ValidationOk {
  ok: true;
}

export interface ValidationFailed {
  ok: false;
  reason: string;
}

export type ValidationResult = ValidationOk | ValidationFailed;

export function validateTransition(
  currentStatus: TemplateStatus,
  to: TemplateStatus,
  role: Role,
  comment: string | undefined,
): ValidationResult {
  const transition = getTransition(currentStatus, to);
  if (!transition) {
    return {
      ok: false,
      reason: `Transición inválida: ${currentStatus} → ${to}`,
    };
  }

  if (!transition.allowedRoles.includes(role)) {
    return {
      ok: false,
      reason: `Tu rol (${role}) no puede: ${transition.label}`,
    };
  }

  if (transition.requiresComment && !comment?.trim()) {
    return {
      ok: false,
      reason: `Esta acción requiere un comentario (${transition.label})`,
    };
  }

  return { ok: true };
}

// =============================================================================
// OQ-6 soft check — expert no puede aprobar templates que él mismo creó
// =============================================================================
// Aunque hoy solo admin puede crear (no aplica), el check está desde v1
// como defensa contra regresiones si el role rules cambia en v2.
// =============================================================================

export function isExpertApprovingOwnTemplate(
  to: TemplateStatus,
  role: Role,
  actorId: string,
  createdBy: string,
): boolean {
  return to === 'approved' && role === 'expert' && actorId === createdBy;
}

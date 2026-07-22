import type { Role, TemplateStatus } from '@shared/schemas/templates';
import { describe, expect, it } from 'vitest';

import {
  TEMPLATE_TRANSITIONS,
  canEdit,
  canTransition,
  canViewTemplate,
  getAvailableTransitions,
  getTransition,
  isExpertApprovingOwnTemplate,
  validateTransition,
} from '../state-machine';

// =============================================================================
// State machine tests — SDD-10 §14.1
// =============================================================================
// Cubre las 7 transiciones, canEdit, canViewTemplate, OQ-6 soft check.
// =============================================================================

const ALL_ROLES: Role[] = ['admin', 'expert', 'recruiter'];
const ALL_STATUSES: TemplateStatus[] = [
  'draft',
  'in_review',
  'changes_requested',
  'approved',
  'rejected',
];

describe('state machine', () => {
  describe('TEMPLATE_TRANSITIONS table', () => {
    it('define exactamente las 7 transiciones del SDD §5.2', () => {
      expect(TEMPLATE_TRANSITIONS).toHaveLength(7);
    });

    it('cubren las 6 transiciones válidas + reopen (#7)', () => {
      const pairs = TEMPLATE_TRANSITIONS.map((t) => `${t.from}→${t.to}`);
      expect(pairs).toEqual([
        'draft→in_review',
        'in_review→approved',
        'in_review→changes_requested',
        'in_review→rejected',
        'changes_requested→in_review',
        'changes_requested→rejected',
        'rejected→draft',
      ]);
    });

    it('los audit actions siguen la convención template.<action>', () => {
      for (const t of TEMPLATE_TRANSITIONS) {
        expect(t.auditAction).toMatch(/^template\./);
      }
    });

    it('los review actions son valores válidos del enum', () => {
      const validActions = new Set([
        'submitted',
        'approved',
        'rejected',
        'changes_requested',
        'edited',
        'resubmitted',
        'reopened',
      ]);
      for (const t of TEMPLATE_TRANSITIONS) {
        expect(validActions.has(t.reviewAction)).toBe(true);
      }
    });

    it('cambios_solicitados y rechazar requieren comment', () => {
      const requiresComment = TEMPLATE_TRANSITIONS.filter((t) => t.requiresComment).map(
        (t) => `${t.from}→${t.to}`,
      );
      expect(requiresComment).toEqual(['in_review→changes_requested', 'in_review→rejected']);
    });
  });

  describe('getTransition', () => {
    it('encuentra transición válida', () => {
      const t = getTransition('draft', 'in_review');
      expect(t).toBeDefined();
      expect(t?.label).toBe('Enviar a revisión');
    });

    it('devuelve undefined para transición inexistente', () => {
      expect(getTransition('draft', 'approved')).toBeUndefined();
      expect(getTransition('approved', 'in_review')).toBeUndefined();
      expect(getTransition('rejected', 'approved')).toBeUndefined();
    });
  });

  describe('getAvailableTransitions', () => {
    it('admin en draft: solo puede enviar a revisión', () => {
      const t = getAvailableTransitions('draft', 'admin');
      expect(t.map((x) => x.to)).toEqual(['in_review']);
    });

    it('admin en in_review: puede aprobar, solicitar cambios o rechazar', () => {
      const t = getAvailableTransitions('in_review', 'admin');
      expect(t.map((x) => x.to).sort()).toEqual(['approved', 'changes_requested', 'rejected']);
    });

    it('expert en in_review: puede aprobar, solicitar cambios o rechazar', () => {
      const t = getAvailableTransitions('in_review', 'expert');
      expect(t.map((x) => x.to).sort()).toEqual(['approved', 'changes_requested', 'rejected']);
    });

    it('expert en draft: no puede hacer ninguna transición', () => {
      expect(getAvailableTransitions('draft', 'expert')).toEqual([]);
    });

    it('recruiter en cualquier estado: no puede hacer transiciones', () => {
      for (const s of ALL_STATUSES) {
        expect(getAvailableTransitions(s, 'recruiter')).toEqual([]);
      }
    });

    it('admin en approved: no hay transiciones salientes (estado terminal)', () => {
      expect(getAvailableTransitions('approved', 'admin')).toEqual([]);
    });

    it('admin en rejected: solo puede reabrir a draft', () => {
      const t = getAvailableTransitions('rejected', 'admin');
      expect(t.map((x) => x.to)).toEqual(['draft']);
    });
  });

  describe('canTransition', () => {
    it('permite draft → in_review por admin', () => {
      expect(canTransition('draft', 'in_review', 'admin')).toBe(true);
    });

    it('bloquea draft → in_review por expert', () => {
      expect(canTransition('draft', 'in_review', 'expert')).toBe(false);
    });

    it('bloquea draft → in_review por recruiter', () => {
      expect(canTransition('draft', 'in_review', 'recruiter')).toBe(false);
    });

    it('permite in_review → approved por admin o expert', () => {
      expect(canTransition('in_review', 'approved', 'admin')).toBe(true);
      expect(canTransition('in_review', 'approved', 'expert')).toBe(true);
    });

    it('bloquea in_review → approved por recruiter', () => {
      expect(canTransition('in_review', 'approved', 'recruiter')).toBe(false);
    });

    it('bloquea in_review → changes_requested por recruiter', () => {
      expect(canTransition('in_review', 'changes_requested', 'recruiter')).toBe(false);
    });

    it('bloquea transiciones inválidas', () => {
      expect(canTransition('draft', 'approved', 'admin')).toBe(false);
      expect(canTransition('rejected', 'approved', 'admin')).toBe(false);
      expect(canTransition('approved', 'in_review', 'admin')).toBe(false);
    });

    it('admin puede reabrir rejected → draft', () => {
      expect(canTransition('rejected', 'draft', 'admin')).toBe(true);
    });

    it('expert NO puede reabrir rejected → draft', () => {
      expect(canTransition('rejected', 'draft', 'expert')).toBe(false);
    });

    it('admin puede reenviar changes_requested → in_review', () => {
      expect(canTransition('changes_requested', 'in_review', 'admin')).toBe(true);
    });

    it('expert NO puede reenviar changes_requested → in_review', () => {
      expect(canTransition('changes_requested', 'in_review', 'expert')).toBe(false);
    });
  });

  describe('canEdit', () => {
    const baseTemplate = {
      status: 'draft' as TemplateStatus,
      deletedAt: null as Date | null,
    };

    it('admin puede editar en draft', () => {
      const r = canEdit(baseTemplate, 'admin');
      expect(r.canEdit).toBe(true);
      if (r.canEdit) {
        expect(r.editableFields).toContain('name');
        expect(r.editableFields).toContain('recipes');
      }
    });

    it('admin puede editar en changes_requested', () => {
      const r = canEdit({ ...baseTemplate, status: 'changes_requested' }, 'admin');
      expect(r.canEdit).toBe(true);
    });

    it('admin NO puede editar en in_review', () => {
      const r = canEdit({ ...baseTemplate, status: 'in_review' }, 'admin');
      expect(r.canEdit).toBe(false);
    });

    it('admin NO puede editar en approved', () => {
      const r = canEdit({ ...baseTemplate, status: 'approved' }, 'admin');
      expect(r.canEdit).toBe(false);
    });

    it('admin NO puede editar en rejected', () => {
      const r = canEdit({ ...baseTemplate, status: 'rejected' }, 'admin');
      expect(r.canEdit).toBe(false);
    });

    it('expert puede editar recipes en in_review', () => {
      const r = canEdit({ ...baseTemplate, status: 'in_review' }, 'expert');
      expect(r.canEdit).toBe(true);
      if (r.canEdit) {
        expect(r.editableFields).toEqual(['recipes']);
        expect(r.editableFields).not.toContain('name');
      }
    });

    it('expert NO puede editar en draft', () => {
      const r = canEdit({ ...baseTemplate, status: 'draft' }, 'expert');
      expect(r.canEdit).toBe(false);
    });

    it('expert NO puede editar en approved', () => {
      const r = canEdit({ ...baseTemplate, status: 'approved' }, 'expert');
      expect(r.canEdit).toBe(false);
    });

    it('recruiter NO puede editar en ningún estado', () => {
      for (const s of ALL_STATUSES) {
        expect(canEdit({ ...baseTemplate, status: s }, 'recruiter').canEdit).toBe(false);
      }
    });

    it('template archivado: nadie puede editar', () => {
      const archived = { ...baseTemplate, deletedAt: new Date() };
      for (const role of ALL_ROLES) {
        expect(canEdit(archived, role).canEdit).toBe(false);
      }
    });
  });

  describe('canViewTemplate', () => {
    const baseTemplate = {
      status: 'draft' as TemplateStatus,
      deletedAt: null as Date | null,
    };

    it('recruiter ve approved pero no draft', () => {
      expect(canViewTemplate({ ...baseTemplate, status: 'approved' }, 'recruiter')).toBe(true);
      expect(canViewTemplate({ ...baseTemplate, status: 'draft' }, 'recruiter')).toBe(false);
    });

    it('recruiter ve changes_requested (no approved) → false', () => {
      expect(canViewTemplate({ ...baseTemplate, status: 'changes_requested' }, 'recruiter')).toBe(
        false,
      );
    });

    it('recruiter NO ve templates con deletedAt', () => {
      const t = { ...baseTemplate, status: 'approved' as TemplateStatus, deletedAt: new Date() };
      expect(canViewTemplate(t, 'recruiter')).toBe(false);
    });

    it('solo admin ve templates deletedAt', () => {
      const t = { ...baseTemplate, status: 'draft' as TemplateStatus, deletedAt: new Date() };
      expect(canViewTemplate(t, 'admin')).toBe(true);
      expect(canViewTemplate(t, 'expert')).toBe(false);
      expect(canViewTemplate(t, 'recruiter')).toBe(false);
    });

    it('admin y expert ven todos los estados no-archivados', () => {
      for (const s of ALL_STATUSES) {
        const t = { ...baseTemplate, status: s };
        expect(canViewTemplate(t, 'admin')).toBe(true);
        expect(canViewTemplate(t, 'expert')).toBe(true);
      }
    });
  });

  describe('validateTransition', () => {
    it('devuelve ok para transición válida', () => {
      const r = validateTransition('draft', 'in_review', 'admin', undefined);
      expect(r).toEqual({ ok: true });
    });

    it('rechaza transición inválida con mensaje claro', () => {
      const r = validateTransition('draft', 'approved', 'admin', undefined);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toContain('draft');
        expect(r.reason).toContain('approved');
      }
    });

    it('rechaza cuando el rol no puede hacerla', () => {
      const r = validateTransition('draft', 'in_review', 'expert', undefined);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toContain('expert');
      }
    });

    it('rechaza changes_requested sin comment', () => {
      const r = validateTransition('in_review', 'changes_requested', 'admin', undefined);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toContain('comentario');
      }
    });

    it('rechaza reject sin comment', () => {
      const r = validateTransition('in_review', 'rejected', 'admin', undefined);
      expect(r.ok).toBe(false);
    });

    it('rechaza comment solo whitespace', () => {
      const r = validateTransition('in_review', 'changes_requested', 'admin', '   ');
      expect(r.ok).toBe(false);
    });

    it('acepta changes_requested con comment válido', () => {
      const r = validateTransition(
        'in_review',
        'changes_requested',
        'admin',
        'falta detalle en competencyContext',
      );
      expect(r).toEqual({ ok: true });
    });
  });

  describe('OQ-6 soft check: isExpertApprovingOwnTemplate', () => {
    it('detecta expert aprobando template que él mismo creó', () => {
      expect(isExpertApprovingOwnTemplate('approved', 'expert', 'u1', 'u1')).toBe(true);
    });

    it('permite expert aprobando template de otro', () => {
      expect(isExpertApprovingOwnTemplate('approved', 'expert', 'u1', 'u2')).toBe(false);
    });

    it('ignora si el rol es admin (admin puede aprobar propio)', () => {
      expect(isExpertApprovingOwnTemplate('approved', 'admin', 'u1', 'u1')).toBe(false);
    });

    it('ignora si to no es approved', () => {
      expect(isExpertApprovingOwnTemplate('changes_requested', 'expert', 'u1', 'u1')).toBe(false);
      expect(isExpertApprovingOwnTemplate('rejected', 'expert', 'u1', 'u1')).toBe(false);
    });
  });
});

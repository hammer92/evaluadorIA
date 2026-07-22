import { describe, expect, it } from 'vitest';

import {
  defaultReviewQueueFilters,
  reviewDecisionFormSchema,
  reviewQueueFiltersSchema,
} from './schemas';

describe('reviewQueueFiltersSchema', () => {
  it('aplica defaults cuando el input es vacío', () => {
    const result = reviewQueueFiltersSchema.parse({});
    expect(result).toEqual({
      status: 'in_review',
      page: 1,
      pageSize: 20,
    });
  });

  it('acepta filtro explícito válido (niche + search)', () => {
    const result = reviewQueueFiltersSchema.parse({
      niche: 'university',
      search: 'algebra',
      page: 2,
      pageSize: 50,
    });
    expect(result).toEqual({
      status: 'in_review',
      niche: 'university',
      search: 'algebra',
      page: 2,
      pageSize: 50,
    });
  });

  it('acepta niche="all" como sentinel', () => {
    const result = reviewQueueFiltersSchema.parse({ niche: 'all', page: 1, pageSize: 20 });
    expect(result.niche).toBe('all');
  });

  it('rechaza niche fuera del enum', () => {
    const result = reviewQueueFiltersSchema.safeParse({
      niche: 'invalid_niche',
      page: 1,
      pageSize: 20,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza search de más de 100 chars', () => {
    const result = reviewQueueFiltersSchema.safeParse({
      search: 'x'.repeat(101),
      page: 1,
      pageSize: 20,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza pageSize fuera de rango (0 o > 100)', () => {
    expect(reviewQueueFiltersSchema.safeParse({ page: 1, pageSize: 0 }).success).toBe(false);
    expect(reviewQueueFiltersSchema.safeParse({ page: 1, pageSize: 101 }).success).toBe(false);
  });

  it('acepta pageSize exacto (1 y 100)', () => {
    expect(reviewQueueFiltersSchema.safeParse({ page: 1, pageSize: 1 }).success).toBe(true);
    expect(reviewQueueFiltersSchema.safeParse({ page: 1, pageSize: 100 }).success).toBe(true);
  });
});

describe('defaultReviewQueueFilters', () => {
  it('tiene los defaults esperadas', () => {
    expect(defaultReviewQueueFilters).toEqual({
      status: 'in_review',
      niche: 'all',
      search: '',
      page: 1,
      pageSize: 20,
    });
  });

  it('pasa la validación de reviewQueueFiltersSchema', () => {
    const result = reviewQueueFiltersSchema.safeParse(defaultReviewQueueFilters);
    expect(result.success).toBe(true);
  });
});

describe('reviewDecisionFormSchema', () => {
  it('valida approve sin comment (comment opcional)', () => {
    const result = reviewDecisionFormSchema.safeParse({
      templateId: 'tmpl-1',
      action: 'approve',
    });
    expect(result.success).toBe(true);
  });

  it('valida approve con comment opcional válido', () => {
    const result = reviewDecisionFormSchema.safeParse({
      templateId: 'tmpl-1',
      action: 'approve',
      comment: 'LGTM — receta bien calibrada',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza request_changes sin comment', () => {
    const result = reviewDecisionFormSchema.safeParse({
      templateId: 'tmpl-1',
      action: 'request_changes',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('comment'))).toBe(true);
    }
  });

  it('rechaza request_changes con comment de menos de 10 chars', () => {
    const result = reviewDecisionFormSchema.safeParse({
      templateId: 'tmpl-1',
      action: 'request_changes',
      comment: 'muy corto',
    });
    expect(result.success).toBe(false);
  });

  it('acepta request_changes con comment >= 10 chars', () => {
    const result = reviewDecisionFormSchema.safeParse({
      templateId: 'tmpl-1',
      action: 'request_changes',
      comment: 'Subir dificultad de la receta 1 a "hard".',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza reject sin comment', () => {
    const result = reviewDecisionFormSchema.safeParse({
      templateId: 'tmpl-1',
      action: 'reject',
    });
    expect(result.success).toBe(false);
  });

  it('acepta reject con comment >= 10 chars', () => {
    const result = reviewDecisionFormSchema.safeParse({
      templateId: 'tmpl-1',
      action: 'reject',
      comment: 'No cumple con el nicho exam_practice (SDD §4.1).',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza comment de más de 2000 chars', () => {
    const result = reviewDecisionFormSchema.safeParse({
      templateId: 'tmpl-1',
      action: 'approve',
      comment: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it('acepta comment de exactamente 2000 chars', () => {
    const result = reviewDecisionFormSchema.safeParse({
      templateId: 'tmpl-1',
      action: 'approve',
      comment: 'x'.repeat(2000),
    });
    expect(result.success).toBe(true);
  });

  it('rechaza templateId vacío', () => {
    const result = reviewDecisionFormSchema.safeParse({
      templateId: '',
      action: 'approve',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza action fuera del enum', () => {
    const result = reviewDecisionFormSchema.safeParse({
      templateId: 'tmpl-1',
      action: 'delete',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza comment solo-whitespace para reject/request_changes', () => {
    const result = reviewDecisionFormSchema.safeParse({
      templateId: 'tmpl-1',
      action: 'reject',
      comment: '          ',
    });
    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { defaultTemplateFilters, templateFiltersSchema, templateFormSchema } from './schemas';

describe('templateFiltersSchema', () => {
  it('accepts all defaults', () => {
    const result = templateFiltersSchema.parse(defaultTemplateFilters);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.status).toBe('all');
  });

  it('rejects invalid status', () => {
    expect(() =>
      templateFiltersSchema.parse({ ...defaultTemplateFilters, status: 'invalid' }),
    ).toThrow();
  });

  it('accepts status="all" as sentinel', () => {
    expect(templateFiltersSchema.parse({ ...defaultTemplateFilters, status: 'all' }).status).toBe(
      'all',
    );
  });

  it('rejects pageSize > 100', () => {
    expect(() =>
      templateFiltersSchema.parse({ ...defaultTemplateFilters, pageSize: 200 }),
    ).toThrow();
  });
});

describe('templateFormSchema', () => {
  const validRecipe = {
    competencyName: 'React Hooks',
    competencyContext: 'Deep understanding of React hooks API and patterns',
    qtyMultipleChoice: 5,
    qtyMultiChoice: 2,
    difficulty: 'medium' as const,
    topicsCovered: ['useState', 'useEffect'],
  };

  it('accepts a complete valid form', () => {
    const result = templateFormSchema.parse({
      name: 'Senior Frontend Engineer Evaluation',
      description: 'Comprehensive evaluation',
      niche: 'school',
      timeLimitMinutes: 60,
      maxRetries: 1,
      recipes: [validRecipe],
    });
    expect(result.recipes).toHaveLength(1);
  });

  it('rejects empty name', () => {
    expect(() =>
      templateFormSchema.parse({
        name: '',
        niche: 'school',
        timeLimitMinutes: 60,
        maxRetries: 1,
        recipes: [validRecipe],
      }),
    ).toThrow();
  });

  it('rejects empty recipes array', () => {
    expect(() =>
      templateFormSchema.parse({
        name: 'Test',
        niche: 'school',
        timeLimitMinutes: 60,
        maxRetries: 1,
        recipes: [],
      }),
    ).toThrow();
  });

  it('rejects recipe with 0 total questions', () => {
    expect(() =>
      templateFormSchema.parse({
        name: 'Test',
        niche: 'school',
        timeLimitMinutes: 60,
        maxRetries: 1,
        recipes: [{ ...validRecipe, qtyMultipleChoice: 0, qtyMultiChoice: 0 }],
      }),
    ).toThrow();
  });

  it('rejects timeLimitMinutes > 240', () => {
    expect(() =>
      templateFormSchema.parse({
        name: 'Test',
        niche: 'school',
        timeLimitMinutes: 300,
        maxRetries: 1,
        recipes: [validRecipe],
      }),
    ).toThrow();
  });
});

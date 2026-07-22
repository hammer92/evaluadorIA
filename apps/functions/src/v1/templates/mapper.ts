import type { Template } from '@platform/shared';

// =============================================================================
// Firestore mapper — templates (SDD-10 §4.3)
// =============================================================================
// snake_case ↔ camelCase. El mapping vive solo en el repository (este CF
// layer). Reutilizado por get-template, list-templates, update-template,
// transition-template y delete-template.
// =============================================================================

export interface TemplateDocRaw {
  organization_id: string;
  name: string;
  description: string | null;
  niche: 'school' | 'university' | 'exam_practice';
  time_limit_minutes: number;
  max_retries: number;
  recipes: {
    recipe_id?: string;
    competency_name: string;
    competency_context: string;
    qty_multiple_choice: number;
    qty_multi_choice: number;
    difficulty: 'easy' | 'medium' | 'hard';
    topics_covered: string[];
  }[];
  status: Template['status'];
  created_by: string;
  created_by_role: Template['createdByRole'];
  created_at: { toDate: () => Date };
  updated_at: { toDate: () => Date };
  approved_by: string | null;
  approved_at: { toDate: () => Date } | null;
  deleted_at: { toDate: () => Date } | null;
}

export interface RecipeInput {
  recipeId?: string;
  competencyName: string;
  competencyContext: string;
  qtyMultipleChoice: number;
  qtyMultiChoice: number;
  difficulty: 'easy' | 'medium' | 'hard';
  topicsCovered?: string[];
}

export function templateFromFirestore(templateId: string, raw: TemplateDocRaw): Template {
  return {
    templateId,
    organizationId: raw.organization_id,
    name: raw.name,
    description: raw.description ?? undefined,
    niche: raw.niche,
    timeLimitMinutes: raw.time_limit_minutes,
    maxRetries: raw.max_retries,
    recipes: raw.recipes.map((r, i) => ({
      recipeId: r.recipe_id ?? `${templateId}__r${i}`,
      competencyName: r.competency_name,
      competencyContext: r.competency_context,
      qtyMultipleChoice: r.qty_multiple_choice,
      qtyMultiChoice: r.qty_multi_choice,
      difficulty: r.difficulty,
      topicsCovered: r.topics_covered ?? [],
    })),
    status: raw.status,
    createdBy: raw.created_by,
    createdByRole: raw.created_by_role,
    createdAt: raw.created_at.toDate(),
    updatedAt: raw.updated_at.toDate(),
    approvedBy: raw.approved_by,
    approvedAt: raw.approved_at?.toDate() ?? null,
    deletedAt: raw.deleted_at?.toDate() ?? null,
  };
}

export function recipeInputToFirestore(recipe: RecipeInput, index: number): unknown {
  return {
    recipe_id: recipe.recipeId ?? `r${index}`,
    competency_name: recipe.competencyName,
    competency_context: recipe.competencyContext,
    qty_multiple_choice: recipe.qtyMultipleChoice,
    qty_multi_choice: recipe.qtyMultiChoice,
    difficulty: recipe.difficulty,
    topics_covered: recipe.topicsCovered ?? [],
  };
}

export function recipesInputToFirestore(recipes: RecipeInput[]): unknown[] {
  return recipes.map((r, i) => recipeInputToFirestore(r, i));
}

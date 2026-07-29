/**
 * generator-client.ts — Thin wrapper del Generator Agent (SDD-11 §4.4).
 *
 * SDD-11 reusa el Generator Agent existente (SDD-G01) para generar las
 * preguntas del preview. Por ahora (MVP), el Generator Agent no está
 * implementado como servicio — esta función retorna un output
 * deterministic que matchea la shape esperada del Generator real.
 *
 * Cuando SDD-G01 esté listo, reemplazar `callGenerator` por la llamada
 * real al servicio (HTTP o in-process). El resto de la API no cambia.
 *
 * Testing:
 *   - vi.mock('@platform/shared', ...) si se quiere mockear el output
 *   - o inyectar un mock via dependency injection en el handler
 */

import type { Template } from '@platform/shared';
import { previewQuestionSchema, type PreviewQuestion } from '@platform/shared';

export interface GeneratorOutput {
  questions: PreviewQuestion[];
  totalRequested: number;
  totalGenerated: number;
  totalFlagged: number;
  totalRefused: number;
  refusal: { refused: true; reason: string; message: string } | null;
}

const PROMPT_VERSION = 'generator/v1.0';
const MODEL = 'gpt-4o-2024-08-06';

/**
 * Genera un preview de preguntas para todas las recipes del template.
 *
 * Para MVP: retorna un output deterministico. Reemplazar `callGeneratorStub`
 * por la llamada real al Generator Agent cuando SDD-G01 esté integrado.
 */
export async function generateQuestionsForPreview(template: Template): Promise<GeneratorOutput> {
  const allQuestions: PreviewQuestion[] = [];
  let totalRequested = 0;
  let totalGenerated = 0;
  let totalFlagged = 0;
  let refusal: GeneratorOutput['refusal'] = null;

  for (const recipe of template.recipes) {
    const recipeOutput = await callGeneratorStub({
      templateId: template.templateId,
      recipeId: recipe.recipeId,
      competencyName: recipe.competencyName,
      competencyContext: recipe.competencyContext,
      niche: template.niche,
      qtyMultipleChoice: recipe.qtyMultipleChoice,
      qtyMultiChoice: recipe.qtyMultiChoice,
      difficulty: recipe.difficulty,
      topicsCovered: recipe.topicsCovered,
      language: 'es',
    });

    if (recipeOutput.refusal) {
      refusal = recipeOutput.refusal;
      break;
    }

    for (const q of recipeOutput.questions) {
      allQuestions.push({
        ...q,
        metadata: { ...q.metadata, previewMode: true },
      });
    }
    totalRequested += recipeOutput.totalRequested;
    totalGenerated += recipeOutput.totalGenerated;
    totalFlagged += recipeOutput.questions.filter((q) => q.selfAssessment.flagForReview).length;
  }

  return {
    questions: allQuestions,
    totalRequested,
    totalGenerated,
    totalFlagged,
    totalRefused: refusal ? 1 : 0,
    refusal,
  };
}

interface RecipeInput {
  templateId: string;
  recipeId: string;
  competencyName: string;
  competencyContext: string;
  niche: string;
  qtyMultipleChoice: number;
  qtyMultiChoice: number;
  difficulty: string;
  topicsCovered: string[];
  language: string;
}

/**
 * Stub deterministico para MVP. Genera preguntas ficticias que cumplen
 * el schema `previewQuestionSchema`. Cada recipe genera exactamente
 * `qtyMultipleChoice + qtyMultiChoice` preguntas.
 *
 * Reemplazar por la llamada real al Generator Agent (SDD-G01) cuando
 * el servicio esté disponible. La shape de retorno es la misma.
 */
function callGeneratorStub(input: RecipeInput): Promise<GeneratorOutput> {
  const totalRequested = input.qtyMultipleChoice + input.qtyMultiChoice;
  const questions: PreviewQuestion[] = [];
  const generatedAt = new Date().toISOString();

  for (let i = 0; i < totalRequested; i++) {
    const isMulti = i >= input.qtyMultipleChoice;
    const stem = `[STUB ${input.recipeId} #${i + 1}] Pregunta sobre ${input.competencyName} (${input.difficulty}, ${input.niche}): ${input.competencyContext.slice(0, 60)}...`;
    const options = [
      { id: 'a', text: `Opción A para ${input.competencyName} pregunta ${i + 1}` },
      { id: 'b', text: `Opción B para ${input.competencyName} pregunta ${i + 1}` },
      { id: 'c', text: `Opción C para ${input.competencyName} pregunta ${i + 1}` },
      { id: 'd', text: `Opción D para ${input.competencyName} pregunta ${i + 1}` },
    ];
    const correctOptionIds = isMulti ? ['a', 'c'] : ['a'];
    const questionId = `${input.recipeId}_q${i + 1}_${Date.now().toString(36)}`;

    const parsed = previewQuestionSchema.parse({
      questionId,
      type: isMulti ? 'multi_answer' : 'single_answer',
      stem,
      context: input.competencyContext,
      options,
      correctOptionIds,
      feedbackPerOption: options.map((o) => ({
        optionId: o.id,
        isCorrect: correctOptionIds.includes(o.id),
        feedback: `Feedback para opción ${o.id.toUpperCase()} en pregunta ${i + 1} sobre ${input.competencyName}. La respuesta correcta es ${correctOptionIds.join(', ').toUpperCase()}. Esta pregunta es de dificultad ${input.difficulty}.`,
        rationale: null,
      })),
      competencyId: input.recipeId,
      niche: input.niche as 'school' | 'university' | 'exam_practice',
      difficulty: input.difficulty as 'easy' | 'medium' | 'hard',
      topicsCovered: input.topicsCovered,
      selfAssessment: {
        estimatedDifficulty: input.difficulty as 'easy' | 'medium' | 'hard',
        confidence: 0.85,
        flagForReview: false,
        flagReason: null,
      },
      metadata: {
        modelVersion: MODEL,
        promptVersion: PROMPT_VERSION,
        generatedAt,
        previewMode: true,
      },
    });
    questions.push(parsed);
  }

  return {
    questions,
    totalRequested,
    totalGenerated: questions.length,
    totalFlagged: 0,
    totalRefused: 0,
    refusal: null,
  };
}

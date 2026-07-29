/**
 * generator-client.ts — Wrapper del Generator Agent via Genkit.
 *
 * SDD-GENKIT-01 / SDD-11: integracion real con Gemini Flash (Google AI
 * Studio) usando Genkit como SDK. Cada recipe del template se traduce a
 * un `ai.generate(...)` con `output.schema` para output estructurado,
 * luego se completa metadata/previewMode/questionId y se valida con
 * `previewQuestionSchema`.
 *
 * API publica (estable, mantenida en backwards-compat con v0):
 *   - generateQuestionsForPreview(template) -> GeneratorOutput
 *
 * Testing:
 *   - vi.mock('./genkit.js', ...) para evitar dependencia de GEMINI_API_KEY
 *   - en integration tests el mock simula `ai.generate` con respuestas
 *     deterministicas
 *   - la shape de retorno (GeneratorOutput) esta congelada por tests +
 *     generate-preview CF
 *
 * Setup del API key:
 *   - Deploy: `firebase functions:secrets:set GEMINI_API_KEY`
 *   - Emulator: `export GEMINI_API_KEY=<key>` o crear
 *     `apps/functions/.secret.local`
 */

import type { Template } from '@platform/shared';
import {
  previewQuestionSchema,
  type PreviewQuestion,
  previewQuestionTypeSchema,
} from '@platform/shared';
import { z } from 'zod';

import { GEMINI_MODEL, getAI } from './genkit.js';

// =============================================================================
// Tipos publicos (sin cambios vs version stub para mantener backwards-compat)
// =============================================================================

export interface GeneratorOutput {
  questions: PreviewQuestion[];
  totalRequested: number;
  totalGenerated: number;
  totalFlagged: number;
  totalRefused: number;
  refusal: { refused: true; reason: string; message: string } | null;
}

const PROMPT_VERSION = 'generator/genkit-v1.0';

// =============================================================================
// Schemas para `ai.generate({ output: { schema } })`
// =============================================================================
// Lo que Gemini retorna: questions parciales + refusal opcional.
// El CF luego rellena `questionId`, `competencyId`, `niche`, `difficulty`,
// `topicsCovered`, y el `metadata` block.

const previewOptionLiteSchema = z.object({
  id: z.string().min(1).max(4),
  text: z.string().min(5).max(500),
});

const previewFeedbackLiteSchema = z.object({
  optionId: z.string().min(1).max(4),
  isCorrect: z.boolean(),
  feedback: z.string().min(50).max(800),
  // Gemini omite rationale cuando no aporta. Default null para que el
  // parse no falle por este campo opcional.
  rationale: z.string().max(500).nullable().default(null),
});

const previewSelfAssessmentLiteSchema = z.object({
  estimatedDifficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  confidence: z.number().min(0).max(1).default(0.85),
  flagForReview: z.boolean().default(false),
  flagReason: z.string().max(300).nullable().default(null),
});

const generatorQuestionLiteSchema = z.object({
  type: previewQuestionTypeSchema,
  stem: z.string().min(20).max(1000),
  // Gemini omite context cuando no aporta — default null evita el error
  // "Required" sobre el campo nullable.
  context: z.string().max(1500).nullable().default(null),
  options: z.array(previewOptionLiteSchema).min(4).max(6),
  correctOptionIds: z.array(z.string().min(1).max(4)).min(1),
  feedbackPerOption: z.array(previewFeedbackLiteSchema).min(1),
  selfAssessment: previewSelfAssessmentLiteSchema,
});
type GeneratorQuestionLite = z.infer<typeof generatorQuestionLiteSchema>;

const generatorResponseSchema = z.object({
  questions: z.array(generatorQuestionLiteSchema),
  // Gemini suele omitir `refusal` cuando no rechaza la receta — declararlo
  // como `.default(null)` lo hace opcional en el JSON schema resultante y
  // evita el error "must have required property 'refusal'" cuando el
  // modelo retorna solo el array de questions.
  refusal: z
    .object({
      refused: z.literal(true),
      reason: z.string().min(1).max(80),
      message: z.string().min(1).max(500),
    })
    .nullable()
    .default(null),
});

// =============================================================================
// Input de la recipe (interno)
// =============================================================================

interface RecipeInput {
  templateId: string;
  recipeId: string;
  competencyName: string;
  competencyContext: string;
  niche: Template['niche'];
  qtyMultipleChoice: number;
  qtyMultiChoice: number;
  difficulty: Template['recipes'][number]['difficulty'];
  topicsCovered: string[];
  language: string;
}

// =============================================================================
// Public API
// =============================================================================

export async function generateQuestionsForPreview(
  template: Template,
): Promise<GeneratorOutput> {
  const allQuestions: PreviewQuestion[] = [];
  let totalRequested = 0;
  let totalGenerated = 0;
  let totalFlagged = 0;

  // Generar cada recipe SECUENCIALMENTE. Probamos `Promise.all` antes y
  // Gemini truncó las respuestas concurrentes (cada call recibe menos
  // tokens visibles porque algunas se procesan en paralelo). Serial da
  // ~25s por recipe × 4 = 100s, dentro del timeout 300s del onCall.
  for (const recipe of template.recipes) {
    const recipeInput: RecipeInput = {
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
    };

    const recipeOutput = await callGenerator(recipeInput);

    if (recipeOutput.refusal) {
      return {
        questions: [],
        totalRequested: totalRequested + recipeOutput.totalRequested,
        totalGenerated: 0,
        totalFlagged: 0,
        totalRefused: 1,
        refusal: recipeOutput.refusal,
      };
    }

    for (const q of recipeOutput.questions) {
      allQuestions.push(q);
    }
    totalRequested += recipeOutput.totalRequested;
    totalGenerated += recipeOutput.totalGenerated;
    totalFlagged += recipeOutput.questions.filter(
      (q) => q.selfAssessment.flagForReview,
    ).length;
  }

  return {
    questions: allQuestions,
    totalRequested,
    totalGenerated,
    totalFlagged,
    totalRefused: 0,
    refusal: null,
  };
}

// =============================================================================
// Generator real (Genkit + Gemini)
// =============================================================================

const SYSTEM_PROMPT = [
  'Sos un generador experto de items de evaluación en español neutro.',
  'Generás preguntas de opción múltiple de alta calidad pedagógica.',
  '',
  'Reglas estrictas:',
  '- Cada pregunta tiene exactamente 4 opciones (a, b, c, d).',
  '- single_answer: exactamente 1 respuesta correcta.',
  '- multi_answer: 2 respuestas correctas (no más).',
  '- El feedback de cada opción debe tener al menos 50 caracteres y',
  '  explicar POR QUÉ esa opción es correcta o POR QUÉ es incorrecta.',
  '- No usar lenguaje sexista, racista, ofensivo o discriminatorio.',
  '- Evitar preguntas ambiguas o que se respondan por descarte trivial.',
  '- Si la receta no permite generar preguntas de calidad (ej. contexto',
  '  insuficiente o tema sensible), devolver refusal en vez de inventar.',
  '- Mantener el stem contextualizado en el dominio y dificultad pedidos.',
  '',
  'FORMATO de salida (JSON estricto, sin markdown fences):',
  '{',
  '  "questions": [',
  '    {',
  '      "type": "single_answer" | "multi_answer",',
  '      "stem": "...",',
  '      "context": string | null,',
  '      "options": [{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."},{"id":"d","text":"..."}],',
  '      "correctOptionIds": ["a"] o ["a","c"],',
  '      "feedbackPerOption": [{"optionId":"a","isCorrect":true,"feedback":"...","rationale":null},...],',
  '      "selfAssessment": {"estimatedDifficulty":"easy|medium|hard","confidence":0.85,"flagForReview":false,"flagReason":null}',
  '    }, ...',
  '  ],',
  '  "refusal": null o {refused:true,reason:"...",message:"..."}',
  '}',
  'Siempre devolver el wrapper {"questions":[...], "refusal":null} aunque',
  'haya una sola pregunta. NUNCA devolver un array a nivel raíz.',
].join('\n');

function buildUserPrompt(input: RecipeInput): string {
  const total = input.qtyMultipleChoice + input.qtyMultiChoice;
  const lines = [
    `Template: ${input.templateId}`,
    `Nicho: ${input.niche}`,
    `Dificultad: ${input.difficulty}`,
    `Idioma: ${input.language}`,
    '',
    `Competencia: ${input.competencyName}`,
    `Contexto de la competencia: ${input.competencyContext}`,
    `Topics cubiertos: ${input.topicsCovered.join(', ') || '(sin topics)'}`,
    '',
    `Generá EXACTAMENTE ${total} preguntas:`,
    `- ${input.qtyMultipleChoice} de tipo "single_answer" (1 respuesta correcta).`,
    ...(input.qtyMultiChoice > 0
      ? [`- ${input.qtyMultiChoice} de tipo "multi_answer" (2 respuestas correctas).`]
      : []),
    '',
    'Para cada pregunta incluí:',
    '- type, stem, context (opcional), options (4 elementos),',
    '  correctOptionIds, feedbackPerOption (4 elementos con isCorrect y feedback),',
    '  selfAssessment (estimatedDifficulty, confidence ∈ [0,1], flagForReview, flagReason).',
    '',
    'Si no podés generar la cantidad pedida con calidad, devolvé refusal',
    'con reason corto y message descriptiva (max 500 chars).',
  ];
  return lines.join('\n');
}

/**
 * Extrae el primer objeto JSON balanceado desde un texto que puede tener
 * markdown fences, prefijos o sufijos. Si hay fences los strippea; busca
 * el primer `{` y el último `}` balanceado. Si no encuentra, tira error
 * con el raw text incluido para debug.
 */
function extractJsonObject(text: string): unknown {
  // Strip markdown code fences (```json, ```, ```JSON, etc).
  const stripped = text.replace(/```(?:json|JSON)?\s*/g, '').replace(/```/g, '');
  const start = stripped.indexOf('{');
  if (start === -1) {
    throw new Error(
      `No JSON object opener '{'. Raw: ${text.slice(0, 500)}${text.length > 500 ? '... [truncated]' : ''}`,
    );
  }
  // Match balanced braces desde `start`. Si la respuesta de Gemini fue
  // truncada por maxOutputTokens, encontramos el cierre correcto del
  // nivel 0 (raiz) sin confundirnos con '}' dentro de strings escapados
  // o nested objects.
  let depth = 0;
  let end = -1;
  let inString = false;
  let escape = false;
  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) {
    throw new Error(
      `No balanced JSON closer (response truncated?). Raw length: ${text.length}, first 500 chars: ${text.slice(0, 500)}`,
    );
  }
  return JSON.parse(stripped.slice(start, end + 1));
}

function buildEnrichedQuestion(
  lite: GeneratorQuestionLite,
  recipe: RecipeInput,
  generatedAt: string,
): PreviewQuestion {
  return previewQuestionSchema.parse({
    questionId: `${recipe.recipeId}_q_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 7)}`,
    type: lite.type,
    stem: lite.stem,
    context: lite.context,
    options: lite.options,
    correctOptionIds: lite.correctOptionIds,
    feedbackPerOption: lite.feedbackPerOption,
    competencyId: recipe.recipeId,
    niche: recipe.niche,
    difficulty: recipe.difficulty,
    topicsCovered: recipe.topicsCovered,
    selfAssessment: lite.selfAssessment,
    metadata: {
      modelVersion: GEMINI_MODEL,
      promptVersion: PROMPT_VERSION,
      generatedAt,
      previewMode: true,
    },
  });
}

async function callGenerator(input: RecipeInput): Promise<GeneratorOutput> {
  const totalRequested = input.qtyMultipleChoice + input.qtyMultiChoice;
  const generatedAt = new Date().toISOString();

  const ai = getAI();

  // Bypass Genkit's output parsing — pedirle solo text crudo y extraer JSON
  // nosotros mismos con `extractJsonObject` (balanced-brace matcher que
  // ignora `}` dentro de strings escapados).
  const response = await ai.generate({
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(input),
    config: {
      temperature: 0.4,
      // 4096 output tokens. Sin thinkingConfig porque Lite/Flash
      // actuales no soportan thinkingBudget=0 (vuelve 400).
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  });

  // Extraer JSON del text crudo.
  const rawText = response.text ?? '';
  let parsedJson: unknown;
  try {
    parsedJson = extractJsonObject(rawText);
  } catch (e) {
    throw new Error(
      `Gemini response was not valid JSON. Raw (first 500 chars): ${rawText.slice(0, 500)}... | Parse error: ${(e as Error).message}`,
    );
  }

  // Normalizar al shape { questions, refusal }.
  interface RawShape {
    questions?: unknown[];
    refusal?: unknown;
  }
  let rawShape: RawShape;
  if (Array.isArray(parsedJson)) {
    rawShape = { questions: parsedJson, refusal: null };
  } else if (parsedJson && typeof parsedJson === 'object') {
    const wrapped = parsedJson as RawShape;
    rawShape = { questions: wrapped.questions ?? [], refusal: wrapped.refusal ?? null };
  } else {
    rawShape = { questions: [], refusal: null };
  }
  const parsed = generatorResponseSchema.parse(rawShape);

  if (parsed.refusal) {
    return {
      questions: [],
      totalRequested,
      totalGenerated: 0,
      totalFlagged: 0,
      totalRefused: 1,
      refusal: parsed.refusal,
    };
  }

  const enrichedQuestions: PreviewQuestion[] = parsed.questions.map((q) =>
    buildEnrichedQuestion(q, input, generatedAt),
  );

  return {
    questions: enrichedQuestions,
    totalRequested,
    totalGenerated: enrichedQuestions.length,
    totalFlagged: enrichedQuestions.filter(
      (q) => q.selfAssessment.flagForReview,
    ).length,
    totalRefused: 0,
    refusal: null,
  };
}

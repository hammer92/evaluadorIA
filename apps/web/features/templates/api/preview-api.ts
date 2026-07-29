import type {
  GeneratePreviewInput,
  GetPreviewOutput,
  RecordAnswersInput,
  RecordAnswersOutput,
  TemplatePreview,
} from '@shared/schemas/preview';

import { functions, httpsCallable } from '@/lib/firebase/auth';

// =============================================================================
// Preview API (cliente) — SDD-11 §4.1
// =============================================================================
// Thin wrappers sobre httpsCallable para las 3 CFs de preview.
// El cliente incluye el Firebase Auth ID token automáticamente; las CFs
// verifican el token + extraen role/claims via buildAuthContext().
// =============================================================================

function unwrapData<T>(p: Promise<{ data: T }>): Promise<T> {
  return p.then((r) => r.data);
}

export function generatePreview(
  templateId: string,
  forceRegenerate = false,
): Promise<TemplatePreview> {
  const fn = httpsCallable<GeneratePreviewInput, TemplatePreview>(
    functions,
    'v1TemplatePreviewGenerate',
  );
  const input: GeneratePreviewInput = { templateId, forceRegenerate };
  return unwrapData(fn(input));
}

export function getPreview(templateId: string): Promise<GetPreviewOutput> {
  const fn = httpsCallable<{ templateId: string }, GetPreviewOutput>(
    functions,
    'v1TemplatePreviewGet',
  );
  return unwrapData(fn({ templateId }));
}

export function recordAnswers(input: RecordAnswersInput): Promise<RecordAnswersOutput> {
  const fn = httpsCallable<RecordAnswersInput, RecordAnswersOutput>(
    functions,
    'v1TemplatePreviewAnswered',
  );
  return unwrapData(fn(input));
}

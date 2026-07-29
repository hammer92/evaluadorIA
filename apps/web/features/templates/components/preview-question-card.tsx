'use client';

import type { PreviewQuestion } from '@shared/schemas/preview';
import { CheckCircle2, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

interface PreviewQuestionCardProps {
  question: PreviewQuestion;
  index?: number;
  showFeedback?: boolean;
  selectedOptionIds?: string[];
  onSelect?: (optionId: string) => void;
}

// =============================================================================
// PreviewQuestionCard — SDD-11 §5.2
// =============================================================================
// Render: stem + context (opcional) + options (radio/checkbox) + feedback
// por opcion cuando showFeedback=true.
// En modo read-only (showFeedback=false): solo el stem + opciones seleccionadas.
// En modo respuesta (showFeedback=true): muestra feedback por opcion y marca
// las correctas/incorrectas.
// =============================================================================

export function PreviewQuestionCard({
  question,
  index,
  showFeedback = false,
  selectedOptionIds = [],
  onSelect,
}: PreviewQuestionCardProps): React.JSX.Element {
  const isMulti = question.type === 'multi_answer';
  const selected = new Set(selectedOptionIds);
  const correct = new Set(question.correctOptionIds);

  return (
    <article
      className="space-y-stack-md rounded-tv border border-border-standard bg-white p-stack-lg"
      aria-labelledby={`q-${question.questionId}-stem`}
    >
      <header className="space-y-stack-sm">
        {index !== undefined && (
          <p className="text-label-sm text-outline-tv">Pregunta {index + 1}</p>
        )}
        <h3
          id={`q-${question.questionId}-stem`}
          className="font-hanken text-headline-sm text-on-surface"
        >
          {question.stem}
        </h3>
        {question.context && (
          <p className="text-body-sm text-on-surface-variant">{question.context}</p>
        )}
      </header>

      <ul
        role={isMulti ? 'group' : 'radiogroup'}
        aria-label={`Opciones para pregunta ${index !== undefined ? index + 1 : ''}`}
        className="space-y-stack-sm"
      >
        {question.options.map((option) => {
          const isSelected = selected.has(option.id);
          const isCorrect = correct.has(option.id);
          const feedback = question.feedbackPerOption.find((f) => f.optionId === option.id);

          return (
            <li key={option.id}>
              <button
                type="button"
                role={isMulti ? 'checkbox' : 'radio'}
                aria-checked={isSelected}
                aria-describedby={
                  showFeedback && feedback ? `fb-${question.questionId}-${option.id}` : undefined
                }
                onClick={() => onSelect?.(option.id)}
                className={cn(
                  'flex w-full items-start gap-stack-sm rounded-md border px-stack-md py-stack-sm text-left transition-colors',
                  isSelected
                    ? 'border-navy bg-navy/5'
                    : 'border-border-standard hover:border-navy/50 hover:bg-navy/5',
                  showFeedback && isCorrect && 'border-status-success bg-status-success/5',
                  showFeedback && isSelected && !isCorrect && 'border-status-error bg-status-error/5',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-label-sm',
                    isSelected
                      ? 'border-navy bg-navy text-white'
                      : 'border-border-standard text-outline-tv',
                  )}
                  aria-hidden
                >
                  {option.id.toUpperCase()}
                </span>
                <span className="flex-1 text-body-md text-on-surface">{option.text}</span>
                {showFeedback && isCorrect && (
                  <CheckCircle2
                    className="h-5 w-5 shrink-0 text-status-success"
                    aria-label="Respuesta correcta"
                  />
                )}
                {showFeedback && isSelected && !isCorrect && (
                  <XCircle
                    className="h-5 w-5 shrink-0 text-status-error"
                    aria-label="Respuesta incorrecta"
                  />
                )}
              </button>
              {showFeedback && feedback && (
                <p
                  id={`fb-${question.questionId}-${option.id}`}
                  className={cn(
                    'ml-9 mt-1 text-body-sm',
                    isCorrect ? 'text-status-success' : 'text-on-surface-variant',
                  )}
                >
                  {feedback.feedback}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

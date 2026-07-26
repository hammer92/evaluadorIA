'use client';

import {
  DIFFICULTY_LABELS,
  NICHE_LABELS,
  REVIEW_ACTION_LABELS,
  type ReviewEvent,
} from '@shared/schemas/templates';
import { ArrowRight, PencilLine } from 'lucide-react';
import * as React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function formatDateTime(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function humanizeField(field: string): string {
  const fieldLabels: Record<string, string> = {
    name: 'Nombre',
    description: 'Descripción',
    niche: 'Nicho',
    timeLimitMinutes: 'Duración (min)',
    maxRetries: 'Reintentos',
    recipes: 'Recetas',
  };

  const recipeFieldLabels: Record<string, string> = {
    competencyName: 'Competencia',
    competencyContext: 'Contexto para la IA',
    qtyMultipleChoice: 'Única respuesta',
    qtyMultiChoice: 'Múltiple respuesta',
    difficulty: 'Dificultad',
    topicsCovered: 'Tópicos cubiertos',
  };

  const recipeMatch = /^recipes\[(\d+)\]\.(.+)$/.exec(field);
  if (recipeMatch?.[1] && recipeMatch[2]) {
    const idx = Number.parseInt(recipeMatch[1], 10);
    const subKey = recipeMatch[2];
    const subField = recipeFieldLabels[subKey] ?? subKey;
    return `Receta ${idx + 1}: ${subField}`;
  }

  return fieldLabels[field] ?? field;
}

function isRecipe(value: unknown): value is { competencyName?: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'competencyName' in value &&
    typeof (value as { competencyName: unknown }).competencyName === 'string'
  );
}

function formatRecipeArray(value: unknown[]): string {
  if (value.length === 0) return '(sin recetas)';
  const names = value
    .map((r) => (isRecipe(r) ? r.competencyName : null))
    .filter((n): n is string => n !== null);
  if (names.length === value.length) {
    return `${value.length} receta${value.length === 1 ? '' : 's'}: ${names.join(', ')}`;
  }
  return `${value.length} receta${value.length === 1 ? '' : 's'}`;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) {
    if (value.length === 0) return '(vacío)';
    if (value.every(isRecipe)) return formatRecipeArray(value);
    if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      return value.join(', ');
    }
    return `${value.length} elemento${value.length === 1 ? '' : 's'}`;
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const maybeNiche = (value as { niche?: string }).niche;
    if (typeof maybeNiche === 'string' && maybeNiche in NICHE_LABELS) {
      return NICHE_LABELS[maybeNiche as keyof typeof NICHE_LABELS];
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function formatDifficulty(value: unknown): string {
  if (typeof value !== 'string') return formatValue(value);
  return DIFFICULTY_LABELS[value as keyof typeof DIFFICULTY_LABELS] ?? value;
}

function formatChange(field: string, value: unknown): string {
  if (field.endsWith('.difficulty')) return formatDifficulty(value);
  if (field === 'niche') {
    if (typeof value === 'string' && value in NICHE_LABELS) {
      return NICHE_LABELS[value as keyof typeof NICHE_LABELS];
    }
    return formatValue(value);
  }
  if (field === 'recipes' && Array.isArray(value)) {
    return formatRecipeArray(value);
  }
  return formatValue(value);
}

export function ReviewHistoryList({
  events,
  loading,
}: {
  events: ReviewEvent[];
  loading?: boolean;
}): React.JSX.Element {
  if (loading) {
    return (
      <div className="space-y-stack-sm" aria-busy="true" aria-label="Cargando historial">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-tv border border-border-standard bg-white p-stack-lg text-center shadow-tv-card">
        <h3 className="text-headline-sm font-semibold text-navy">Sin eventos</h3>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Aún no hay eventos de revisión registrados para este template.
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-stack-sm">
      {events.map((event) => {
        const actionLabel =
          REVIEW_ACTION_LABELS[event.action as keyof typeof REVIEW_ACTION_LABELS] ?? event.action;
        const hasChanges = Array.isArray(event.changes) && event.changes.length > 0;
        return (
          <li
            key={event.reviewId}
            className="rounded-tv border border-border-standard bg-white p-stack-md shadow-tv-card"
          >
            <div className="flex flex-wrap items-start justify-between gap-stack-sm">
              <div className="space-y-stack-xs">
                <p className="text-label-sm text-outline-tv">{actionLabel}</p>
                <p className="text-body-md text-on-surface">
                  <span className="font-medium">{event.actorName}</span>
                  <span className="text-on-surface-variant"> · {event.actorRole}</span>
                </p>
              </div>
              <time className="text-body-sm text-on-surface-variant">
                {formatDateTime(event.createdAt)}
              </time>
            </div>

            {event.comment && (
              <p className="mt-stack-sm border-l-2 border-outline pl-stack-sm text-body-md text-on-surface-variant">
                {event.comment}
              </p>
            )}

            {hasChanges && (() => {
              // Filtrar cambios donde before === after (no hay diff real).
              const realChanges = event.changes!.filter((c) => {
                const beforeStr = formatChange(c.field, c.before);
                const afterStr = formatChange(c.field, c.after);
                return beforeStr !== afterStr;
              });
              if (realChanges.length === 0) return null;
              return (
                <div className="mt-stack-md">
                  <p className="mb-stack-sm flex items-center gap-1.5 text-label-sm font-bold uppercase tracking-wider text-outline-tv">
                    <PencilLine className="h-3.5 w-3.5" aria-hidden />
                    Cambios ({realChanges.length})
                  </p>
                  <ul className="divide-y divide-border-standard rounded-md border border-border-standard bg-surface-subtle/40">
                    {realChanges.map((change, i) => (
                      <li
                        key={`${change.field}-${i}`}
                        className="space-y-1.5 px-stack-sm py-stack-sm text-body-sm"
                      >
                        <p className="font-medium text-on-surface">
                          {humanizeField(change.field)}
                        </p>
                        <DiffPair
                          before={formatChange(change.field, change.before)}
                          after={formatChange(change.field, change.after)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </li>
        );
      })}
    </ol>
  );
}

function DiffPair({ before, after }: { before: string; after: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          'inline-flex max-w-full min-w-0 items-start break-words rounded-md border px-2 py-1 font-mono text-label-sm',
          'border-status-error/30 bg-status-error/5 text-status-error line-through',
        )}
      >
        {before}
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-outline-tv" aria-hidden />
      <span
        className={cn(
          'inline-flex max-w-full min-w-0 items-start break-words rounded-md border px-2 py-1 font-mono text-label-sm',
          'border-status-success/30 bg-status-success/5 text-status-success',
        )}
      >
        {after}
      </span>
    </div>
  );
}

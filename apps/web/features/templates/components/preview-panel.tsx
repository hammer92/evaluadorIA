'use client';

import { AlertTriangle, FileText, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { useGeneratePreview, usePreview } from '../hooks/use-preview';

import { PreviewQuestionCard } from './preview-question-card';
import { Simulator } from './simulator';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// =============================================================================
// PreviewPanel — SDD-11 §5.2
// =============================================================================
// 3 estados:
//  - never generated: botón "Generar preview"
//  - fresh: lista de preguntas + CTA "Tomar simulación"
//  - stale: warning banner + botón "Regenerar"
// Optional requireAcknowledgement: si es true, expone checkbox (no implementado
// en este slice — el gating del approve se hace en PR-4 integration).
// =============================================================================

interface PreviewPanelProps {
  templateId: string;
  requireAcknowledgement?: boolean;
}

export function PreviewPanel({
  templateId,
  requireAcknowledgement: _requireAcknowledgement = false,
}: PreviewPanelProps): React.JSX.Element {
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const { data, isLoading, isError } = usePreview(templateId);
  const generate = useGeneratePreview(templateId);

  if (isLoading) {
    return (
      <section
        className="space-y-stack-md rounded-tv border border-border-standard bg-white p-stack-lg"
        aria-busy="true"
        aria-label="Cargando preview"
      >
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </section>
    );
  }

  if (isError) {
    return (
      <section
        className="space-y-stack-md rounded-tv border-l-4 border-status-error bg-status-error/5 p-stack-lg"
        role="alert"
      >
        <p className="font-medium text-status-error">No se pudo cargar el preview.</p>
        <Button variant="outline" size="sm" onClick={() => generate.mutate(false)}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          Reintentar
        </Button>
      </section>
    );
  }

  if (!data?.preview) {
    return (
      <section
        className="space-y-stack-md rounded-tv border-l-4 border-status-info bg-status-info/5 p-stack-lg"
        aria-label="Preview no generado"
      >
        <div>
          <h2 className="font-hanken text-headline-sm font-semibold text-navy">
            Preview de preguntas
          </h2>
          <p className="text-body-md text-on-surface-variant">
            Generá un preview para ver las preguntas que la IA produciría con esta receta antes de
            aprobarla.
          </p>
        </div>
        <Button
          onClick={() => generate.mutate(false)}
          disabled={generate.isPending}
          aria-busy={generate.isPending}
        >
          <Sparkles className="mr-2 h-4 w-4" aria-hidden />
          {generate.isPending ? 'Generando...' : 'Generar preview'}
        </Button>
      </section>
    );
  }

  return (
    <>
      <section
        className="space-y-stack-md rounded-tv border-l-4 border-status-info bg-status-info/5 p-stack-lg"
        aria-label="Preview de preguntas"
      >
        <div className="flex flex-wrap items-start justify-between gap-stack-sm">
          <div>
            <h2 className="font-hanken text-headline-sm font-semibold text-navy">
              Preview de preguntas
            </h2>
            <p className="text-body-sm text-navy/70">
              {data.preview.questions.length} preguntas · Modelo {data.preview.modelVersion} ·{' '}
              {data.preview.totalFlagged} flagged
            </p>
          </div>
          <div className="flex gap-stack-sm">
            <Button
              variant="outline"
              size="sm"
              onClick={() => generate.mutate(true)}
              disabled={generate.isPending}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
              Regenerar
            </Button>
            <Button size="sm" onClick={() => setSimulatorOpen(true)}>
              <Sparkles className="mr-1.5 h-4 w-4" aria-hidden />
              Tomar simulación
            </Button>
          </div>
        </div>

        {data.isStale && (
          <div
            className="flex items-start gap-stack-sm rounded-tv border-l-4 border-status-warning bg-status-warning/5 p-stack-md"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" aria-hidden />
            <div>
              <p className="font-medium text-on-surface">Preview desactualizado</p>
              <p className="text-body-sm text-on-surface-variant">
                {data.message ?? 'La receta cambió desde que se generó este preview. Regenerá para ver la versión actual.'}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-stack-sm">
          {data.preview.questions.slice(0, 3).map((q, i) => (
            <PreviewQuestionCard key={q.questionId} question={q} index={i} />
          ))}
          {data.preview.questions.length > 3 && (
            <p className="text-body-sm text-on-surface-variant">
              <FileText className="mr-1 inline h-4 w-4" aria-hidden />
              Mostrando 3 de {data.preview.questions.length} preguntas. Tomá la simulación para ver
              todas.
            </p>
          )}
        </div>
      </section>

      {simulatorOpen && (
        <Simulator preview={data.preview} onClose={() => setSimulatorOpen(false)} />
      )}
    </>
  );
}

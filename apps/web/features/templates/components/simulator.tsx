'use client';

import type { TemplatePreview } from '@shared/schemas/preview';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { useRecordAnswers } from '../hooks/use-preview';

import { PreviewQuestionCard } from './preview-question-card';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';


// =============================================================================
// Simulator — SDD-11 §5.2
// =============================================================================
// Modal con flujo: start screen → one question at a time → submit → feedback
// → next → final summary con score.
// onComplete callback al cerrar.
// =============================================================================

interface AnswerEntry {
  questionId: string;
  selectedOptionIds: string[];
  timeSpentMs: number;
}

interface SimulatorProps {
  preview: TemplatePreview;
  onClose: () => void;
}

export function Simulator({ preview, onClose }: SimulatorProps): React.JSX.Element {
  const [stage, setStage] = useState<'start' | 'playing' | 'submitted' | 'result'>('start');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerEntry[]>([]);
  const [pendingSelection, setPendingSelection] = useState<string[]>([]);
  const [questionStartedAt, setQuestionStartedAt] = useState<number>(Date.now());
  const [result, setResult] = useState<{ score: number; correct: number; total: number } | null>(
    null,
  );

  const recordAnswers = useRecordAnswers();
  const total = preview.questions.length;
  const currentQ = preview.questions[currentIndex];
  const progress = total === 0 ? 0 : Math.round(((currentIndex + 1) / total) * 100);

  const start = () => {
    setStage('playing');
    setCurrentIndex(0);
    setAnswers([]);
    setPendingSelection([]);
    setQuestionStartedAt(Date.now());
  };

  const handleSelect = (optionId: string) => {
    const q = preview.questions[currentIndex];
    if (!q) return;
    if (q.type === 'single_answer') {
      setPendingSelection([optionId]);
    } else {
      setPendingSelection((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
      );
    }
  };

  const submitAnswer = () => {
    if (!currentQ || pendingSelection.length === 0) return;
    const elapsed = Date.now() - questionStartedAt;
    setAnswers((prev) => [
      ...prev,
      {
        questionId: currentQ.questionId,
        selectedOptionIds: pendingSelection,
        timeSpentMs: elapsed,
      },
    ]);
    setStage('submitted');
  };

  const next = () => {
    if (currentIndex + 1 >= total) {
      finish();
      return;
    }
    setCurrentIndex((i) => i + 1);
    setPendingSelection([]);
    setQuestionStartedAt(Date.now());
    setStage('playing');
  };

  const finish = () => {
    const payload = {
      templateId: preview.templateId,
      previewId: preview.previewId,
      answers,
    };
    recordAnswers.mutate(payload, {
      onSuccess: (data) => {
        setResult({ score: data.score, correct: data.correct, total: data.total });
        setStage('result');
      },
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl" aria-labelledby="simulator-title">
        <DialogTitle id="simulator-title" className="font-hanken text-headline-md">
          {stage === 'start' && 'Simulación de examen'}
          {stage === 'playing' && `Pregunta ${currentIndex + 1} de ${total}`}
          {stage === 'submitted' && 'Feedback'}
          {stage === 'result' && 'Resultado'}
        </DialogTitle>

        {stage === 'start' && (
          <div className="space-y-stack-md py-stack-md">
            <p className="text-body-md text-on-surface-variant">
              Vas a tomar una simulación con {total} pregunta{total === 1 ? '' : 's'}.
              Respondé como si fueras el candidato para validar la calidad de las preguntas.
            </p>
            <div className="flex justify-end gap-stack-sm">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={start}>
                <Sparkles className="mr-2 h-4 w-4" aria-hidden />
                Empezar simulación
              </Button>
            </div>
          </div>
        )}

        {(stage === 'playing' || stage === 'submitted') && currentQ && (
          <div className="space-y-stack-md py-stack-md">
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-surface-subtle"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progreso: ${progress}%`}
            >
              <div
                className="h-full bg-navy transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            <PreviewQuestionCard
              question={currentQ}
              index={currentIndex}
              showFeedback={stage === 'submitted'}
              selectedOptionIds={stage === 'submitted' ? pendingSelection : []}
              onSelect={handleSelect}
            />

            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
                Anterior
              </Button>
              {stage === 'playing' ? (
                <Button onClick={submitAnswer} disabled={pendingSelection.length === 0}>
                  Enviar respuesta
                </Button>
              ) : (
                <Button onClick={next}>
                  {currentIndex + 1 >= total ? 'Ver resultado' : 'Siguiente'}
                  <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
                </Button>
              )}
            </div>
          </div>
        )}

        {stage === 'result' && result && (
          <div className="space-y-stack-md py-stack-md">
            <div className="rounded-tv border-l-4 border-status-success bg-status-success/5 p-stack-md">
              <p className="text-headline-sm font-semibold text-on-surface">
                Obtuviste {result.correct}/{result.total} correctas ({result.score}%)
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

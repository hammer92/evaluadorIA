'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Edit3, Loader2, MessageSquareWarning, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  useApproveTemplate,
  useRejectTemplate,
  useRequestChanges,
} from '../hooks/use-review-hooks';
import { reviewDecisionFormSchema, type ReviewDecisionFormValues } from '../schemas';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Action = 'approve' | 'request_changes' | 'reject';

const ACTION_META: Record<
  Action,
  {
    title: string;
    description: string;
    buttonLabel: string;
    buttonClass: string;
    icon: typeof CheckCircle2;
  }
> = {
  approve: {
    title: 'Aprobar template',
    description: 'El template será visible para todos los recruiters de la organización.',
    buttonLabel: 'Aprobar',
    buttonClass: 'bg-status-success text-white hover:bg-status-success/90',
    icon: CheckCircle2,
  },
  request_changes: {
    title: 'Solicitar cambios',
    description: 'El template volverá a borrador. El recruiter deberá atender tus comentarios.',
    buttonLabel: 'Solicitar cambios',
    buttonClass: 'border-status-warning text-status-warning hover:bg-status-warning/10',
    icon: MessageSquareWarning,
  },
  reject: {
    title: 'Rechazar template',
    description: 'El template será marcado como rechazado. Esta acción no se puede deshacer.',
    buttonLabel: 'Rechazar',
    buttonClass: 'border-status-error text-status-error hover:bg-status-error/10',
    icon: XCircle,
  },
};

interface ActionDialogProps {
  action: Action;
  templateId: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onSubmitted: () => void;
}

function ActionDialog({
  action,
  templateId,
  open,
  onOpenChange,
  onSubmitted,
}: ActionDialogProps): React.JSX.Element {
  const meta = ACTION_META[action];
  const approve = useApproveTemplate();
  const requestChanges = useRequestChanges();
  const reject = useRejectTemplate();
  const mutation =
    action === 'approve' ? approve : action === 'request_changes' ? requestChanges : reject;
  const { isPending } = mutation;

  const form = useForm<ReviewDecisionFormValues>({
    resolver: zodResolver(reviewDecisionFormSchema),
    defaultValues: { templateId, action, comment: '' },
    mode: 'onChange',
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = form;

  function onSubmit(values: ReviewDecisionFormValues): void {
    const input = { templateId, comment: values.comment ?? '' };
    mutation.mutate(input, {
      onSuccess: () => {
        reset();
        onSubmitted();
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-stack-md">
          <div className="space-y-stack-sm">
            <Label htmlFor={`comment-${action}`}>
              Comentario{' '}
              {action === 'approve' ? (
                <span className="text-body-sm text-navy/60">(opcional)</span>
              ) : (
                <span className="text-status-error">*</span>
              )}
            </Label>
            <Textarea
              id={`comment-${action}`}
              placeholder={
                action === 'approve'
                  ? 'Feedback positivo o notas opcionales...'
                  : 'Explicá qué debe cambiar el recruiter (mín. 10 caracteres)...'
              }
              rows={4}
              maxLength={2000}
              aria-invalid={Boolean(errors.comment)}
              {...register('comment')}
            />
            {errors.comment && (
              <p className="text-body-sm text-status-error" role="alert">
                {errors.comment.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending || (action !== 'approve' && !isValid)}
              className={meta.buttonClass}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {meta.buttonLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface ReviewDecisionPanelProps {
  templateId: string;
  onEditAndApprove: () => void;
}

export function ReviewDecisionPanel({
  templateId,
  onEditAndApprove,
}: ReviewDecisionPanelProps): React.JSX.Element {
  const [openAction, setOpenAction] = useState<Action | null>(null);

  return (
    <div
      className="space-y-stack-md rounded-tv border-l-4 border-status-info bg-status-info/5 p-stack-md"
      role="region"
      aria-label="Acciones de revisión"
    >
      <div>
        <h2 className="text-headline-sm font-semibold text-navy">Decisión de revisión</h2>
        <p className="text-body-sm text-navy/60">
          Aprobá, solicitá cambios, o rechazá este template.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-stack-sm sm:grid-cols-2 lg:grid-cols-4">
        <Button
          variant="default"
          onClick={() => setOpenAction('approve')}
          className="bg-status-success text-white hover:bg-status-success/90"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Aprobar
        </Button>
        <Button
          variant="outline"
          onClick={() => setOpenAction('request_changes')}
          className="border-status-warning text-status-warning hover:bg-status-warning/10"
        >
          <MessageSquareWarning className="mr-2 h-4 w-4" />
          Solicitar cambios
        </Button>
        <Button
          variant="outline"
          onClick={() => setOpenAction('reject')}
          className="border-status-error text-status-error hover:bg-status-error/10"
        >
          <XCircle className="mr-2 h-4 w-4" />
          Rechazar
        </Button>
        <Button variant="ghost" onClick={onEditAndApprove}>
          <Edit3 className="mr-2 h-4 w-4" />
          Editar y aprobar
        </Button>
      </div>

      {openAction && (
        <ActionDialog
          action={openAction}
          templateId={templateId}
          open={Boolean(openAction)}
          onOpenChange={(o) => !o && setOpenAction(null)}
          onSubmitted={() => {
            /* query invalidation happens via hook */
          }}
        />
      )}
    </div>
  );
}

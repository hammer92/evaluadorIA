'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Template } from '@shared/schemas/templates';
import { DIFFICULTY_LABELS } from '@shared/schemas/templates';
import { Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { useApproveTemplate, useExpertEditTemplate } from '../hooks/use-review-hooks';
import { expertEditFormSchema, type ExpertEditFormValues } from '../schemas';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

export interface ExpertEditModalProps {
  template: Template;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCompleted?: () => void;
}

export function ExpertEditModal({
  template,
  open,
  onOpenChange,
  onCompleted,
}: ExpertEditModalProps): React.JSX.Element {
  const expertEdit = useExpertEditTemplate(template.templateId);
  const approve = useApproveTemplate();
  const isPending = expertEdit.isPending || approve.isPending;

  const form = useForm<ExpertEditFormValues>({
    resolver: zodResolver(expertEditFormSchema),
    defaultValues: {
      templateId: template.templateId,
      comment: '',
      recipes: template.recipes.map((r) => ({
        recipeId: r.recipeId,
        competencyContext: r.competencyContext,
        qtyMultipleChoice: r.qtyMultipleChoice,
        qtyMultiChoice: r.qtyMultiChoice,
        difficulty: r.difficulty,
        topicsCovered: r.topicsCovered,
      })),
    },
  });

  const { register, handleSubmit, control, reset, formState } = form;
  const { errors } = formState;
  const { fields } = useFieldArray({ control, name: 'recipes' });

  // Reset form cuando cambia el template (evita stale data entre templates).
  useEffect(() => {
    if (open) {
      reset({
        templateId: template.templateId,
        comment: '',
        recipes: template.recipes.map((r) => ({
          recipeId: r.recipeId,
          competencyContext: r.competencyContext,
          qtyMultipleChoice: r.qtyMultipleChoice,
          qtyMultiChoice: r.qtyMultiChoice,
          difficulty: r.difficulty,
          topicsCovered: r.topicsCovered,
        })),
      });
    }
  }, [open, template.templateId, template.recipes, reset]);

  function onSubmit(values: ExpertEditFormValues): void {
    // Build recipes payload omitting undefined fields (exactOptionalPropertyTypes).
    const recipesPayload =
      values.recipes?.map((r) => ({
        recipeId: r.recipeId,
        ...(r.competencyContext !== undefined ? { competencyContext: r.competencyContext } : {}),
        ...(r.qtyMultipleChoice !== undefined ? { qtyMultipleChoice: r.qtyMultipleChoice } : {}),
        ...(r.qtyMultiChoice !== undefined ? { qtyMultiChoice: r.qtyMultiChoice } : {}),
        ...(r.difficulty !== undefined ? { difficulty: r.difficulty } : {}),
        ...(r.topicsCovered !== undefined ? { topicsCovered: r.topicsCovered } : {}),
      })) ?? [];

    // 1) Apply expert edit
    expertEdit.mutate(
      {
        templateId: template.templateId,
        recipes: recipesPayload,
        ...(values.comment !== undefined && values.comment.length > 0
          ? { comment: values.comment }
          : {}),
      },
      {
        onSuccess: () => {
          // 2) Immediately approve
          approve.mutate(
            {
              templateId: template.templateId,
              ...(values.comment !== undefined && values.comment.length > 0
                ? { comment: values.comment }
                : {}),
            },
            {
              onSuccess: () => {
                reset();
                onCompleted?.();
                onOpenChange(false);
              },
            },
          );
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[80vh] max-w-[720px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar y aprobar — {template.name}</DialogTitle>
          <DialogDescription>
            Ajustá los parámetros técnicos de las recetas. Al guardar, el template se aprueba
            automáticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-stack-md">
          {fields.map((field, idx) => (
            <div
              key={field.id}
              className="space-y-stack-sm rounded-tv border border-border bg-surface-container-lowest p-stack-md"
            >
              <div className="flex items-center justify-between">
                <p className="text-label-sm text-outline-tv">Receta #{idx + 1}</p>
                <span className="text-body-sm text-navy/60">
                  {template.recipes[idx]?.competencyName}
                </span>
              </div>
              <div className="space-y-stack-xs">
                <Label htmlFor={`recipes.${idx}.competencyContext`}>Contexto para la IA</Label>
                <Textarea
                  id={`recipes.${idx}.competencyContext`}
                  rows={3}
                  {...register(`recipes.${idx}.competencyContext` as const)}
                />
                {errors.recipes?.[idx]?.competencyContext && (
                  <p className="text-body-sm text-status-error" role="alert">
                    {errors.recipes[idx]?.competencyContext?.message}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-stack-sm md:grid-cols-3">
                <div className="space-y-stack-xs">
                  <Label htmlFor={`recipes.${idx}.qtyMultipleChoice`}>Única respuesta</Label>
                  <Input
                    id={`recipes.${idx}.qtyMultipleChoice`}
                    type="number"
                    min={0}
                    max={20}
                    {...register(`recipes.${idx}.qtyMultipleChoice` as const, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="space-y-stack-xs">
                  <Label htmlFor={`recipes.${idx}.qtyMultiChoice`}>Múltiple respuesta</Label>
                  <Input
                    id={`recipes.${idx}.qtyMultiChoice`}
                    type="number"
                    min={0}
                    max={20}
                    {...register(`recipes.${idx}.qtyMultiChoice` as const, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="space-y-stack-xs">
                  <Label htmlFor={`recipes.${idx}.difficulty`}>Dificultad</Label>
                  <DifficultySelect
                    recipeIndex={idx}
                    defaultValue={template.recipes[idx]?.difficulty ?? 'medium'}
                    onChange={(v) => form.setValue(`recipes.${idx}.difficulty`, v)}
                  />
                </div>
              </div>
              <TopicsInput
                recipeIndex={idx}
                initial={template.recipes[idx]?.topicsCovered ?? []}
                onChange={(topics) => form.setValue(`recipes.${idx}.topicsCovered`, topics)}
              />
            </div>
          ))}
          <Separator />
          <div className="space-y-stack-sm">
            <Label htmlFor="expert-comment">
              Comentario <span className="text-body-sm text-navy/60">(opcional)</span>
            </Label>
            <Textarea
              id="expert-comment"
              placeholder="Notas o feedback para el equipo..."
              rows={2}
              maxLength={2000}
              {...register('comment')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar y aprobar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DifficultySelect({
  recipeIndex,
  defaultValue,
  onChange,
}: {
  recipeIndex: number;
  defaultValue: 'easy' | 'medium' | 'hard';
  onChange: (value: 'easy' | 'medium' | 'hard') => void;
}): React.JSX.Element {
  const id = `recipes.${recipeIndex}.difficulty`;
  return (
    <Select
      defaultValue={defaultValue}
      onValueChange={(v: string) => onChange(v as 'easy' | 'medium' | 'hard')}
    >
      <SelectTrigger id={id} aria-label="Dificultad">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="easy">{DIFFICULTY_LABELS.easy}</SelectItem>
        <SelectItem value="medium">{DIFFICULTY_LABELS.medium}</SelectItem>
        <SelectItem value="hard">{DIFFICULTY_LABELS.hard}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function TopicsInput({
  recipeIndex,
  initial,
  onChange,
}: {
  recipeIndex: number;
  initial: string[];
  onChange: (topics: string[]) => void;
}): React.JSX.Element {
  const [topics, setTopics] = useState<string[]>(initial);
  const [draft, setDraft] = useState('');

  function add(): void {
    const trimmed = draft.trim();
    if (trimmed.length < 2 || trimmed.length > 80) return;
    if (topics.length >= 20) return;
    const next = [...topics, trimmed];
    setTopics(next);
    setDraft('');
    onChange(next);
  }

  function remove(idx: number): void {
    const next = topics.filter((_, i) => i !== idx);
    setTopics(next);
    onChange(next);
  }

  return (
    <div className="space-y-stack-xs" data-testid={`topics-input-${recipeIndex}`}>
      <Label htmlFor={`topics-${recipeIndex}`}>Tópicos cubiertos (máx 20)</Label>
      <div className="flex gap-stack-sm">
        <Input
          id={`topics-${recipeIndex}`}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Escribí un tópico y presioná Enter..."
          maxLength={80}
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          Agregar
        </Button>
      </div>
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {topics.map((topic, idx) => (
            <span
              key={`${topic}-${idx}`}
              className="inline-flex items-center gap-1 rounded-md bg-surface-container-low px-2 py-0.5 text-body-sm text-on-surface"
            >
              {topic}
              <button
                type="button"
                onClick={() => remove(idx)}
                aria-label={`Quitar ${topic}`}
                className="text-navy/40 hover:text-status-error"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

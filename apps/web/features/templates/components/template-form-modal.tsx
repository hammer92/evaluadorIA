'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Template } from '@shared/schemas/templates';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { useCreateTemplate, useUpdateTemplate } from '../hooks/use-templates';
import { templateFormSchema, type TemplateFormValues } from '../schemas';

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

export function TemplateFormModal({
  open,
  onOpenChange,
  mode,
  template,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  mode: 'create' | 'edit';
  template?: Template;
}): React.JSX.Element {
  const create = useCreateTemplate();
  const update = useUpdateTemplate(template?.templateId ?? '');

  const defaultValues: TemplateFormValues = {
    name: template?.name ?? '',
    description: template?.description ?? '',
    niche: template?.niche ?? 'school',
    timeLimitMinutes: template?.timeLimitMinutes ?? 30,
    maxRetries: template?.maxRetries ?? 1,
    recipes:
      template?.recipes.map((r) => ({
        recipeId: r.recipeId,
        competencyName: r.competencyName,
        competencyContext: r.competencyContext,
        qtyMultipleChoice: r.qtyMultipleChoice,
        qtyMultiChoice: r.qtyMultiChoice,
        difficulty: r.difficulty,
        topicsCovered: r.topicsCovered,
      })) ?? [],
  };

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues,
  });

  const { register, handleSubmit, control, formState, reset } = form;
  const { errors } = formState;
  const { fields, append, remove } = useFieldArray({ control, name: 'recipes' });

  useEffect(() => {
    if (open) {
      reset(defaultValues);
    }
  }, [open, template?.templateId, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const recipes = values.recipes.map(({ recipeId, ...rest }) => {
        void recipeId; // omit server-generated recipeId on create
        return rest;
      });
      if (mode === 'create') {
        await create.mutateAsync({
          name: values.name,
          description: values.description,
          niche: values.niche,
          timeLimitMinutes: values.timeLimitMinutes,
          maxRetries: values.maxRetries,
          recipes,
        });
      } else if (template) {
        await update.mutateAsync({
          templateId: template.templateId,
          name: values.name,
          description: values.description,
          niche: values.niche,
          timeLimitMinutes: values.timeLimitMinutes,
          maxRetries: values.maxRetries,
          recipes,
        });
      }
      onOpenChange(false);
    } catch {
      // Error shown via toast (mutation.onError handler in production).
    }
  });

  const isSubmitting = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Crear template' : 'Editar template'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Definí el nombre, nicho y recetas de evaluación. El template arranca en estado "Borrador".'
              : 'Modificá los datos del template. Cambios permitidos solo en estado Borrador o Cambios solicitados.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={() => {
            void onSubmit();
          }}
          className="space-y-stack-md"
          noValidate
        >
          <div className="space-y-stack-sm">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              {...register('name')}
              aria-invalid={Boolean(errors.name)}
              placeholder="Senior Frontend Engineer Evaluation"
            />
            {errors.name && <p className="text-body-sm text-status-error">{errors.name.message}</p>}
          </div>

          <div className="space-y-stack-sm">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea
              id="description"
              rows={2}
              {...register('description')}
              aria-invalid={Boolean(errors.description)}
              placeholder="Breve descripción del propósito del template"
            />
            {errors.description && (
              <p className="text-body-sm text-status-error">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-stack-md">
            <div className="space-y-stack-sm">
              <Label htmlFor="niche">Nicho</Label>
              <Select
                value={form.watch('niche')}
                onValueChange={(v) =>
                  form.setValue('niche', v as TemplateFormValues['niche'], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="niche">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="school">Escolar</SelectItem>
                  <SelectItem value="university">Universitario</SelectItem>
                  <SelectItem value="exam_practice">Simulacro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-stack-sm">
              <Label htmlFor="timeLimitMinutes">Duración (min)</Label>
              <Input
                id="timeLimitMinutes"
                type="number"
                {...register('timeLimitMinutes', { valueAsNumber: true })}
                aria-invalid={Boolean(errors.timeLimitMinutes)}
              />
              {errors.timeLimitMinutes && (
                <p className="text-body-sm text-status-error">{errors.timeLimitMinutes.message}</p>
              )}
            </div>
            <div className="space-y-stack-sm">
              <Label htmlFor="maxRetries">Reintentos</Label>
              <Input
                id="maxRetries"
                type="number"
                {...register('maxRetries', { valueAsNumber: true })}
                aria-invalid={Boolean(errors.maxRetries)}
              />
              {errors.maxRetries && (
                <p className="text-body-sm text-status-error">{errors.maxRetries.message}</p>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-stack-sm">
            <div className="flex items-center justify-between">
              <Label>Recetas ({fields.length})</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    competencyName: '',
                    competencyContext: '',
                    qtyMultipleChoice: 1,
                    qtyMultiChoice: 0,
                    difficulty: 'medium',
                    topicsCovered: [],
                  })
                }
                disabled={fields.length >= 20}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Agregar receta
              </Button>
            </div>

            {fields.map((field, idx) => (
              <div
                key={field.id}
                className="space-y-stack-sm rounded-md border border-border bg-surface-container-low p-stack-md"
              >
                <div className="flex items-center justify-between">
                  <p className="text-label-sm text-outline-tv">Receta #{idx + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(idx)}
                    aria-label={`Eliminar receta ${idx + 1}`}
                    disabled={fields.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-status-error" />
                  </Button>
                </div>
                <div className="space-y-stack-sm">
                  <Input
                    placeholder="Nombre de la competencia (ej. React Hooks)"
                    {...register(`recipes.${idx}.competencyName`)}
                    aria-invalid={Boolean(errors.recipes?.[idx]?.competencyName)}
                  />
                  {errors.recipes?.[idx]?.competencyName && (
                    <p className="text-body-sm text-status-error">
                      {errors.recipes[idx]?.competencyName?.message}
                    </p>
                  )}
                </div>
                <div className="space-y-stack-sm">
                  <Textarea
                    rows={3}
                    placeholder="Contexto para la IA (mín. 20 caracteres)"
                    {...register(`recipes.${idx}.competencyContext`)}
                    aria-invalid={Boolean(errors.recipes?.[idx]?.competencyContext)}
                  />
                  {errors.recipes?.[idx]?.competencyContext && (
                    <p className="text-body-sm text-status-error">
                      {errors.recipes[idx]?.competencyContext?.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-stack-sm">
                  <div className="space-y-stack-xs">
                    <Label htmlFor={`recipes.${idx}.difficulty`}>Dificultad</Label>
                    <Select
                      value={form.watch(`recipes.${idx}.difficulty`)}
                      onValueChange={(v) =>
                        form.setValue(
                          `recipes.${idx}.difficulty`,
                          v as TemplateFormValues['recipes'][number]['difficulty'],
                          { shouldValidate: true },
                        )
                      }
                    >
                      <SelectTrigger id={`recipes.${idx}.difficulty`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Fácil</SelectItem>
                        <SelectItem value="medium">Medio</SelectItem>
                        <SelectItem value="hard">Difícil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-stack-xs">
                    <Label htmlFor={`recipes.${idx}.qtyMultipleChoice`}>Única resp.</Label>
                    <Input
                      id={`recipes.${idx}.qtyMultipleChoice`}
                      type="number"
                      {...register(`recipes.${idx}.qtyMultipleChoice`, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-stack-xs">
                    <Label htmlFor={`recipes.${idx}.qtyMultiChoice`}>Múltiple resp.</Label>
                    <Input
                      id={`recipes.${idx}.qtyMultiChoice`}
                      type="number"
                      {...register(`recipes.${idx}.qtyMultiChoice`, { valueAsNumber: true })}
                    />
                  </div>
                </div>
                {errors.recipes?.[idx] && !errors.recipes[idx]?.competencyName && (
                  <p className="text-body-sm text-status-error">
                    {errors.recipes[idx]?.message ?? 'Revisar campos de la receta'}
                  </p>
                )}
              </div>
            ))}
            {typeof errors.recipes?.message === 'string' && (
              <p className="text-body-sm text-status-error">{errors.recipes.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Crear' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

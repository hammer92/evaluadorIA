'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Template } from '@shared/schemas/templates';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { useCreateTemplate, useUpdateTemplate } from '../hooks/use-templates';
import { templateFormSchema, type TemplateFormValues } from '../schemas';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

// =============================================================================
// TemplateForm — formulario reutilizable para crear/editar templates.
// =============================================================================
// Se usa desde las páginas completas /admin/templates/new y
// /admin/templates/edit (en lugar del antiguo modal). Recibe los defaults
// (vacíos en create, precargados en edit), delega en useCreateTemplate /
// useUpdateTemplate, y notifica éxito vía `onSuccess` para que la página
// decida a dónde navegar (volver al listado o al detalle).
// =============================================================================

export function TemplateForm({
  mode,
  template,
  submitLabel,
  onSuccess,
}: {
  mode: 'create' | 'edit';
  template?: Template;
  submitLabel: string;
  onSuccess: () => void;
}): React.JSX.Element {
  const create = useCreateTemplate();
  const update = useUpdateTemplate(template?.templateId ?? '');
  const isEdit = mode === 'edit';

  const defaultValues: TemplateFormValues = useMemo(
    () => ({
      name: template?.name ?? '',
      description: template?.description ?? '',
      niche: template?.niche ?? 'school',
      timeLimitMinutes: template?.timeLimitMinutes ?? 30,
      maxRetries: template?.maxRetries ?? 1,
      passingScore: template?.passingScore ?? 70,
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
    }),
    [template],
  );

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues,
  });

  const { register, handleSubmit, control, formState, setValue, watch } = form;
  const { errors } = formState;
  const { fields, append, remove } = useFieldArray({ control, name: 'recipes' });

  const [submitError, setSubmitError] = useState<string | null>(null);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const recipes = values.recipes.map(({ recipeId, ...rest }) => {
      void recipeId;
      return rest;
    });
    try {
      if (mode === 'create') {
        await create.mutateAsync({
          name: values.name,
          description: values.description,
          niche: values.niche,
          timeLimitMinutes: values.timeLimitMinutes,
          maxRetries: values.maxRetries,
          passingScore: values.passingScore,
          version: 0,
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
          passingScore: values.passingScore,
          recipes,
        });
      }
      onSuccess();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error desconocido al guardar';
      setSubmitError(message);
    }
  });

  const isSubmitting = create.isPending || update.isPending;

  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      className="space-y-stack-lg"
      noValidate
    >
      {submitError && (
        <div
          role="alert"
          className="rounded-tv border border-status-error/30 bg-status-error/5 p-stack-md text-body-sm text-status-error"
        >
          <p className="font-medium">No se pudo guardar el template</p>
          <p className="mt-1 text-on-surface-variant">{submitError}</p>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline-sm">Datos generales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-stack-md md:grid-cols-2">
          <div className="space-y-stack-sm md:col-span-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              {...register('name')}
              aria-invalid={Boolean(errors.name)}
              placeholder="Senior Frontend Engineer Evaluation"
            />
            {errors.name && (
              <p className="text-body-sm text-status-error" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-stack-sm md:col-span-2">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea
              id="description"
              rows={2}
              {...register('description')}
              aria-invalid={Boolean(errors.description)}
              placeholder="Breve descripción del propósito del template"
            />
            {errors.description && (
              <p className="text-body-sm text-status-error" role="alert">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-stack-sm">
            <Label htmlFor="niche">Nicho</Label>
            <Select
              value={watch('niche')}
              onValueChange={(v) =>
                setValue('niche', v as TemplateFormValues['niche'], { shouldValidate: true })
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

          <div className="grid grid-cols-2 gap-stack-md md:grid-cols-3">
            <div className="space-y-stack-sm">
              <Label htmlFor="timeLimitMinutes">Duración (min)</Label>
              <Input
                id="timeLimitMinutes"
                type="number"
                {...register('timeLimitMinutes', { valueAsNumber: true })}
                aria-invalid={Boolean(errors.timeLimitMinutes)}
              />
              {errors.timeLimitMinutes && (
                <p className="text-body-sm text-status-error" role="alert">
                  {errors.timeLimitMinutes.message}
                </p>
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
                <p className="text-body-sm text-status-error" role="alert">
                  {errors.maxRetries.message}
                </p>
              )}
            </div>
            <div className="space-y-stack-sm">
              <Label htmlFor="passingScore">Score de aprobación (%)</Label>
              <Input
                id="passingScore"
                type="number"
                min={0}
                max={100}
                {...register('passingScore', { valueAsNumber: true })}
                aria-invalid={Boolean(errors.passingScore)}
              />
              {errors.passingScore && (
                <p className="text-body-sm text-status-error" role="alert">
                  {errors.passingScore.message}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-headline-sm">Recetas ({fields.length})</CardTitle>
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
        </CardHeader>
        <CardContent className="space-y-stack-md">
          {fields.map((field, idx) => (
            <div
              key={field.id}
              className="space-y-stack-md rounded-md border border-border bg-surface-container-low p-stack-md"
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
                <Label htmlFor={`recipes.${idx}.competencyName`}>Nombre de la competencia</Label>
                <Input
                  id={`recipes.${idx}.competencyName`}
                  placeholder="React Hooks"
                  {...register(`recipes.${idx}.competencyName`)}
                  aria-invalid={Boolean(errors.recipes?.[idx]?.competencyName)}
                />
                {errors.recipes?.[idx]?.competencyName && (
                  <p className="text-body-sm text-status-error" role="alert">
                    {errors.recipes[idx]?.competencyName?.message}
                  </p>
                )}
              </div>

              <div className="space-y-stack-sm">
                <Label htmlFor={`recipes.${idx}.competencyContext`}>
                  Contexto para la IA
                </Label>
                <Textarea
                  id={`recipes.${idx}.competencyContext`}
                  rows={3}
                  placeholder="Mínimo 20 caracteres. Describí el contexto que verá el modelo."
                  {...register(`recipes.${idx}.competencyContext`)}
                  aria-invalid={Boolean(errors.recipes?.[idx]?.competencyContext)}
                />
                {errors.recipes?.[idx]?.competencyContext && (
                  <p className="text-body-sm text-status-error" role="alert">
                    {errors.recipes[idx]?.competencyContext?.message}
                  </p>
                )}
              </div>

              <Separator />

              <div className="grid gap-stack-md md:grid-cols-3">
                <div className="space-y-stack-sm">
                  <Label htmlFor={`recipes.${idx}.difficulty`}>Dificultad</Label>
                  <Select
                    value={watch(`recipes.${idx}.difficulty`)}
                    onValueChange={(v) =>
                      setValue(
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
                <div className="space-y-stack-sm">
                  <Label htmlFor={`recipes.${idx}.qtyMultipleChoice`}>Única respuesta</Label>
                  <Input
                    id={`recipes.${idx}.qtyMultipleChoice`}
                    type="number"
                    min={0}
                    {...register(`recipes.${idx}.qtyMultipleChoice`, { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-stack-sm">
                  <Label htmlFor={`recipes.${idx}.qtyMultiChoice`}>Múltiple respuesta</Label>
                  <Input
                    id={`recipes.${idx}.qtyMultiChoice`}
                    type="number"
                    min={0}
                    {...register(`recipes.${idx}.qtyMultiChoice`, { valueAsNumber: true })}
                  />
                </div>
              </div>
            </div>
          ))}

          {typeof errors.recipes?.message === 'string' && (
            <p className="text-body-sm text-status-error" role="alert">
              {errors.recipes.message}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-stack-sm border-t border-border pt-stack-md">
        <Button asChild variant="ghost" disabled={isSubmitting}>
          <Link href={isEdit && template ? `/admin/templates/detail?templateId=${template.templateId}` : '/admin/templates'}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancelar
          </Link>
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
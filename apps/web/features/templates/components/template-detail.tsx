'use client';

import { DIFFICULTY_LABELS, NICHE_LABELS } from '@shared/schemas/templates';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { NicheBadge } from '@/components/niche-badge';
import { TemplateStatusBadge } from '@/components/template-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRole } from '@/features/auth/components/role-provider';
import { ExpertEditModal } from '@/features/review/components/expert-edit-modal';
import { ReviewDecisionPanel } from '@/features/review/components/review-decision-panel';
import { SubmitForReviewButton } from '@/features/review/components/submit-for-review-button';
import { ReviewHistoryList } from '@/features/templates/components/review-history-list';
import { TemplateActionBar } from '@/features/templates/components/template-action-bar';
import { TemplateFormModal } from '@/features/templates/components/template-form-modal';
import { useReviewHistory, useTemplate } from '@/features/templates/hooks/use-templates';

function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TemplateDetail({ templateId }: { templateId: string }) {
  const { data: template, isLoading, isError, error } = useTemplate(templateId);
  const { data: history } = useReviewHistory(templateId);
  const [editing, setEditing] = useState(false);
  const [expertEditing, setExpertEditing] = useState(false);
  const role = useRole();

  if (isLoading) {
    return (
      <div className="space-y-stack-md">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-tv border border-status-error/30 bg-status-error/5 p-stack-md text-body-md text-status-error">
        Error al cargar el template: {error?.message ?? 'desconocido'}
      </div>
    );
  }

  if (!template) {
    return (
      <div className="rounded-tv border border-border bg-surface-container-lowest p-12 text-center">
        <h3 className="text-headline-sm font-semibold text-navy">Template no encontrado</h3>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/admin/templates">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al listado
          </Link>
        </Button>
      </div>
    );
  }

  const isDeleted = Boolean(template.deletedAt);
  const canEdit =
    !isDeleted &&
    (role === 'admin' ||
      (role === 'recruiter' &&
        (template.status === 'draft' || template.status === 'changes_requested')));
  const canDelete = !isDeleted && role === 'admin';
  const canSubmitForReview =
    !isDeleted &&
    role === 'recruiter' &&
    (template.status === 'draft' || template.status === 'changes_requested');
  const canReview = !isDeleted && role === 'admin' && template.status === 'in_review';

  return (
    <div className="space-y-stack-lg">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/admin/templates">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver al listado
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-stack-md">
          <div className="space-y-stack-sm">
            <div className="flex items-center gap-stack-sm">
              <h1 className="font-hanken text-display-lg text-on-surface">{template.name}</h1>
              <TemplateStatusBadge status={template.status} />
              {isDeleted && <span className="text-label-sm text-status-error">(eliminado)</span>}
            </div>
            {template.description && (
              <p className="text-body-lg text-on-surface-variant">{template.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-stack-md text-body-sm text-on-surface-variant">
              <NicheBadge niche={template.niche} />
              <span>•</span>
              <span>Duración: {template.timeLimitMinutes} min</span>
              <span>•</span>
              <span>Reintentos: {template.maxRetries}</span>
              <span>•</span>
              <span>Versión {template.createdAt && formatDate(template.createdAt)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-stack-sm">
            <TemplateActionBar
              template={template}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={() => setEditing(true)}
            />
            {canSubmitForReview && <SubmitForReviewButton templateId={template.templateId} />}
          </div>
        </div>
      </div>

      {canReview && (
        <ReviewDecisionPanel
          templateId={template.templateId}
          onEditAndApprove={() => setExpertEditing(true)}
        />
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Vista general</TabsTrigger>
          <TabsTrigger value="content">Contenido ({template.recipes.length})</TabsTrigger>
          <TabsTrigger value="history">Historial ({history?.events.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-stack-md">
          <Card>
            <CardHeader>
              <CardTitle className="text-headline-sm">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-stack-sm text-body-md">
              <div className="grid grid-cols-2 gap-stack-md">
                <div>
                  <p className="text-label-sm text-outline-tv">Creado por</p>
                  <p className="text-on-surface">{template.createdBy}</p>
                </div>
                <div>
                  <p className="text-label-sm text-outline-tv">Fecha de creación</p>
                  <p className="text-on-surface">{formatDate(template.createdAt)}</p>
                </div>
                <div>
                  <p className="text-label-sm text-outline-tv">Última actualización</p>
                  <p className="text-on-surface">{formatDate(template.updatedAt)}</p>
                </div>
                <div>
                  <p className="text-label-sm text-outline-tv">Nicho</p>
                  <p className="text-on-surface">{NICHE_LABELS[template.niche]}</p>
                </div>
                {template.approvedBy && (
                  <div>
                    <p className="text-label-sm text-outline-tv">Aprobado por</p>
                    <p className="text-on-surface">{template.approvedBy}</p>
                  </div>
                )}
                {template.approvedAt && (
                  <div>
                    <p className="text-label-sm text-outline-tv">Fecha de aprobación</p>
                    <p className="text-on-surface">{formatDate(template.approvedAt)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-stack-md">
          {template.recipes.map((recipe, idx) => (
            <Card key={recipe.recipeId}>
              <CardHeader>
                <CardTitle className="flex items-center gap-stack-sm text-headline-sm">
                  <span className="text-outline-tv">#{idx + 1}</span>
                  {recipe.competencyName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-stack-md">
                <div>
                  <p className="text-label-sm text-outline-tv">Contexto para la IA</p>
                  <p className="mt-1 text-body-md text-on-surface">{recipe.competencyContext}</p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-stack-md text-body-md md:grid-cols-4">
                  <div>
                    <p className="text-label-sm text-outline-tv">Dificultad</p>
                    <p className="text-on-surface">{DIFFICULTY_LABELS[recipe.difficulty]}</p>
                  </div>
                  <div>
                    <p className="text-label-sm text-outline-tv">Única respuesta</p>
                    <p className="text-on-surface">{recipe.qtyMultipleChoice}</p>
                  </div>
                  <div>
                    <p className="text-label-sm text-outline-tv">Múltiple respuesta</p>
                    <p className="text-on-surface">{recipe.qtyMultiChoice}</p>
                  </div>
                  <div>
                    <p className="text-label-sm text-outline-tv">Total preguntas</p>
                    <p className="text-on-surface font-medium">
                      {recipe.qtyMultipleChoice + recipe.qtyMultiChoice}
                    </p>
                  </div>
                </div>
                {recipe.topicsCovered.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-label-sm text-outline-tv">Tópicos cubiertos</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {recipe.topicsCovered.map((topic) => (
                          <span
                            key={topic}
                            className="inline-flex items-center rounded-md bg-surface-container-low px-2 py-0.5 text-body-sm text-on-surface"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="history">
          <ReviewHistoryList events={history?.events ?? []} loading={!history} />
        </TabsContent>
      </Tabs>

      <TemplateFormModal
        open={editing}
        onOpenChange={(o) => !o && setEditing(false)}
        mode="edit"
        template={template}
      />
      {canReview && (
        <ExpertEditModal
          template={template}
          open={expertEditing}
          onOpenChange={(o) => !o && setExpertEditing(false)}
        />
      )}
    </div>
  );
}

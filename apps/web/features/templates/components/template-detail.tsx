'use client';

import { DIFFICULTY_LABELS, NICHE_LABELS } from '@shared/schemas/templates';
import { getAvailableTransitions } from '@shared/state-machines/templates';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Edit,
  FileText,
  History,
  Hourglass,
  Info,
  ListChecks,
  Lock,
  Sparkles,
  Target,
  Trash2,
  User,
  type LucideIcon,
} from 'lucide-react';
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
import { PreviewPanel } from '@/features/templates/components/preview-panel';
import { ReviewHistoryList } from '@/features/templates/components/review-history-list';
import { useReviewHistory, useTemplate } from '@/features/templates/hooks/use-templates';


function formatDate(value: string | Date | null | undefined): string {
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

type StatusKey = 'draft' | 'in_review' | 'changes_requested' | 'approved' | 'rejected';

const REVIEW_FLOW: { key: StatusKey; label: string }[] = [
  { key: 'draft', label: 'Borrador' },
  { key: 'in_review', label: 'Enviado' },
  { key: 'changes_requested', label: 'En revisión' },
  { key: 'approved', label: 'Decisión' },
];

function flowStateIndex(status: StatusKey): { index: number; isRejected: boolean } {
  if (status === 'rejected') return { index: 3, isRejected: true };
  if (status === 'approved') return { index: 3, isRejected: false };
  if (status === 'in_review' || status === 'changes_requested') return { index: 2, isRejected: false };
  return { index: 0, isRejected: false };
}

function TemplateDetailSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-stack-lg" aria-busy="true" aria-label="Cargando template">
      <div className="flex flex-wrap items-center justify-between gap-stack-md">
        <Skeleton className="h-5 w-72" />
        <div className="flex gap-stack-sm">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="space-y-stack-sm">
        <Skeleton className="h-9 w-96 max-w-full" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 space-y-stack-md lg:col-span-8">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="col-span-12 space-y-stack-md lg:col-span-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function TemplateDetail({ templateId }: { templateId: string }) {
  const { data: template, isLoading, isError, error } = useTemplate(templateId);
  const { data: historyEvents } = useReviewHistory(templateId);
  const [expertEditing, setExpertEditing] = useState(false);
  const [previewAcknowledged, setPreviewAcknowledged] = useState(false);
  const role = useRole();

  if (isLoading) return <TemplateDetailSkeleton />;

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-tv border border-status-error/30 bg-status-error/5 p-stack-md text-body-md text-status-error"
      >
        Error al cargar el template: {error?.message ?? 'desconocido'}
      </div>
    );
  }

  if (!template) {
    return (
      <div className="rounded-tv border border-border-standard bg-surface-container-lowest p-12 text-center">
        <h3 className="text-headline-sm font-semibold text-navy">Template no encontrado</h3>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          El template que buscás no existe o fue eliminado.
        </p>
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
  // canSubmitForReview se calcula desde el state machine (source of truth) en vez
  // de hardcodear role === 'admin' acá — así si el state machine cambia, el UI
  // sigue sincronizado (mismo path que apps/functions/src/v1/templates/transition-template.ts).
  const canSubmitForReview = (() => {
    if (isDeleted) return false;
    if (!role) return false;
    const available = getAvailableTransitions(template.status, role);
    return available.some((t) => t.to === 'in_review');
  })();
  const canReview = (() => {
    if (isDeleted) return false;
    if (!role) return false;
    if (template.status !== 'in_review') return false;
    const available = getAvailableTransitions(template.status, role);
    return available.length > 0;
  })();

  const status = template.status;
  // Defensive: el cache del detalle puede haber sido poblado con una versión
  // parcial del Template (ej. durante transitions concurrentes o setQueryData
  // con respuesta incompleta del servidor). `recipes` debería ser siempre un
  // array por el zod schema, pero si llegara undefined, defendemos con `[]`
  // para no crashear el render.
  const recipes = template.recipes ?? [];
  const totalQuestions = recipes.reduce(
    (sum, r) => sum + r.qtyMultipleChoice + r.qtyMultiChoice,
    0,
  );
  const totalMultipleChoice = recipes.reduce((sum, r) => sum + r.qtyMultipleChoice, 0);
  const totalMultiChoice = recipes.reduce((sum, r) => sum + r.qtyMultiChoice, 0);
  const recipesCount = recipes.length;
  const historyCount = historyEvents?.length ?? 0;
  const allTopics = Array.from(new Set(recipes.flatMap((r) => r.topicsCovered)));
  const { index: flowIndex, isRejected } = flowStateIndex(status);
  const lastReview = historyEvents?.[0];

  return (
    <div className="space-y-stack-lg">
      {/* Top app bar */}
      <div className="flex flex-wrap items-center justify-between gap-stack-md">
        <div className="flex items-center gap-stack-md">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-on-surface-variant transition-colors hover:bg-navy/5 hover:text-navy"
          >
            <Link href="/admin/templates" aria-label="Volver al listado">
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-body-sm">
            <Link
              href="/admin/templates"
              className="text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Templates
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-outline-tv" aria-hidden />
            <span className="font-bold text-on-surface">{template.name}</span>
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-stack-sm">
          {canEdit && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/templates/edit?templateId=${template.templateId}`}>
                <Edit className="mr-1.5 h-4 w-4" aria-hidden />
                Editar
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" disabled aria-label="Duplicar (no disponible)">
            <Copy className="mr-1.5 h-4 w-4" aria-hidden />
            Duplicar
          </Button>
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="border-status-error text-status-error hover:bg-status-error/5"
              disabled={isDeleted}
            >
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
              Eliminar
            </Button>
          )}
          {canEdit && (
            <Button asChild variant="primary" size="default" className="font-bold">
              <Link href={`/admin/templates/edit?templateId=${template.templateId}`}>
                Editar template
              </Link>
            </Button>
          )}
          {canSubmitForReview && <SubmitForReviewButton templateId={template.templateId} />}
        </div>
      </div>

      {/* Header */}
      <section className="space-y-stack-sm">
        <div className="flex flex-wrap items-center gap-stack-sm">
          <h1 className="font-hanken text-display-lg tracking-tight text-on-surface">
            {template.name}
          </h1>
          <TemplateStatusBadge status={template.status} />
          {isDeleted && (
            <span className="inline-flex items-center gap-1 rounded-md bg-status-error/10 px-2 py-0.5 text-label-sm text-status-error">
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Eliminado
            </span>
          )}
        </div>
        {template.description && (
          <p className="max-w-2xl text-body-lg text-on-surface-variant">{template.description}</p>
        )}

        <div className="mt-stack-md flex flex-wrap items-center gap-x-stack-lg gap-y-stack-sm border-t border-border-standard pt-stack-md text-body-sm text-on-surface-variant">
          <MetaItem icon={User} label="Creado por" value={template.createdBy} />
          <MetaItem icon={Calendar} label="Fecha" value={formatDate(template.createdAt)} />
          <MetaItem icon={Clock} label="Actualizado" value={formatDate(template.updatedAt)} />
          <MetaItem icon={History} label="Versión" value={`v${template.version ?? 0}`} />
          <MetaItem icon={ListChecks} label="Recetas" value={recipesCount} />
          <MetaItem
            icon={Target}
            label="Score de aprobación"
            value={`${template.passingScore ?? 70}%`}
          />
        </div>
      </section>

      <PreviewPanel
        templateId={template.templateId}
        requireAcknowledgement={canReview}
        acknowledged={previewAcknowledged}
        onAcknowledgedChange={setPreviewAcknowledged}
      />

      {canReview && (
        <ReviewDecisionPanel
          templateId={template.templateId}
          onEditAndApprove={() => setExpertEditing(true)}
          disabled={!previewAcknowledged}
        />
      )}

      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Vista general</TabsTrigger>
          <TabsTrigger value="content">Contenido ({recipesCount})</TabsTrigger>
          <TabsTrigger value="history">Historial ({historyCount})</TabsTrigger>
        </TabsList>

        <div className="grid grid-cols-12 gap-gutter">
          <div className="col-span-12 space-y-stack-md lg:col-span-8">
            <TabsContent value="overview" className="mt-stack-lg space-y-stack-md">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-navy">
                    <span>Descripción del template</span>
                    <Info className="h-5 w-5 text-on-surface-variant" aria-hidden />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-stack-md">
                  <p className="text-body-md leading-relaxed text-on-surface-variant">
                    {template.description ||
                      'Este template no tiene una descripción definida todavía.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <NicheBadge niche={template.niche} />
                    {allTopics.slice(0, 6).map((topic) => (
                      <span
                        key={topic}
                        className="inline-flex items-center rounded-lg border border-border-standard bg-surface-subtle px-3 py-1 text-label-sm font-semibold text-on-surface"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-navy">
                    <ListChecks className="h-5 w-5 text-brand-secondary" aria-hidden />
                    Criterios de evaluación
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recipesCount === 0 ? (
                    <p className="text-body-md text-on-surface-variant">
                      Este template no tiene recetas definidas.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border-standard">
                      {recipes.map((recipe) => (
                        <li
                          key={recipe.recipeId}
                          className="flex items-start gap-stack-md py-stack-md first:pt-0 last:pb-0"
                        >
                          <span
                            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-status-info/10 text-status-info"
                            aria-hidden
                          >
                            <Check className="h-4 w-4" strokeWidth={3} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-on-surface">{recipe.competencyName}</p>
                            <p className="mt-0.5 text-body-sm text-on-surface-variant">
                              {DIFFICULTY_LABELS[recipe.difficulty]} ·{' '}
                              {recipe.qtyMultipleChoice + recipe.qtyMultiChoice} preguntas
                              {recipe.topicsCovered.length > 0 &&
                                ` · ${recipe.topicsCovered.length} tópico${
                                  recipe.topicsCovered.length === 1 ? '' : 's'
                                }`}
                            </p>
                          </div>
                          <span className="shrink-0 font-hanken text-headline-sm text-navy tabular-nums">
                            {recipe.qtyMultipleChoice + recipe.qtyMultiChoice}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="content" className="mt-stack-lg space-y-stack-md">
              {canEdit && (
                <div className="flex flex-wrap items-center justify-between gap-stack-sm rounded-tv border border-dashed border-brand-secondary/40 bg-brand-secondary/5 px-stack-md py-stack-sm">
                  <div className="flex items-center gap-stack-sm">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-secondary/15 text-brand-secondary"
                      aria-hidden
                    >
                      <Edit className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-body-sm font-medium text-on-surface">
                        Gestioná el contenido de las recetas
                      </p>
                      <p className="text-label-sm text-on-surface-variant">
                        Agregá, editá o eliminá competencias y sus preguntas.
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="primary" size="sm" className="font-bold">
                    <Link
                      href={`/admin/templates/edit?templateId=${template.templateId}`}
                    >
                      <Edit className="mr-1.5 h-4 w-4" aria-hidden />
                      Editar contenido
                    </Link>
                  </Button>
                </div>
              )}

              {recipesCount === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center gap-stack-md py-stack-lg text-center">
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-on-surface-variant"
                      aria-hidden
                    >
                      <FileText className="h-6 w-6" />
                    </span>
                    <div className="space-y-stack-xs">
                      <h3 className="text-headline-sm text-on-surface">Sin recetas</h3>
                      <p className="max-w-sm text-body-sm text-on-surface-variant">
                        Este template todavía no tiene recetas definidas.
                      </p>
                    </div>
                    {canEdit && (
                      <Button asChild variant="primary" size="sm" className="mt-stack-sm font-bold">
                        <Link
                          href={`/admin/templates/edit?templateId=${template.templateId}`}
                        >
                          <Edit className="mr-1.5 h-4 w-4" aria-hidden />
                          Agregar primera receta
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                recipes.map((recipe, idx) => (
                  <Card
                    key={recipe.recipeId}
                    className="transition-shadow hover:shadow-md motion-reduce:transition-none"
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-stack-sm text-headline-sm text-navy">
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-subtle text-label-sm font-bold text-navy"
                          aria-hidden
                        >
                          {idx + 1}
                        </span>
                        <span>{recipe.competencyName}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-stack-md">
                      <div>
                        <p className="text-label-sm text-on-surface-variant">Contexto para la IA</p>
                        <p className="mt-1 whitespace-pre-line text-body-md leading-relaxed text-on-surface">
                          {recipe.competencyContext}
                        </p>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-stack-md text-body-md md:grid-cols-4">
                        <Pair label="Dificultad" value={DIFFICULTY_LABELS[recipe.difficulty]} />
                        <Pair label="Única respuesta" value={`${recipe.qtyMultipleChoice}`} />
                        <Pair label="Múltiple respuesta" value={`${recipe.qtyMultiChoice}`} />
                        <Pair
                          label="Total"
                          value={
                            <span className="font-hanken text-headline-sm text-navy tabular-nums">
                              {recipe.qtyMultipleChoice + recipe.qtyMultiChoice}
                            </span>
                          }
                        />
                      </div>
                      {recipe.topicsCovered.length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-label-sm text-on-surface-variant">
                              Tópicos cubiertos
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {recipe.topicsCovered.map((topic) => (
                                <span
                                  key={topic}
                                  className="inline-flex items-center rounded-md border border-border-standard bg-surface-subtle px-2 py-0.5 text-body-sm text-on-surface"
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
                ))
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-stack-lg">
              <ReviewHistoryList events={historyEvents ?? []} loading={!historyEvents} />
            </TabsContent>
          </div>

          {/* Sidebar — visible on all tabs */}
          <aside className="col-span-12 space-y-stack-md lg:col-span-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-navy">Estado de revisión</CardTitle>
              </CardHeader>
              <CardContent className="space-y-stack-md">
                <ol
                  className="relative flex items-start justify-between px-2"
                  aria-label="Flujo de revisión"
                >
                  <span
                    className="absolute left-4 right-4 top-3 h-0.5 bg-surface-container"
                    aria-hidden
                  />
                  {REVIEW_FLOW.map((step, i) => {
                    const reached = !isRejected && i <= flowIndex;
                    const isCurrent = !isRejected && i === flowIndex;
                    return (
                      <li
                        key={step.key}
                        className="relative z-10 flex flex-col items-center gap-2"
                        aria-current={isCurrent ? 'step' : undefined}
                      >
                        <span
                          className={
                            isCurrent
                              ? 'flex h-8 w-8 items-center justify-center rounded-full border-2 border-status-warning bg-status-warning/10 text-status-warning -mt-1'
                              : reached
                                ? 'flex h-6 w-6 items-center justify-center rounded-full bg-status-success text-white'
                                : 'flex h-6 w-6 items-center justify-center rounded-full bg-surface-container text-on-surface-variant'
                          }
                          aria-hidden
                        >
                        {isCurrent ? (
                          <Hourglass className="h-4 w-4 motion-safe:animate-pulse" />
                        ) : reached ? (
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          ) : (
                            <Lock className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <span
                          className={
                            'text-[10px] font-bold uppercase ' +
                            (isCurrent
                              ? 'text-status-warning'
                              : reached
                                ? 'text-on-surface'
                                : 'text-on-surface-variant')
                          }
                        >
                          {step.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {isRejected && (
                  <div className="flex items-center gap-2 rounded-md bg-status-error/10 px-stack-sm py-stack-xs text-body-sm text-status-error">
                    <Info className="h-4 w-4" aria-hidden />
                    Este template fue rechazado.
                  </div>
                )}
                <Separator />
                <dl className="grid grid-cols-3 gap-stack-md border-t border-border-standard pt-stack-md text-center">
                  <SidebarStat label="Recetas" value={recipesCount} />
                  <SidebarStat
                    label="Preguntas"
                    value={totalQuestions}
                    divider="middle"
                  />
                  <SidebarStat label="Duración" value={`${template.timeLimitMinutes}m`} />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-navy">
                  <span>Actividad reciente</span>
                  {historyCount > 0 && (
                    <span className="text-label-sm font-bold text-status-info">
                      {historyCount} eventos
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historyCount === 0 ? (
                  <p className="text-body-sm text-on-surface-variant">
                    Aún no hay eventos de revisión registrados.
                  </p>
                ) : (
                  <div className="space-y-stack-md">
                    <div className="flex items-start gap-stack-sm">
                      <span
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-status-success/10 text-status-success"
                        aria-hidden
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-body-sm font-bold text-on-surface">
                          {lastReview?.actorName ?? 'Sistema'}
                        </p>
                        <p className="text-label-sm text-on-surface-variant">
                          {lastReview?.action ?? 'created'} · {formatDate(lastReview?.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="relative overflow-hidden rounded-xl bg-navy p-stack-md text-on-surface-variant shadow-tv-card">
              <span
                className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand-secondary/10 blur-2xl"
                aria-hidden
              />
              <div className="relative flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand-secondary" aria-hidden />
                <h4 className="text-body-sm font-bold text-white">Resumen</h4>
              </div>
              <p className="relative mt-stack-sm text-label-sm leading-relaxed text-on-primary-container">
                {recipesCount} {recipesCount === 1 ? 'competencia' : 'competencias'} ·{' '}
                {totalMultipleChoice} preguntas de única respuesta · {totalMultiChoice} de múltiple
                respuesta.
              </p>
              <div className="relative mt-stack-md grid grid-cols-2 gap-stack-md border-t border-on-primary-fixed-variant/30 pt-stack-md text-label-sm">
                <Pair label="Nicho" value={NICHE_LABELS[template.niche]} dark />
                <Pair label="Reintentos" value={`${template.maxRetries}`} dark />
                <Pair
                  label="Score aprobación"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5 text-brand-secondary" aria-hidden />
                      {template.passingScore ?? 70}%
                    </span>
                  }
                  dark
                />
                <Pair
                  label="Versión"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5 text-brand-secondary" aria-hidden />
                      v{template.version ?? 0}
                    </span>
                  }
                  dark
                />
              </div>
            </div>
          </aside>
        </div>
      </Tabs>

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

/* ---------- Lightweight presentational helpers ---------- */

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="h-4 w-4 text-on-surface-variant" aria-hidden />
      <span>
        {label} <strong className="font-semibold text-on-surface">{value}</strong>
      </span>
    </span>
  );
}

function Pair({
  label,
  value,
  dark = false,
}: {
  label: string;
  value: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className={'text-label-sm ' + (dark ? 'text-outline-tv' : 'text-on-surface-variant')}>
        {label}
      </p>
      <p className={'text-body-md ' + (dark ? 'text-white' : 'text-on-surface')}>{value}</p>
    </div>
  );
}

function SidebarStat({
  label,
  value,
  divider,
}: {
  label: string;
  value: React.ReactNode;
  divider?: 'middle';
}) {
  return (
    <div
      className={
        'text-center' +
        (divider === 'middle' ? ' border-x border-border-standard' : '')
      }
    >
      <dt className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </dt>
      <dd className="font-hanken text-display-lg text-on-surface">{value}</dd>
    </div>
  );
}

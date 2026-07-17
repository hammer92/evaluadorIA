'use client';

import { Minus, Plus, RotateCcw, Save, Search } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

interface MasteryLevel {
  id: string;
  name: string;
  rangeMin: number;
  rangeMax: number;
  description: string;
}

const DEFAULT_LEVELS: MasteryLevel[] = [
  {
    id: 'junior',
    name: 'Junior',
    rangeMin: 0,
    rangeMax: 40,
    description: 'Capacidad básica de ejecución con supervisión constante.',
  },
  {
    id: 'mid',
    name: 'Mid-Level',
    rangeMin: 61,
    rangeMax: 70,
    description: 'Autonomía funcional en tareas de complejidad media.',
  },
  {
    id: 'senior',
    name: 'Senior',
    rangeMin: 71,
    rangeMax: 90,
    description: 'Liderazgo técnico y resolución de problemas complejos.',
  },
  {
    id: 'tech-lead',
    name: 'Tech Lead',
    rangeMin: 91,
    rangeMax: 100,
    description: 'Visión arquitectónica y optimización de procesos globales.',
  },
];

interface DefaultWeight {
  id: string;
  label: string;
  value: number;
  hint: string;
}

const DEFAULT_WEIGHTS: DefaultWeight[] = [
  {
    id: 'code',
    label: 'Desafíos de Código',
    value: 50,
    hint: 'La suma total de pesos debe ser siempre 100% para evitar conflictos de criterios válidos.',
  },
  {
    id: 'multiple',
    label: 'Opción Múltiple',
    value: 30,
    hint: '',
  },
  {
    id: 'open',
    label: 'Preguntas Abiertas',
    value: 20,
    hint: '',
  },
];

const AI_MODELS = [
  'GPT-4o (Standard Technical)',
  'GPT-4 Turbo (Analytical)',
  'Claude 3.5 Sonnet',
  'Gemini 1.5 Pro',
] as const;

const FOCUS_LEVELS = ['Baja', 'Media', 'Alta'] as const;

const RETENTION_OPTIONS = [30, 60, 90, 365] as const;

export function GlobalSettingsView(): React.JSX.Element {
  const [levels, setLevels] = useState<MasteryLevel[]>(DEFAULT_LEVELS);
  const [weights, setWeights] = useState<DefaultWeight[]>(DEFAULT_WEIGHTS);
  const [verifierModel, setVerifierModel] = useState<(typeof AI_MODELS)[number]>(AI_MODELS[0]);
  const [reportModel, setReportModel] = useState<(typeof AI_MODELS)[number]>(AI_MODELS[1]);
  const [temperatureCreative, setTemperatureCreative] = useState(0.2);
  const [temperatureRigorous, setTemperatureRigorous] = useState(0.7);
  const [proactiveQuestions, setProactiveQuestions] = useState(true);
  const [focusLevel, setFocusLevel] = useState<(typeof FOCUS_LEVELS)[number]>('Media');
  const [retries, setRetries] = useState(2);
  const [retention, setRetention] = useState<(typeof RETENTION_OPTIONS)[number]>(60);
  const [externalAIDetection, setExternalAIDetection] = useState(true);
  const [dirty, setDirty] = useState(false);

  const totalWeight = weights.reduce((acc, w) => acc + w.value, 0);
  const weightValid = totalWeight === 100;

  const markDirty = (): void => setDirty(true);

  const reset = (): void => {
    setLevels(DEFAULT_LEVELS);
    setWeights(DEFAULT_WEIGHTS);
    setVerifierModel(AI_MODELS[0]);
    setReportModel(AI_MODELS[1]);
    setTemperatureCreative(0.2);
    setTemperatureRigorous(0.7);
    setProactiveQuestions(true);
    setFocusLevel('Media');
    setRetries(2);
    setRetention(60);
    setExternalAIDetection(true);
    setDirty(false);
  };

  const save = (): void => {
    setDirty(false);
  };

  return (
    <div className="space-y-stack-lg">
      <header className="flex flex-wrap items-end justify-between gap-stack-md">
        <div className="space-y-stack-sm">
          <h1 className="font-hanken text-display-lg text-on-surface">
            Configuración Global del Sistema
          </h1>
          <p className="text-body-lg text-on-surface-variant">
            Gestión centralizada de parámetros maestros, agentes de IA y políticas de proctoring.
          </p>
        </div>
        <div className="flex items-center gap-stack-sm">
          <button
            type="button"
            onClick={reset}
            disabled={!dirty}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-md border border-border-standard bg-white px-stack-md text-body-md font-medium text-on-surface transition-colors',
              dirty ? 'hover:bg-surface-subtle' : 'cursor-not-allowed opacity-50',
            )}
          >
            <RotateCcw size={16} />
            Descartar Cambios
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || !weightValid}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-md bg-brand-secondary px-stack-md text-body-md font-bold text-on-secondary-container transition-colors shadow-tv-card',
              dirty && weightValid
                ? 'hover:bg-brand-secondary/90'
                : 'cursor-not-allowed opacity-50',
            )}
          >
            <Save size={16} />
            Guardar Configuración
          </button>
        </div>
      </header>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline-tv" />
        <input
          type="search"
          placeholder="Buscar parámetros…"
          aria-label="Buscar parámetros"
          className="h-10 w-full rounded-md border border-border-standard bg-white pl-9 pr-3 text-body-md text-on-surface transition-colors placeholder:text-outline-tv focus-visible:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-stack-md lg:grid-cols-2">
        <MasteryLevelsCard
          levels={levels}
          onChange={(next) => {
            setLevels(next);
            markDirty();
          }}
        />
        <DefaultWeightsCard
          weights={weights}
          total={totalWeight}
          valid={weightValid}
          onChange={(next) => {
            setWeights(next);
            markDirty();
          }}
        />
        <AIAgentsCard
          verifierModel={verifierModel}
          reportModel={reportModel}
          temperatureCreative={temperatureCreative}
          temperatureRigorous={temperatureRigorous}
          proactiveQuestions={proactiveQuestions}
          onVerifierModelChange={(m) => {
            setVerifierModel(m);
            markDirty();
          }}
          onReportModelChange={(m) => {
            setReportModel(m);
            markDirty();
          }}
          onTemperatureCreativeChange={(v) => {
            setTemperatureCreative(v);
            markDirty();
          }}
          onTemperatureRigorousChange={(v) => {
            setTemperatureRigorous(v);
            markDirty();
          }}
          onProactiveQuestionsChange={(v) => {
            setProactiveQuestions(v);
            markDirty();
          }}
        />
        <SecurityProctoringCard
          focusLevel={focusLevel}
          retries={retries}
          retention={retention}
          externalAIDetection={externalAIDetection}
          onFocusLevelChange={(v) => {
            setFocusLevel(v);
            markDirty();
          }}
          onRetriesChange={(v) => {
            setRetries(v);
            markDirty();
          }}
          onRetentionChange={(v) => {
            setRetention(v);
            markDirty();
          }}
          onExternalAIDetectionChange={(v) => {
            setExternalAIDetection(v);
            markDirty();
          }}
        />
      </div>

      <MetricsFooter />
    </div>
  );
}

function CardShell({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="rounded-tv border border-border-standard bg-white shadow-tv-card">
      <header className="flex items-center gap-2 border-b border-border-standard px-stack-lg py-stack-md">
        <span aria-hidden className="text-navy">
          {icon}
        </span>
        <h2 className="font-hanken text-headline-md text-on-surface">{title}</h2>
      </header>
      <div className="p-stack-lg">{children}</div>
    </section>
  );
}

function MasteryLevelsCard({
  levels,
  onChange,
}: {
  levels: MasteryLevel[];
  onChange: (next: MasteryLevel[]) => void;
}): React.JSX.Element {
  return (
    <CardShell title="Niveles de Maestría y Rangos" icon={<StarIcon />}>
      <div className="overflow-hidden rounded-md border border-border-standard">
        <table className="w-full text-left text-body-md">
          <thead className="bg-surface-subtle text-label-sm uppercase tracking-wider text-outline-tv">
            <tr>
              <th className="px-stack-md py-stack-sm font-medium">Nivel</th>
              <th className="px-stack-md py-stack-sm font-medium">Rango Score (%)</th>
              <th className="px-stack-md py-stack-sm font-medium">Descripción del Informe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-standard">
            {levels.map((lvl, idx) => (
              <tr key={lvl.id} className="align-top">
                <td className="px-stack-md py-stack-md font-medium text-on-surface">{lvl.name}</td>
                <td className="px-stack-md py-stack-md">
                  <div className="flex items-center gap-stack-sm">
                    <NumberStepper
                      value={lvl.rangeMin}
                      onChange={(v) => {
                        const next = levels.slice();
                        const min = Math.max(0, Math.min(v, next[idx]!.rangeMax));
                        next[idx] = { ...lvl, rangeMin: min };
                        onChange(next);
                      }}
                    />
                    <span className="text-outline-tv">→</span>
                    <NumberStepper
                      value={lvl.rangeMax}
                      onChange={(v) => {
                        const next = levels.slice();
                        const max = Math.max(next[idx]!.rangeMin, Math.min(v, 100));
                        next[idx] = { ...lvl, rangeMax: max };
                        onChange(next);
                      }}
                    />
                  </div>
                </td>
                <td className="px-stack-md py-stack-md text-on-surface-variant">
                  {lvl.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardShell>
  );
}

function DefaultWeightsCard({
  weights,
  total,
  valid,
  onChange,
}: {
  weights: DefaultWeight[];
  total: number;
  valid: boolean;
  onChange: (next: DefaultWeight[]) => void;
}): React.JSX.Element {
  return (
    <CardShell title="Pesos por Defecto" icon={<ScaleIcon />}>
      <p className="mb-stack-md text-body-md text-on-surface-variant">
        Determina la importancia relativa de cada categoría en la puntuación final.
      </p>
      <div className="space-y-stack-md">
        {weights.map((w, idx) => (
          <div key={w.id} className="space-y-stack-sm">
            <div className="flex items-center justify-between">
              <label
                htmlFor={`weight-${w.id}`}
                className="text-body-md font-medium text-on-surface"
              >
                {w.label}
              </label>
              <span className="font-jetbrains text-body-md font-bold text-navy">{w.value}%</span>
            </div>
            <input
              id={`weight-${w.id}`}
              type="range"
              min={0}
              max={100}
              value={w.value}
              onChange={(e) => {
                const next = weights.slice();
                next[idx] = { ...w, value: Number(e.target.value) };
                onChange(next);
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-subtle accent-brand-secondary"
            />
          </div>
        ))}
        {weights.some((w) => w.hint) && (
          <div
            className={cn(
              'flex items-start gap-2 rounded-md border p-stack-md text-body-md',
              valid
                ? 'border-status-info/30 bg-status-info/5 text-status-info'
                : 'border-status-error/30 bg-status-error/5 text-status-error',
            )}
          >
            <AlertIcon />
            <span>
              {valid
                ? 'La suma total de pesos debe ser siempre 100% para evitar conflictos de criterios válidos.'
                : `La suma actual es ${total}% (debe ser 100%).`}
            </span>
          </div>
        )}
      </div>
    </CardShell>
  );
}

function AIAgentsCard({
  verifierModel,
  reportModel,
  temperatureCreative,
  temperatureRigorous,
  proactiveQuestions,
  onVerifierModelChange,
  onReportModelChange,
  onTemperatureCreativeChange,
  onTemperatureRigorousChange,
  onProactiveQuestionsChange,
}: {
  verifierModel: (typeof AI_MODELS)[number];
  reportModel: (typeof AI_MODELS)[number];
  temperatureCreative: number;
  temperatureRigorous: number;
  proactiveQuestions: boolean;
  onVerifierModelChange: (m: (typeof AI_MODELS)[number]) => void;
  onReportModelChange: (m: (typeof AI_MODELS)[number]) => void;
  onTemperatureCreativeChange: (v: number) => void;
  onTemperatureRigorousChange: (v: number) => void;
  onProactiveQuestionsChange: (v: boolean) => void;
}): React.JSX.Element {
  return (
    <CardShell title="Configuración de Agentes IA" icon={<BrainIcon />}>
      <div className="space-y-stack-md">
        <div className="grid grid-cols-1 gap-stack-md sm:grid-cols-2">
          <ModelSelect
            id="verifier-model"
            label="Agente Verificador"
            value={verifierModel}
            onChange={onVerifierModelChange}
          />
          <ModelSelect
            id="report-model"
            label="Agente de Informe"
            value={reportModel}
            onChange={onReportModelChange}
          />
        </div>
        <div className="grid grid-cols-1 gap-stack-md sm:grid-cols-2">
          <TempSlider
            id="temp-creative"
            label="Temperatura (Creatividad)"
            value={temperatureCreative}
            onChange={onTemperatureCreativeChange}
            tone="info"
          />
          <TempSlider
            id="temp-rigorous"
            label="Temperatura (Rigor)"
            value={temperatureRigorous}
            onChange={onTemperatureRigorousChange}
            tone="warning"
          />
        </div>
        <ToggleRow
          id="proactive"
          label="Generación Proactiva de Preguntas"
          description="Permite a la IA sugerir variaciones de preguntas durante la creación de plantillas."
          value={proactiveQuestions}
          onChange={onProactiveQuestionsChange}
        />
      </div>
    </CardShell>
  );
}

function SecurityProctoringCard({
  focusLevel,
  retries,
  retention,
  externalAIDetection,
  onFocusLevelChange,
  onRetriesChange,
  onRetentionChange,
  onExternalAIDetectionChange,
}: {
  focusLevel: (typeof FOCUS_LEVELS)[number];
  retries: number;
  retention: (typeof RETENTION_OPTIONS)[number];
  externalAIDetection: boolean;
  onFocusLevelChange: (v: (typeof FOCUS_LEVELS)[number]) => void;
  onRetriesChange: (v: number) => void;
  onRetentionChange: (v: (typeof RETENTION_OPTIONS)[number]) => void;
  onExternalAIDetectionChange: (v: boolean) => void;
}): React.JSX.Element {
  return (
    <CardShell title="Seguridad y Proctoring" icon={<ShieldIcon />}>
      <div className="space-y-stack-md">
        <SegmentedControl
          id="focus-level"
          label="Sensibilidad de Pérdida de Foco"
          options={FOCUS_LEVELS.slice()}
          value={focusLevel}
          onChange={onFocusLevelChange}
        />
        <Counter
          id="retries"
          label="Límite Global de Re-intentos"
          value={retries}
          onChange={onRetriesChange}
          min={0}
          max={10}
        />
        <SegmentedControl
          id="retention"
          label="Retención de Video (Días)"
          options={RETENTION_OPTIONS.slice()}
          value={retention}
          onChange={(v) => onRetentionChange(v)}
          formatter={(v) => `${v}`}
        />
        <ToggleRow
          id="external-ai"
          label="Detección de IA Externa"
          description="Activa el escaneo de patrones de uso de LLMs externos durante la evaluación."
          value={externalAIDetection}
          onChange={onExternalAIDetectionChange}
        />
      </div>
    </CardShell>
  );
}

function MetricsFooter(): React.JSX.Element {
  return (
    <footer className="grid grid-cols-1 gap-stack-md rounded-tv border border-border-standard bg-navy px-stack-lg py-stack-md text-white shadow-tv-card sm:grid-cols-3">
      <Metric label="Consumo de Tokens / Mes" value="14.2M / 20M" />
      <Metric label="Costo Estimado" value="$124.50 USD" />
      <Metric label="Uptime de Agentes" value="99.98%" tone="success" />
    </footer>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success';
}): React.JSX.Element {
  return (
    <div className="space-y-stack-sm">
      <p className="text-label-sm uppercase tracking-wider text-navy-dim">{label}</p>
      <p
        className={cn(
          'font-hanken text-headline-md',
          tone === 'success' ? 'text-status-success' : 'text-white',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ModelSelect<T extends string>({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  onChange: (v: T) => void;
}): React.JSX.Element {
  return (
    <div className="space-y-stack-sm">
      <label htmlFor={id} className="text-label-sm uppercase tracking-wider text-outline-tv">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-10 w-full rounded-md border border-border-standard bg-white px-3 text-body-md text-on-surface focus-visible:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/20"
      >
        {AI_MODELS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}

function TempSlider({
  id,
  label,
  value,
  onChange,
  tone,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  tone: 'info' | 'warning';
}): React.JSX.Element {
  return (
    <div className="space-y-stack-sm">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-body-md font-medium text-on-surface">
          {label}
        </label>
        <span
          className={cn(
            'font-jetbrains text-body-md font-bold',
            tone === 'warning' ? 'text-status-warning' : 'text-status-info',
          )}
        >
          {value.toFixed(1)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          'h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-subtle',
          tone === 'warning' ? 'accent-status-warning' : 'accent-status-info',
        )}
      />
    </div>
  );
}

function ToggleRow({
  id,
  label,
  description,
  value,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-stack-md rounded-md border border-border-standard bg-surface-subtle p-stack-md">
      <div className="min-w-0 flex-1 space-y-stack-sm">
        <label htmlFor={id} className="text-body-md font-medium text-on-surface">
          {label}
        </label>
        {description && <p className="text-body-md text-on-surface-variant">{description}</p>}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors',
          value ? 'bg-brand-secondary' : 'bg-surface-subtle ring-1 ring-inset ring-border-standard',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
            value ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

function SegmentedControl<T extends string | number>({
  id,
  label,
  options,
  value,
  onChange,
  formatter,
}: {
  id: string;
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
  formatter?: (v: T) => string;
}): React.JSX.Element {
  return (
    <div className="space-y-stack-sm">
      <label id={`${id}-label`} className="text-body-md font-medium text-on-surface">
        {label}
      </label>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        className="inline-flex rounded-md border border-border-standard bg-surface-subtle p-1"
      >
        {options.map((opt) => {
          const active = opt === value;
          return (
            <button
              key={String(opt)}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt)}
              className={cn(
                'rounded-sm px-stack-md py-1 text-body-md font-medium transition-colors',
                active
                  ? 'bg-white text-navy shadow-tv-card'
                  : 'text-on-surface-variant hover:text-navy',
              )}
            >
              {formatter ? formatter(opt) : String(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Counter({
  id,
  label,
  value,
  onChange,
  min,
  max,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}): React.JSX.Element {
  return (
    <div className="space-y-stack-sm">
      <label htmlFor={id} className="text-body-md font-medium text-on-surface">
        {label}
      </label>
      <div className="inline-flex items-center rounded-md border border-border-standard bg-white">
        <button
          type="button"
          aria-label="Decrementar"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-10 w-10 items-center justify-center text-on-surface-variant hover:bg-surface-subtle hover:text-navy"
        >
          <Minus size={16} />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
          className="h-10 w-16 border-x border-border-standard bg-transparent text-center font-jetbrains text-body-md font-bold text-navy focus:outline-none"
        />
        <button
          type="button"
          aria-label="Incrementar"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-10 w-10 items-center justify-center text-on-surface-variant hover:bg-surface-subtle hover:text-navy"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

function NumberStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}): React.JSX.Element {
  return (
    <div className="inline-flex items-center rounded-md border border-border-standard bg-white">
      <button
        type="button"
        aria-label="Decrementar"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-8 w-8 items-center justify-center text-on-surface-variant hover:bg-surface-subtle hover:text-navy"
      >
        <Minus size={14} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={0}
        max={100}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(0, Math.min(100, v)));
        }}
        className="h-8 w-14 border-x border-border-standard bg-transparent text-center font-jetbrains text-body-md text-navy focus:outline-none"
      />
      <button
        type="button"
        aria-label="Incrementar"
        onClick={() => onChange(Math.min(100, value + 1))}
        className="flex h-8 w-8 items-center justify-center text-on-surface-variant hover:bg-surface-subtle hover:text-navy"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

function StarIcon(): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function ScaleIcon(): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 3v18M3 8l9-5 9 5M5 12h14M7 12l-2 4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2l-2-4M17 12l-2 4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2l-2-4" />
    </svg>
  );
}

function BrainIcon(): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04ZM14.5 2a2.5 2.5 0 0 0-2.5 2.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04Z" />
    </svg>
  );
}

function ShieldIcon(): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  );
}

function AlertIcon(): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

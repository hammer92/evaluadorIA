'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, Phone, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { createSession, signInWithEmail, signInWithPhone, verifyPhoneCode } from '../api/auth-api';
import { loginSchema, phoneE164Schema, type LoginInput } from '../schemas';

import { getAuthErrorMessage } from './auth-error';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ConfirmationResult } from '@/lib/firebase/auth';

// =============================================================================
// LoginForm — tabs Email | Phone (Q1=C: auth providers permitidos)
// =============================================================================
// ADR-002: Email + Phone son los únicos providers. NO Google.
// =============================================================================

type Tab = 'email' | 'phone';
const RECAPTCHA_CONTAINER_ID = 'login-recaptcha-container';

export function LoginForm({ nextUrl }: { nextUrl?: string }) {
  const [tab, setTab] = useState<Tab>('email');

  return (
    <div className="bg-white border-border-standard shadow-tv-card rounded-lg p-stack-lg border">
      <div className="mb-stack-lg text-center">
        <h1 className="text-headline-md font-hanken text-primary mb-1 tracking-tight">
          Entorno de Evaluación
        </h1>
        <p className="text-body-md text-on-surface-variant">Technical Validation System</p>
      </div>

      <div
        role="tablist"
        aria-label="Método de inicio de sesión"
        className="border-border-standard mb-stack-md flex rounded-lg border p-1"
      >
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'email'}
          onClick={() => setTab('email')}
          className={`flex-1 rounded-md px-3 py-2 text-label-sm font-label-sm uppercase transition-colors ${
            tab === 'email'
              ? 'bg-brand-secondary text-on-secondary-fixed-variant'
              : 'text-on-surface-variant hover:bg-surface-neutral'
          }`}
        >
          <Mail className="mr-2 inline h-4 w-4" strokeWidth={1.75} />
          Email
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'phone'}
          onClick={() => setTab('phone')}
          className={`flex-1 rounded-md px-3 py-2 text-label-sm font-label-sm uppercase transition-colors ${
            tab === 'phone'
              ? 'bg-brand-secondary text-on-secondary-fixed-variant'
              : 'text-on-surface-variant hover:bg-surface-neutral'
          }`}
        >
          <Phone className="mr-2 inline h-4 w-4" strokeWidth={1.75} />
          Teléfono
        </button>
      </div>

      {tab === 'email' ? (
        <EmailLoginForm key="email" nextUrl={nextUrl ?? undefined} />
      ) : (
        <PhoneLoginForm key="phone" nextUrl={nextUrl ?? undefined} />
      )}

      {/* Contenedor único de reCAPTCHA — reCAPTCHA invisible se monta acá */}
      <div id={RECAPTCHA_CONTAINER_ID} />

      <div className="border-border-standard mt-stack-lg border-t pt-stack-md">
        <div className="flex items-start gap-stack-sm">
          <ShieldCheck
            className="text-status-info mt-0.5 h-4 w-4 shrink-0"
            fill="currentColor"
            strokeWidth={1.5}
          />
          <p className="text-label-sm text-on-surface-variant leading-relaxed">
            Este es un entorno seguro. Tus credenciales se transmiten cifradas y la sesión expira
            automáticamente. Asegurate de estar en un lugar tranquilo sin interrupciones.
          </p>
        </div>
      </div>

      <div className="mt-stack-md flex items-center justify-between px-2">
        <a
          className="text-label-sm text-on-surface-variant hover:text-brand-secondary flex items-center gap-1 transition-colors"
          href="#"
        >
          Soporte Técnico
        </a>
        <a
          className="text-label-sm text-on-surface-variant hover:text-brand-secondary transition-colors"
          href="#"
        >
          Instrucciones del Sistema
        </a>
      </div>
    </div>
  );
}

// =============================================================================
// EmailLoginForm — formulario tradicional con email + password
// =============================================================================

function EmailLoginForm({ nextUrl }: { nextUrl?: string | undefined }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const user = await signInWithEmail(values.email, values.password);
      const ok = await createSession(user);
      if (!ok) {
        setServerError('No se pudo crear la sesión. Reintentá.');
        return;
      }
      toast.success('Sesión iniciada');
      router.push(nextUrl ?? '/admin');
      router.refresh();
    } catch (e) {
      console.error('[login-email] error:', e);
      setServerError(getAuthErrorMessage(e));
    }
  });

  const inputClass =
    'bg-surface-neutral border-border-standard focus:ring-brand-secondary focus:border-brand-secondary w-full rounded-lg border py-3 pl-10 pr-3 text-body-md font-body-md transition-all focus:outline-none focus:ring-2';

  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      className="space-y-stack-md"
      noValidate
    >
      <div className="space-y-stack-sm">
        <label
          htmlFor="email"
          className="text-label-sm text-on-surface-variant block font-label-sm uppercase"
        >
          Correo Institucional
        </label>
        <div className="group relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Mail className="text-outline-tv text-body-md h-4 w-4" strokeWidth={1.75} />
          </div>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="usuario@empresa.com"
            className={`${inputClass} placeholder:text-on-surface-variant/60`}
            {...form.register('email')}
            aria-invalid={form.formState.errors.email ? true : undefined}
          />
        </div>
        {form.formState.errors.email && (
          <p className="text-label-sm text-status-error font-label-sm uppercase">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-stack-sm">
        <label
          htmlFor="password"
          className="text-label-sm text-on-surface-variant block font-label-sm uppercase"
        >
          Contraseña
        </label>
        <div className="group relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Lock className="text-outline-tv text-body-md h-4 w-4" strokeWidth={1.75} />
          </div>
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            className={inputClass}
            {...form.register('password')}
            aria-invalid={form.formState.errors.password ? true : undefined}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((s) => !s)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-outline-tv hover:text-primary"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <Eye className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>
        </div>
        {form.formState.errors.password && (
          <p className="text-label-sm text-status-error font-label-sm uppercase">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      {serverError && (
        <p role="alert" className="text-label-sm text-status-error font-label-sm uppercase">
          {serverError}
        </p>
      )}

      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="bg-brand-secondary hover:bg-brand-secondary text-on-secondary-fixed-variant hover:text-white w-full rounded-lg py-6 text-base font-bold transition-all active:scale-95"
      >
        {form.formState.isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Ingresando...
          </>
        ) : (
          <>
            <span>Ingresar</span>
            <ArrowRight className="text-body-md h-4 w-4" strokeWidth={2} />
          </>
        )}
      </Button>

      <p className="text-center text-sm text-on-surface-variant">
        ¿No tenés cuenta?{' '}
        <Link
          href="/signup"
          className="text-brand-secondary font-semibold underline-offset-4 hover:underline"
        >
          Registrate
        </Link>
      </p>
    </form>
  );
}

// =============================================================================
// PhoneLoginForm — two-step OTP flow
// =============================================================================
// Step 1: User ingresa phone → signInWithPhone (envía SMS)
// Step 2: User ingresa 6-digit code → verifyPhoneCode → createSession
// =============================================================================

type PhoneStep = 'request' | 'verify';

function PhoneLoginForm({ nextUrl }: { nextUrl?: string | undefined }) {
  const router = useRouter();
  const [step, setStep] = useState<PhoneStep>('request');
  const [serverError, setServerError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const parse = phoneE164Schema.safeParse(phone);
    if (!parse.success) {
      setServerError(parse.error.issues[0]?.message ?? 'Número inválido');
      return;
    }
    setBusy(true);
    try {
      confirmationRef.current = await signInWithPhone({
        phoneNumber: phone,
        recaptchaContainerId: RECAPTCHA_CONTAINER_ID,
      });
      setStep('verify');
      toast.success('Código enviado por SMS');
    } catch (err) {
      console.error('[login-phone] request failed:', err);
      setServerError(getAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!confirmationRef.current) {
      setServerError('Sesión de verificación expiró. Pedí un código nuevo');
      setStep('request');
      return;
    }
    setBusy(true);
    try {
      const user = await verifyPhoneCode(confirmationRef.current, code);
      const ok = await createSession(user);
      if (!ok) {
        setServerError('No se pudo crear la sesión. Reintentá.');
        return;
      }
      toast.success('Sesión iniciada');
      router.push(nextUrl ?? '/admin');
      router.refresh();
    } catch (err) {
      console.error('[login-phone] verify failed:', err);
      setServerError(getAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'bg-surface-neutral border-border-standard focus:ring-brand-secondary focus:border-brand-secondary w-full rounded-lg border py-3 pl-10 pr-3 text-body-md font-body-md transition-all focus:outline-none focus:ring-2';

  if (step === 'request') {
    return (
      <form
        onSubmit={(e) => {
          void handleRequest(e);
        }}
        className="space-y-stack-md"
        noValidate
      >
        <div className="space-y-stack-sm">
          <label
            htmlFor="phone"
            className="text-label-sm text-on-surface-variant block font-label-sm uppercase"
          >
            Número de Teléfono
          </label>
          <div className="group relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Phone className="text-outline-tv text-body-md h-4 w-4" strokeWidth={1.75} />
            </div>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+5491155554444"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`${inputClass} placeholder:text-on-surface-variant/60`}
            />
          </div>
          <p className="text-label-sm text-on-surface-variant leading-relaxed">
            Formato internacional con código de país (ej: +54 para Argentina).
          </p>
        </div>

        {serverError && (
          <p role="alert" className="text-label-sm text-status-error font-label-sm uppercase">
            {serverError}
          </p>
        )}

        <Button
          type="submit"
          disabled={busy}
          className="bg-brand-secondary hover:bg-brand-secondary text-on-secondary-fixed-variant hover:text-white w-full rounded-lg py-6 text-base font-bold transition-all active:scale-95"
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin" />
              Enviando código...
            </>
          ) : (
            <>
              <span>Enviar código</span>
              <ArrowRight className="text-body-md h-4 w-4" strokeWidth={2} />
            </>
          )}
        </Button>

        <p className="text-center text-sm text-on-surface-variant">
          ¿No tenés cuenta?{' '}
          <Link
            href="/signup"
            className="text-brand-secondary font-semibold underline-offset-4 hover:underline"
          >
            Registrate
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        void handleVerify(e);
      }}
      className="space-y-stack-md"
      noValidate
    >
      <div className="space-y-stack-sm">
        <label
          htmlFor="code"
          className="text-label-sm text-on-surface-variant block font-label-sm uppercase"
        >
          Código de Verificación
        </label>
        <div className="group relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Lock className="text-outline-tv text-body-md h-4 w-4" strokeWidth={1.75} />
          </div>
          <Input
            id="code"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className={`${inputClass} tracking-widest`}
          />
        </div>
        <p className="text-label-sm text-on-surface-variant leading-relaxed">
          Te enviamos un código de 6 dígitos a <strong>{phone}</strong>.
        </p>
      </div>

      {serverError && (
        <p role="alert" className="text-label-sm text-status-error font-label-sm uppercase">
          {serverError}
        </p>
      )}

      <Button
        type="submit"
        disabled={busy || code.length !== 6}
        className="bg-brand-secondary hover:bg-brand-secondary text-on-secondary-fixed-variant hover:text-white w-full rounded-lg py-6 text-base font-bold transition-all active:scale-95"
      >
        {busy ? (
          <>
            <Loader2 className="animate-spin" />
            Verificando...
          </>
        ) : (
          <>
            <span>Verificar</span>
            <ArrowRight className="text-body-md h-4 w-4" strokeWidth={2} />
          </>
        )}
      </Button>

      <button
        type="button"
        onClick={() => {
          setStep('request');
          setCode('');
          setServerError(null);
          confirmationRef.current = null;
        }}
        className="text-label-sm text-on-surface-variant hover:text-brand-secondary w-full text-center transition-colors"
      >
        ← Cambiar número
      </button>
    </form>
  );
}

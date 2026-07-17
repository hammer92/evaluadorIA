'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { createSession, signUpWithEmail } from '../api/auth-api';
import { signupSchema, type SignupInput } from '../schemas';

import { getAuthErrorMessage } from './auth-error';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SignupForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', displayName: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const { user, isFirstUser } = await signUpWithEmail({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
      });
      const ok = await createSession(user);
      if (!ok) {
        setServerError('No se pudo crear la sesión. Reintentá.');
        return;
      }
      toast.success(
        isFirstUser ? '¡Bienvenido! Sos el primer usuario, sos admin.' : 'Cuenta creada',
      );
      router.push('/admin');
      router.refresh();
    } catch (e) {
      console.error('[signup] error:', e);
      setServerError(getAuthErrorMessage(e));
    }
  });

  const inputClass =
    'bg-surface-neutral border-border-standard focus:ring-brand-secondary focus:border-brand-secondary w-full rounded-lg border py-3 pl-10 pr-3 text-body-md font-body-md transition-all focus:outline-none focus:ring-2';

  return (
    <div className="bg-white border-border-standard shadow-tv-card rounded-lg p-stack-lg border">
      <div className="mb-stack-lg text-center">
        <h1 className="text-headline-md font-hanken text-primary mb-1 tracking-tight">
          Crear cuenta
        </h1>
        <p className="text-body-md text-on-surface-variant">Technical Validation System</p>
      </div>

        <form
          onSubmit={(event) => {
            void onSubmit(event);
          }}
          className="space-y-stack-md"
          noValidate
        >
        <div className="space-y-stack-sm">
          <label
            htmlFor="displayName"
            className="text-label-sm text-on-surface-variant block font-label-sm uppercase"
          >
            Nombre Completo
          </label>
          <div className="group relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <User className="text-outline-tv text-body-md h-4 w-4" strokeWidth={1.75} />
            </div>
            <Input
              id="displayName"
              type="text"
              autoComplete="name"
              placeholder="Tu nombre"
              className={`${inputClass} placeholder:text-on-surface-variant/60`}
              {...form.register('displayName')}
              aria-invalid={form.formState.errors.displayName ? true : undefined}
            />
          </div>
          {form.formState.errors.displayName && (
            <p className="text-label-sm text-status-error font-label-sm uppercase">
              {form.formState.errors.displayName.message}
            </p>
          )}
        </div>

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
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              className={`${inputClass} placeholder:text-on-surface-variant/60`}
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
              Creando...
            </>
          ) : (
            <>
              <span>Crear cuenta</span>
              <ArrowRight className="text-body-md h-4 w-4" strokeWidth={2} />
            </>
          )}
        </Button>

        <p className="text-center text-sm text-on-surface-variant">
          ¿Ya tenés cuenta?{' '}
          <Link
            href="/login"
            className="text-brand-secondary font-semibold underline-offset-4 hover:underline"
          >
            Iniciar sesión
          </Link>
        </p>
      </form>

      <div className="border-border-standard mt-stack-lg border-t pt-stack-md">
        <div className="flex items-start gap-stack-sm">
          <ShieldCheck
            className="text-status-info mt-0.5 h-4 w-4 shrink-0"
            fill="currentColor"
            strokeWidth={1.5}
          />
          <p className="text-label-sm text-on-surface-variant leading-relaxed">
            El primer usuario del sistema se vuelve administrador automáticamente. Los siguientes
            accesos requieren invitación de un administrador existente.
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

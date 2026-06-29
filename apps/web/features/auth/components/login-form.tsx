'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { createSession, signInWithEmail } from '../api/auth-api';
import { loginSchema, type LoginInput } from '../schemas';

import { getAuthErrorCode, mapAuthErrorMessage } from './auth-error';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// =============================================================================
// LoginForm — email/password.
// =============================================================================
// Q1=A: solo email/password. Llama `signInWithEmail` (Firebase Auth) y luego
// `createSession` (API route → Cloud Function → cookie httpOnly).
// =============================================================================

export function LoginForm({ nextUrl }: { nextUrl?: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
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
      router.push(nextUrl || '/admin');
      router.refresh();
    } catch (e) {
      const code = getAuthErrorCode(e);
      setServerError(mapAuthErrorMessage(code));
    }
  });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Iniciar sesión</CardTitle>
        <CardDescription>Ingresá con tu email y contraseña</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...form.register('email')}
              aria-invalid={form.formState.errors.email ? true : undefined}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...form.register('password')}
              aria-invalid={form.formState.errors.password ? true : undefined}
            />
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          {serverError && (
            <p role="alert" className="text-sm text-destructive">
              {serverError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="animate-spin" />
                Ingresando...
              </>
            ) : (
              'Ingresar'
            )}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            ¿No tenés cuenta?{' '}
            <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
              Registrate
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

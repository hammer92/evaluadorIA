'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { createSession, signUpWithEmail } from '../api/auth-api';
import { signupSchema, type SignupInput } from '../schemas';

import { getAuthErrorMessage } from './auth-error';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// =============================================================================
// SignupForm — email/password.
// =============================================================================
// Q3=C (híbrido): si es el primer user del sistema, signUpWithEmail retorna
// isFirstUser=true y la UI lo celebra. Si no, el form rechaza con mensaje claro.
// =============================================================================

export function SignupForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
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

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Crear cuenta</CardTitle>
        <CardDescription>
          El primer usuario del sistema se vuelve admin automáticamente
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Nombre</Label>
            <Input
              id="displayName"
              type="text"
              autoComplete="name"
              {...form.register('displayName')}
              aria-invalid={form.formState.errors.displayName ? true : undefined}
            />
            {form.formState.errors.displayName && (
              <p className="text-xs text-destructive">
                {form.formState.errors.displayName.message}
              </p>
            )}
          </div>
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
              autoComplete="new-password"
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
                Creando...
              </>
            ) : (
              'Crear cuenta'
            )}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const profileSchema = z.object({
  displayName: z.string().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
});
type ProfileValues = z.infer<typeof profileSchema>;

// =============================================================================
// /admin/settings/profile — form para editar displayName del usuario actual.
// =============================================================================
// STUB: por ahora solo persiste en local state (no hay CF v1ProfileUpdate).
// Cuando se implemente la CF, este form la llamará via useMutation. Hasta
// entonces sirve como skeleton visual para el PR-3.
// =============================================================================

export default function ProfileSettingsPage(): React.JSX.Element {
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: '' },
  });

  const { register, handleSubmit, formState } = form;
  const { errors, isDirty, isSubmitting } = formState;

  function onSubmit(values: ProfileValues): void {
    // Stub: en el sprint futuro, llamar useUpdateProfile mutation.
    // Por ahora solo log para validar el flow de form.
    if (typeof window !== 'undefined') {
      window.console.info('[profile] would save:', values);
    }
  }

  return (
    <div className="space-y-stack-lg">
      <header className="space-y-stack-sm">
        <p className="text-label-sm text-outline-tv">CONFIGURACIÓN · MI PERFIL</p>
        <h1 className="font-hanken text-display-lg text-on-surface">Mi perfil</h1>
        <p className="text-body-lg text-on-surface-variant">
          Actualizá tu nombre visible para el equipo.
        </p>
      </header>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-stack-sm text-headline-sm">
            <User className="h-5 w-5" />
            Datos personales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-stack-md">
            <div className="space-y-stack-sm">
              <Label htmlFor="displayName">Nombre visible</Label>
              <Input
                id="displayName"
                placeholder="Tu nombre completo"
                aria-invalid={Boolean(errors.displayName)}
                {...register('displayName')}
              />
              {errors.displayName && (
                <p className="text-body-sm text-status-error" role="alert">
                  {errors.displayName.message}
                </p>
              )}
              <p className="text-body-sm text-navy/60">
                El email y rol son administrados por tu organización y no pueden modificarse desde
                acá.
              </p>
            </div>
            <Button type="submit" disabled={!isDirty || isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Guardar cambios
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

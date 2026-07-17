'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ServerAuth } from '@/features/auth/types';

const profileSchema = z.object({
  displayName: z.string().min(1).max(120),
  photoURL: z.string().url().or(z.literal('')).optional(),
});
type ProfileInput = z.infer<typeof profileSchema>;

export function ProfileForm({ user }: { user: ServerAuth }): React.JSX.Element {
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: '', photoURL: '' },
  });

  useEffect(() => {
    form.reset({ displayName: user.email.split('@')[0] ?? '', photoURL: '' });
  }, [user.email, form]);

  const onSubmit = form.handleSubmit((values) => {
    void values;
    toast.success('Perfil actualizado (mock)');
  });

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Perfil</CardTitle>
        <CardDescription>
          Actualizá tu nombre visible y foto. Los cambios se aplican a tu sesión activa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            void onSubmit(event);
          }}
          className="space-y-stack-md"
        >
          <div className="space-y-stack-sm">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email} disabled readOnly />
          </div>
          <div className="space-y-stack-sm">
            <Label htmlFor="displayName">Nombre</Label>
            <Input id="displayName" {...form.register('displayName')} />
            {form.formState.errors.displayName && (
              <p className="text-xs text-status-error">
                {form.formState.errors.displayName.message}
              </p>
            )}
          </div>
          <div className="space-y-stack-sm">
            <Label htmlFor="photoURL">Foto (URL)</Label>
            <Input
              id="photoURL"
              type="url"
              placeholder="https://..."
              {...form.register('photoURL')}
            />
            {form.formState.errors.photoURL && (
              <p className="text-xs text-status-error">{form.formState.errors.photoURL.message}</p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 pt-stack-sm">
            <Button type="button" variant="ghost" onClick={() => form.reset()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

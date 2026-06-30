'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createUserInputSchema, updateUserInputSchema, type User } from '@shared/schemas/users';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { useCreateUser } from '../hooks/use-create-user';
import { useUpdateUser } from '../hooks/use-update-user';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const createSchema = createUserInputSchema;
const updateSchema = updateUserInputSchema;

type CreateValues = z.input<typeof createSchema>;
type UpdateValues = z.input<typeof updateSchema>;

export function UserFormModal({
  open,
  onOpenChange,
  mode,
  user,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  mode: 'create' | 'edit';
  user?: User;
}): React.JSX.Element {
  const create = useCreateUser();
  const update = useUpdateUser();

  const isEdit = mode === 'edit' && user;

  const form = useForm<CreateValues | UpdateValues>({
    resolver: zodResolver(isEdit ? updateSchema : createSchema),
    defaultValues: isEdit
      ? { displayName: user.displayName ?? '', role: user.role, status: user.status }
      : { email: '', displayName: '', role: 'recruiter', sendInviteEmail: true },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        isEdit
          ? { displayName: user.displayName ?? '', role: user.role, status: user.status }
          : { email: '', displayName: '', role: 'recruiter', sendInviteEmail: true },
      );
    }
  }, [open, isEdit, user, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await update.mutateAsync({ uid: user.uid, input: values as UpdateValues });
      } else {
        await create.mutateAsync(values as CreateValues);
      }
      onOpenChange(false);
    } catch {
      // toast mostrado en el hook
    }
  });

  const pending = create.isPending || update.isPending;
  const emailError = (form.formState.errors as Record<string, { message?: string } | undefined>)[
    'email'
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Modificá el rol o el nombre de ${user.email}.`
              : 'Creá un usuario y enviale la invitación por email.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-stack-md">
          {!isEdit && (
            <div className="space-y-stack-sm">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="off"
                {...form.register('email' as keyof CreateValues)}
              />
              {emailError && <p className="text-xs text-status-error">{emailError.message}</p>}
            </div>
          )}
          {isEdit && (
            <div className="space-y-stack-sm">
              <Label>Email</Label>
              <Input value={user.email} disabled readOnly />
            </div>
          )}
          <div className="space-y-stack-sm">
            <Label htmlFor="displayName">Nombre</Label>
            <Input id="displayName" autoComplete="off" {...form.register('displayName' as const)} />
            {form.formState.errors.displayName && (
              <p className="text-xs text-status-error">
                {form.formState.errors.displayName.message as string}
              </p>
            )}
          </div>
          <div className="space-y-stack-sm">
            <Label htmlFor="role">Rol</Label>
            <Select
              value={form.watch('role' as const)}
              onValueChange={(v) =>
                form.setValue('role' as const, v as 'admin' | 'recruiter' | 'expert')
              }
            >
              <SelectTrigger id="role" className="border-border-standard">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="recruiter">Recruiter</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isEdit && (
            <div className="space-y-stack-sm">
              <Label htmlFor="status">Estado</Label>
              <Select
                value={form.watch('status' as const)}
                onValueChange={(v) =>
                  form.setValue('status' as const, v as 'active' | 'invited' | 'suspended')
                }
              >
                <SelectTrigger id="status" className="border-border-standard">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="invited">Invitado</SelectItem>
                  <SelectItem value="suspended">Suspendido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {!isEdit && (
            <label
              htmlFor="sendInviteEmail"
              className="flex cursor-pointer items-center gap-2 text-body-md text-on-surface-variant"
            >
              <input
                id="sendInviteEmail"
                type="checkbox"
                className="h-4 w-4 rounded border-border-standard text-navy focus:ring-navy/30"
                {...form.register('sendInviteEmail' as const)}
              />
              Enviar email de invitación
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import type { User } from '@shared/schemas/users';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { useDeleteUser } from '../hooks/use-delete-user';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function DeleteUserDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  user: User | null;
}): React.JSX.Element {
  const del = useDeleteUser();

  const onConfirm = async (): Promise<void> => {
    if (!user) return;
    try {
      await del.mutateAsync({ uid: user.uid });
      onOpenChange(false);
    } catch {
      // toast en el hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-status-error/10 text-status-error">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="space-y-stack-sm">
              <DialogTitle>Eliminar usuario</DialogTitle>
              <DialogDescription>
                ¿Eliminar a <span className="font-medium text-on-surface">{user?.email}</span>? Esta
                acción es reversible: el usuario queda con status=&ldquo;suspendido&rdquo; y un
                timestamp <code className="font-jetbrains text-xs">deletedAt</code>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={del.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              void onConfirm();
            }}
            disabled={del.isPending}
          >
            {del.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eliminar usuario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

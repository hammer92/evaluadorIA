'use client';

import type { User } from '@shared/schemas/users';
import { Loader2 } from 'lucide-react';

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
          <DialogTitle>Eliminar usuario</DialogTitle>
          <DialogDescription>
            ¿Eliminar a <span className="font-medium text-foreground">{user?.email}</span>? La
            acción es reversible: el user queda con status=&ldquo;suspendido&rdquo; y deletedAt
            timestamp.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={del.isPending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={del.isPending}>
            {del.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

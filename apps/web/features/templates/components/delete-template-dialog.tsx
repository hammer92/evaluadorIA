'use client';

import type { Template } from '@shared/schemas/templates';
import { Loader2 } from 'lucide-react';

import { useDeleteTemplate } from '../hooks/use-templates';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function DeleteTemplateDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  template: Template | null;
}): React.JSX.Element {
  const del = useDeleteTemplate();

  async function onConfirm(): Promise<void> {
    if (!template) return;
    try {
      await del.mutateAsync(template.templateId);
      onOpenChange(false);
    } catch {
      // surfaced via mutation.onError in production
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar este template?</DialogTitle>
          <DialogDescription>
            Estás por eliminar <strong>{template?.name}</strong>. Esta acción es un soft-delete: el
            template quedará marcado como eliminado y se ocultará del listado, pero su historial de
            revisión se conserva para auditoría.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={del.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-status-error/30 text-status-error hover:bg-status-error/10"
            onClick={() => {
              void onConfirm();
            }}
            disabled={del.isPending}
          >
            {del.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

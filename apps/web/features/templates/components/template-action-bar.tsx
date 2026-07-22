'use client';

import type { Template } from '@shared/schemas/templates';
import { Edit, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function TemplateActionBar({
  template,
  canEdit,
  canDelete,
  onEdit,
}: {
  template: Template;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
}): React.JSX.Element | null {
  if (!canEdit && !canDelete) return null;
  return (
    <div className="flex flex-wrap gap-stack-sm">
      {canEdit && (
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </Button>
      )}
      {canDelete && (
        <Button
          variant="outline"
          size="sm"
          className="border-status-error/30 text-status-error hover:bg-status-error/10"
          disabled={Boolean(template.deletedAt)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </Button>
      )}
    </div>
  );
}

'use client';

import type { Template } from '@shared/schemas/templates';
import { Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export function TemplateActionBar({
  template,
  canEdit,
  canDelete,
  editHref,
}: {
  template: Template;
  canEdit: boolean;
  canDelete: boolean;
  editHref: string;
}): React.JSX.Element | null {
  if (!canEdit && !canDelete) return null;
  return (
    <div className="flex flex-wrap gap-stack-sm">
      {canEdit && (
        <Button asChild variant="outline" size="sm">
          <Link href={editHref}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Link>
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
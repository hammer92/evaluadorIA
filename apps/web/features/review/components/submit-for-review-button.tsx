'use client';

import { Loader2, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useSubmitForReview } from '@/features/review/hooks/use-review-hooks';

export interface SubmitForReviewButtonProps {
  templateId: string;
  onSubmitted?: () => void;
}

export function SubmitForReviewButton({
  templateId,
  onSubmitted,
}: SubmitForReviewButtonProps): React.JSX.Element {
  const submit = useSubmitForReview();

  function handleClick(): void {
    submit.mutate(
      { templateId },
      {
        onSuccess: () => {
          onSubmitted?.();
        },
      },
    );
  }

  return (
    <Button onClick={handleClick} disabled={submit.isPending}>
      {submit.isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Send className="mr-2 h-4 w-4" />
      )}
      Enviar a revisión
    </Button>
  );
}

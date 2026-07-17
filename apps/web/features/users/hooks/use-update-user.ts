'use client';

import type { UpdateUserInput } from '@shared/schemas/users';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { updateUser } from '../api/users-api';

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, input }: { uid: string; input: UpdateUserInput }) => updateUser(uid, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario actualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

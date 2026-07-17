'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { deleteUser } from '../api/users-api';

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid }: { uid: string }) => deleteUser(uid),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario eliminado');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

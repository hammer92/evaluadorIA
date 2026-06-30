import { roleSchema, statusSchema } from '@shared/schemas/common';
import { z } from 'zod';

export const userFiltersSchema = z.object({
  status: statusSchema.optional().or(z.literal('all')),
  role: roleSchema.optional().or(z.literal('all')),
  search: z.string().max(100).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type UserFilters = z.infer<typeof userFiltersSchema>;

export const defaultFilters: UserFilters = {
  status: 'all',
  role: 'all',
  search: '',
  page: 1,
  pageSize: 20,
};

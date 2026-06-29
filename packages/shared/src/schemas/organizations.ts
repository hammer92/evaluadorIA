import { z } from 'zod';

export const organizationPlanSchema = z.enum(['free', 'pro', 'enterprise']);
export type OrganizationPlan = z.infer<typeof organizationPlanSchema>;

export const organizationSchema = z.object({
  orgId: z.string(),
  name: z.string().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  plan: organizationPlanSchema,
  settings: z.object({
    timezone: z.string().default('UTC'),
    locale: z.string().default('en'),
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  deletedAt: z.date().nullable(),
});
export type Organization = z.infer<typeof organizationSchema>;

export const createOrganizationInputSchema = organizationSchema.pick({
  name: true,
  slug: true,
  plan: true,
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationInputSchema>;

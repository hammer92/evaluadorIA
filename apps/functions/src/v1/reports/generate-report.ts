import { randomUUID } from 'node:crypto';

import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

import { env } from '../../env.js';
import { handleError } from '../../shared/handle-error.js';
import { withAuth } from '../../shared/on-call-auth.js';
import { validateInput } from '../../shared/validate-input.js';

const inputSchema = z.object({
  type: z.enum(['users_csv', 'audit_log_pdf']),
  organizationId: z.string().optional(),
  dateRange: z
    .object({
      from: z.string().datetime(),
      to: z.string().datetime(),
    })
    .optional(),
});
type GenerateReportInput = z.input<typeof inputSchema>;

export interface GenerateReportOutput {
  jobId: string;
  status: 'queued';
  estimatedSeconds: number;
}

export const v1ReportsGenerate = onCall(
  {
    cors: env.ALLOWED_ORIGINS.split(','),
  },
  withAuth<GenerateReportInput, GenerateReportOutput>('admin', (_ctx, data) => {
    try {
      validateInput(inputSchema, data);

      const jobId = `job_${randomUUID()}`;
      return Promise.resolve({
        jobId,
        status: 'queued' as const,
        estimatedSeconds: 30,
      });
    } catch (e) {
      handleError(e);
    }
  }),
);

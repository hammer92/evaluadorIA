import { randomUUID } from 'node:crypto';

import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

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
    cors: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3000').split(','),
  },
  withAuth<GenerateReportInput, GenerateReportOutput>('admin', async (_ctx, data) => {
    try {
      validateInput(inputSchema, data);

      const jobId = `job_${randomUUID()}`;
      return {
        jobId,
        status: 'queued' as const,
        estimatedSeconds: 30,
      };
    } catch (e) {
      handleError(e);
    }
  }),
);

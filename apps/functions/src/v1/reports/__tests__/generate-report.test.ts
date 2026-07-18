import { describe, expect, it, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  _firebase_functions_v2_https: null as unknown,
  _firebase_functions_v2: null as unknown,
}));

vi.mock('../../../firebase-admin.js', () => ({
  getAdminAuth: vi.fn(() => ({})),
  getAdminDb: vi.fn(() => ({})),
  getAdminApp: vi.fn(() => ({})),
  getAdminStorage: vi.fn(() => ({})),
}));

vi.mock('firebase-functions/v2/https', async () => {
  hoisted._firebase_functions_v2_https ??= await vi.importActual('firebase-functions/v2/https');
  const actual = hoisted._firebase_functions_v2_https;
  return {
    ...actual,
    onCall: ((optsOrHandler: unknown, maybeHandler?: unknown) => {
      const handler =
        typeof optsOrHandler === 'function'
          ? (optsOrHandler as (req: unknown) => Promise<unknown>)
          : (maybeHandler as (req: unknown) => Promise<unknown>);
      return ((req: unknown) => handler(req)) as unknown as ReturnType<typeof actual.onCall>;
    }) as typeof actual.onCall,
  };
});

vi.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({
    value: () => process.env[name],
  }),
}));

vi.mock('firebase-functions/v2', async () => {
  hoisted._firebase_functions_v2 ??= await vi.importActual('firebase-functions/v2');
  const actual = hoisted._firebase_functions_v2;
  return {
    ...actual,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('firebase-functions', () => ({
  config: () => ({
    session: {
      cookie_secret: process.env['SESSION_COOKIE_SECRET'] ?? '',
    },
    allowed: {
      origins: process.env['ALLOWED_ORIGINS'] ?? '',
    },
    repository: {
      driver: process.env['REPOSITORY_DRIVER'] ?? 'memory',
    },
    admin: {
      project_id: process.env['FIREBASE_ADMIN_PROJECT_ID'] ?? 'demo-test',
    },
    openai: {
      api_key: process.env['OPENAI_API_KEY'],
    },
  }),
}));

const { v1ReportsGenerate } = await import('../generate-report.js');

interface ReportData {
  type: 'users_csv' | 'audit_log_pdf';
  organizationId?: string;
  dateRange?: { from: string; to: string };
}
type ReportFn = (req: {
  data: ReportData;
  auth?: { uid: string; token: Record<string, unknown> } | null;
  rawRequest?: { headers?: Record<string, unknown> };
}) => Promise<unknown>;

function asCallable(fn: unknown): ReportFn {
  return fn as unknown as ReportFn;
}

function adminContext(): {
  uid: string;
  email: string;
  role: string;
  token: Record<string, unknown>;
} {
  return { uid: 'admin-uid', email: 'admin@platform.com', role: 'admin', token: { role: 'admin' } };
}

describe('v1ReportsGenerate', () => {
  beforeEach(() => {
    process.env['SESSION_COOKIE_SECRET'] = 'test-secret-for-vitest-must-be-at-least-32-chars-long';
  });

  it('rechaza type inválido', async () => {
    const fn = asCallable(v1ReportsGenerate);
    await expect(
      fn({
        data: { type: 'invalid_type' } as unknown as ReportData,
        auth: adminContext(),
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rechaza dateRange.from no-ISO', async () => {
    const fn = asCallable(v1ReportsGenerate);
    await expect(
      fn({
        data: {
          type: 'users_csv',
          dateRange: { from: 'not-a-date', to: '2024-01-01T00:00:00Z' },
        },
        auth: adminContext(),
        rawRequest: { headers: {} },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('happy path users_csv devuelve jobId', async () => {
    const fn = asCallable(v1ReportsGenerate);
    const result = (await fn({
      data: { type: 'users_csv' },
      auth: adminContext(),
      rawRequest: { headers: {} },
    })) as { jobId: string; status: string; estimatedSeconds: number };

    expect(result.jobId).toMatch(/^job_/);
    expect(result.status).toBe('queued');
    expect(result.estimatedSeconds).toBe(30);
  });

  it('happy path audit_log_pdf con dateRange', async () => {
    const fn = asCallable(v1ReportsGenerate);
    const result = (await fn({
      data: {
        type: 'audit_log_pdf',
        organizationId: 'org-1',
        dateRange: {
          from: '2024-01-01T00:00:00Z',
          to: '2024-12-31T23:59:59Z',
        },
      },
      auth: adminContext(),
      rawRequest: { headers: {} },
    })) as { jobId: string; status: string };

    expect(result.status).toBe('queued');
  });

  it('genera jobIds únicos en llamadas sucesivas', async () => {
    const fn = asCallable(v1ReportsGenerate);
    const a = (await fn({
      data: { type: 'users_csv' },
      auth: adminContext(),
      rawRequest: { headers: {} },
    })) as { jobId: string };
    const b = (await fn({
      data: { type: 'users_csv' },
      auth: adminContext(),
      rawRequest: { headers: {} },
    })) as { jobId: string };
    expect(a.jobId).not.toBe(b.jobId);
  });
});

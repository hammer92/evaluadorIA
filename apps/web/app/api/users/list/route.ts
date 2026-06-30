import { NextResponse, type NextRequest } from 'next/server';

import { callCallable, readSessionCookie } from '@/lib/api/cf-proxy';

export const dynamic = 'force-dynamic';

interface ListInput {
  status?: string;
  role?: string;
  search?: string;
  page: number;
  pageSize: number;
}

interface ListOutput {
  items: {
    uid: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;
    role: string;
    organizationId: string | null;
    status: string;
    createdAt: string;
  }[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await readSessionCookie();
  if (!ctx) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (ctx.role !== 'admin' && ctx.role !== 'recruiter') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<ListInput>;
  const page = typeof body.page === 'number' && body.page > 0 ? body.page : 1;
  const pageSize =
    typeof body.pageSize === 'number' && body.pageSize > 0 && body.pageSize <= 100
      ? body.pageSize
      : 20;

  const input: ListInput = {
    page,
    pageSize,
    ...(body.status ? { status: body.status } : {}),
    ...(body.role ? { role: body.role } : {}),
    ...(body.search ? { search: body.search } : {}),
  };

  const result = await callCallable<ListInput, ListOutput>('v1UsersList', input, ctx);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

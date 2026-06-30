import { NextResponse, type NextRequest } from 'next/server';

import { callCallable, readSessionCookie } from '@/lib/api/cf-proxy';

export const dynamic = 'force-dynamic';

interface CreateInput {
  email: string;
  displayName?: string;
  role: 'admin' | 'recruiter' | 'expert';
  sendInviteEmail?: boolean;
}

interface CreateOutput {
  uid: string;
  email: string;
  displayName: string | null;
  role: string;
  organizationId: string | null;
  status: 'invited';
  createdBy: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await readSessionCookie();
  if (!ctx) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (ctx.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<CreateInput>;
  if (typeof body.email !== 'string' || !body.email.includes('@')) {
    return NextResponse.json({ error: 'invalid-email' }, { status: 400 });
  }
  if (body.role !== 'admin' && body.role !== 'recruiter' && body.role !== 'expert') {
    return NextResponse.json({ error: 'invalid-role' }, { status: 400 });
  }

  const input: CreateInput = {
    email: body.email,
    role: body.role,
    ...(body.displayName ? { displayName: body.displayName } : {}),
    ...(body.sendInviteEmail !== undefined ? { sendInviteEmail: body.sendInviteEmail } : {}),
  };

  const result = await callCallable<CreateInput, CreateOutput>('v1UsersCreate', input, ctx);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

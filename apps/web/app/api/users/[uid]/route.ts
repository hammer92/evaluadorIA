import { NextResponse, type NextRequest } from 'next/server';

import { callCallable, readSessionCookie } from '@/lib/api/cf-proxy';

export const dynamic = 'force-dynamic';

interface UpdateInput {
  displayName?: string;
  photoURL?: string;
  role?: 'admin' | 'recruiter' | 'expert';
  status?: 'active' | 'invited' | 'suspended';
}

interface UpdateRequest {
  uid: string;
  input: UpdateInput;
}

interface UpdateOutput {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: string;
  organizationId: string | null;
  status: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
): Promise<NextResponse> {
  const ctx = await readSessionCookie();
  if (!ctx) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { uid } = await params;
  if (!uid) {
    return NextResponse.json({ error: 'missing-uid' }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<UpdateInput>;
  if (body.role && body.role !== 'admin' && body.role !== 'recruiter' && body.role !== 'expert') {
    return NextResponse.json({ error: 'invalid-role' }, { status: 400 });
  }
  if (
    body.status &&
    body.status !== 'active' &&
    body.status !== 'invited' &&
    body.status !== 'suspended'
  ) {
    return NextResponse.json({ error: 'invalid-status' }, { status: 400 });
  }

  const input: UpdateInput = {
    ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
    ...(body.photoURL !== undefined ? { photoURL: body.photoURL } : {}),
    ...(body.role ? { role: body.role } : {}),
    ...(body.status ? { status: body.status } : {}),
  };

  const result = await callCallable<UpdateRequest, UpdateOutput>(
    'v1UsersUpdate',
    { uid, input },
    ctx,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
): Promise<NextResponse> {
  const ctx = await readSessionCookie();
  if (!ctx) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (ctx.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { uid } = await params;
  if (!uid) {
    return NextResponse.json({ error: 'missing-uid' }, { status: 400 });
  }
  if (uid === ctx.uid) {
    return NextResponse.json({ error: 'cannot-delete-self' }, { status: 400 });
  }

  const result = await callCallable<{ uid: string }, { uid: string; deletedAt: string }>(
    'v1UsersDelete',
    { uid },
    ctx,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

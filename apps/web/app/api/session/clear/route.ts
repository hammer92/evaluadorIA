import { NextResponse } from 'next/server';

// =============================================================================
// Next.js API route — POST /api/session/clear
// =============================================================================
// Borra la cookie de sesión del origin localhost:3000. Mismo motivo que
// /api/session: necesita ser same-origin para que el browser la borre.
// =============================================================================

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ success: true });
  res.cookies.set({
    name: '__session',
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}

import { NextResponse } from 'next/server';
import { botPost } from '@/lib/bot-api';
import { setSessionCookie } from '@/lib/auth';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { phone, code } = body || {};
  if (!phone || !code) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }
  const result = await botPost('/api/auth/verify-code', { phone, code });
  if (!result.ok || typeof result.token !== 'string') {
    return NextResponse.json(result, { status: 401 });
  }
  await setSessionCookie(result.token);
  return NextResponse.json({ ok: true, tenant_id: result.tenant_id });
}

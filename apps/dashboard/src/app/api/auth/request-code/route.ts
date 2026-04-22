import { NextResponse } from 'next/server';
import { botPost } from '@/lib/bot-api';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const phone = body?.phone;
  if (!phone) return NextResponse.json({ ok: false, error: 'missing_phone' }, { status: 400 });
  const result = await botPost('/api/auth/request-code', { phone });
  const status = result.ok ? 200 : 400;
  return NextResponse.json(result, { status });
}

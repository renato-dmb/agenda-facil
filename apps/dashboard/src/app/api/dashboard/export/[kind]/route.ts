import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BOT_URL = process.env.BOT_API_URL || 'http://localhost:3001';

async function authHeaders(): Promise<Record<string, string>> {
  const store = await cookies();
  const token = store.get('af_session')?.value;
  return token ? { authorization: `Bearer ${token}` } : {};
}

const ALLOWED = new Set(['customers', 'appointments', 'reviews']);

export async function GET(_req: Request, context: { params: Promise<{ kind: string }> }) {
  const { kind } = await context.params;
  if (!ALLOWED.has(kind)) {
    return NextResponse.json({ ok: false, error: 'invalid_kind' }, { status: 400 });
  }
  const res = await fetch(`${BOT_URL}/api/bot/export/${kind}`, {
    headers: await authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: `http_${res.status}` }, { status: res.status });
  }
  const body = await res.text();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${kind}.csv"`,
    },
  });
}

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BOT_URL = process.env.BOT_API_URL || 'http://localhost:3001';

async function authHeaders(): Promise<Record<string, string>> {
  const store = await cookies();
  const token = store.get('af_session')?.value;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${BOT_URL}/api/bot/appointments/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.ok ? 200 : res.status });
}

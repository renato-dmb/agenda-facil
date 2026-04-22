import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BOT_URL = process.env.BOT_API_URL || 'http://localhost:3001';

async function authHeaders(): Promise<Record<string, string>> {
  const store = await cookies();
  const token = store.get('af_session')?.value;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function GET() {
  const res = await fetch(`${BOT_URL}/api/bot/admin/tenants`, {
    headers: await authHeaders(),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.ok ? 200 : res.status });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${BOT_URL}/api/bot/admin/tenants`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.ok ? 200 : res.status });
}

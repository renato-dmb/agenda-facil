'use server';

import { cookies } from 'next/headers';

const BOT_URL = process.env.BOT_API_URL || 'http://localhost:3001';
const COOKIE_NAME = 'af_session';

async function authHeaders(): Promise<Record<string, string>> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return token ? { authorization: `Bearer ${token}` } : {};
}

type BotResult = { ok: boolean; [key: string]: unknown };

export async function botCall(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<BotResult> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(await authHeaders()),
  };
  const res = await fetch(`${BOT_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as BotResult;
  if (!res.ok && typeof data.ok === 'undefined') {
    return { ok: false, error: `http_${res.status}` };
  }
  return data;
}

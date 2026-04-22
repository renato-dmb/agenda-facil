const BOT_URL = process.env.BOT_API_URL || 'http://localhost:3001';

type JsonResult = { ok: boolean; [key: string]: unknown };

export async function botPost(path: string, body: unknown): Promise<JsonResult> {
  const res = await fetch(`${BOT_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as JsonResult;
  if (!res.ok && typeof data.ok === 'undefined') {
    return { ok: false, error: `http_${res.status}`, message: 'Falha na comunicação com o bot.' };
  }
  return data;
}

export async function botGet(path: string): Promise<JsonResult> {
  const res = await fetch(`${BOT_URL}${path}`, { cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as JsonResult;
  if (!res.ok && typeof data.ok === 'undefined') {
    return { ok: false, error: `http_${res.status}` };
  }
  return data;
}

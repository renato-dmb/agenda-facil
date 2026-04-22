import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'af_session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

export type SessionPayload = {
  tenant_id: string;
  owner_phone: string;
  iat: number;
  exp: number;
};

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET missing or too short');
  return new TextEncoder().encode(s);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: 'agenda-facil-bot',
      audience: 'agenda-facil-dashboard',
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

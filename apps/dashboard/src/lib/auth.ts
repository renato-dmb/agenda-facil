import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { tenants } from '@agenda-facil/db';

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

/**
 * Sessão válida E tenant que ainda existe no banco.
 *
 * `readSession` só confere a assinatura do JWT, que vale 30 dias. Se o tenant
 * for apagado nesse intervalo, o cookie continua "válido" apontando para algo
 * inexistente: /login mandava para /home e /home devolvia para /login, num
 * loop infinito (ERR_TOO_MANY_REDIRECTS). Quem decide redirecionamento deve
 * usar esta função, não `readSession` sozinha.
 *
 * @returns null quando não há cookie, o token é inválido/expirado, ou o tenant
 *          da sessão não existe mais — todos os casos em que a saída é o login.
 */
export async function resolveSessionTenant(): Promise<{
  session: SessionPayload;
  tenant: { id: string; slug: string; name: string };
} | null> {
  const session = await readSession();
  if (!session) return null;

  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) return null;

  return { session, tenant };
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

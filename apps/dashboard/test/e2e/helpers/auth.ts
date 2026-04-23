import { SignJWT } from 'jose';
import type { BrowserContext } from '@playwright/test';

const SECRET = process.env.JWT_SECRET || 'test-jwt-secret-32-chars-minimum-ok';

export async function issueSessionToken(tenantId: string, ownerPhone = '5511987654321') {
  const key = new TextEncoder().encode(SECRET);
  return await new SignJWT({ tenant_id: tenantId, owner_phone: ownerPhone })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('agenda-facil-bot')
    .setAudience('agenda-facil-dashboard')
    .setExpirationTime('1d')
    .sign(key);
}

export async function loginAs(context: BrowserContext, tenantId: string, baseURL: string) {
  const token = await issueSessionToken(tenantId);
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: 'af_session',
      value: token,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    },
  ]);
}

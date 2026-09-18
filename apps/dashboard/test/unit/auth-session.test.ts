import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

const SECRET = 'test-jwt-secret-32-chars-minimum-ok';

// cookie store falso, controlado por teste
let cookieJar: Record<string, string> = {};
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar[name] ? { value: cookieJar[name] } : undefined),
    set: (name: string, value: string) => {
      cookieJar[name] = value;
    },
    delete: (name: string) => {
      delete cookieJar[name];
    },
  }),
}));

// banco falso: só existe o tenant que cada teste registrar
let tenantsNoBanco: Record<string, { id: string; slug: string; name: string }> = {};
vi.mock('@agenda-facil/db', () => ({
  tenants: {
    getById: async (id: string) => tenantsNoBanco[id] ?? null,
  },
}));

const { resolveSessionTenant } = await import('@/lib/auth');

async function tokenPara(tenantId: string, { expirado = false } = {}) {
  const jwt = new SignJWT({ tenant_id: tenantId, owner_phone: '5511900000000' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('agenda-facil-bot')
    .setAudience('agenda-facil-dashboard')
    .setExpirationTime(expirado ? '-1h' : '30d');
  return jwt.sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  cookieJar = {};
  tenantsNoBanco = {};
});

describe('resolveSessionTenant', () => {
  it('devolve sessão e tenant quando ambos são válidos', async () => {
    tenantsNoBanco['t-1'] = { id: 't-1', slug: 'paulo-testa', name: 'Paulo Testa' };
    cookieJar['af_session'] = await tokenPara('t-1');

    const resultado = await resolveSessionTenant();

    expect(resultado).not.toBeNull();
    expect(resultado!.tenant.slug).toBe('paulo-testa');
    expect(resultado!.session.tenant_id).toBe('t-1');
  });

  it('devolve null quando o JWT é válido mas o tenant não existe mais', async () => {
    // Regressão: tenant apagado deixava o cookie vivo por 30 dias.
    // /login redirecionava para /home, /home devolvia para /login → loop infinito.
    cookieJar['af_session'] = await tokenPara('tenant-apagado');

    expect(await resolveSessionTenant()).toBeNull();
  });

  it('devolve null quando não há cookie', async () => {
    expect(await resolveSessionTenant()).toBeNull();
  });

  it('devolve null quando o token está expirado', async () => {
    tenantsNoBanco['t-1'] = { id: 't-1', slug: 'paulo-testa', name: 'Paulo Testa' };
    cookieJar['af_session'] = await tokenPara('t-1', { expirado: true });

    expect(await resolveSessionTenant()).toBeNull();
  });

  it('devolve null quando o token foi assinado com outro segredo', async () => {
    tenantsNoBanco['t-1'] = { id: 't-1', slug: 'paulo-testa', name: 'Paulo Testa' };
    cookieJar['af_session'] = await new SignJWT({ tenant_id: 't-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('agenda-facil-bot')
      .setAudience('agenda-facil-dashboard')
      .setExpirationTime('30d')
      .sign(new TextEncoder().encode('outro-segredo-com-32-caracteres!!'));

    expect(await resolveSessionTenant()).toBeNull();
  });
});

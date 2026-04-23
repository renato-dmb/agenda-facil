import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { requireFromSrc } from '../../helpers/cjs-loader.mjs';

const moduleRequire = requireFromSrc('auth/magic-code.js');
const wa = moduleRequire('../whatsapp/baileys-manager');
const magicCode = moduleRequire('./magic-code');

let pool;
let tenant;
let testHelpers;

beforeAll(async () => {
  const dbPkg = await import('@agenda-facil/db');
  testHelpers = dbPkg.default.testHelpers;
  await testHelpers.setupTestDb();
  pool = testHelpers.makeTestPool();
});

beforeEach(async () => {
  await testHelpers.resetTestDb(pool);
  tenant = await testHelpers.seedTenant(pool);
  await pool.query(`UPDATE tenants SET owner_phone = $1 WHERE id = $2`, [
    '5511987654321',
    tenant.id,
  ]);
  wa.sendText = vi.fn().mockResolvedValue({ ok: true });
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('auth/magic-code', () => {
  describe('requestCode', () => {
    it('retorna invalid_phone pra entrada malformada', async () => {
      const r = await magicCode.requestCode({ rawPhone: 'xyz' });
      expect(r.ok).toBe(false);
      expect(r.error).toBe('invalid_phone');
    });

    it('phone desconhecido retorna resposta mascarada (não vaza existência)', async () => {
      const r = await magicCode.requestCode({ rawPhone: '5511900000000' });
      expect(r.ok).toBe(true);
      expect(r.masked).toBe(true);
      expect(wa.sendText).not.toHaveBeenCalled();
    });

    it('phone válido gera código, grava em auth_codes e envia WhatsApp', async () => {
      const r = await magicCode.requestCode({ rawPhone: '5511987654321' });
      expect(r.ok).toBe(true);
      expect(r.masked).toBe(false);
      expect(wa.sendText).toHaveBeenCalledTimes(1);

      const codes = await pool.query(`SELECT * FROM auth_codes WHERE tenant_id = $1`, [
        tenant.id,
      ]);
      expect(codes.rowCount).toBe(1);
      expect(codes.rows[0].code_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('rate limit bloqueia após 3 pedidos na mesma janela', async () => {
      await magicCode.requestCode({ rawPhone: '5511987654321' });
      await magicCode.requestCode({ rawPhone: '5511987654321' });
      await magicCode.requestCode({ rawPhone: '5511987654321' });
      const r = await magicCode.requestCode({ rawPhone: '5511987654321' });
      expect(r.ok).toBe(false);
      expect(r.error).toBe('rate_limited');
    });
  });

  describe('verifyCode + verifyToken', () => {
    async function extractPlaintextCode() {
      // Como a gente não tem o código em plaintext (só o hash), pedimos um novo
      // e pegamos o que foi enviado via sendText.
      wa.sendText.mockClear();
      await magicCode.requestCode({ rawPhone: '5511987654321' });
      const msg = wa.sendText.mock.calls[0][2];
      const match = msg.match(/\*(\d{6})\*/);
      return match[1];
    }

    it('código correto emite JWT verificável', async () => {
      const code = await extractPlaintextCode();
      const r = await magicCode.verifyCode({ rawPhone: '5511987654321', code });
      expect(r.ok).toBe(true);
      expect(r.token).toBeDefined();
      expect(r.tenant_id).toBe(tenant.id);

      const verified = await magicCode.verifyToken(r.token);
      expect(verified.ok).toBe(true);
      expect(verified.payload.tenant_id).toBe(tenant.id);
      expect(verified.payload.owner_phone).toBe('5511987654321');
    });

    it('código errado incrementa attempts', async () => {
      await extractPlaintextCode();
      const r = await magicCode.verifyCode({ rawPhone: '5511987654321', code: '000000' });
      expect(r.ok).toBe(false);
      expect(r.error).toBe('wrong_code');
      const codes = await pool.query(`SELECT attempts FROM auth_codes WHERE tenant_id = $1`, [
        tenant.id,
      ]);
      expect(codes.rows[0].attempts).toBe(1);
    });

    it('código formato inválido retorna invalid_code', async () => {
      const r = await magicCode.verifyCode({ rawPhone: '5511987654321', code: 'abc' });
      expect(r.error).toBe('invalid_code');
    });

    it('verifyToken falha com token lixo', async () => {
      const r = await magicCode.verifyToken('not-a-jwt');
      expect(r.ok).toBe(false);
      expect(r.error).toBe('invalid_token');
    });
  });
});

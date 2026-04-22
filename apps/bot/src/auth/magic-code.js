const crypto = require('crypto');
const { SignJWT, jwtVerify } = require('jose');
const { tenants, authCodes } = require('@agenda-facil/db');
const wa = require('../whatsapp/baileys-manager');
const { normalizePhone, brMobileVariants, phoneToJid, formatPhone } = require('../utils/phone');

const CODE_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX = 3;
const JWT_TTL = '30d';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set (>=32 chars)');
  }
  return new TextEncoder().encode(secret);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function generate6DigitCode() {
  // crypto.randomInt é uniforme; gera 100000..999999
  return String(crypto.randomInt(100000, 1000000));
}

async function requestCode({ rawPhone }) {
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return { ok: false, error: 'invalid_phone', message: 'Número de telefone inválido.' };
  }
  const variants = brMobileVariants(phone);

  const recent = await authCodes.countRecentByPhone(variants, RATE_LIMIT_WINDOW_MINUTES);
  if (recent >= RATE_LIMIT_MAX) {
    return {
      ok: false,
      error: 'rate_limited',
      message: `Muitas tentativas. Aguarde ${RATE_LIMIT_WINDOW_MINUTES} minutos antes de pedir novamente.`,
    };
  }

  const matching = await tenants.listByOwnerPhone(phone);
  let tenant = matching[0];
  if (!tenant) {
    for (const v of variants) {
      const list = await tenants.listByOwnerPhone(v);
      if (list[0]) {
        tenant = list[0];
        break;
      }
    }
  }
  if (!tenant) {
    // Resposta genérica (não revela se o número existe ou não)
    return {
      ok: true,
      masked: true,
      message: 'Se o número estiver cadastrado, você vai receber um código no seu WhatsApp.',
    };
  }

  const code = generate6DigitCode();
  const codeHash = sha256(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  await authCodes.create({
    tenantId: tenant.id,
    phone,
    codeHash,
    expiresAt,
  });

  const jid = phoneToJid(phone);
  if (!jid) {
    return { ok: false, error: 'bad_jid', message: 'Não foi possível montar o JID.' };
  }

  try {
    await wa.sendText(
      tenant.id,
      jid,
      `🔐 Seu código de acesso ao painel agenda-fácil:\n\n*${code}*\n\nExpira em ${CODE_TTL_MINUTES} minutos. Não compartilhe com ninguém.`,
    );
  } catch (err) {
    console.error('[auth] failed to send magic code via WhatsApp:', err.message);
    return {
      ok: false,
      error: 'whatsapp_unavailable',
      message: 'Não foi possível enviar o código agora. Tente de novo em alguns minutos.',
    };
  }

  return {
    ok: true,
    masked: false,
    message: `Código enviado para ${formatPhone(phone)} via WhatsApp. Digite o código para entrar.`,
  };
}

async function verifyCode({ rawPhone, code }) {
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return { ok: false, error: 'invalid_phone' };
  }
  if (!code || !/^\d{6}$/.test(String(code))) {
    return { ok: false, error: 'invalid_code' };
  }
  const variants = brMobileVariants(phone);

  const active = await authCodes.findActive(variants);
  if (!active) {
    return { ok: false, error: 'no_active_code', message: 'Código expirado ou inexistente. Solicite um novo.' };
  }

  if (active.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: 'too_many_attempts', message: 'Muitas tentativas erradas. Solicite um novo código.' };
  }

  const incomingHash = sha256(String(code));
  if (incomingHash !== active.code_hash) {
    await authCodes.incrementAttempts(active.id);
    return { ok: false, error: 'wrong_code', message: 'Código incorreto.' };
  }

  await authCodes.markUsed(active.id);

  const token = await new SignJWT({
    tenant_id: active.tenant_id,
    owner_phone: phone,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('agenda-facil-bot')
    .setAudience('agenda-facil-dashboard')
    .setExpirationTime(JWT_TTL)
    .sign(getJwtSecret());

  return {
    ok: true,
    token,
    tenant_id: active.tenant_id,
    expires_in_seconds: 30 * 24 * 60 * 60,
  };
}

async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      issuer: 'agenda-facil-bot',
      audience: 'agenda-facil-dashboard',
    });
    return { ok: true, payload };
  } catch (err) {
    return { ok: false, error: 'invalid_token', message: err.message };
  }
}

module.exports = { requestCode, verifyCode, verifyToken };

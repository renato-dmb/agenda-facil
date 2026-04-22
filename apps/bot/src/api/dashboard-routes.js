const { tenants, contacts, conversations, appointments: appts } = require('@agenda-facil/db');
const { verifyToken } = require('../auth/magic-code');
const resolver = require('../tenancy/resolver');
const { normalizePhone, brMobileVariants } = require('../utils/phone');
const gcal = require('../integrations/google-calendar/events');

async function auth(req, res) {
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ ok: false, error: 'missing_token' });
    return null;
  }
  const result = await verifyToken(token);
  if (!result.ok) {
    res.status(401).json({ ok: false, error: 'invalid_token' });
    return null;
  }
  return result.payload;
}

function register(app) {
  // Estado geral do tenant (usado pelo dashboard pra refletir mudanças feitas no WhatsApp)
  app.get('/api/bot/tenant', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const tenant = await tenants.getById(payload.tenant_id);
    if (!tenant) return res.status(404).json({ ok: false, error: 'tenant_not_found' });
    res.json({ ok: true, tenant });
  });

  // Pausar/retomar bot
  app.post('/api/bot/ai-active', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const active = req.body?.active === true;
    await tenants.setAiActive(payload.tenant_id, active);
    await resolver.refreshTenant(payload.tenant_id);
    res.json({ ok: true, ai_active: active });
  });

  // Modo público/privado
  app.post('/api/bot/audience-mode', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const mode = req.body?.mode;
    if (mode !== 'public' && mode !== 'private') {
      return res.status(400).json({ ok: false, error: 'invalid_mode' });
    }
    await tenants.setAudienceMode(payload.tenant_id, mode);
    await resolver.refreshTenant(payload.tenant_id);
    res.json({ ok: true, audience_mode: mode });
  });

  // Contatos: add
  app.post('/api/bot/contacts', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const phone = normalizePhone(req.body?.phone);
    if (!phone) return res.status(400).json({ ok: false, error: 'invalid_phone' });
    const name = req.body?.name?.trim() || null;
    const contact = await contacts.add(payload.tenant_id, phone, name);
    res.json({ ok: true, contact });
  });

  // Contatos: remove
  app.delete('/api/bot/contacts', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const phone = normalizePhone(req.body?.phone);
    if (!phone) return res.status(400).json({ ok: false, error: 'invalid_phone' });
    const count = await contacts.remove(payload.tenant_id, brMobileVariants(phone));
    res.json({ ok: true, removed: count });
  });

  // Pausar/retomar IA numa conversa específica
  app.post('/api/bot/conversations/state', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const phone = req.body?.phone;
    const state = req.body?.state;
    if (!phone || !['ai_active', 'paused', 'escalated'].includes(state)) {
      return res.status(400).json({ ok: false, error: 'invalid_params' });
    }
    await conversations.setState(payload.tenant_id, phone, state);
    res.json({ ok: true });
  });

  // Cancelar agendamento — deleta evento GCal e marca status
  app.post('/api/bot/appointments/:id/cancel', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const id = req.params.id;
    const appt = await appts.getById(payload.tenant_id, id);
    if (!appt) return res.status(404).json({ ok: false, error: 'not_found' });
    if (appt.google_event_id) {
      try {
        await gcal.deleteEvent(payload.tenant_id, appt.google_event_id);
      } catch (err) {
        if (err.code !== 404 && err.code !== 410) {
          console.error('[dashboard-api] gcal delete failed:', err.message);
        }
      }
    }
    await appts.setStatus(id, 'cancelled');
    res.json({ ok: true });
  });
}

module.exports = { register };

const {
  tenants,
  contacts,
  conversations,
  appointments: appts,
  services,
  scheduled,
  knowledge,
} = require('@agenda-facil/db');
const { verifyToken } = require('../auth/magic-code');
const resolver = require('../tenancy/resolver');
const { normalizePhone, brMobileVariants } = require('../utils/phone');
const gcal = require('../integrations/google-calendar/events');
const { invalidate: invalidateKnowledgeCache } = require('../knowledge/loader');

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
  // ===== Estado do tenant =====
  app.get('/api/bot/tenant', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const tenant = await tenants.getById(payload.tenant_id);
    if (!tenant) return res.status(404).json({ ok: false, error: 'tenant_not_found' });
    res.json({ ok: true, tenant });
  });

  // ===== Bot on/off =====
  app.post('/api/bot/ai-active', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const active = req.body?.active === true;
    await tenants.setAiActive(payload.tenant_id, active);
    await resolver.refreshTenant(payload.tenant_id);
    res.json({ ok: true, ai_active: active });
  });

  // ===== Modo público/privado =====
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

  // ===== Contatos =====
  app.post('/api/bot/contacts', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const phone = normalizePhone(req.body?.phone);
    if (!phone) return res.status(400).json({ ok: false, error: 'invalid_phone' });
    const name = req.body?.name?.trim() || null;
    const contact = await contacts.add(payload.tenant_id, phone, name);
    res.json({ ok: true, contact });
  });

  app.delete('/api/bot/contacts', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const phone = normalizePhone(req.body?.phone);
    if (!phone) return res.status(400).json({ ok: false, error: 'invalid_phone' });
    const count = await contacts.remove(payload.tenant_id, brMobileVariants(phone));
    res.json({ ok: true, removed: count });
  });

  // ===== Conversas =====
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

  // ===== Agendamentos: cancelar =====
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

  // ===== Serviços CRUD =====
  app.get('/api/bot/services', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const list = await services.listAll(payload.tenant_id);
    res.json({ ok: true, services: list });
  });

  app.post('/api/bot/services', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const body = req.body || {};
    if (!body.name || typeof body.duration_minutes !== 'number') {
      return res.status(400).json({ ok: false, error: 'invalid_params' });
    }
    const svc = await services.createForTenant(payload.tenant_id, {
      name: String(body.name).trim(),
      duration_minutes: body.duration_minutes,
      price_cents: typeof body.price_cents === 'number' ? body.price_cents : null,
      display_order: typeof body.display_order === 'number' ? body.display_order : 0,
      active: body.active !== false,
    });
    res.json({ ok: true, service: svc });
  });

  app.patch('/api/bot/services/:id', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const patch = req.body || {};
    const updated = await services.updateForTenant(payload.tenant_id, req.params.id, patch);
    if (!updated) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true, service: updated });
  });

  app.delete('/api/bot/services/:id', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const count = await services.deleteForTenant(payload.tenant_id, req.params.id);
    if (count === 0) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true });
  });

  // ===== Horário de funcionamento =====
  app.get('/api/bot/business-hours', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const hours = await services.listBusinessHours(payload.tenant_id);
    res.json({ ok: true, hours });
  });

  app.put('/api/bot/business-hours', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const entries = req.body?.hours;
    if (!Array.isArray(entries)) return res.status(400).json({ ok: false, error: 'invalid_params' });
    for (const h of entries) {
      if (
        typeof h.weekday !== 'number' ||
        h.weekday < 0 ||
        h.weekday > 6 ||
        typeof h.start_time !== 'string' ||
        typeof h.end_time !== 'string'
      ) {
        return res.status(400).json({ ok: false, error: 'invalid_entry' });
      }
    }
    await services.replaceBusinessHours(payload.tenant_id, entries);
    res.json({ ok: true });
  });

  // ===== Lembretes pré/pós-atendimento =====
  app.get('/api/bot/reminders', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const [pre, post] = await Promise.all([
      scheduled.listByTriggerType(payload.tenant_id, 'pre_appointment'),
      scheduled.listByTriggerType(payload.tenant_id, 'post_appointment'),
    ]);
    res.json({ ok: true, pre: pre[0] || null, post: post[0] || null });
  });

  app.put('/api/bot/reminders', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const b = req.body || {};
    const kind = b.kind;
    if (kind !== 'pre_appointment' && kind !== 'post_appointment') {
      return res.status(400).json({ ok: false, error: 'invalid_kind' });
    }
    if (typeof b.content !== 'string' || typeof b.offset_minutes !== 'number') {
      return res.status(400).json({ ok: false, error: 'invalid_params' });
    }
    await scheduled.upsertScheduledMessage(payload.tenant_id, {
      name: kind === 'pre_appointment' ? 'lembrete_pre' : 'lembrete_pos',
      trigger_type: kind,
      offset_minutes: b.offset_minutes,
      send_hour: '09:00',
      content_type: 'template',
      content: b.content.trim(),
      active: b.active !== false,
    });
    res.json({ ok: true });
  });

  // ===== Recorrência =====
  app.post('/api/bot/recurrence', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const b = req.body || {};
    const settings = {};
    if (typeof b.enabled === 'boolean') settings.recurrence_enabled = b.enabled;
    if (typeof b.triggerDays === 'number') settings.recurrence_trigger_days = b.triggerDays;
    if (typeof b.retryDays === 'number') settings.recurrence_retry_days = b.retryDays;
    if (typeof b.sendHour === 'string') settings.recurrence_send_hour = b.sendHour;
    await tenants.upsertSettings(payload.tenant_id, settings);

    if (typeof b.template === 'string' && b.template.trim()) {
      await scheduled.upsertScheduledMessage(payload.tenant_id, {
        name: 'recorrencia_principal',
        trigger_type: 'recurrence_since_last_appointment',
        offset_days: b.triggerDays || 14,
        send_hour: b.sendHour || '09:00',
        content_type: 'template',
        content: b.template.trim(),
        active: b.enabled !== false,
      });
    }
    await resolver.refreshTenant(payload.tenant_id);
    res.json({ ok: true });
  });

  // ===== Base de conhecimento =====
  app.get('/api/bot/knowledge', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const rows = await knowledge.listByTenant(payload.tenant_id);
    res.json({ ok: true, sections: rows });
  });

  app.put('/api/bot/knowledge', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const body = req.body || {};
    const section = body.section;
    const content = body.content;
    if (!knowledge.SECTIONS.includes(section)) {
      return res.status(400).json({ ok: false, error: 'invalid_section' });
    }
    if (typeof content !== 'string') {
      return res.status(400).json({ ok: false, error: 'invalid_content' });
    }
    await knowledge.upsertSection(payload.tenant_id, section, content);
    const tenant = await tenants.getById(payload.tenant_id);
    if (tenant) invalidateKnowledgeCache(tenant.slug);
    res.json({ ok: true });
  });
}

module.exports = { register };

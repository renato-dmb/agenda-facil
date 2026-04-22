const {
  tenants,
  contacts,
  conversations,
  appointments: appts,
  services,
  scheduled,
  knowledge,
  whatsappContacts,
  customers,
  messages: messageQueries,
  reviews,
  pool,
} = require('@agenda-facil/db');
const { verifyToken } = require('../auth/magic-code');
const resolver = require('../tenancy/resolver');
const { normalizePhone, brMobileVariants, phoneToJid } = require('../utils/phone');
const { addMinutesIso, humanDateTimeInTz } = require('../utils/dates');
const gcal = require('../integrations/google-calendar/events');
const { invalidate: invalidateKnowledgeCache } = require('../knowledge/loader');
const wa = require('../whatsapp/baileys-manager');
const reminderEngine = require('../scheduler/appointment-reminders');

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

async function requireSuperAdmin(req, res) {
  const payload = await auth(req, res);
  if (!payload) return null;
  const t = await tenants.getById(payload.tenant_id);
  if (!t?.is_super_admin) {
    res.status(403).json({ ok: false, error: 'forbidden' });
    return null;
  }
  return payload;
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
    await reminderEngine
      .removeForAppointment(id)
      .catch(() => {});
    notifyAppointmentChange(payload.tenant_id, id, 'cancelled').catch(() => {});
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
    const [preList, postList] = await Promise.all([
      scheduled.listByTriggerType(payload.tenant_id, 'pre_appointment'),
      scheduled.listByTriggerType(payload.tenant_id, 'post_appointment'),
    ]);
    res.json({ ok: true, pre: preList, post: postList });
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
    const name = b.name || (kind === 'pre_appointment' ? 'lembrete_pre' : 'lembrete_pos');
    await scheduled.upsertScheduledMessage(payload.tenant_id, {
      name,
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

  // ===== Super Admin (N) =====
  app.get('/api/bot/admin/tenants', async (req, res) => {
    const payload = await requireSuperAdmin(req, res);
    if (!payload) return;
    const list = await tenants.listAll();
    res.json({ ok: true, tenants: list });
  });

  app.post('/api/bot/admin/tenants', async (req, res) => {
    const payload = await requireSuperAdmin(req, res);
    if (!payload) return;
    const b = req.body || {};
    if (!b.slug || !b.name || !b.profession_type || !b.owner_phone) {
      return res.status(400).json({ ok: false, error: 'missing_fields' });
    }
    const ownerPhone = normalizePhone(b.owner_phone);
    if (!ownerPhone) return res.status(400).json({ ok: false, error: 'invalid_phone' });
    try {
      const t = await tenants.createNew({
        slug: String(b.slug).toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        name: b.name,
        profession_type: b.profession_type,
        timezone: b.timezone || 'America/Sao_Paulo',
        owner_phone: ownerPhone,
      });
      res.json({ ok: true, tenant: t });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'create_failed', detail: err.message });
    }
  });

  // ===== Onboarding (D) =====
  app.get('/api/bot/onboarding-status', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const [svcList, hoursList, gcalToken] = await Promise.all([
      services.listActive(payload.tenant_id),
      services.listBusinessHours(payload.tenant_id),
      require('@agenda-facil/db').googleOAuth.getByTenantId(payload.tenant_id),
    ]);
    const tenant = await tenants.getById(payload.tenant_id);
    const whatsappConnected = wa.listConnected().some((c) => c.tenantId === payload.tenant_id);
    res.json({
      ok: true,
      status: tenant?.status,
      checks: {
        has_services: svcList.length > 0,
        has_hours: hoursList.length > 0,
        has_gcal: !!gcalToken,
        has_whatsapp: whatsappConnected,
      },
    });
  });

  app.post('/api/bot/onboarding/activate', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    await tenants.setStatus(payload.tenant_id, 'active');
    await resolver.refreshTenant(payload.tenant_id);
    res.json({ ok: true });
  });

  // ===== Campanhas manuais (M) =====
  app.post('/api/bot/broadcast', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const b = req.body || {};
    const text = typeof b.text === 'string' ? b.text.trim() : '';
    if (!text) return res.status(400).json({ ok: false, error: 'empty_text' });

    const recipients = Array.isArray(b.phones) ? b.phones : [];
    const filter = b.filter;
    const poolPkg = pool.getPool();
    let phones = [];

    if (recipients.length > 0) {
      phones = recipients;
    } else if (filter === 'all_customers') {
      const r = await poolPkg.query(
        `SELECT phone FROM customers WHERE tenant_id = $1 AND phone NOT LIKE '5500%'`,
        [payload.tenant_id],
      );
      phones = r.rows.map((x) => x.phone);
    } else if (filter === 'active_last_60d') {
      const r = await poolPkg.query(
        `SELECT phone FROM customers WHERE tenant_id = $1 AND phone NOT LIKE '5500%'
           AND last_appointment_at >= NOW() - INTERVAL '60 days'`,
        [payload.tenant_id],
      );
      phones = r.rows.map((x) => x.phone);
    } else if (filter === 'inactive_30d') {
      const r = await poolPkg.query(
        `SELECT phone FROM customers WHERE tenant_id = $1 AND phone NOT LIKE '5500%'
           AND (last_appointment_at IS NULL OR last_appointment_at < NOW() - INTERVAL '30 days')`,
        [payload.tenant_id],
      );
      phones = r.rows.map((x) => x.phone);
    }

    const unique = Array.from(new Set(phones)).filter(Boolean);
    let sent = 0;
    let failed = 0;
    for (const phone of unique) {
      const jid = phoneToJid(phone);
      if (!jid) continue;
      try {
        const customer = await customers.getByPhone(payload.tenant_id, phone);
        const body = text
          .replace(/\{first_name\}/gi, customer?.name?.split(' ')[0] || '')
          .replace(/\{nome\}/gi, customer?.name || '');
        await wa.sendText(payload.tenant_id, jid, body);
        await messageQueries.log({
          tenantId: payload.tenant_id,
          waMessageId: null,
          phone,
          direction: 'out',
          body,
        });
        sent += 1;
        await new Promise((r) => setTimeout(r, 2500));
      } catch (err) {
        failed += 1;
      }
    }
    res.json({ ok: true, sent, failed, total: unique.length });
  });

  // ===== Customers (U — birthday edit) =====
  app.patch('/api/bot/customers/:id', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const id = req.params.id;
    const b = req.body || {};
    const poolPkg = pool.getPool();
    const sets = [];
    const values = [payload.tenant_id, id];
    let i = 3;
    if (typeof b.name === 'string') {
      sets.push(`name = $${i}`);
      values.push(b.name.trim());
      i += 1;
    }
    if (typeof b.email === 'string') {
      sets.push(`email = $${i}`);
      values.push(b.email.trim() || null);
      i += 1;
    }
    if (typeof b.birthday === 'string' || b.birthday === null) {
      sets.push(`birthday = $${i}`);
      values.push(b.birthday || null);
      i += 1;
    }
    if (sets.length === 0) return res.json({ ok: true });
    await poolPkg.query(
      `UPDATE customers SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`,
      values,
    );
    res.json({ ok: true });
  });

  // ===== Lista de espera (V) =====
  app.get('/api/bot/waitlist', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const poolPkg = pool.getPool();
    const r = await poolPkg.query(
      `SELECT w.*, c.name AS customer_name, c.phone AS customer_phone, s.name AS service_name
       FROM waitlist w
       JOIN customers c ON c.id = w.customer_id
       LEFT JOIN services s ON s.id = w.service_id
       WHERE w.tenant_id = $1 AND w.status = 'waiting'
       ORDER BY w.created_at`,
      [payload.tenant_id],
    );
    res.json({ ok: true, waitlist: r.rows });
  });

  app.post('/api/bot/waitlist', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const b = req.body || {};
    const phone = normalizePhone(b.phone);
    if (!phone) return res.status(400).json({ ok: false, error: 'invalid_phone' });
    const customer = await customers.upsertByPhone(payload.tenant_id, phone, { name: b.name });
    const poolPkg = pool.getPool();
    const { rows } = await poolPkg.query(
      `INSERT INTO waitlist (tenant_id, customer_id, service_id, preferred_date, preferred_time_start, preferred_time_end, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        payload.tenant_id,
        customer.id,
        b.service_id || null,
        b.preferred_date || null,
        b.preferred_time_start || null,
        b.preferred_time_end || null,
        b.notes || null,
      ],
    );
    res.json({ ok: true, entry: rows[0] });
  });

  app.post('/api/bot/waitlist/:id/notify', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const poolPkg = pool.getPool();
    const r = await poolPkg.query(
      `SELECT w.*, c.phone, c.name FROM waitlist w
       JOIN customers c ON c.id = w.customer_id
       WHERE w.id = $1 AND w.tenant_id = $2`,
      [req.params.id, payload.tenant_id],
    );
    const entry = r.rows[0];
    if (!entry) return res.status(404).json({ ok: false, error: 'not_found' });
    const firstName = (entry.name || '').split(' ')[0] || 'Olá';
    const text = `Oi ${firstName}! Abriu um horário pra você. Me avisa qual dia/hora fica melhor que eu já reservo 💈`;
    const jid = phoneToJid(entry.phone);
    try {
      await wa.sendText(payload.tenant_id, jid, text);
      await messageQueries.log({
        tenantId: payload.tenant_id,
        waMessageId: null,
        phone: entry.phone,
        direction: 'out',
        body: text,
      });
      await poolPkg.query(
        `UPDATE waitlist SET status = 'notified', notified_at = NOW() WHERE id = $1`,
        [req.params.id],
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'send_failed', detail: err.message });
    }
  });

  app.delete('/api/bot/waitlist/:id', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const poolPkg = pool.getPool();
    await poolPkg.query(
      `DELETE FROM waitlist WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, payload.tenant_id],
    );
    res.json({ ok: true });
  });

  // ===== Contatos do WhatsApp (sync do celular pareado) =====
  app.get('/api/bot/whatsapp-contacts', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const list = await whatsappContacts.listByTenant(payload.tenant_id, {
      search: q,
      limit: 50,
    });
    res.json({ ok: true, contacts: list });
  });

  app.get('/api/bot/whatsapp-contacts/count', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const count = await whatsappContacts.countByTenant(payload.tenant_id);
    res.json({ ok: true, count });
  });

  // ===== Agendamento manual pelo dashboard (não passa pelo Claude) =====
  app.post('/api/bot/appointments', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const body = req.body || {};
    const kind = body.kind === 'block' ? 'block' : 'appointment';

    const startIso = body.start_time;
    if (!startIso) return res.status(400).json({ ok: false, error: 'missing_start_time' });

    const tenant = await tenants.getById(payload.tenant_id);
    if (!tenant) return res.status(404).json({ ok: false, error: 'tenant_not_found' });
    const tz = tenant.timezone || 'America/Sao_Paulo';

    let serviceId = null;
    let durationMin = 30;
    let customerId = null;
    let customerPhone = null;
    let customerName = body.customer_name || null;

    if (kind === 'appointment') {
      const { normalizePhone } = require('../utils/phone');
      customerPhone = normalizePhone(body.customer_phone);
      if (!customerPhone) return res.status(400).json({ ok: false, error: 'invalid_phone' });
      if (!body.service_id) return res.status(400).json({ ok: false, error: 'missing_service' });

      const svc = await services.getById(payload.tenant_id, body.service_id);
      if (!svc) return res.status(400).json({ ok: false, error: 'service_not_found' });
      serviceId = svc.id;
      durationMin = svc.duration_minutes;

      const customer = await customers.upsertByPhone(payload.tenant_id, customerPhone, {
        name: customerName,
      });
      customerId = customer.id;
      customerName = customer.name || customerName;
    } else {
      // Bloqueio: precisa de duration explícita
      durationMin = typeof body.duration_minutes === 'number' ? body.duration_minutes : 30;
      // Usa/cria um customer sistema pra bloqueios
      const sysCustomer = await customers.upsertByPhone(payload.tenant_id, '55000000000000', {
        name: '(bloqueio)',
      });
      customerId = sysCustomer.id;
    }

    const endIso = addMinutesIso(startIso, durationMin);

    // Evento no Google Calendar (apenas pra appointments reais; pra bloqueios
    // também criamos pra ocupar o calendário do profissional)
    let googleEventId = null;
    try {
      const summary =
        kind === 'block'
          ? `Bloqueio ${body.notes ? '— ' + body.notes.slice(0, 40) : ''}`.trim()
          : `${body.notes?.slice(0, 40) || 'Atendimento'} — ${customerName || ''}`.trim();
      const description =
        kind === 'block'
          ? `Bloqueio criado via painel.${body.notes ? '\n\n' + body.notes : ''}`
          : [
              `Cliente: ${customerName || ''}`,
              `Telefone: ${customerPhone || ''}`,
              body.notes ? `Notas: ${body.notes}` : null,
              '',
              'Agendado via painel agenda-fácil.',
            ]
              .filter(Boolean)
              .join('\n');
      const event = await gcal.createEvent(payload.tenant_id, {
        summary,
        description,
        startIso,
        endIso,
        timezone: tz,
      });
      googleEventId = event.id;
    } catch (err) {
      console.error('[dashboard-api] gcal create failed:', err.message);
    }

    const record = await appts.create({
      tenantId: payload.tenant_id,
      customerId,
      serviceId,
      startsAt: startIso,
      endsAt: endIso,
      googleEventId,
      notes: body.notes || null,
    });

    if (kind === 'appointment' && customerPhone) {
      await customers.updateLastAppointmentAt(customerId, startIso);
      reminderEngine
        .syncForAppointment(record.id)
        .catch((err) => console.error('[dashboard-api] reminder sync failed:', err.message));
    }

    res.json({
      ok: true,
      appointment: {
        id: record.id,
        starts_at: startIso,
        ends_at: endIso,
        kind,
        human_readable: humanDateTimeInTz(startIso, tz),
      },
    });
  });

  // ===== Reagendar =====
  app.patch('/api/bot/appointments/:id', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const id = req.params.id;
    const body = req.body || {};

    const appt = await appts.getById(payload.tenant_id, id);
    if (!appt) return res.status(404).json({ ok: false, error: 'not_found' });

    const tenant = await tenants.getById(payload.tenant_id);
    const tz = tenant.timezone || 'America/Sao_Paulo';
    const oldStartsAt = appt.starts_at;

    let startIso = appt.starts_at;
    let endIso = appt.ends_at;

    if (body.start_time) {
      startIso = body.start_time;
      const durationMs = new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime();
      const durationMin = Math.round(durationMs / 60000);
      endIso = addMinutesIso(startIso, durationMin);

      if (appt.google_event_id) {
        try {
          await gcal.updateEvent(payload.tenant_id, appt.google_event_id, {
            start: { dateTime: startIso, timeZone: tz },
            end: { dateTime: endIso, timeZone: tz },
          });
        } catch (err) {
          console.error('[dashboard-api] gcal update failed:', err.message);
        }
      }
      await appts.updateTimes(appt.id, startIso, endIso);

      reminderEngine
        .syncForAppointment(appt.id)
        .catch((err) => console.error('[dashboard-api] reminder re-sync failed:', err.message));

      // Notifica cliente sobre o reagendamento (AD)
      notifyAppointmentChange(payload.tenant_id, appt.id, 'rescheduled', {
        oldStartsAt,
        newStartsAt: startIso,
      }).catch((err) => console.error('[dashboard-api] notify failed:', err.message));
    }

    res.json({
      ok: true,
      appointment: {
        id: appt.id,
        starts_at: startIso,
        ends_at: endIso,
        human_readable: humanDateTimeInTz(startIso, tz),
      },
    });
  });

  // ===== Enviar mensagem manual pelo dashboard (AC) =====
  app.post('/api/bot/send-message', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const { normalizePhone } = require('../utils/phone');
    const phone = normalizePhone(req.body?.phone);
    const text = req.body?.text;
    if (!phone) return res.status(400).json({ ok: false, error: 'invalid_phone' });
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ ok: false, error: 'empty_text' });
    }
    const jid = phoneToJid(phone);
    if (!jid) return res.status(400).json({ ok: false, error: 'invalid_jid' });

    try {
      await wa.sendText(payload.tenant_id, jid, text.trim());
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'send_failed', detail: err.message });
    }

    await messageQueries.log({
      tenantId: payload.tenant_id,
      waMessageId: null,
      phone,
      direction: 'out',
      body: text.trim(),
    });

    // Atualiza histórico da conversa pra refletir no dashboard
    try {
      const conv = (await conversations.get(payload.tenant_id, phone)) || { history: [] };
      const history = Array.isArray(conv.history) ? conv.history : [];
      history.push({ role: 'assistant', content: [{ type: 'text', text: text.trim() }] });
      await conversations.upsert(payload.tenant_id, phone, { history: history.slice(-40) });
    } catch (err) {
      // best-effort
    }

    res.json({ ok: true });
  });

  // ===== Reviews / CSAT =====
  app.get('/api/bot/reviews', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const { reviews } = require('@agenda-facil/db');
    const [list, agg] = await Promise.all([
      reviews.listByTenant(payload.tenant_id, { limit: 50 }),
      reviews.aggregates(payload.tenant_id, { sinceDays: 90 }),
    ]);
    res.json({ ok: true, reviews: list, aggregates: agg });
  });

  // ===== Exportar CSV =====
  function csvEscape(v) {
    if (v == null) return '';
    const s = String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function sendCsv(res, filename, rows) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(rows.map((r) => r.map(csvEscape).join(',')).join('\n'));
  }

  app.get('/api/bot/export/customers', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const p = pool.getPool();
    const r = await p.query(
      `SELECT name, phone, email, birthday, last_appointment_at, created_at
       FROM customers WHERE tenant_id = $1 ORDER BY name NULLS LAST`,
      [payload.tenant_id],
    );
    const rows = [['nome', 'telefone', 'email', 'aniversario', 'ultimo_atendimento', 'criado_em']];
    for (const row of r.rows) {
      rows.push([
        row.name || '',
        row.phone,
        row.email || '',
        row.birthday ? new Date(row.birthday).toISOString().slice(0, 10) : '',
        row.last_appointment_at ? new Date(row.last_appointment_at).toISOString() : '',
        new Date(row.created_at).toISOString(),
      ]);
    }
    sendCsv(res, 'clientes.csv', rows);
  });

  app.get('/api/bot/export/appointments', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const p = pool.getPool();
    const r = await p.query(
      `SELECT a.starts_at, a.ends_at, a.status, c.name AS customer, c.phone,
              s.name AS service, s.price_cents
       FROM appointments a
       LEFT JOIN customers c ON c.id = a.customer_id
       LEFT JOIN services s ON s.id = a.service_id
       WHERE a.tenant_id = $1 ORDER BY a.starts_at DESC`,
      [payload.tenant_id],
    );
    const rows = [['inicio', 'fim', 'status', 'cliente', 'telefone', 'servico', 'preco_reais']];
    for (const row of r.rows) {
      rows.push([
        new Date(row.starts_at).toISOString(),
        new Date(row.ends_at).toISOString(),
        row.status,
        row.customer || '',
        row.phone || '',
        row.service || '',
        row.price_cents != null ? (row.price_cents / 100).toFixed(2) : '',
      ]);
    }
    sendCsv(res, 'agendamentos.csv', rows);
  });

  app.get('/api/bot/export/reviews', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const p = pool.getPool();
    const r = await p.query(
      `SELECT r.score, r.comment, r.wants_return, r.return_interval_days, r.created_at,
              c.name AS customer_name, c.phone AS customer_phone
       FROM appointment_reviews r
       LEFT JOIN customers c ON c.id = r.customer_id
       WHERE r.tenant_id = $1 ORDER BY r.created_at DESC`,
      [payload.tenant_id],
    );
    const rows = [['data', 'nota', 'comentario', 'quer_retornar', 'intervalo_dias', 'cliente', 'telefone']];
    for (const row of r.rows) {
      rows.push([
        new Date(row.created_at).toISOString(),
        row.score,
        row.comment || '',
        row.wants_return === true ? 'sim' : row.wants_return === false ? 'nao' : '',
        row.return_interval_days || '',
        row.customer_name || '',
        row.customer_phone || '',
      ]);
    }
    sendCsv(res, 'avaliacoes.csv', rows);
  });

  // ===== Stats para home =====
  app.get('/api/bot/stats', async (req, res) => {
    const payload = await auth(req, res);
    if (!payload) return;
    const { reviews } = require('@agenda-facil/db');
    const poolPkg = require('@agenda-facil/db').pool.getPool();

    const [weekAppts, monthClients, csat] = await Promise.all([
      poolPkg.query(
        `SELECT COUNT(*)::int AS n FROM appointments
         WHERE tenant_id = $1 AND status = 'confirmed'
           AND starts_at >= NOW() - INTERVAL '7 days'`,
        [payload.tenant_id],
      ),
      poolPkg.query(
        `SELECT COUNT(*)::int AS n FROM customers
         WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
        [payload.tenant_id],
      ),
      reviews.aggregates(payload.tenant_id, { sinceDays: 30 }),
    ]);
    const cancelled = await poolPkg.query(
      `SELECT COUNT(*)::int AS n FROM appointments
       WHERE tenant_id = $1 AND status = 'cancelled'
         AND starts_at >= NOW() - INTERVAL '30 days'`,
      [payload.tenant_id],
    );
    const total30 = await poolPkg.query(
      `SELECT COUNT(*)::int AS n FROM appointments
       WHERE tenant_id = $1
         AND starts_at >= NOW() - INTERVAL '30 days'`,
      [payload.tenant_id],
    );
    const cancelRate =
      total30.rows[0].n > 0 ? Math.round((cancelled.rows[0].n / total30.rows[0].n) * 100) : 0;

    res.json({
      ok: true,
      stats: {
        appointments_7d: weekAppts.rows[0].n,
        new_customers_30d: monthClients.rows[0].n,
        csat_30d: csat,
        cancel_rate_30d_pct: cancelRate,
      },
    });
  });
}

// Função helper pra notificar cliente em mudanças (AD)
async function notifyAppointmentChange(tenantId, appointmentId, kind, data = {}) {
  const appt = await appts.getDetailed(tenantId, appointmentId);
  if (!appt) return;
  const tenant = await tenants.getById(tenantId);
  const tz = tenant?.timezone || 'America/Sao_Paulo';
  const firstName = (appt.customer_name || '').split(' ')[0] || 'Olá';
  const fmt = (iso) =>
    new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    });

  let text;
  if (kind === 'cancelled') {
    text = `Oi ${firstName}! Seu atendimento de ${fmt(appt.starts_at)} foi cancelado. Qualquer dúvida, é só me chamar. 🙌`;
  } else if (kind === 'rescheduled') {
    text = `Oi ${firstName}! Seu atendimento foi reagendado:\n\nDe: ${fmt(data.oldStartsAt)}\nPara: *${fmt(data.newStartsAt)}*\n\nAté lá! 💈`;
  } else {
    return;
  }

  const { phoneToJid } = require('../utils/phone');
  const jid = phoneToJid(appt.customer_phone);
  if (!jid) return;
  try {
    await wa.sendText(tenantId, jid, text);
    await messageQueries.log({
      tenantId,
      waMessageId: null,
      phone: appt.customer_phone,
      direction: 'out',
      body: text,
    });
  } catch (err) {
    console.error('[notify] send failed:', err.message);
  }
}

// Exporta pra uso pelas tools do Claude (que também chamam em cancel/reschedule)
module.exports.notifyAppointmentChange = notifyAppointmentChange;

module.exports = { register };

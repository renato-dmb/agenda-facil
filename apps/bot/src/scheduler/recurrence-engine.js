const {
  customers,
  scheduled,
  tenants,
  messages: messageQueries,
} = require('@agenda-facil/db');

const TRIGGER_TYPE = 'recurrence_since_last_appointment';

async function enqueueEligibleForTenant(tenant) {
  if (tenant.recurrence_enabled === false) return { enqueued: 0, reason: 'disabled' };
  if (tenant.status !== 'active') return { enqueued: 0, reason: 'tenant_not_active' };

  const triggerDays = tenant.recurrence_trigger_days || 14;
  const retryDays = tenant.recurrence_retry_days || 7;

  const messagesForTenant = await scheduled.getActiveByTriggerType(tenant.id, TRIGGER_TYPE);
  if (messagesForTenant.length === 0) return { enqueued: 0, reason: 'no_messages_configured' };
  const msg = messagesForTenant[0];

  const eligible = await customers.listEligibleForRecurrence(tenant.id, triggerDays);

  const retryCutoffIso = new Date(Date.now() - retryDays * 86400 * 1000).toISOString();
  let enqueued = 0;

  for (const customer of eligible) {
    const hasInbound = await messageQueries.hasInboundSince(tenant.id, customer.phone, retryCutoffIso);
    if (hasInbound) continue;

    const sendAt = new Date();
    const [hh, mm] = (tenant.recurrence_send_hour || '09:00').split(':').map(Number);
    sendAt.setHours(hh, mm, 0, 0);
    if (sendAt.getTime() < Date.now()) sendAt.setDate(sendAt.getDate() + 1);

    const inserted = await scheduled.enqueueForCustomer({
      tenantId: tenant.id,
      scheduledMessageId: msg.id,
      customerId: customer.id,
      phone: customer.phone,
      sendAt: sendAt.toISOString(),
    });
    if (inserted) enqueued += 1;
  }

  return { enqueued, eligible_count: eligible.length };
}

async function enqueueEligibleForAllTenants() {
  const all = await tenants.listActive();
  const results = [];
  for (const t of all) {
    try {
      const r = await enqueueEligibleForTenant(t);
      results.push({ slug: t.slug, ...r });
    } catch (err) {
      console.error(`[recurrence:${t.slug}] failed:`, err.message);
      results.push({ slug: t.slug, error: err.message });
    }
  }
  return results;
}

module.exports = { enqueueEligibleForAllTenants, enqueueEligibleForTenant, TRIGGER_TYPE };

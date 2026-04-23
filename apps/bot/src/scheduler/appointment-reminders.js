const { scheduled } = require('@agenda-facil/db');

// Para um appointment recém-criado/reagendado, enfileira ou atualiza as
// entradas de lembretes (pre_appointment + post_appointment) ativas do tenant.
async function syncForAppointment(appointmentId) {
  const poolPkg = require('@agenda-facil/db').pool.getPool();
  const { rows } = await poolPkg.query(
    `SELECT * FROM appointments WHERE id = $1`,
    [appointmentId],
  );
  const appt = rows[0];
  if (!appt) return { ok: false, reason: 'appointment_not_found' };
  if (appt.status === 'cancelled') {
    await scheduled.removeByAppointment(appointmentId);
    return { ok: true, reason: 'cancelled_cleanup' };
  }

  const { rows: custRows } = await poolPkg.query(
    `SELECT id, phone FROM customers WHERE id = $1`,
    [appt.customer_id],
  );
  const cust = custRows[0];
  if (!cust) return { ok: false, reason: 'customer_not_found' };

  const triggerTypes = ['pre_appointment', 'post_appointment'];
  const totalEnqueued = { pre: 0, post: 0 };

  for (const trigger of triggerTypes) {
    const messages = await scheduled.getActiveByTriggerType(appt.tenant_id, trigger);
    for (const msg of messages) {
      const offset = msg.offset_minutes;
      if (typeof offset !== 'number') continue;

      let base;
      if (trigger === 'pre_appointment') {
        base = new Date(appt.starts_at);
      } else {
        base = new Date(appt.ends_at);
      }
      const sendAt = new Date(base.getTime() + offset * 60 * 1000);

      // Pula se o horário de envio já passou (improvável mas defensivo)
      if (sendAt.getTime() <= Date.now() + 5000) continue;

      await scheduled.upsertAppointmentReminder({
        tenantId: appt.tenant_id,
        scheduledMessageId: msg.id,
        appointmentId: appt.id,
        customerId: cust.id,
        phone: cust.phone,
        sendAt: sendAt.toISOString(),
      });
      if (trigger === 'pre_appointment') totalEnqueued.pre += 1;
      else totalEnqueued.post += 1;
    }
  }

  return { ok: true, enqueued: totalEnqueued };
}

async function removeForAppointment(appointmentId) {
  const removed = await scheduled.removeByAppointment(appointmentId);
  return { ok: true, removed };
}

module.exports = { syncForAppointment, removeForAppointment };

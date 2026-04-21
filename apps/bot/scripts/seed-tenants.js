#!/usr/bin/env node
/**
 * Semente inicial de tenants. Idempotente: roda múltiplas vezes sem duplicar.
 * Uso: node scripts/seed-tenants.js
 *
 * Cria Jeff (barbearia real) e barbeiro-2 (placeholder). Atualize aqui ao onboardar
 * novos profissionais enquanto não houver dashboard.
 */
require('dotenv/config');
const { tenants, services, scheduled, pool } = require('@agenda-facil/db');
const { normalizePhone } = require('../src/utils/phone');

const SEEDS = [
  {
    slug: 'barbeiro-jeff',
    name: 'Barbearia do Jeff',
    profession_type: 'barbearia',
    timezone: 'America/Sao_Paulo',
    whatsapp_number: process.env.JEFF_WHATSAPP_NUMBER
      ? normalizePhone(process.env.JEFF_WHATSAPP_NUMBER)
      : null,
    owner_phone: normalizePhone('5511989064335'),
    status: 'pending',
    services: [
      { name: 'Corte', duration_minutes: 30, price_cents: 5000, display_order: 1 },
      { name: 'Barba', duration_minutes: 30, price_cents: 4000, display_order: 2 },
      { name: 'Corte + Barba', duration_minutes: 60, price_cents: 8000, display_order: 3 },
      { name: 'Sobrancelha', duration_minutes: 15, price_cents: 2000, display_order: 4 },
    ],
    business_hours: [
      { weekday: 2, start_time: '09:00', end_time: '19:00' },
      { weekday: 3, start_time: '09:00', end_time: '19:00' },
      { weekday: 4, start_time: '09:00', end_time: '19:00' },
      { weekday: 5, start_time: '09:00', end_time: '19:00' },
      { weekday: 6, start_time: '09:00', end_time: '18:00' },
    ],
    scheduled_messages: [
      {
        name: 'recorrencia_14_dias',
        trigger_type: 'recurrence_since_last_appointment',
        offset_days: 14,
        send_hour: '09:00',
        content_type: 'template',
        content:
          'Oi {first_name}! 💈 Já faz um tempinho desde seu último corte com o Jeff. Bora agendar os próximos? É só me dizer quando fica bom pra você.',
        active: true,
      },
    ],
  },
  {
    slug: 'barbeiro-2',
    name: 'Segundo Barbeiro (placeholder)',
    profession_type: 'barbearia',
    timezone: 'America/Sao_Paulo',
    whatsapp_number: null,
    status: 'pending',
    services: [
      { name: 'Corte', duration_minutes: 30, price_cents: 5000, display_order: 1 },
      { name: 'Barba', duration_minutes: 30, price_cents: 4000, display_order: 2 },
      { name: 'Corte + Barba', duration_minutes: 60, price_cents: 8000, display_order: 3 },
    ],
    business_hours: [
      { weekday: 2, start_time: '09:00', end_time: '19:00' },
      { weekday: 3, start_time: '09:00', end_time: '19:00' },
      { weekday: 4, start_time: '09:00', end_time: '19:00' },
      { weekday: 5, start_time: '09:00', end_time: '19:00' },
      { weekday: 6, start_time: '09:00', end_time: '18:00' },
    ],
    scheduled_messages: [
      {
        name: 'recorrencia_14_dias',
        trigger_type: 'recurrence_since_last_appointment',
        offset_days: 14,
        send_hour: '09:00',
        content_type: 'template',
        content:
          'Oi {first_name}! Já faz um tempinho. Bora agendar seu próximo atendimento?',
        active: true,
      },
    ],
  },
];

async function main() {
  for (const seed of SEEDS) {
    const tenant = await tenants.upsertTenant({
      slug: seed.slug,
      name: seed.name,
      profession_type: seed.profession_type,
      timezone: seed.timezone,
      whatsapp_number: seed.whatsapp_number,
      status: seed.status,
    });
    if (seed.owner_phone) {
      await tenants.setOwnerPhone(tenant.id, seed.owner_phone);
    }
    await tenants.upsertSettings(tenant.id, {});

    for (const [i, svc] of (seed.services || []).entries()) {
      await services.upsertByName(tenant.id, { ...svc, display_order: svc.display_order ?? i });
    }
    if (seed.business_hours) {
      await services.replaceBusinessHours(tenant.id, seed.business_hours);
    }
    for (const m of seed.scheduled_messages || []) {
      await scheduled.upsertScheduledMessage(tenant.id, m);
    }

    console.log(`✓ ${tenant.slug} (${tenant.id}) — ${seed.services.length} services, ${(seed.scheduled_messages || []).length} scheduled message(s)`);
  }
  await pool.getPool().end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

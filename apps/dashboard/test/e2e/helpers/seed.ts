import pkg from '@agenda-facil/db';

// Seed mínimo pra testes E2E — tenant + settings + alguns dados.
// Usa o test DB (TEST_DATABASE_URL), compartilhado com os testes de backend.
export async function seedDashboardTenant() {
  const { testHelpers, tenants, customers } = pkg;
  const pool = testHelpers.makeTestPool();
  await testHelpers.resetTestDb(pool);

  const tenant = await testHelpers.seedTenant(pool, {
    slug: 'e2e-tenant',
    name: 'Dashboard E2E',
    whatsapp_number: '5511999998888',
    status: 'active',
  });

  // owner phone pra JWT bater
  await pool.query(`UPDATE tenants SET owner_phone = $1 WHERE id = $2`, [
    '5511987654321',
    tenant.id,
  ]);

  // 1 serviço
  await pool.query(
    `INSERT INTO services (tenant_id, name, duration_minutes, price_cents, active)
     VALUES ($1, 'Corte clássico', 30, 4500, true)`,
    [tenant.id],
  );

  // 3 clientes
  for (let i = 1; i <= 3; i += 1) {
    await customers.upsertByPhone(tenant.id, `55119000000${i.toString().padStart(2, '0')}`, {
      name: `Cliente ${i}`,
    });
  }

  await pool.end();
  return tenant;
}

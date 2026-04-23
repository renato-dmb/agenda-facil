import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { seedDashboardTenant } from './helpers/seed';

test.describe('navegação golden path', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const tenant = await seedDashboardTenant();
    await loginAs(context, tenant.id, baseURL!);
  });

  test('home renderiza cards de stats', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/home/);
    // Espera encontrar pelo menos um card (os componentes Card tem role article ou classe card)
    const cards = page.locator('[class*="card"], article, section').filter({
      hasText: /(agendamento|cliente|avaliaç|cancelament|retenç)/i,
    });
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
  });

  test('agendamentos lista vazia quando não há dados', async ({ page }) => {
    await page.goto('/agendamentos');
    await page.waitForLoadState('networkidle');
    // sem crash; url correto
    await expect(page).toHaveURL(/\/agendamentos/);
  });

  test('clientes mostra os 3 clientes do seed', async ({ page }) => {
    await page.goto('/clientes');
    await page.waitForLoadState('networkidle');
    // Os clientes seedados tem nome "Cliente 1/2/3"
    await expect(page.getByText('Cliente 1').first()).toBeVisible();
    await expect(page.getByText('Cliente 2').first()).toBeVisible();
    await expect(page.getByText('Cliente 3').first()).toBeVisible();
  });

  test('ajustes/servicos mostra o serviço seedado', async ({ page }) => {
    await page.goto('/ajustes/servicos');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Corte clássico/i).first()).toBeVisible();
  });

  test('relatorios carrega sem erro', async ({ page }) => {
    await page.goto('/relatorios');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/relatorios/);
  });

  test('conversas carrega sem erro', async ({ page }) => {
    await page.goto('/conversas');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/conversas/);
  });

  test('ajustes/integracoes mostra seletor de provedor de agenda', async ({ page }) => {
    await page.goto('/ajustes/integracoes');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Provedor de agenda/i).first()).toBeVisible();
    await expect(page.getByText(/Google Calendar/i).first()).toBeVisible();
    await expect(page.getByText(/Avec/i).first()).toBeVisible();
  });
});

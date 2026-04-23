import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { seedDashboardTenant } from './helpers/seed';

test.describe('login / autenticação', () => {
  test('redireciona usuário não logado pra /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('página de login renderiza campos esperados', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="tel"], input[name="phone"]').first()).toBeVisible();
  });

  test('cookie válido dá acesso à home', async ({ page, context, baseURL }) => {
    const tenant = await seedDashboardTenant();
    await loginAs(context, tenant.id, baseURL!);
    await page.goto('/');
    // a home redireciona pra /home ou renderiza — só testamos que NÃO redireciona pra login
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toMatch(/\/login/);
  });
});

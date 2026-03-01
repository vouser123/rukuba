import { test, expect } from '@playwright/test';

test('landing page renders auth UI', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('body')).toBeVisible();

  const hasEmailInput = await page.locator('input[type="email"]').first().isVisible().catch(() => false);
  const hasPasswordInput = await page.locator('input[type="password"]').first().isVisible().catch(() => false);

  expect(hasEmailInput || hasPasswordInput).toBeTruthy();
});

test('optional login smoke (env-driven)', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_EMAIL;
  const password = process.env.PLAYWRIGHT_PASSWORD;

  test.skip(!email || !password, 'Set PLAYWRIGHT_EMAIL and PLAYWRIGHT_PASSWORD to enable login smoke.');

  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);

  const signInButton = page.getByRole('button', { name: /sign in|log in/i }).first();
  await signInButton.click();

  // Supabase auth success creates a localStorage auth-token entry with access token.
  await page.waitForFunction(() => {
    const authKey = Object.keys(localStorage).find((key) => key.includes('auth-token'));
    if (!authKey) return false;
    const raw = localStorage.getItem(authKey);
    return typeof raw === 'string' && raw.includes('access_token');
  }, { timeout: 15000 });
});

import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'test@migestor.com';
const TEST_PASSWORD = 'Test123456';

test('Full application flow - login and navigate to dashboard', async ({ page }) => {
  console.log('1. Navigating to homepage...');

  // Navigate to homepage (should redirect to login)
  await page.goto('http://localhost:3001/', {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  // Should redirect to login page
  await expect(page).toHaveURL(/.*login/);
  console.log('✓ Redirected to login page');

  // Check login form is visible
  const emailInput = page.locator('input[name="email"], input[type="email"]');
  const passwordInput = page.locator('input[name="password"], input[type="password"]');
  const submitButton = page.locator('button[type="submit"]');

  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await expect(submitButton).toBeVisible();
  console.log('✓ Login form is visible');

  // Fill login form
  console.log('2. Logging in...');
  await emailInput.fill(TEST_EMAIL);
  await passwordInput.fill(TEST_PASSWORD);
  await submitButton.click();

  // Wait for redirect to dashboard
  await page.waitForURL(/.*dashboard/, { timeout: 10000 });
  console.log('✓ Successfully logged in and redirected to dashboard');

  // Wait for dashboard content to load
  await page.waitForTimeout(2000);

  // Check that we're not stuck on "Cargando..."
  const bodyText = await page.locator('body').textContent();
  const hasLoadingOnly = bodyText?.trim() === 'Cargando' || bodyText?.trim() === 'miGestor\nCargando';

  expect(hasLoadingOnly).toBe(false);
  console.log('✓ Dashboard loaded successfully (not stuck on loading)');

  // Take screenshot of dashboard
  await page.screenshot({ path: 'dashboard-screenshot.png', fullPage: true });
  console.log('✓ Screenshot saved to: dashboard-screenshot.png');

  console.log('\n✅ FULL APPLICATION FLOW SUCCESSFUL!');
});

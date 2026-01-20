import { test, expect } from '@playwright/test';

test('Debug: verificar cálculos de balance', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3001/login');
  await page.fill('input[type="email"]', 'test@migestor.com');
  await page.fill('input[type="password"]', 'Test123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  // Go to facturas
  await page.goto('http://localhost:3001/facturas');
  await page.waitForTimeout(3000);

  // Get the values from cards
  const ingresosText = await page.locator('div:has-text("Ingresos 2026") .text-3xl').textContent();
  const gastosText = await page.locator('div:has-text("Gastos 2026") .text-3xl').textContent();
  const balanceText = await page.locator('div:has-text("Balance 2026") .text-3xl').textContent();

  console.log('💰 Ingresos:', ingresosText);
  console.log('💸 Gastos:', gastosText);
  console.log('📊 Balance:', balanceText);

  // Count rows in table
  const ingresoRows = await page.locator('tbody tr:has(span:has-text("Ingreso"))').count();
  const gastoRows = await page.locator('tbody tr:has(span:has-text("Gasto"))').count();

  console.log(`📋 Filas de ingreso: ${ingresoRows}`);
  console.log(`📋 Filas de gasto: ${gastoRows}`);

  // Get totals from each row
  const totalCells = await page.locator('tbody tr td:nth-child(7)').allTextContents();
  console.log('💵 Totales en tabla:', totalCells);

  await page.screenshot({ path: '/tmp/balance-debug.png', fullPage: true });
});

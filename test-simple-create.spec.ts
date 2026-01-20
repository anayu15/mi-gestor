import { test, expect } from '@playwright/test';

test('Test simple: crear factura y verificar que aparece', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3001/login');
  await page.fill('input[type="email"]', 'test@migestor.com');
  await page.fill('input[type="password"]', 'Test123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  console.log('✅ Login exitoso');

  // Go to facturas first to see what years we have
  await page.goto('http://localhost:3001/facturas');
  await page.waitForTimeout(2000);

  // Take screenshot of current state
  await page.screenshot({ path: '/tmp/facturas-before.png', fullPage: true });
  console.log('📸 Screenshot guardado: /tmp/facturas-before.png');

  // Check what years are available
  const yearButtons = await page.locator('div.border-b button').allTextContents();
  console.log('📅 Años disponibles:', yearButtons);

  // Create new invoice for 2026
  await page.click('a[href="/facturas/nueva"]');
  await page.waitForURL('**/facturas/nueva');
  await page.waitForTimeout(1000);

  await page.fill('input[name="fecha_emision"]', '2026-01-11');
  await page.fill('textarea[name="concepto"]', 'TEST SIMPLE ' + Date.now());
  await page.fill('input[name="base_imponible"]', '1000');

  const clientSelect = page.locator('select[name="cliente_id"]');
  await clientSelect.selectOption({ index: 1 });

  await page.click('button[type="submit"]');
  console.log('📝 Factura enviada');

  // Wait for redirect
  await page.waitForTimeout(4000);

  const currentUrl = page.url();
  console.log('📍 URL actual:', currentUrl);

  // Go to facturas explicitly
  await page.goto('http://localhost:3001/facturas');
  await page.waitForTimeout(3000);

  // Take screenshot after creation
  await page.screenshot({ path: '/tmp/facturas-after.png', fullPage: true });
  console.log('📸 Screenshot guardado: /tmp/facturas-after.png');

  // Check what years are available now
  const yearButtonsAfter = await page.locator('div.border-b button').allTextContents();
  console.log('📅 Años disponibles después:', yearButtonsAfter);

  // Check if 2026 tab exists and click it
  const tab2026 = page.locator('div.border-b button:has-text("2026")');
  const tab2026Exists = await tab2026.isVisible().catch(() => false);

  if (tab2026Exists) {
    console.log('✅ Tab 2026 encontrado, haciendo clic...');
    await tab2026.click();
    await page.waitForTimeout(1000);
  } else {
    console.log('❌ Tab 2026 NO encontrado');
  }

  // Check if our invoice appears
  const testInvoice = page.locator('text=TEST SIMPLE');
  const invoiceExists = await testInvoice.isVisible().catch(() => false);

  if (invoiceExists) {
    console.log('✅ Factura encontrada en la lista');
  } else {
    console.log('❌ Factura NO encontrada en la lista');

    // List all visible table rows
    const tableRows = await page.locator('tbody tr').allTextContents();
    console.log('📋 Filas en tabla:', tableRows.length);
    if (tableRows.length > 0) {
      console.log('Primeras 3 filas:', tableRows.slice(0, 3));
    }
  }
});

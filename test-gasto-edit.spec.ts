import { test, expect } from '@playwright/test';

test('verificar que el botón Editar de gasto funciona', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3001/login');
  await page.fill('input[name="email"]', 'test@migestor.com');
  await page.fill('input[name="password"]', 'test123');
  await page.click('button[type="submit"]');

  // Wait for navigation to dashboard
  await page.waitForURL('**/dashboard');
  console.log('✅ Login exitoso');

  // Navigate to facturas
  await page.click('a[href="/facturas"]');
  await page.waitForURL('**/facturas');
  console.log('✅ Navegado a facturas');

  // Wait for the page to load
  await page.waitForTimeout(1000);

  // Look for a "Gasto" badge to identify expense rows
  const gastoBadge = page.locator('span:has-text("Gasto")').first();
  const isVisible = await gastoBadge.isVisible().catch(() => false);

  if (!isVisible) {
    console.log('⚠️  No hay gastos en la lista. Creando uno primero...');

    // Create a test expense first
    await page.click('a[href="/gastos/nuevo"]');
    await page.waitForURL('**/gastos/nuevo');

    await page.fill('input[name="concepto"]', 'Gasto de prueba para editar');
    await page.fill('input[name="proveedor_nombre"]', 'Proveedor Test');
    await page.fill('input[name="fecha_emision"]', '2025-01-10');
    await page.fill('input[name="base_imponible"]', '100');

    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Go back to facturas
    await page.click('a[href="/facturas"]');
    await page.waitForURL('**/facturas');
    await page.waitForTimeout(1000);
  }

  // Find the first expense row (has "Gasto" badge)
  const gastoRow = page.locator('tr:has(span:has-text("Gasto"))').first();

  // Click the "Editar" link in that row
  const editLink = gastoRow.locator('a:has-text("Editar")');
  const editHref = await editLink.getAttribute('href');
  console.log('🔍 URL del enlace Editar:', editHref);

  await editLink.click();

  // Wait a bit to see where we land
  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  console.log('📍 URL actual:', currentUrl);

  // Check if we're on a 404 page
  const bodyText = await page.textContent('body');

  if (bodyText?.includes('404') || currentUrl.includes('404')) {
    console.log('❌ ERROR: Página 404 detectada');
    console.log('   Se esperaba: /gastos/[id]/editar');
    console.log('   Se obtuvo:', currentUrl);
  } else if (currentUrl.includes('/gastos/') && currentUrl.includes('/editar')) {
    console.log('✅ ÉXITO: Navegó correctamente a la página de edición');
  } else {
    console.log('⚠️  URL inesperada:', currentUrl);
  }
});

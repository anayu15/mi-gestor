import { test, expect } from '@playwright/test';

test('validar actualización de fecha de factura', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3001/login');
  await page.fill('input[name="email"]', 'test@migestor.com');
  await page.fill('input[name="password"]', 'test123');
  await page.click('button[type="submit"]');

  // Wait for navigation to dashboard
  await page.waitForURL('**/dashboard');

  // Navigate to invoices
  await page.click('a[href="/facturas"]');
  await page.waitForURL('**/facturas');

  // Click on first invoice edit button
  await page.click('text=Editar >> nth=0');
  await page.waitForURL('**/facturas/**/editar');

  // Get current date value
  const dateInput = page.locator('input[name="fecha_emision"]');
  const originalDate = await dateInput.inputValue();
  console.log('Fecha original:', originalDate);

  // Change the date
  const newDate = '2025-12-25';
  await dateInput.fill(newDate);
  console.log('Nueva fecha ingresada:', newDate);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for success message
  await expect(page.locator('text=Factura actualizada correctamente')).toBeVisible({ timeout: 5000 });
  console.log('Mensaje de éxito visible');

  // Wait for redirect
  await page.waitForURL('**/facturas', { timeout: 5000 });

  // Reload to ensure fresh data
  await page.reload();

  // Check if date was actually updated in the table
  const firstInvoiceDateCell = page.locator('tbody tr:first-child td:nth-child(2)');
  const displayedDate = await firstInvoiceDateCell.textContent();
  console.log('Fecha mostrada en tabla:', displayedDate);

  // Try to edit again to see what date is in the form
  await page.click('text=Editar >> nth=0');
  await page.waitForURL('**/facturas/**/editar');

  const actualDate = await dateInput.inputValue();
  console.log('Fecha en formulario después de actualizar:', actualDate);

  if (actualDate === newDate) {
    console.log('✅ ÉXITO: La fecha se actualizó correctamente');
  } else {
    console.log('❌ ERROR: La fecha NO se actualizó. Se mantuvo como:', actualDate);
    console.log('   Se esperaba:', newDate);
  }
});

import { test, expect } from '@playwright/test';

test('Test: cancelar edición de gasto y verificar tabla', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3001/login');
  await page.fill('input[type="email"]', 'test@migestor.com');
  await page.fill('input[type="password"]', 'Test123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  console.log('✅ Login exitoso');

  // Go to gastos directly
  await page.goto('http://localhost:3001/gastos');
  await page.waitForTimeout(2000);

  console.log('📸 En página de gastos');
  await page.screenshot({ path: '/tmp/gastos-page.png', fullPage: true });

  // Check if there's an error or if table is visible
  const errorVisible = await page.locator('text=Error').isVisible().catch(() => false);
  if (errorVisible) {
    const errorText = await page.locator('text=Error').textContent();
    console.log('❌ Error encontrado:', errorText);
  }

  const tableVisible = await page.locator('table').isVisible().catch(() => false);
  if (tableVisible) {
    console.log('✅ Tabla visible');
    const rows = await page.locator('tbody tr').count();
    console.log(`📊 Número de filas en tabla: ${rows}`);
  } else {
    console.log('❌ Tabla NO visible');
  }

  // Try to edit a gasto
  const editButton = page.locator('a:has-text("Editar")').first();
  const editExists = await editButton.isVisible().catch(() => false);

  if (editExists) {
    console.log('✅ Botón Editar encontrado, haciendo clic...');
    await editButton.click();
    await page.waitForTimeout(1000);

    // Click cancel
    const cancelButton = page.locator('a:has-text("Cancelar")');
    const cancelExists = await cancelButton.isVisible().catch(() => false);

    if (cancelExists) {
      console.log('✅ Botón Cancelar encontrado, haciendo clic...');
      await cancelButton.click();
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      console.log('📍 URL después de cancelar:', currentUrl);

      // Take screenshot after cancel
      await page.screenshot({ path: '/tmp/after-cancel.png', fullPage: true });

      // Check if page looks broken
      const bodyText = await page.textContent('body');
      if (bodyText?.includes('Error') || bodyText?.includes('undefined') || bodyText?.includes('NaN')) {
        console.log('❌ La página parece tener errores');
        console.log('Contenido:', bodyText?.substring(0, 500));
      } else {
        console.log('✅ La página parece normal');
      }
    }
  } else {
    console.log('⚠️  No hay gastos para editar');
  }
});

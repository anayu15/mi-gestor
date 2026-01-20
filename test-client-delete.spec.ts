import { test, expect } from '@playwright/test';

test.describe('Client Deletion Flow', () => {
  test('delete client via edit page', async ({ page }) => {
    test.setTimeout(180000);

    // 1. Login
    console.log('Step 1: Logging in...');
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="email"]').fill('test@migestor.com');
    await page.locator('input[type="password"]').fill('Test123456');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    console.log('Logged in successfully!');

    // 2. Navigate to clientes page
    console.log('Step 2: Navigating to clientes page...');
    await page.goto('http://localhost:3001/clientes');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/delete-01-clientes-page.png', fullPage: true });

    // 3. Check if Ai Consortivm exists
    console.log('Step 3: Looking for Ai Consortivm client...');
    const clientExists = await page.locator('text=Ai Consortivm').isVisible({ timeout: 3000 }).catch(() => false);

    if (!clientExists) {
      console.log('Client "Ai Consortivm" not found. Creating it first...');

      // Create the client
      const newClientBtn = page.locator('a:has-text("Nuevo Cliente"), button:has-text("Nuevo Cliente"), button:has-text("Crear primer cliente")').first();
      await newClientBtn.click();
      await page.waitForTimeout(1000);

      await page.locator('input[name="nombre"]').fill('Ai Consortivm');
      await page.locator('input[name="cif"]').fill('A56760267');
      await page.locator('input[name="direccion"]').fill('Sector Literatos 38');
      await page.locator('input[name="ciudad"]').fill('Tres Cantos, Madrid');
      await page.locator('input[name="codigo_postal"]').fill('28760');

      await page.locator('button:has-text("Crear Cliente")').click();
      await page.waitForTimeout(2000);

      // Navigate back to list
      await page.goto('http://localhost:3001/clientes');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'test-results/delete-02-client-exists.png', fullPage: true });

    // 4. Click "Editar" link for Ai Consortivm
    console.log('Step 4: Clicking Editar link for Ai Consortivm...');

    // Find the row containing Ai Consortivm and click its Editar link
    const clientRow = page.locator('tr:has-text("Ai Consortivm"), div:has-text("Ai Consortivm")').first();
    const editLink = clientRow.locator('a:has-text("Editar")');

    if (await editLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editLink.click();
      console.log('Clicked Editar link');
    } else {
      // Fallback: click first Editar link
      await page.locator('a:has-text("Editar")').first().click();
      console.log('Clicked first Editar link');
    }

    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/delete-03-edit-page.png', fullPage: true });

    // 5. Click the red "Eliminar" button
    console.log('Step 5: Clicking Eliminar button...');
    const deleteBtn = page.locator('button:has-text("Eliminar")');
    await deleteBtn.click();
    console.log('Clicked Eliminar button');

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/delete-04-confirm-dialog.png', fullPage: true });

    // 6. Click "Si, eliminar" in the confirmation dialog
    console.log('Step 6: Confirming deletion...');

    // The confirmation dialog has "Si, eliminar" button
    const confirmBtn = page.locator('button:has-text("Si, eliminar"), button:has-text("Sí, eliminar")');

    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Found confirmation button');
      await confirmBtn.click();
      console.log('Clicked "Si, eliminar" to confirm');
    } else {
      console.log('Confirmation button not found, looking for alternatives...');
      // Try other selectors
      const altConfirm = page.locator('button.bg-red-600, button.bg-red-500').first();
      if (await altConfirm.isVisible({ timeout: 2000 }).catch(() => false)) {
        await altConfirm.click();
        console.log('Clicked red confirmation button');
      }
    }

    // Wait for deletion to process
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/delete-05-after-confirm.png', fullPage: true });

    // 7. Navigate back to clientes list
    console.log('Step 7: Navigating back to clientes list...');
    await page.goto('http://localhost:3001/clientes');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/delete-06-list-after-delete.png', fullPage: true });

    // 8. Check if client is still visible (without Mostrar inactivos)
    const clientStillActive = await page.locator('text=Ai Consortivm').isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Client visible in active list: ${clientStillActive}`);

    if (clientStillActive) {
      console.log('VERIFICATION: Client is STILL ACTIVE in the list');
    } else {
      console.log('VERIFICATION: Client is NOT visible in active list (deletion may have worked)');
    }

    // 9. Check with "Mostrar inactivos" checkbox
    const showInactiveCheckbox = page.locator('input[type="checkbox"]').first();
    if (await showInactiveCheckbox.isVisible({ timeout: 1000 }).catch(() => false)) {
      await showInactiveCheckbox.check();
      console.log('Checked Mostrar inactivos');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/delete-07-show-inactive.png', fullPage: true });

      const clientInInactive = await page.locator('text=Ai Consortivm').isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`Client visible when showing inactive: ${clientInInactive}`);

      // Check if client has "Inactivo" badge
      const inactiveBadge = page.locator('tr:has-text("Ai Consortivm") >> text=Inactivo');
      const hasInactiveBadge = await inactiveBadge.isVisible({ timeout: 2000 }).catch(() => false);

      if (!clientInInactive) {
        console.log('RESULT: Client was HARD-DELETED (completely removed from database)');
      } else if (hasInactiveBadge) {
        console.log('RESULT: Client was SOFT-DELETED - marked as "Inactivo"');
      } else {
        console.log('RESULT: Client is still active (visible without Inactivo badge)');
      }
    }

    // Final screenshot
    await page.screenshot({ path: 'test-results/delete-final.png', fullPage: true });
    console.log('Test completed!');
  });
});

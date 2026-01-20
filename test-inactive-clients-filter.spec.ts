import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'test@migestor.com',
  password: 'Test123456'
};

test.describe('Inactive Clients Filter Test', () => {
  test('should not show inactive clients in invoice creation form', async ({ page }) => {
    console.log('Step 1: Logging in...');
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ Login successful');

    // Navigate to clients page and mark a client as inactive
    console.log('Step 2: Marking a client as inactive...');
    await page.goto('http://localhost:3001/clientes');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/inactive-01-clients-list.png', fullPage: true });

    // Find first client and click edit
    const firstEditLink = page.locator('a:has-text("Editar")').first();
    const hasClient = await firstEditLink.count();

    if (hasClient === 0) {
      console.log('⚠️  No clients found, creating one first...');
      // Create a test client
      await page.click('text=Nuevo Cliente');
      await page.waitForTimeout(500);

      const timestamp = Date.now();
      await page.fill('input[name="razon_social"]', `Test Inactive Client ${timestamp}`);
      await page.fill('input[name="cif"]', `B${timestamp.toString().slice(-7)}9`);
      await page.fill('input[name="email"]', `inactive${timestamp}@test.com`);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/clientes', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
    }

    // Get client name before marking as inactive
    const clientNameElement = page.locator('table tbody tr').first().locator('td').first().locator('div').first();
    const clientName = await clientNameElement.textContent();
    console.log(`Found client: "${clientName}"`);

    // Click edit on first client
    await page.locator('a:has-text("Editar")').first().click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/inactive-02-edit-form.png', fullPage: true });

    // Uncheck "Cliente activo"
    const activoCheckbox = page.locator('input[name="activo"]');
    await activoCheckbox.uncheck();
    await page.screenshot({ path: 'screenshots/inactive-03-marked-inactive.png', fullPage: true });

    // Save
    await page.click('button[type="submit"]:has-text("Guardar")');
    await page.waitForURL('**/clientes', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/inactive-04-back-to-list.png', fullPage: true });

    console.log('✅ Client marked as inactive');

    // Navigate to facturas page
    console.log('Step 3: Opening invoice creation modal...');
    await page.goto('http://localhost:3001/facturas');
    await page.waitForLoadState('networkidle');

    // Click "Nueva Factura" button
    await page.click('button:has-text("Nueva Factura"), button:has-text("Nuevo Ingreso")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/inactive-05-invoice-modal.png', fullPage: true });

    // Check the cliente dropdown
    const clienteSelect = page.locator('select[name="cliente_id"], select#cliente_id');
    const options = await clienteSelect.locator('option').allTextContents();

    console.log('Available clients in dropdown:', options);

    // Verify the inactive client is NOT in the list
    const hasInactiveClient = options.some(opt => opt.includes(clientName || ''));

    if (hasInactiveClient) {
      console.log('❌ FAIL: Inactive client appears in dropdown');
      await page.screenshot({ path: 'screenshots/inactive-06-FAIL-inactive-shown.png', fullPage: true });
      throw new Error(`Inactive client "${clientName}" should not appear in invoice dropdown`);
    } else {
      console.log('✅ PASS: Inactive client correctly filtered out');
      await page.screenshot({ path: 'screenshots/inactive-06-PASS-inactive-hidden.png', fullPage: true });
    }

    // Verify client still appears in clients management page
    console.log('Step 4: Verifying inactive client appears in management page...');
    await page.keyboard.press('Escape'); // Close modal
    await page.goto('http://localhost:3001/clientes');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/inactive-07-verify-in-management.png', fullPage: true });

    const clientInList = page.locator('table').locator(`text=${clientName}`);
    await expect(clientInList).toBeVisible({ timeout: 5000 });

    // Should have "Inactivo" badge
    const clientRow = page.locator(`tr:has-text("${clientName}")`);
    await expect(clientRow.locator('text=Inactivo')).toBeVisible();

    console.log('✅ Inactive client correctly visible in management page with badge');
    console.log('\n✅ ALL TESTS PASSED!');
  });
});

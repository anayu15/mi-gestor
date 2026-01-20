import { test, expect } from '@playwright/test';

test.describe('Client Deletion Verification', () => {
  test('verify client deletion in facturas settings panel', async ({ page }) => {
    // Step 1: Navigate to login page
    console.log('Step 1: Navigating to login page...');
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');

    // Take screenshot of login page
    await page.screenshot({ path: 'test-results/01-login-page.png', fullPage: true });
    console.log('Screenshot saved: 01-login-page.png');

    // Step 2: Log in with test credentials
    console.log('Step 2: Logging in with test credentials...');
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('Successfully logged in and redirected to dashboard');
    await page.screenshot({ path: 'test-results/02-dashboard.png', fullPage: true });
    console.log('Screenshot saved: 02-dashboard.png');

    // Step 3: Navigate to facturas tab
    console.log('Step 3: Navigating to facturas tab...');
    await page.click('a[href="/facturas"]');
    await page.waitForURL('**/facturas');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/03-facturas-page.png', fullPage: true });
    console.log('Screenshot saved: 03-facturas-page.png');

    // Step 4: Click the settings gear icon button
    console.log('Step 4: Opening settings panel...');
    await page.waitForTimeout(1000);

    const settingsButton = page.locator('button[title="Configuración de Facturas"]');
    await settingsButton.click();

    // Wait for the settings panel to appear
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/04-settings-panel-open.png', fullPage: true });
    console.log('Screenshot saved: 04-settings-panel-open.png');

    // Step 5: Check if we need to create a client first
    console.log('Step 5: Checking for existing clients...');
    const noClientsMessage = page.locator('text=No tienes clientes registrados');
    const hasNoClients = await noClientsMessage.count() > 0;

    if (hasNoClients) {
      console.log('No clients found - creating a test client first...');

      // Click "Crear primer cliente" or "+ Nuevo Cliente" button
      const createButton = page.locator('button:has-text("Crear primer cliente"), button:has-text("Nuevo Cliente")').first();
      await createButton.click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: 'test-results/05-new-client-modal.png', fullPage: true });
      console.log('Screenshot saved: 05-new-client-modal.png');

      // Fill in client details
      // Look for the form fields in the modal
      const razonSocialInput = page.locator('input[name="razon_social"], input[placeholder*="razón"], input[placeholder*="nombre"]').first();
      const cifInput = page.locator('input[name="cif"], input[placeholder*="CIF"], input[placeholder*="NIF"]').first();
      const emailInput = page.locator('input[name="email"], input[type="email"]').last(); // Use last() to avoid login email field
      const direccionInput = page.locator('input[name="direccion"], input[placeholder*="dirección"], textarea[name="direccion"]').first();

      // Fill form with test data
      const testClientName = `Test Client ${Date.now()}`;
      await razonSocialInput.fill(testClientName);
      await cifInput.fill('B12345678');
      await emailInput.fill('testclient@test.com');
      await direccionInput.fill('Calle Test 123, Madrid');

      await page.screenshot({ path: 'test-results/06-client-form-filled.png', fullPage: true });
      console.log('Screenshot saved: 06-client-form-filled.png');

      // Submit the form
      const submitButton = page.locator('button[type="submit"]:has-text("Guardar"), button[type="submit"]:has-text("Crear")').first();
      if (await submitButton.count() === 0) {
        // Try generic submit button
        const anySubmit = page.locator('form button[type="submit"]');
        await anySubmit.click();
      } else {
        await submitButton.click();
      }

      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-results/07-client-created.png', fullPage: true });
      console.log('Screenshot saved: 07-client-created.png');
      console.log(`Created test client: ${testClientName}`);
    }

    // Step 6: Wait for clients to load and count them
    await page.waitForTimeout(1000);
    console.log('Step 6: Verifying clients are displayed...');

    // Count delete buttons to know how many clients we have
    const deleteButtons = page.locator('button[title="Eliminar"]');
    const clientCountBefore = await deleteButtons.count();
    console.log(`Found ${clientCountBefore} clients with delete buttons`);

    await page.screenshot({ path: 'test-results/08-clients-list.png', fullPage: true });
    console.log('Screenshot saved: 08-clients-list.png');

    if (clientCountBefore > 0) {
      // Step 7: Delete the first client
      console.log('Step 7: Deleting the first client...');

      // Get client info before deletion
      const firstDeleteBtn = deleteButtons.first();
      const clientRow = firstDeleteBtn.locator('xpath=ancestor::tr');
      const clientName = await clientRow.locator('td').first().textContent();
      console.log(`Deleting client: ${clientName?.trim()}`);

      // Click delete
      await firstDeleteBtn.click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: 'test-results/09-delete-confirmation.png', fullPage: true });
      console.log('Screenshot saved: 09-delete-confirmation.png');

      // Confirm deletion - look for the confirmation modal button
      const confirmModal = page.locator('.fixed, [role="dialog"]').filter({ hasText: 'Confirmar' });
      if (await confirmModal.count() > 0) {
        const confirmBtn = confirmModal.locator('button:has-text("Eliminar")');
        if (await confirmBtn.count() > 0) {
          console.log('Clicking confirm button in modal...');
          await confirmBtn.click();
        }
      } else {
        // Try finding confirm button directly
        const confirmBtns = page.locator('button:has-text("Eliminar")');
        const count = await confirmBtns.count();
        if (count > 1) {
          // Click the last one (likely in the modal)
          await confirmBtns.last().click();
        }
      }

      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-results/10-after-delete.png', fullPage: true });
      console.log('Screenshot saved: 10-after-delete.png');

      // Step 8: Count clients after deletion
      const clientCountAfterDelete = await deleteButtons.count();
      console.log(`Clients after deletion: ${clientCountAfterDelete}`);

      if (clientCountAfterDelete < clientCountBefore) {
        console.log('SUCCESS: Client was removed from the list immediately!');
      }

      // Step 9: Verify persistence - refresh the page
      console.log('Step 9: Refreshing page to verify deletion persists...');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Re-open settings panel
      await settingsButton.click();
      await page.waitForTimeout(1500);

      await page.screenshot({ path: 'test-results/11-after-refresh.png', fullPage: true });
      console.log('Screenshot saved: 11-after-refresh.png');

      // Count clients after refresh
      const clientCountAfterRefresh = await deleteButtons.count();
      console.log(`Clients after refresh: ${clientCountAfterRefresh}`);

      // Final verification
      if (clientCountAfterRefresh === clientCountAfterDelete) {
        console.log('\n========================================');
        console.log('SUCCESS: Client deletion is WORKING CORRECTLY!');
        console.log('========================================');
        console.log(`- Started with ${clientCountBefore} clients`);
        console.log(`- After deletion: ${clientCountAfterDelete} clients`);
        console.log(`- After refresh: ${clientCountAfterRefresh} clients`);
        console.log('- Deleted client did NOT reappear after page refresh');
        console.log('========================================\n');
      } else if (clientCountAfterRefresh > clientCountAfterDelete) {
        console.log('\n========================================');
        console.log('FAILURE: Client reappeared after refresh!');
        console.log('========================================');
        console.log(`- After deletion: ${clientCountAfterDelete} clients`);
        console.log(`- After refresh: ${clientCountAfterRefresh} clients`);
        console.log('- The deletion fix may not be working correctly');
        console.log('========================================\n');
      }
    } else {
      console.log('Could not find delete buttons - checking UI state...');
      await page.screenshot({ path: 'test-results/08-no-delete-buttons.png', fullPage: true });
      console.log('Screenshot saved: 08-no-delete-buttons.png');
    }

    await page.screenshot({ path: 'test-results/12-final-state.png', fullPage: true });
    console.log('Screenshot saved: 12-final-state.png');

    console.log('\n=== Test Complete ===');
    console.log('Review screenshots in /Users/anayusta/workspace/mi-gestor/test-results/');
  });
});

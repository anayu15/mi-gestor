import { test, expect } from '@playwright/test';

test.describe('Client Creation and Deletion Flow', () => {
  test('create Ai Consortivm client and delete it', async ({ page }) => {
    // Configure longer timeout
    test.setTimeout(120000);

    // Step 1: Navigate to login page
    console.log('Step 1: Navigating to login page...');
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');

    // Take screenshot of login page
    await page.screenshot({ path: 'test-results/client-test-01-login-page.png', fullPage: true });
    console.log('Screenshot saved: client-test-01-login-page.png');

    // Step 2: Log in with test credentials
    console.log('Step 2: Logging in with test credentials...');
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('Successfully logged in and redirected to dashboard');
    await page.screenshot({ path: 'test-results/client-test-02-dashboard.png', fullPage: true });
    console.log('Screenshot saved: client-test-02-dashboard.png');

    // Step 3: Navigate to facturas tab
    console.log('Step 3: Navigating to facturas tab...');
    await page.click('a[href="/facturas"]');
    await page.waitForURL('**/facturas');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/client-test-03-facturas-page.png', fullPage: true });
    console.log('Screenshot saved: client-test-03-facturas-page.png');

    // Step 4: Click the settings gear icon button
    console.log('Step 4: Opening settings panel...');
    await page.waitForTimeout(1000);

    const settingsButton = page.locator('button[title="Configuración de Facturas"]');
    await settingsButton.click();

    // Wait for the settings panel to appear
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/client-test-04-settings-panel-open.png', fullPage: true });
    console.log('Screenshot saved: client-test-04-settings-panel-open.png');

    // Step 5: Count initial clients
    const deleteButtons = page.locator('button[title="Eliminar"]');
    const initialClientCount = await deleteButtons.count();
    console.log(`Initial client count: ${initialClientCount}`);

    // Step 6: Click "+ Nuevo Cliente" to create a new client
    console.log('Step 5: Opening new client form...');
    const newClientButton = page.locator('button:has-text("Nuevo Cliente")');
    await newClientButton.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/client-test-05-new-client-modal.png', fullPage: true });
    console.log('Screenshot saved: client-test-05-new-client-modal.png');

    // Step 7: Fill in the client form with specific data
    console.log('Step 6: Filling in client form with Ai Consortivm data...');

    // Find the form fields - check for the modal/form
    const form = page.locator('form').filter({ hasText: 'Nombre' }).first();

    // Fill in Nombre (company name / razon_social)
    const nombreInput = page.locator('input[name="razon_social"], input[id*="nombre"], input[placeholder*="nombre"]').first();
    await nombreInput.fill('Ai Consortivm');

    // Fill in CIF
    const cifInput = page.locator('input[name="cif"], input[id*="cif"], input[placeholder*="CIF"]').first();
    await cifInput.fill('A56760267');

    // Fill in Direccion
    const direccionInput = page.locator('input[name="direccion"], textarea[name="direccion"], input[placeholder*="dirección"]').first();
    await direccionInput.fill('Sector Literatos 38');

    // Fill in Ciudad
    const ciudadInput = page.locator('input[name="ciudad"], input[id*="ciudad"], input[placeholder*="ciudad"]').first();
    if (await ciudadInput.count() > 0) {
      await ciudadInput.fill('Tres Cantos, Madrid');
    }

    // Fill in Codigo Postal
    const codigoPostalInput = page.locator('input[name="codigo_postal"], input[id*="postal"], input[placeholder*="postal"]').first();
    if (await codigoPostalInput.count() > 0) {
      await codigoPostalInput.fill('28760');
    }

    // Check "cliente principal" checkbox
    const clientePrincipalCheckbox = page.locator('input[type="checkbox"][name="es_cliente_principal"], input[type="checkbox"]:near(:text("principal"))');
    if (await clientePrincipalCheckbox.count() > 0) {
      const isChecked = await clientePrincipalCheckbox.first().isChecked();
      if (!isChecked) {
        await clientePrincipalCheckbox.first().click();
      }
    }

    await page.screenshot({ path: 'test-results/client-test-06-form-filled.png', fullPage: true });
    console.log('Screenshot saved: client-test-06-form-filled.png');

    // Step 8: Submit the form
    console.log('Step 7: Submitting the client form...');
    const submitButton = page.locator('button[type="submit"]:has-text("Guardar"), button[type="submit"]:has-text("Crear")').first();
    if (await submitButton.count() > 0) {
      await submitButton.click();
    } else {
      const formSubmit = page.locator('form button[type="submit"]').first();
      await formSubmit.click();
    }

    // Wait for the submission to process
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/client-test-07-after-submit.png', fullPage: true });
    console.log('Screenshot saved: client-test-07-after-submit.png');

    // Check for any error messages
    const errorMessage = page.locator('text=CIF ya existe, text=error, text=Error');
    const hasError = await errorMessage.count() > 0;
    if (hasError) {
      console.log('WARNING: An error message was detected!');
      await page.screenshot({ path: 'test-results/client-test-07b-error-detected.png', fullPage: true });
    }

    // Step 9: Verify the client was created
    console.log('Step 8: Verifying client creation...');
    await page.waitForTimeout(1000);

    // Check if the client appears in the list
    const aiConsortvimInList = page.locator('td:has-text("Ai Consortivm"), span:has-text("Ai Consortivm")');
    const clientExists = await aiConsortvimInList.count() > 0;

    const newClientCount = await deleteButtons.count();
    console.log(`Client count after creation: ${newClientCount}`);

    if (clientExists) {
      console.log('SUCCESS: Ai Consortivm client was created successfully!');
    } else {
      console.log('Client may not be visible in current view - checking...');
    }

    await page.screenshot({ path: 'test-results/client-test-08-client-created.png', fullPage: true });
    console.log('Screenshot saved: client-test-08-client-created.png');

    // Step 10: Find and delete the Ai Consortivm client
    console.log('Step 9: Locating Ai Consortivm client for deletion...');

    // Find the row containing Ai Consortivm
    const clientRow = page.locator('tr').filter({ hasText: 'Ai Consortivm' }).first();
    const deleteButton = clientRow.locator('button[title="Eliminar"]');

    if (await deleteButton.count() > 0) {
      console.log('Found delete button for Ai Consortivm - clicking...');
      await deleteButton.click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: 'test-results/client-test-09-delete-confirm.png', fullPage: true });
      console.log('Screenshot saved: client-test-09-delete-confirm.png');

      // Confirm deletion in the modal
      const confirmBtn = page.locator('button:has-text("Eliminar")').last();
      if (await confirmBtn.count() > 0) {
        console.log('Confirming deletion...');
        await confirmBtn.click();
      }

      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'test-results/client-test-10-after-delete.png', fullPage: true });
      console.log('Screenshot saved: client-test-10-after-delete.png');

      // Check if client is gone from the list
      const clientStillExists = await aiConsortvimInList.count() > 0;
      const finalClientCount = await deleteButtons.count();
      console.log(`Client count after deletion: ${finalClientCount}`);

      if (!clientStillExists) {
        console.log('SUCCESS: Ai Consortivm client was removed from the list!');
      } else {
        console.log('WARNING: Client may still be in the list');
      }
    } else {
      console.log('Could not find delete button for Ai Consortivm');
    }

    // Step 11: Refresh the page and verify deletion persists
    console.log('Step 10: Refreshing page to verify deletion persists...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Re-open settings panel
    await settingsButton.click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'test-results/client-test-11-after-refresh.png', fullPage: true });
    console.log('Screenshot saved: client-test-11-after-refresh.png');

    // Check if Ai Consortivm is still gone
    const clientAfterRefresh = page.locator('td:has-text("Ai Consortivm"), span:has-text("Ai Consortivm")');
    const clientReappeared = await clientAfterRefresh.count() > 0;

    const countAfterRefresh = await deleteButtons.count();
    console.log(`Client count after refresh: ${countAfterRefresh}`);

    // Final report
    console.log('\n========================================');
    console.log('TEST RESULTS SUMMARY');
    console.log('========================================');
    console.log(`Initial clients: ${initialClientCount}`);
    console.log(`After creation: ${newClientCount}`);
    console.log(`After deletion: ${countAfterRefresh}`);

    if (!clientReappeared && countAfterRefresh <= initialClientCount) {
      console.log('STATUS: SUCCESS - Client was created, deleted, and did not reappear after refresh');
    } else if (clientReappeared) {
      console.log('STATUS: FAILURE - Client reappeared after refresh');
    } else {
      console.log('STATUS: NEEDS REVIEW - Check screenshots for details');
    }
    console.log('========================================\n');

    await page.screenshot({ path: 'test-results/client-test-12-final-state.png', fullPage: true });
    console.log('Screenshot saved: client-test-12-final-state.png');

    console.log('\n=== Test Complete ===');
    console.log('Review screenshots in /Users/anayusta/workspace/mi-gestor/test-results/');
  });
});

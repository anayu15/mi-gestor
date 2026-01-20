import { test, expect } from '@playwright/test';

test.describe('Client Creation and Deletion Flow', () => {
  test('create and delete client from clientes page', async ({ page }) => {
    // Set a longer timeout for this test
    test.setTimeout(180000);

    // 1. Navigate to login page
    console.log('Step 1: Navigating to login page...');
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/01-login-page.png', fullPage: true });

    // 2. Log in with test credentials
    console.log('Step 2: Logging in with test credentials...');
    await page.locator('input[type="email"]').fill('test@migestor.com');
    await page.locator('input[type="password"]').fill('Test123456');
    await page.locator('button[type="submit"]').click();

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    console.log('Successfully logged in!');
    await page.screenshot({ path: 'test-results/02-dashboard.png', fullPage: true });

    // 3. Navigate to facturas tab first (as requested)
    console.log('Step 3: Navigating to facturas tab...');
    await page.click('a[href="/facturas"]');
    await page.waitForURL('**/facturas');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/03-facturas-page.png', fullPage: true });

    // 4. Look for gear icon/settings on facturas page
    console.log('Step 4: Looking for gear icon on facturas page...');

    // The facturas page might have a settings gear icon
    // Let's check for any settings-related buttons
    const pageButtons = await page.locator('button').all();
    console.log(`Found ${pageButtons.length} buttons on facturas page`);

    // Look for icon buttons that might be settings
    const iconBtns = page.locator('button:has(svg)');
    const iconCount = await iconBtns.count();
    console.log(`Found ${iconCount} icon buttons`);

    // Try to find a gear/settings icon - check first few buttons
    let foundGear = false;
    for (let i = 0; i < Math.min(5, iconCount); i++) {
      const btn = iconBtns.nth(i);
      const html = await btn.innerHTML();
      // Log first button's HTML to help identify patterns
      if (i === 0) {
        console.log(`First icon button HTML: ${html}`);
      }
      // Check if this looks like a gear icon (SVG with gear-like path)
      if (html.includes('M12') && (html.includes('M9.594') || html.includes('gear') || html.includes('cog'))) {
        console.log(`Found potential gear icon at index ${i}`);
        foundGear = true;
      }
    }

    await page.screenshot({ path: 'test-results/04-facturas-icons.png', fullPage: true });

    // 5. Navigate to clientes page
    console.log('Step 5: Navigating to clientes page...');
    await page.goto('http://localhost:3001/clientes');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/05-clientes-page.png', fullPage: true });

    // 6. Check if there are existing clients
    console.log('Step 6: Checking for existing clients...');
    const noClientsMsg = page.locator('text=No tienes clientes registrados');
    const hasNoClients = await noClientsMsg.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasNoClients) {
      console.log('No existing clients found');
    } else {
      console.log('Existing clients found on page');
      // Check for the "Mostrar inactivos" checkbox
      const showInactiveCheckbox = page.locator('text=Mostrar inactivos');
      if (await showInactiveCheckbox.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('Found "Mostrar inactivos" option');
      }
    }

    // 7. Click "Nuevo Cliente" button
    console.log('Step 7: Clicking Nuevo Cliente button...');
    const newClientBtn = page.locator('a:has-text("Nuevo Cliente"), button:has-text("Nuevo Cliente")').first();

    if (await newClientBtn.isVisible({ timeout: 3000 })) {
      await newClientBtn.click();
      await page.waitForTimeout(1000);
      await page.waitForLoadState('networkidle');
    } else {
      // Try "Crear primer cliente" if available
      const createFirstBtn = page.locator('button:has-text("Crear primer cliente")');
      if (await createFirstBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createFirstBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    await page.screenshot({ path: 'test-results/06-new-client-form.png', fullPage: true });

    // 8. Fill in the client form
    console.log('Step 8: Filling in client form...');

    // Wait for form fields
    await page.waitForSelector('input[name="nombre"], input[type="text"]', { timeout: 5000 });

    // Fill nombre field (looking for the first text input or named input)
    const nombreInput = page.locator('input[name="nombre"]');
    if (await nombreInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nombreInput.fill('Ai Consortivm');
      console.log('Filled nombre field');
    } else {
      // Try the first text input
      const firstTextInput = page.locator('input[type="text"]').first();
      await firstTextInput.fill('Ai Consortivm');
      console.log('Filled first text input as nombre');
    }

    // Fill CIF field
    const cifInput = page.locator('input[name="cif"]');
    if (await cifInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cifInput.fill('A56760267');
      console.log('Filled CIF field');
    }

    // Fill direccion field
    const dirInput = page.locator('input[name="direccion"]');
    if (await dirInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await dirInput.fill('Sector Literatos 38');
      console.log('Filled direccion field');
    }

    // Fill ciudad field
    const ciudadInput = page.locator('input[name="ciudad"]');
    if (await ciudadInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await ciudadInput.fill('Tres Cantos, Madrid');
      console.log('Filled ciudad field');
    }

    // Fill codigo postal field
    const cpInput = page.locator('input[name="codigo_postal"]');
    if (await cpInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cpInput.fill('28760');
      console.log('Filled codigo_postal field');
    }

    // DO NOT check "cliente principal" - user already has one
    // This would cause an error as seen in previous test
    console.log('Skipping cliente principal checkbox (user already has one)');

    await page.screenshot({ path: 'test-results/07-form-filled.png', fullPage: true });

    // 9. Click "Crear Cliente" button
    console.log('Step 9: Clicking Crear Cliente button...');
    const createBtn = page.locator('button:has-text("Crear Cliente")');
    await createBtn.click();

    // Wait for response and potential redirect
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/08-after-create.png', fullPage: true });

    // Check for any error messages
    const errorMsg = page.locator('.text-red-600, .text-red-500, [class*="error"]');
    const hasError = await errorMsg.isVisible({ timeout: 1000 }).catch(() => false);
    if (hasError) {
      const errorText = await errorMsg.textContent();
      console.log(`Error message found: ${errorText}`);
    }

    // 10. Verify client was created
    console.log('Step 10: Verifying client creation...');

    // Navigate back to clientes list
    await page.goto('http://localhost:3001/clientes');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/09-clientes-list.png', fullPage: true });

    // Check for the new client
    const clientText = page.locator('text=Ai Consortivm');
    const clientCreated = await clientText.isVisible({ timeout: 5000 }).catch(() => false);

    if (clientCreated) {
      console.log('SUCCESS: Client "Ai Consortivm" was created and is visible in the list!');
      await page.screenshot({ path: 'test-results/10-client-found.png', fullPage: true });
    } else {
      console.log('Client not visible in list - checking page state...');
      // Let's see what's on the page
      const pageContent = await page.textContent('body');
      console.log('Page contains:', pageContent?.substring(0, 500));
    }

    // 11. Try to delete the client
    console.log('Step 11: Attempting to delete the client...');

    if (clientCreated) {
      // Find the client row/card and its delete button
      const clientContainer = page.locator('div:has-text("Ai Consortivm"), tr:has-text("Ai Consortivm")').first();

      // Look for delete button - could be trash icon or text
      const deleteBtn = clientContainer.locator('button:has(svg), button').filter({ hasText: /eliminar|delete/i }).first();

      // If not found, try looking for any button with trash-like icon
      if (!await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Look for all buttons in the container
        const containerBtns = await clientContainer.locator('button').all();
        console.log(`Found ${containerBtns.length} buttons in client container`);

        // Click the last button (often delete is last)
        if (containerBtns.length > 0) {
          const lastBtn = containerBtns[containerBtns.length - 1];
          await lastBtn.click();
          console.log('Clicked last button in client container');
        }
      } else {
        await deleteBtn.click();
        console.log('Clicked delete button');
      }

      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/11-delete-attempt.png', fullPage: true });

      // Look for confirmation dialog
      const confirmDialog = page.locator('[role="dialog"], .modal');
      if (await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Confirmation dialog appeared');
        await page.screenshot({ path: 'test-results/12-confirm-dialog.png', fullPage: true });

        // Click confirm button
        const confirmBtn = confirmDialog.locator('button:has-text("Eliminar"), button:has-text("Confirmar"), button:has-text("Sí")');
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click();
          console.log('Confirmed deletion');
        }
      }

      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/13-after-delete-confirm.png', fullPage: true });
    }

    // 12. Refresh and verify deletion
    console.log('Step 12: Refreshing page to verify deletion...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/14-after-refresh.png', fullPage: true });

    // Check if client is still visible
    const clientStillVisible = await page.locator('text=Ai Consortivm').isVisible({ timeout: 3000 }).catch(() => false);

    // Also check with "Mostrar inactivos" checkbox
    const showInactive = page.locator('input[type="checkbox"]').first();
    if (await showInactive.isVisible({ timeout: 1000 }).catch(() => false)) {
      const isChecked = await showInactive.isChecked();
      if (!isChecked) {
        await showInactive.check();
        console.log('Checked "Mostrar inactivos" checkbox');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'test-results/15-show-inactive.png', fullPage: true });
      }
    }

    const clientVisibleAfterShowInactive = await page.locator('text=Ai Consortivm').isVisible({ timeout: 3000 }).catch(() => false);

    if (clientStillVisible) {
      console.log('RESULT: Client is still visible after refresh');
    } else if (clientVisibleAfterShowInactive) {
      console.log('RESULT: Client was SOFT-DELETED - visible only when "Mostrar inactivos" is checked');
    } else {
      console.log('RESULT: Client is no longer visible (either hard-deleted or not in database)');
    }

    // Final screenshot
    await page.screenshot({ path: 'test-results/final-state.png', fullPage: true });
    console.log('Test completed! Check test-results folder for screenshots.');
  });
});

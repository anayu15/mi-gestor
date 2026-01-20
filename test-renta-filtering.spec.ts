import { test, expect } from '@playwright/test';

test.describe('RENTA/Modelo 100 Filtering Test', () => {
  test('Verify RENTA filtering based on settings toggle', async ({ page }) => {
    // Step 1: Go to login page
    console.log('Step 1: Navigating to login page...');
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');

    // Step 2: Log in with test credentials
    console.log('Step 2: Logging in with test@migestor.com...');
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('Successfully logged in and redirected to dashboard');

    // Step 3: Navigate to fiscal calendar
    console.log('Step 3: Navigating to /fiscal/calendario...');
    await page.goto('http://localhost:3001/fiscal/calendario');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for data to load

    // Step 4: Take screenshot of initial state
    console.log('Step 4: Taking screenshot of fiscal calendar table...');
    await page.screenshot({
      path: '/Users/anayusta/workspace/mi-gestor/screenshot-01-calendar-initial.png',
      fullPage: true
    });

    // Step 5: Check if RENTA appears in the table (initial state)
    const tableBody = await page.locator('tbody').textContent().catch(() => '');
    const rentaVisibleInitially = tableBody?.includes('RENTA') ?? false;
    console.log(`RENTA visible in calendar table initially: ${rentaVisibleInitially}`);

    // Step 6: Open settings panel by clicking the gear icon
    console.log('Step 5: Clicking on settings (gear) icon...');

    // The settings button has an SVG with a gear/cog path
    const settingsButton = page.locator('button').filter({ has: page.locator('svg path[d*="M10.325"]') });
    const count = await settingsButton.count();
    console.log(`Found ${count} settings buttons`);

    if (count > 0) {
      await settingsButton.first().click();
      console.log('Clicked settings button');
    }

    await page.waitForTimeout(1500);

    // Step 7: Screenshot after clicking settings
    await page.screenshot({
      path: '/Users/anayusta/workspace/mi-gestor/screenshot-02-settings-panel.png',
      fullPage: true
    });

    // Step 8: Find the Modelo 100 - RENTA section and its toggle
    console.log('Step 6: Looking for Modelo 100 - RENTA toggle...');

    // Look for the element containing "Modelo 100 - RENTA" text
    const modelo100Label = page.locator('span:has-text("Modelo 100 - RENTA")');
    const labelCount = await modelo100Label.count();
    console.log(`Found ${labelCount} elements with "Modelo 100 - RENTA"`);

    if (labelCount > 0) {
      // The toggle is in the same container as the label
      // Navigate up to find the card container, then find the toggle button within it
      const modelo100Card = modelo100Label.locator('xpath=ancestor::div[contains(@class, "flex") and contains(@class, "items-start")]').first();

      // The toggle button is a button with rounded-full class within the card
      const toggleInCard = modelo100Card.locator('button').first();

      if (await toggleInCard.count() > 0) {
        console.log('Found toggle button for Modelo 100 - RENTA');

        // Check current state by looking at the background color class
        const toggleClasses = await toggleInCard.getAttribute('class') || '';
        const isToggleOn = toggleClasses.includes('bg-slate-700');
        console.log(`Modelo 100 toggle is currently: ${isToggleOn ? 'ON' : 'OFF'}`);

        // Test scenario based on current state
        if (!isToggleOn) {
          // Toggle is OFF - verify RENTA is not in calendar
          console.log('Step 7: Toggle is OFF - RENTA should NOT appear in calendar');

          // Close settings to see calendar
          const cancelBtn = page.locator('button:has-text("Cancelar")');
          if (await cancelBtn.count() > 0) {
            await cancelBtn.click();
            await page.waitForTimeout(500);
          }

          // Screenshot showing calendar WITHOUT RENTA
          await page.screenshot({
            path: '/Users/anayusta/workspace/mi-gestor/screenshot-03-calendar-NO-RENTA.png',
            fullPage: true
          });

          const tableBodyOff = await page.locator('tbody').textContent().catch(() => '');
          const hasRentaOff = tableBodyOff?.includes('RENTA') ?? false;
          console.log(`RENTA in calendar when toggle OFF: ${hasRentaOff}`);
          console.log(hasRentaOff ? 'WARNING: RENTA should NOT appear' : 'SUCCESS: RENTA correctly hidden');

          // Now turn toggle ON
          console.log('Step 8: Opening settings to turn toggle ON...');
          await settingsButton.first().click();
          await page.waitForTimeout(1500);

          // Find and click the toggle
          const modelo100Label2 = page.locator('span:has-text("Modelo 100 - RENTA")');
          const modelo100Card2 = modelo100Label2.locator('xpath=ancestor::div[contains(@class, "flex") and contains(@class, "items-start")]').first();
          const toggleInCard2 = modelo100Card2.locator('button').first();

          console.log('Step 9: Clicking toggle to turn ON...');
          await toggleInCard2.click();
          await page.waitForTimeout(500);

          // Screenshot showing toggle ON in settings
          await page.screenshot({
            path: '/Users/anayusta/workspace/mi-gestor/screenshot-04-settings-toggle-ON.png',
            fullPage: true
          });

          // Save settings
          console.log('Step 10: Saving settings...');
          const saveBtn = page.locator('button:has-text("Guardar cambios")');
          await saveBtn.click();
          await page.waitForTimeout(3000); // Wait for save and page reload

          // Verify RENTA now appears
          console.log('Step 11: Verifying RENTA appears when toggle is ON...');
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1500);

          // Screenshot showing calendar WITH RENTA
          await page.screenshot({
            path: '/Users/anayusta/workspace/mi-gestor/screenshot-05-calendar-WITH-RENTA.png',
            fullPage: true
          });

          const tableBodyOn = await page.locator('tbody').textContent().catch(() => '');
          const hasRentaOn = tableBodyOn?.includes('RENTA') ?? false;
          console.log(`RENTA in calendar when toggle ON: ${hasRentaOn}`);
          console.log(hasRentaOn ? 'SUCCESS: RENTA correctly appears' : 'WARNING: RENTA should appear');

        } else {
          // Toggle is ON - verify RENTA IS in calendar, then turn OFF
          console.log('Step 7: Toggle is ON - RENTA should appear in calendar');

          // Screenshot showing toggle ON in settings
          await page.screenshot({
            path: '/Users/anayusta/workspace/mi-gestor/screenshot-03-settings-toggle-ON.png',
            fullPage: true
          });

          // Close settings to see calendar
          const cancelBtn = page.locator('button:has-text("Cancelar")');
          if (await cancelBtn.count() > 0) {
            await cancelBtn.click();
            await page.waitForTimeout(500);
          }

          // Screenshot showing calendar WITH RENTA
          await page.screenshot({
            path: '/Users/anayusta/workspace/mi-gestor/screenshot-04-calendar-WITH-RENTA.png',
            fullPage: true
          });

          const tableBodyOn = await page.locator('tbody').textContent().catch(() => '');
          const hasRentaOn = tableBodyOn?.includes('RENTA') ?? false;
          console.log(`RENTA in calendar when toggle ON: ${hasRentaOn}`);
          console.log(hasRentaOn ? 'SUCCESS: RENTA correctly appears' : 'WARNING: RENTA should appear');

          // Now turn toggle OFF
          console.log('Step 8: Opening settings to turn toggle OFF...');
          await settingsButton.first().click();
          await page.waitForTimeout(1500);

          // Find and click the toggle
          const modelo100Label2 = page.locator('span:has-text("Modelo 100 - RENTA")');
          const modelo100Card2 = modelo100Label2.locator('xpath=ancestor::div[contains(@class, "flex") and contains(@class, "items-start")]').first();
          const toggleInCard2 = modelo100Card2.locator('button').first();

          console.log('Step 9: Clicking toggle to turn OFF...');
          await toggleInCard2.click();
          await page.waitForTimeout(500);

          // Screenshot showing toggle OFF in settings
          await page.screenshot({
            path: '/Users/anayusta/workspace/mi-gestor/screenshot-05-settings-toggle-OFF.png',
            fullPage: true
          });

          // Save settings
          console.log('Step 10: Saving settings...');
          const saveBtn = page.locator('button:has-text("Guardar cambios")');
          await saveBtn.click();
          await page.waitForTimeout(3000); // Wait for save and page reload

          // Verify RENTA no longer appears
          console.log('Step 11: Verifying RENTA is hidden when toggle is OFF...');
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1500);

          // Screenshot showing calendar WITHOUT RENTA
          await page.screenshot({
            path: '/Users/anayusta/workspace/mi-gestor/screenshot-06-calendar-NO-RENTA.png',
            fullPage: true
          });

          const tableBodyOff = await page.locator('tbody').textContent().catch(() => '');
          const hasRentaOff = tableBodyOff?.includes('RENTA') ?? false;
          console.log(`RENTA in calendar when toggle OFF: ${hasRentaOff}`);
          console.log(hasRentaOff ? 'WARNING: RENTA should NOT appear' : 'SUCCESS: RENTA correctly hidden');

          // Turn toggle back ON to restore original state
          console.log('Step 12: Restoring toggle to ON...');
          await settingsButton.first().click();
          await page.waitForTimeout(1500);

          const modelo100Label3 = page.locator('span:has-text("Modelo 100 - RENTA")');
          const modelo100Card3 = modelo100Label3.locator('xpath=ancestor::div[contains(@class, "flex") and contains(@class, "items-start")]').first();
          const toggleInCard3 = modelo100Card3.locator('button').first();
          await toggleInCard3.click();
          await page.waitForTimeout(500);

          const saveBtn2 = page.locator('button:has-text("Guardar cambios")');
          await saveBtn2.click();
          await page.waitForTimeout(3000);
        }
      } else {
        console.log('ERROR: Could not find toggle button');
      }
    } else {
      console.log('ERROR: Could not find Modelo 100 - RENTA label');
    }

    // Final screenshot
    await page.screenshot({
      path: '/Users/anayusta/workspace/mi-gestor/screenshot-final.png',
      fullPage: true
    });

    console.log('\n=== Test Complete ===');
    console.log('Screenshots saved in /Users/anayusta/workspace/mi-gestor/');
  });
});

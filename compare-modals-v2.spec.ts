import { test, expect } from '@playwright/test';

test('Compare contract preview modals', async ({ page }) => {
  test.setTimeout(180000);

  // Login
  console.log('Step 1: Logging in...');
  await page.goto('http://localhost:3001/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'test@migestor.com');
  await page.fill('input[type="password"]', 'Test123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  console.log('Login successful');

  // Part 1: Go to Documentos and find a contract
  console.log('\nStep 2: Navigating to Documentos...');
  await page.goto('http://localhost:3001/documentos');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Take initial screenshot
  await page.screenshot({
    path: '/Users/anayusta/workspace/mi-gestor/comparison/documentos-page-initial.png',
    fullPage: true
  });

  // Look for "Contrato" badge
  const contractBadge = page.locator('span.bg-blue-100:has-text("Contrato")');
  const contractCount = await contractBadge.count();
  console.log(`Found ${contractCount} contract badge(s) in Documentos`);

  if (contractCount > 0) {
    // Find the row containing this contract
    const contractRow = contractBadge.first().locator('xpath=ancestor::tr');

    // Find and click the view button (eye icon) in this row
    const viewButton = contractRow.locator('button').filter({
      has: page.locator('svg path[d*="M15 12a3 3 0 11-6 0"]')
    });

    if (await viewButton.count() > 0) {
      console.log('Found view button, clicking...');
      await viewButton.first().click();
      await page.waitForTimeout(2000);

      // Take screenshot of the modal
      await page.screenshot({
        path: '/Users/anayusta/workspace/mi-gestor/comparison/01-documentos-contract-modal.png',
        fullPage: false
      });
      console.log('Screenshot saved: 01-documentos-contract-modal.png');

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      console.log('No view button found in contract row');
    }
  } else {
    console.log('No contracts found in Documentos page');
  }

  // Part 2: Go to Facturas and find Programaciones with contracts
  console.log('\nStep 3: Navigating to Facturas...');
  await page.goto('http://localhost:3001/facturas');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Look for the settings (gear) icon button to open Programaciones
  const settingsButton = page.locator('button').filter({
    has: page.locator('svg path[d*="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0"]')
  });

  if (await settingsButton.count() > 0) {
    console.log('Found settings button, clicking...');
    await settingsButton.first().click();
    await page.waitForTimeout(1500);
  }

  // Take screenshot of facturas page with settings panel
  await page.screenshot({
    path: '/Users/anayusta/workspace/mi-gestor/comparison/facturas-settings-panel.png',
    fullPage: true
  });

  // Look for "Programaciones Recurrentes" section
  const programacionesHeader = page.locator('h2:has-text("Programaciones Recurrentes")');
  if (await programacionesHeader.isVisible()) {
    console.log('Found Programaciones Recurrentes section');

    // Look for a green eye button (contract view button) in the programaciones table
    const contractViewButtons = page.locator('button.text-green-600');
    const buttonCount = await contractViewButtons.count();
    console.log(`Found ${buttonCount} green button(s) in Programaciones`);

    if (buttonCount > 0) {
      console.log('Clicking first contract view button...');
      await contractViewButtons.first().click();
      await page.waitForTimeout(2000);

      // Take screenshot of contract modal from facturas
      await page.screenshot({
        path: '/Users/anayusta/workspace/mi-gestor/comparison/02-facturas-contract-modal.png',
        fullPage: false
      });
      console.log('Screenshot saved: 02-facturas-contract-modal.png');

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  } else {
    console.log('Programaciones section not visible');
    // Try scrolling to find it
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: '/Users/anayusta/workspace/mi-gestor/comparison/facturas-scrolled.png',
      fullPage: true
    });
  }

  console.log('\nTest completed!');
});

import { test, expect } from '@playwright/test';

test('Compare contract preview modals in Documentos and Facturas', async ({ page }) => {
  // Set a longer timeout for this test
  test.setTimeout(120000);

  // Login
  console.log('Logging in...');
  await page.goto('http://localhost:3001/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"]', 'test@migestor.com');
  await page.fill('input[type="password"]', 'Test123456');
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  console.log('Login successful, on dashboard');

  // Part 1: Go to Documentos tab and find a contract
  console.log('Navigating to Documentos...');
  await page.goto('http://localhost:3001/documentos');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Look for a contract document (blue "Contrato" badge)
  const contractBadge = page.locator('span:has-text("Contrato")').first();

  if (await contractBadge.isVisible()) {
    console.log('Found contract document');

    // Find the parent row/card and click the eye icon
    const contractRow = contractBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class,"border")]').first();

    // Try to find the eye icon button
    const eyeButton = contractRow.locator('button').filter({ has: page.locator('svg') }).first();

    // Alternative: find by looking for an icon with the eye/view pattern
    const viewButtons = await page.locator('button[title*="Ver"], button[aria-label*="Ver"], button:has(svg[class*="eye"]), button:has(svg path[d*="M2 12"])').all();

    console.log(`Found ${viewButtons.length} view buttons`);

    // Click the first eye button near a contract
    // Let's find all buttons in the documentos list
    const contractSection = page.locator('table tbody tr:has(span:text("Contrato")), div:has(span:text("Contrato"))').first();

    if (await contractSection.isVisible()) {
      // Find any clickable eye icon within or near this row
      const buttons = await contractSection.locator('button').all();
      console.log(`Found ${buttons.length} buttons in contract row`);

      for (const btn of buttons) {
        const html = await btn.innerHTML();
        if (html.includes('svg') || html.includes('eye')) {
          console.log('Found button with icon, clicking...');
          await btn.click();
          break;
        }
      }
    }

    // Wait for modal to appear
    await page.waitForTimeout(1500);

    // Take screenshot of the modal from Documentos
    const modal1 = page.locator('div[class*="fixed"][class*="inset"]').first();
    if (await modal1.isVisible()) {
      await page.screenshot({
        path: '/Users/anayusta/workspace/mi-gestor/comparison/01-documentos-contract-modal.png',
        fullPage: false
      });
      console.log('Screenshot 1 saved: documentos-contract-modal.png');

      // Close the modal
      const closeButton = page.locator('button:has-text("Cerrar"), button[aria-label*="close"], button:has(svg path[d*="M6 18L18 6"])').first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(500);
    }
  } else {
    console.log('No contract found in Documentos, taking screenshot of page');
    await page.screenshot({
      path: '/Users/anayusta/workspace/mi-gestor/comparison/01-documentos-page.png',
      fullPage: true
    });
  }

  // Part 2: Go to Facturas tab and find Programaciones section
  console.log('Navigating to Facturas...');
  await page.goto('http://localhost:3001/facturas');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Scroll down to find Programaciones section
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  // Look for Programaciones section
  const programacionesSection = page.locator('text=Programaciones, text=Programación, h2:has-text("Programaciones"), h3:has-text("Programaciones")').first();

  if (await programacionesSection.isVisible()) {
    console.log('Found Programaciones section');
    await programacionesSection.scrollIntoViewIfNeeded();
  }

  // Take a screenshot of the current state
  await page.screenshot({
    path: '/Users/anayusta/workspace/mi-gestor/comparison/02-facturas-page.png',
    fullPage: true
  });
  console.log('Screenshot saved: facturas-page.png');

  // Look for a programacion with a contract and click its eye icon
  const programacionWithContract = page.locator('tr:has(span:text("Contrato")), div:has(span:text("Contrato"))');
  const count = await programacionWithContract.count();
  console.log(`Found ${count} items with contract badge`);

  if (count > 0) {
    const firstItem = programacionWithContract.first();
    const eyeBtn = firstItem.locator('button').first();
    if (await eyeBtn.isVisible()) {
      await eyeBtn.click();
      await page.waitForTimeout(1500);

      // Take screenshot of the modal
      await page.screenshot({
        path: '/Users/anayusta/workspace/mi-gestor/comparison/02-facturas-contract-modal.png',
        fullPage: false
      });
      console.log('Screenshot 2 saved: facturas-contract-modal.png');
    }
  }

  console.log('Test completed!');
});

import { test, expect } from '@playwright/test';

test('detailed repeated invoice test', async ({ page }) => {
  test.setTimeout(180000);
  
  // Login
  await page.goto('http://localhost:3001/login');
  await page.fill('input[type="email"]', 'test@migestor.com');
  await page.fill('input[type="password"]', 'Test123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
  
  // Go to facturas
  await page.goto('http://localhost:3001/facturas');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Click Nuevo Ingreso
  await page.getByRole('button', { name: /nuevo ingreso/i }).first().click();
  await page.waitForTimeout(1000);
  
  // Scroll the modal to see all content
  const modal = page.locator('[role="dialog"], .modal, [class*="modal"]').first();
  
  // Take full page screenshot
  await page.screenshot({ path: 'screenshots/detailed-01-modal-open.png', fullPage: true });
  
  // Select client
  await page.locator('select').first().selectOption({ index: 1 });
  
  // Fill basic data
  await page.locator('input[name*="concepto"], textarea').first().fill('Test programacion detallado');
  await page.locator('input[name*="base"]').first().fill('500');
  
  // Enable repetir
  const repetirLabel = page.locator('label').filter({ hasText: /repetir/i }).first();
  await repetirLabel.click();
  await page.waitForTimeout(500);
  
  // Take screenshot showing the repetir options
  await page.screenshot({ path: 'screenshots/detailed-02-repetir-enabled.png', fullPage: true });
  
  // Find and scroll to the repetition section
  const repetirSection = page.locator('text=/fecha.*inicio|periodicidad|sin.*fecha/i').first();
  if (await repetirSection.isVisible()) {
    await repetirSection.scrollIntoViewIfNeeded();
  }
  
  await page.screenshot({ path: 'screenshots/detailed-03-repetir-options.png', fullPage: true });
  
  // Now set the date - use a more specific approach
  const dateInputs = await page.locator('input[type="date"]').all();
  console.log('Found', dateInputs.length, 'date inputs');
  
  for (let i = 0; i < dateInputs.length; i++) {
    const isVisible = await dateInputs[i].isVisible();
    const value = await dateInputs[i].inputValue();
    console.log(`Date input ${i}: visible=${isVisible}, value=${value}`);
  }
  
  // Set fecha inicio to Jan 15, 2024
  if (dateInputs.length > 0) {
    // First date input should be fecha_inicio for repetition
    await dateInputs[0].fill('2024-01-15');
    console.log('Set first date input to 2024-01-15');
  }
  
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/detailed-04-date-set.png', fullPage: true });
  
  // Check Sin fecha de fin
  const sinFinCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /sin.*fin/i })
    .or(page.getByLabel(/sin.*fecha.*fin/i));
  
  // Try to find the sin fin option in visible checkboxes
  const checkboxes = await page.locator('input[type="checkbox"]:visible').all();
  console.log('Found', checkboxes.length, 'visible checkboxes');
  
  for (const cb of checkboxes) {
    const checked = await cb.isChecked();
    const label = await cb.locator('xpath=..').textContent().catch(() => 'no label');
    console.log(`Checkbox: checked=${checked}, label=${label}`);
  }
  
  // Look for all visible selects and their options now
  const visibleSelects = await page.locator('select:visible').all();
  console.log('\nVisible selects:', visibleSelects.length);
  
  for (let i = 0; i < visibleSelects.length; i++) {
    const opts = await visibleSelects[i].locator('option').allTextContents();
    console.log(`Select ${i}:`, opts);
    
    // Set periodicidad to Mensual
    if (opts.some(o => o.toLowerCase().includes('mensual'))) {
      await visibleSelects[i].selectOption({ label: 'Mensual' });
      console.log('Selected Mensual');
    }
    
    // Set tipo dia to Primer dia del mes
    if (opts.some(o => o.toLowerCase().includes('primer dia'))) {
      await visibleSelects[i].selectOption({ label: 'Primer dia del mes' });
      console.log('Selected Primer dia del mes');
    }
  }
  
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/detailed-05-all-configured.png', fullPage: true });
  
  // Look for preview text
  console.log('\n=== Looking for preview ===');
  const bodyText = await page.textContent('body');
  
  // Find patterns like "X registros", "X facturas", etc.
  const previewPatterns = bodyText?.match(/\d+\s*(registros?|facturas?|ingresos?)/gi);
  console.log('Preview patterns found:', previewPatterns);
  
  // Find any info text about what will be created
  const infoElements = await page.locator('[class*="info"], [class*="preview"], [class*="helper"], p, span').filter({ hasText: /se crear|generar/i }).allTextContents();
  console.log('Info elements:', infoElements);
  
  // Scroll down to see everything
  await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"], .modal, [class*="modal"]');
    if (modal) modal.scrollTop = modal.scrollHeight;
  });
  
  await page.screenshot({ path: 'screenshots/detailed-06-scrolled.png', fullPage: true });
  
  // Now submit
  console.log('\n=== Submitting form ===');
  
  const responsePromise = page.waitForResponse(resp => 
    resp.url().includes('/api/') && resp.request().method() === 'POST'
  , { timeout: 15000 }).catch(() => null);
  
  await page.getByRole('button', { name: /guardar|crear|submit|generar/i }).first().click();
  
  const response = await responsePromise;
  if (response) {
    console.log('Response URL:', response.url());
    console.log('Response status:', response.status());
    try {
      const json = await response.json();
      console.log('Response:', JSON.stringify(json, null, 2).substring(0, 2000));
    } catch (e) {}
  }
  
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'screenshots/detailed-07-after-submit.png', fullPage: true });
  
  // Check results for each year
  console.log('\n=== Checking results ===');
  await page.goto('http://localhost:3001/facturas');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Get year dropdown options
  const yearSelect = page.locator('select').filter({ hasText: /202\d/ }).first();
  if (await yearSelect.isVisible()) {
    const yearOpts = await yearSelect.locator('option').allTextContents();
    console.log('Year options available:', yearOpts);
    
    // Check each year
    for (const yearOpt of yearOpts) {
      const year = yearOpt.trim();
      if (/^\d{4}$/.test(year)) {
        try {
          await yearSelect.selectOption(year);
          await page.waitForTimeout(1000);
          
          // Count items with our test concept
          const items = await page.locator('tr, [class*="row"]').filter({ hasText: /test programacion detallado/i }).count();
          console.log(`Year ${year}: ${items} items found`);
          
          await page.screenshot({ path: `screenshots/detailed-year-${year}.png`, fullPage: true });
        } catch (e) {
          console.log(`Could not check year ${year}`);
        }
      }
    }
  }
  
  console.log('\n=== Test complete ===');
});

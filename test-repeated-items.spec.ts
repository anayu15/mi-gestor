import { test, expect } from '@playwright/test';

test.describe('Repeated Items (Programaciones) Test', () => {
  test('test repeated invoice creation', async ({ page }) => {
    // Set longer timeout for this test
    test.setTimeout(120000);
    
    // 1. Go to login page
    console.log('Step 1: Going to login page...');
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: 'screenshots/01-login-page.png', fullPage: true });
    
    // 2. Login with test credentials
    console.log('Step 2: Logging in...');
    await page.fill('input[type="email"], input[name="email"]', 'test@migestor.com');
    await page.fill('input[type="password"], input[name="password"]', 'Test123456');
    await page.click('button[type="submit"]');
    
    // Wait for navigation after login
    await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {
      console.log('Did not redirect to dashboard, checking current URL');
    });
    await page.waitForLoadState('networkidle');
    
    console.log('Current URL after login:', page.url());
    await page.screenshot({ path: 'screenshots/02-after-login.png', fullPage: true });
    
    // 3. Navigate to facturas page
    console.log('Step 3: Navigating to facturas page...');
    await page.goto('http://localhost:3001/facturas');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'screenshots/03-facturas-page.png', fullPage: true });
    
    // 4. Look for year dropdown and take screenshot
    console.log('Step 4: Looking for year dropdown...');
    const yearSelect = page.locator('select').filter({ hasText: /202\d/ }).first();
    if (await yearSelect.isVisible()) {
      // Get all year options
      const yearOptions = await yearSelect.locator('option').allTextContents();
      console.log('Available years:', yearOptions);
      await page.screenshot({ path: 'screenshots/04-year-dropdown.png', fullPage: true });
    }
    
    // 5. Click "Nuevo ingreso" button
    console.log('Step 5: Clicking Nuevo ingreso button...');
    const nuevoIngresoBtn = page.getByRole('button', { name: /nuevo ingreso/i })
      .or(page.locator('button').filter({ hasText: /nuevo ingreso/i }))
      .or(page.locator('a').filter({ hasText: /nuevo ingreso/i }));
    
    await nuevoIngresoBtn.first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await page.screenshot({ path: 'screenshots/05-nuevo-ingreso-form.png', fullPage: true });
    
    // 6. Fill in the form
    console.log('Step 6: Filling in form...');
    
    // Select a client - get first select and choose option
    const firstSelect = page.locator('select').first();
    await firstSelect.selectOption({ index: 1 });
    
    await page.screenshot({ path: 'screenshots/06-client-selected.png', fullPage: true });
    
    // Fill concepto
    const conceptoInput = page.locator('input[name*="concepto"]')
      .or(page.locator('textarea[name*="concepto"]'))
      .or(page.getByLabel(/concepto/i));
    await conceptoInput.first().fill('Test repetido');
    
    // Fill base imponible
    const baseInput = page.locator('input[name*="base"]')
      .or(page.getByLabel(/base/i));
    await baseInput.first().fill('1000');
    
    await page.screenshot({ path: 'screenshots/07-form-filled.png', fullPage: true });
    
    // 7. Enable "Repetir ingreso" toggle
    console.log('Step 7: Enabling repetir ingreso toggle...');
    
    // Find the label containing "repetir" and click it
    const repetirLabel = page.locator('label').filter({ hasText: /repetir/i }).first();
    await repetirLabel.click();
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/08-repetir-enabled.png', fullPage: true });
    
    // 8. Configure repetition settings
    console.log('Step 8: Configuring repetition settings...');
    
    // Look for fecha inicio field and fill it
    const fechaInputs = await page.locator('input[type="date"]').all();
    console.log('Found', fechaInputs.length, 'date inputs');
    
    if (fechaInputs.length > 0) {
      await fechaInputs[0].fill('2024-01-15');
      console.log('Set fecha inicio to 2024-01-15');
    }
    
    await page.screenshot({ path: 'screenshots/09a-fecha-inicio-set.png', fullPage: true });
    
    // Check if "Sin fecha de fin" is already checked (look for checkbox)
    const sinFinLabel = page.locator('label').filter({ hasText: /sin.*fecha.*fin/i }).first();
    const sinFinCheckbox = sinFinLabel.locator('input[type="checkbox"]');
    
    const isChecked = await sinFinCheckbox.isChecked();
    console.log('Sin fecha de fin checkbox is checked:', isChecked);
    
    if (!isChecked) {
      await sinFinLabel.click();
      console.log('Clicked Sin fecha de fin');
    }
    
    await page.screenshot({ path: 'screenshots/09b-sin-fin-checked.png', fullPage: true });
    
    // Look for periodicidad dropdown and select MENSUAL
    const allSelects = await page.locator('select:visible').all();
    console.log('Found', allSelects.length, 'visible selects');
    
    for (let i = 0; i < allSelects.length; i++) {
      const opts = await allSelects[i].locator('option').allTextContents();
      console.log(`Select ${i} options:`, opts);
      
      if (opts.some(o => o.toUpperCase().includes('MENSUAL') || o.toLowerCase().includes('mensual'))) {
        try {
          await allSelects[i].selectOption('MENSUAL');
          console.log('Selected MENSUAL periodicidad');
        } catch (e) {
          console.log('Could not select MENSUAL');
        }
      }
      
      if (opts.some(o => o.toUpperCase().includes('PRIMER_DIA') || o.toLowerCase().includes('primer'))) {
        try {
          await allSelects[i].selectOption('PRIMER_DIA');
          console.log('Selected PRIMER_DIA tipo');
        } catch (e) {
          console.log('Could not select PRIMER_DIA');
        }
      }
    }
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/09c-repetition-configured.png', fullPage: true });
    
    // 9. Look for preview information
    console.log('Step 9: Looking for preview...');
    
    // Print all visible text that might be related to preview
    const pageText = await page.textContent('body');
    const previewMatches = pageText?.match(/\d+\s*(registros?|facturas?|ingresos?|items?)/gi);
    console.log('Preview matches found:', previewMatches);
    
    // Look for specific preview element
    const previewElement = page.locator('[class*="preview"], [class*="info"], [class*="summary"]').filter({ hasText: /registro|factura|ingreso/i });
    const previewTexts = await previewElement.allTextContents();
    console.log('Preview element texts:', previewTexts);
    
    await page.screenshot({ path: 'screenshots/10-preview.png', fullPage: true });
    
    // 10. Submit the form
    console.log('Step 10: Submitting form...');
    
    // Listen for console messages
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log('Browser console:', msg.type(), msg.text());
      }
    });
    
    // Capture network responses
    const responsePromise = page.waitForResponse(resp => 
      resp.url().includes('/api/') && resp.request().method() === 'POST'
    , { timeout: 15000 }).catch(() => null);
    
    const submitBtn = page.getByRole('button', { name: /guardar|crear|submit|enviar/i })
      .or(page.locator('button[type="submit"]'));
    
    await submitBtn.first().click();
    console.log('Clicked submit button');
    
    const response = await responsePromise;
    if (response) {
      console.log('API Response URL:', response.url());
      console.log('API Response status:', response.status());
      try {
        const json = await response.json();
        console.log('API Response body:', JSON.stringify(json, null, 2));
      } catch (e) {
        const text = await response.text();
        console.log('API Response text:', text.substring(0, 500));
      }
    } else {
      console.log('No API response captured');
    }
    
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/11-after-submit.png', fullPage: true });
    
    // 11. Check for error messages
    console.log('Step 11: Checking for errors or success messages...');
    
    const errorElements = await page.locator('[class*="error"], [class*="alert-danger"], [role="alert"]').allTextContents();
    console.log('Error messages:', errorElements.filter(e => e.trim()));
    
    const successElements = await page.locator('[class*="success"], [class*="toast"], [class*="alert-success"]').allTextContents();
    console.log('Success messages:', successElements.filter(e => e.trim()));
    
    // Check for any toast or notification
    const toasts = await page.locator('[class*="toast"], [class*="notification"], [class*="snackbar"]').allTextContents();
    console.log('Toasts/Notifications:', toasts);
    
    await page.screenshot({ path: 'screenshots/12-messages.png', fullPage: true });
    
    // 12. Go back to facturas list to see created items
    console.log('Step 12: Checking created items in different years...');
    await page.goto('http://localhost:3001/facturas');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'screenshots/13-facturas-list-after.png', fullPage: true });
    
    // Count items for each year
    const yearSelectAfter = page.locator('select').filter({ hasText: /202\d/ }).first();
    
    // Check 2024
    console.log('\n--- Checking 2024 ---');
    try {
      await yearSelectAfter.selectOption('2024');
      await page.waitForTimeout(1500);
      const count2024 = await page.locator('tr, [class*="item"], [class*="row"]').filter({ hasText: /test repetido/i }).count();
      console.log('Items with "Test repetido" in 2024:', count2024);
      
      // Count all table rows
      const tableRows2024 = await page.locator('tbody tr').count();
      console.log('Total table rows in 2024:', tableRows2024);
      
      await page.screenshot({ path: 'screenshots/14-facturas-2024.png', fullPage: true });
    } catch (e) {
      console.log('Could not check 2024:', e);
    }
    
    // Check 2025
    console.log('\n--- Checking 2025 ---');
    try {
      await yearSelectAfter.selectOption('2025');
      await page.waitForTimeout(1500);
      const count2025 = await page.locator('tr, [class*="item"], [class*="row"]').filter({ hasText: /test repetido/i }).count();
      console.log('Items with "Test repetido" in 2025:', count2025);
      
      const tableRows2025 = await page.locator('tbody tr').count();
      console.log('Total table rows in 2025:', tableRows2025);
      
      await page.screenshot({ path: 'screenshots/15-facturas-2025.png', fullPage: true });
    } catch (e) {
      console.log('Could not check 2025:', e);
    }
    
    // Check 2026
    console.log('\n--- Checking 2026 ---');
    try {
      await yearSelectAfter.selectOption('2026');
      await page.waitForTimeout(1500);
      const count2026 = await page.locator('tr, [class*="item"], [class*="row"]').filter({ hasText: /test repetido/i }).count();
      console.log('Items with "Test repetido" in 2026:', count2026);
      
      const tableRows2026 = await page.locator('tbody tr').count();
      console.log('Total table rows in 2026:', tableRows2026);
      
      await page.screenshot({ path: 'screenshots/16-facturas-2026.png', fullPage: true });
    } catch (e) {
      console.log('Could not check 2026:', e);
    }
    
    // Final summary
    console.log('\n=== TEST COMPLETED ===');
    console.log('Check screenshots in the screenshots/ directory for visual verification');
  });
});

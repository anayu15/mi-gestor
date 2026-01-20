import { test, expect } from '@playwright/test';

test.describe('Invoice Creation Verification Test', () => {
  test('Test single invoice creation and year filter behavior', async ({ page }) => {
    console.log('\n=== INVOICE CREATION VERIFICATION TEST ===\n');

    // Capture console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[Console Error] ${msg.text()}`);
      }
    });

    // ========== 1. LOGIN ==========
    console.log('1. Logging in...');
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('   Login successful\n');

    // ========== 2. NAVIGATE TO FACTURAS ==========
    console.log('2. Navigating to /facturas...');
    await page.goto('http://localhost:3001/facturas');
    await page.waitForTimeout(2000);
    console.log('   Navigation complete\n');

    // ========== 3. TAKE SCREENSHOT OF CURRENT STATE ==========
    console.log('3. Taking screenshot of current state...');

    // Log year dropdown state
    const yearSelector = page.locator('select');
    const yearDropdownExists = await yearSelector.first().isVisible().catch(() => false);
    if (yearDropdownExists) {
      const selectedYear = await yearSelector.first().inputValue().catch(() => 'N/A');
      console.log(`   Year dropdown selected value: ${selectedYear}`);
    }

    // Check for year tabs (buttons)
    const yearTabs = page.locator('nav button, div.border-b button');
    const yearTabsCount = await yearTabs.count();
    console.log(`   Year tabs found: ${yearTabsCount}`);

    // List all visible invoices
    const invoiceRows = page.locator('table tbody tr');
    const invoiceCount = await invoiceRows.count();
    console.log(`   Invoices visible in table: ${invoiceCount}`);

    await page.screenshot({ path: 'screenshot-01-facturas-initial.png', fullPage: true });
    console.log('   Screenshot saved: screenshot-01-facturas-initial.png\n');

    // ========== 4. CLICK "NUEVO INGRESO" BUTTON ==========
    console.log('4. Looking for "Nuevo ingreso" button...');

    // Try various selectors for the button
    const nuevoIngresoSelectors = [
      'a:has-text("Nuevo ingreso")',
      'button:has-text("Nuevo ingreso")',
      'a[href="/facturas/nueva"]',
      'text=Nuevo ingreso'
    ];

    let buttonFound = false;
    for (const selector of nuevoIngresoSelectors) {
      const btn = page.locator(selector);
      if (await btn.isVisible().catch(() => false)) {
        console.log(`   Found button with selector: ${selector}`);
        await btn.click();
        buttonFound = true;
        break;
      }
    }

    if (!buttonFound) {
      // Take screenshot to see what's on the page
      await page.screenshot({ path: 'screenshot-error-no-nuevo-ingreso.png', fullPage: true });
      console.log('   ERROR: Could not find "Nuevo ingreso" button');
      console.log('   Screenshot saved: screenshot-error-no-nuevo-ingreso.png');

      // Log all buttons/links on page
      const allButtons = page.locator('button, a');
      const buttonTexts = await allButtons.allTextContents();
      console.log('   All buttons/links on page:', buttonTexts.slice(0, 10));
    }

    await page.waitForTimeout(2000);
    console.log(`   Current URL after click: ${page.url()}\n`);

    // ========== 5. CREATE NON-REPETITIVE INVOICE ==========
    console.log('5. Creating non-repetitive invoice...');

    // Take screenshot of form
    await page.screenshot({ path: 'screenshot-02-new-invoice-form.png', fullPage: true });
    console.log('   Screenshot saved: screenshot-02-new-invoice-form.png');

    // Select client (first available)
    const clientSelect = page.locator('select[name="cliente_id"]');
    if (await clientSelect.isVisible()) {
      // Get all options
      const options = await clientSelect.locator('option').allTextContents();
      console.log(`   Available clients: ${options.join(', ')}`);

      // Select second option (first is usually placeholder)
      if (options.length > 1) {
        await clientSelect.selectOption({ index: 1 });
        console.log(`   Selected client: ${options[1]}`);
      }
    }

    // Fill concepto
    const conceptoInput = page.locator('textarea[name="concepto"], input[name="concepto"]');
    if (await conceptoInput.isVisible()) {
      await conceptoInput.fill('Test single invoice');
      console.log('   Filled concepto: "Test single invoice"');
    }

    // Fill base imponible
    const baseInput = page.locator('input[name="base_imponible"]');
    if (await baseInput.isVisible()) {
      await baseInput.fill('500');
      console.log('   Filled base_imponible: 500');
    }

    // Set date to today (2026-01-14)
    const dateInput = page.locator('input[name="fecha_emision"]');
    if (await dateInput.isVisible()) {
      const currentDateValue = await dateInput.inputValue();
      console.log(`   Current date value in form: ${currentDateValue}`);
      await dateInput.fill('2026-01-14');
      console.log('   Set fecha_emision to: 2026-01-14');
    }

    // Check if "Repetir ingreso" toggle exists and make sure it's OFF
    const repetirToggle = page.locator('input[type="checkbox"]').filter({ hasText: /repetir|recurrente/i });
    const repetirLabel = page.locator('label:has-text("Repetir"), label:has-text("recurrente")');

    if (await repetirToggle.isVisible().catch(() => false)) {
      const isChecked = await repetirToggle.isChecked();
      console.log(`   "Repetir ingreso" toggle is: ${isChecked ? 'ON' : 'OFF'}`);
      if (isChecked) {
        await repetirToggle.click();
        console.log('   Turned OFF "Repetir ingreso" toggle');
      }
    } else {
      console.log('   No "Repetir ingreso" toggle found (or already off)');
    }

    // Log all form field states before submit
    console.log('\n   Form state before submit:');
    const allInputs = page.locator('input, select, textarea');
    const inputCount = await allInputs.count();
    for (let i = 0; i < Math.min(inputCount, 15); i++) {
      const input = allInputs.nth(i);
      const name = await input.getAttribute('name').catch(() => 'unnamed');
      const value = await input.inputValue().catch(() => 'N/A');
      const type = await input.getAttribute('type').catch(() => 'text');
      if (name && name !== 'unnamed') {
        console.log(`     - ${name} (${type}): ${value}`);
      }
    }

    // Take screenshot before submit
    await page.screenshot({ path: 'screenshot-03-form-filled.png', fullPage: true });
    console.log('\n   Screenshot saved: screenshot-03-form-filled.png\n');

    // ========== 6. SUBMIT THE FORM ==========
    console.log('6. Submitting the form...');

    const submitButton = page.locator('button[type="submit"]');
    if (await submitButton.isVisible()) {
      await submitButton.click();
      console.log('   Clicked submit button');
    }

    // Wait for response
    await page.waitForTimeout(3000);
    console.log(`   URL after submission: ${page.url()}`);

    // Take screenshot after submission (may show PDF preview modal)
    await page.screenshot({ path: 'screenshot-04-after-submission.png', fullPage: true });
    console.log('   Screenshot saved: screenshot-04-after-submission.png');

    // Check for success message
    const successToast = page.locator('text=correctamente, text=creado, text=success');
    const hasSuccessMessage = await successToast.isVisible().catch(() => false);
    console.log(`   Success message visible: ${hasSuccessMessage}`);

    // Close the PDF preview modal if it's open
    const closeModalButton = page.locator('button:has(svg), button.close, [aria-label="close"], [aria-label="Close"]').first();
    const modalCloseX = page.locator('div.fixed button').filter({ hasText: '' }).first();
    const anyCloseButton = page.locator('div.fixed.inset-0 button').first();

    // Try to close modal by clicking X button or clicking outside
    const modalOverlay = page.locator('div.fixed.inset-0.bg-black');
    if (await modalOverlay.isVisible().catch(() => false)) {
      console.log('   PDF preview modal is open, attempting to close...');

      // Try pressing Escape key
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // If still visible, try clicking X button
      if (await modalOverlay.isVisible().catch(() => false)) {
        const xButton = page.locator('button:has-text("X"), button:has-text("x")').first();
        if (await xButton.isVisible().catch(() => false)) {
          await xButton.click();
          await page.waitForTimeout(500);
        }
      }

      // If still visible, look for any close button in the modal header
      if (await modalOverlay.isVisible().catch(() => false)) {
        const headerCloseBtn = page.locator('div.fixed button svg').first();
        if (await headerCloseBtn.isVisible().catch(() => false)) {
          await headerCloseBtn.click({ force: true });
          await page.waitForTimeout(500);
        }
      }

      console.log('   Modal close attempted');
    }

    await page.waitForTimeout(1000);
    console.log('');

    // ========== 7. CHECK IF INVOICE APPEARS IN 2026 LIST ==========
    console.log('7. Checking if invoice appears in 2026 list...');

    // Force navigate to facturas page to ensure modal is closed
    await page.goto('http://localhost:3001/facturas');
    await page.waitForTimeout(2000);

    // Take screenshot after navigation
    await page.screenshot({ path: 'screenshot-05-facturas-after-nav.png', fullPage: true });
    console.log('   Screenshot saved: screenshot-05-facturas-after-nav.png');

    // Check current year selection (it's a button/dropdown, not a select)
    const yearButton = page.locator('button:has-text("2026"), button:has-text("2025"), button:has-text("2024")').first();
    if (await yearButton.isVisible().catch(() => false)) {
      const yearText = await yearButton.textContent();
      console.log(`   Year button shows: ${yearText}`);

      // If it's a dropdown button, click to see options
      if (!yearText?.includes('2026')) {
        await yearButton.click();
        await page.waitForTimeout(500);

        const option2026 = page.locator('button:has-text("2026"), option:has-text("2026"), li:has-text("2026")');
        if (await option2026.isVisible().catch(() => false)) {
          await option2026.click();
          await page.waitForTimeout(1000);
          console.log('   Selected 2026');
        }
      }
    }

    // Also check if there's a select dropdown for years
    const yearSelect = page.locator('select').first();
    if (await yearSelect.isVisible().catch(() => false)) {
      const selectedYear = await yearSelect.inputValue().catch(() => 'N/A');
      console.log(`   Year select value: ${selectedYear}`);
    }

    // Search for our invoice in the table
    await page.waitForTimeout(2000);
    const testInvoiceRow = page.locator('tr:has-text("Test single invoice"), td:has-text("Test single invoice")');
    const invoiceFound = await testInvoiceRow.isVisible().catch(() => false);

    console.log(`   Invoice "Test single invoice" found in list: ${invoiceFound ? 'YES' : 'NO'}`);

    // List all invoices in the table to see what's there
    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count();
    console.log(`   Total rows in table: ${rowCount}`);

    if (rowCount > 0) {
      console.log('   First 5 invoice entries:');
      for (let i = 0; i < Math.min(rowCount, 5); i++) {
        const rowText = await tableRows.nth(i).textContent();
        console.log(`     Row ${i + 1}: ${rowText?.substring(0, 100)}...`);
      }
    }

    // Take screenshot of the list
    await page.screenshot({ path: 'screenshot-06-facturas-list-2026.png', fullPage: true });
    console.log('   Screenshot saved: screenshot-06-facturas-list-2026.png\n');

    // ========== 8. CHECK BROWSER CONSOLE FOR ERRORS ==========
    console.log('8. Checking browser console for errors...');
    if (consoleErrors.length > 0) {
      console.log('   Console errors found:');
      consoleErrors.forEach(err => console.log(`   ${err}`));
    } else {
      console.log('   No console errors detected');
    }
    console.log('');

    // ========== 9. REPORT FINDINGS ==========
    console.log('=== FINDINGS REPORT ===\n');
    console.log('Invoice Creation Test Results:');
    console.log('------------------------------');
    console.log(`- Login: Successful`);
    console.log(`- Nuevo ingreso button found: ${buttonFound ? 'YES' : 'NO'}`);
    console.log(`- Form submission: Completed`);
    console.log(`- Invoice visible in 2026 list: ${invoiceFound ? 'YES' : 'NO'}`);
    console.log(`- Console errors: ${consoleErrors.length}`);

    if (!invoiceFound) {
      console.log('\nPOSSIBLE ISSUES:');
      console.log('- Invoice date might not match 2026 year filter');
      console.log('- Invoice might have been saved with wrong date');
      console.log('- Year filter might not be working correctly');
    }

    console.log('\nScreenshots saved:');
    console.log('- screenshot-01-facturas-initial.png');
    console.log('- screenshot-02-new-invoice-form.png');
    console.log('- screenshot-03-form-filled.png');
    console.log('- screenshot-04-after-submission.png');
    console.log('- screenshot-05-facturas-after-nav.png');
    console.log('- screenshot-06-facturas-list-2026.png');

    console.log('\n=== TEST COMPLETE ===\n');

    // Cleanup - delete the test invoice if found
    if (invoiceFound) {
      console.log('Cleanup: Deleting test invoice...');
      const deleteBtn = page.locator('tr:has-text("Test single invoice") button:has-text("Eliminar")');
      if (await deleteBtn.isVisible().catch(() => false)) {
        page.on('dialog', dialog => dialog.accept());
        await deleteBtn.click();
        await page.waitForTimeout(1000);
        console.log('Test invoice deleted');
      }
    }
  });
});

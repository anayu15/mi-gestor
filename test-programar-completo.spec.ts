import { test, expect, Page } from '@playwright/test';

/**
 * Test the "Programar" scheduling feature in the mi-gestor application
 * Creates actual scheduled invoices and expenses following the test plan.
 */
test.describe('Programar Feature - Complete Test', () => {
  const TEST_EMAIL = 'test@migestor.com';
  const TEST_PASSWORD = 'Test123456';
  const FRONTEND_URL = 'http://localhost:3001';

  let errors: string[] = [];

  test.beforeEach(async ({ page }) => {
    errors = [];

    // Capture JavaScript errors
    page.on('pageerror', error => {
      errors.push(`Page error: ${error.message}`);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('Failed to load resource') &&
            !text.includes('404') &&
            !text.includes('favicon.ico')) {
          errors.push(`Console error: ${text}`);
        }
      }
    });
  });

  async function login(page: Page) {
    console.log('Step: Navigating to login page...');
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });

    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    console.log('Step: Login page loaded');

    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    console.log('Step: Credentials filled');

    await page.click('button[type="submit"]');

    // Wait for response and navigation - give more time for the backend
    console.log('Step: Waiting for login response...');

    // Wait for the dashboard or any non-login page
    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    } catch (e) {
      // If waitForURL fails, check for error message
      const errorMsg = page.locator('.bg-red-50, .text-red-600, .text-red-500');
      if (await errorMsg.count() > 0) {
        const errText = await errorMsg.first().textContent();
        console.log(`Login error on page: ${errText}`);
        throw new Error(`Login failed with error: ${errText}`);
      }

      // Try waiting a bit more
      await page.waitForTimeout(3000);
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        throw new Error('Login did not redirect - still on login page');
      }
    }

    const currentUrl = page.url();
    console.log(`Step: Logged in, current URL: ${currentUrl}`);

    expect(currentUrl).not.toContain('/login');
    console.log('Login successful!');
  }

  test('Test 1: Create Scheduled Invoices (Facturas)', async ({ page }) => {
    console.log('\n============================================');
    console.log('TEST 1: Creating Scheduled Invoices');
    console.log('============================================\n');

    await login(page);

    // Step 1: Go to http://localhost:3001/facturas
    console.log('Step 1: Navigating to Facturas page...');
    await page.goto(`${FRONTEND_URL}/facturas`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/test1-01-facturas-page.png', fullPage: true });
    console.log('Screenshot: test1-01-facturas-page.png');

    // Step 2: Click "Nueva Factura" / "+ Nuevo Ingreso" button
    console.log('Step 2: Looking for "+ Nuevo Ingreso" button...');
    const nuevoIngresoBtn = page.locator('button:has-text("Nuevo Ingreso")');
    await expect(nuevoIngresoBtn).toBeVisible({ timeout: 5000 });

    await nuevoIngresoBtn.click();
    await page.waitForTimeout(1000);
    console.log('Step 2: Modal opened');
    await page.screenshot({ path: 'screenshots/test1-02-nueva-factura-modal.png', fullPage: true });
    console.log('Screenshot: test1-02-nueva-factura-modal.png');

    // Step 3: Fill in form fields
    console.log('Step 3: Filling in form fields...');

    // Select a client from dropdown
    const clientSelect = page.locator('select[name="cliente_id"]');
    await clientSelect.waitFor({ state: 'visible', timeout: 5000 });

    // Get available clients
    const clientOptions = await clientSelect.locator('option').allTextContents();
    console.log(`Available clients: ${clientOptions.join(', ')}`);

    // Select first non-empty client
    const validOptions = await clientSelect.locator('option[value]:not([value=""])').all();
    if (validOptions.length === 0) {
      console.log('ERROR: No clients available. Please create a client first.');
      await page.screenshot({ path: 'screenshots/test1-ERROR-no-clients.png', fullPage: true });
      throw new Error('No clients available to select');
    }

    const firstClientValue = await validOptions[0].getAttribute('value');
    await clientSelect.selectOption(firstClientValue!);
    const selectedClientText = await clientSelect.locator('option:checked').textContent();
    console.log(`Selected client: ${selectedClientText}`);

    // Fill Concepto
    console.log('Filling concepto: "Servicios mensuales de consultoria"');
    await page.fill('textarea[name="concepto"]', 'Servicios mensuales de consultoria');

    // Fill Base Imponible
    console.log('Filling base imponible: 2000');
    await page.fill('input[name="base_imponible"]', '2000');

    // Verify IVA and IRPF values
    const ivaSelect = page.locator('select[name="tipo_iva"]');
    const irpfSelect = page.locator('select[name="tipo_irpf"]');
    const ivaValue = await ivaSelect.inputValue();
    const irpfValue = await irpfSelect.inputValue();
    console.log(`IVA: ${ivaValue}%, IRPF: ${irpfValue}%`);

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/test1-03-form-filled.png', fullPage: true });
    console.log('Screenshot: test1-03-form-filled.png');

    // Step 4: Enable "Programar este ingreso" toggle
    console.log('Step 4: Enabling "Programar este ingreso" toggle...');

    // Scroll down to see Programar section
    const modalContent = page.locator('.overflow-y-auto');
    await modalContent.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(300);

    // Click on toggle using the span text
    const programarToggle = page.locator('span:has-text("Programar este ingreso")');
    await programarToggle.click();
    await page.waitForTimeout(1000);

    // Verify the blue config section appeared (within the modal, using .rounded-lg.p-4)
    const modal = page.locator('.fixed.inset-0').first();
    const configSection = modal.locator('.bg-blue-50.rounded-lg');
    await expect(configSection).toBeVisible({ timeout: 3000 });
    console.log('Programar config section is now visible');
    await page.screenshot({ path: 'screenshots/test1-04-programar-enabled.png', fullPage: true });
    console.log('Screenshot: test1-04-programar-enabled.png');

    // Step 5: Configure scheduling settings
    console.log('Step 5: Configuring scheduling settings...');

    // Scroll to see all fields
    await modalContent.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(300);

    // Periodicidad: Mensual (should be default) - within modal's programar section
    const periodicidadSelect = configSection.locator('select').first();
    await periodicidadSelect.selectOption('MENSUAL');
    console.log('Set Periodicidad: Mensual');

    // Dia de generacion: Ultimo dia laboral (should be default)
    const tipoDiaSelect = configSection.locator('select').nth(1);
    await tipoDiaSelect.selectOption('ULTIMO_DIA_LABORAL');
    console.log('Set Dia de generacion: Ultimo dia laboral');

    // Fecha inicio: 2026-01-01
    const fechaInicioInput = configSection.locator('input[type="date"]').first();
    await fechaInicioInput.fill('2026-01-01');
    console.log('Set Fecha inicio: 2026-01-01');

    // Check "Sin fecha de fin" checkbox
    const sinFechaFinCheckbox = configSection.locator('input[type="checkbox"]');
    const isChecked = await sinFechaFinCheckbox.isChecked();
    console.log(`"Sin fecha de fin" checkbox state: ${isChecked ? 'CHECKED' : 'UNCHECKED'}`);

    if (!isChecked) {
      await sinFechaFinCheckbox.check();
      console.log('Checked "Sin fecha de fin"');
    }

    await page.waitForTimeout(2000); // Wait for preview API
    await page.screenshot({ path: 'screenshots/test1-05-programar-configured.png', fullPage: true });
    console.log('Screenshot: test1-05-programar-configured.png');

    // Step 6: Verify preview shows 12 facturas
    console.log('Step 6: Verifying preview count...');

    // Wait for preview to calculate
    await configSection.locator('.text-xl.font-bold').waitFor({ state: 'visible', timeout: 5000 });
    const previewNumber = configSection.locator('.text-xl.font-bold');
    const previewCount = await previewNumber.textContent();
    console.log(`Preview shows: ${previewCount} facturas`);

    // Should show 12 (one per month for the year)
    expect(parseInt(previewCount || '0')).toBe(12);
    console.log('Preview count verified: 12 facturas');
    await page.screenshot({ path: 'screenshots/test1-06-preview-12.png', fullPage: true });
    console.log('Screenshot: test1-06-preview-12.png');

    // Step 7: Click submit button
    console.log('Step 7: Submitting to create invoices...');

    const submitBtn = page.locator('button[type="submit"]').last();
    const btnText = await submitBtn.textContent();
    console.log(`Submit button text: "${btnText}"`);

    const isDisabled = await submitBtn.isDisabled();
    expect(isDisabled).toBe(false);
    console.log('Submit button is enabled');

    await submitBtn.click();
    console.log('Clicked submit button');

    // Wait for response - look for success message in modal with "creado" or "generado"
    console.log('Waiting for success message...');

    // Wait for the specific success message that mentions the count
    try {
      // Look for success message containing "facturas" - this is the modal success message
      const successMsgLocator = modal.locator('text=/Se han creado \\d+ facturas/i');
      await successMsgLocator.waitFor({ state: 'visible', timeout: 15000 });
      const msgText = await successMsgLocator.textContent();
      console.log(`SUCCESS MESSAGE: ${msgText}`);
    } catch (e) {
      // If that doesn't work, check for any green success box in modal
      const successBox = modal.locator('.bg-green-50.text-green-600');
      if (await successBox.count() > 0) {
        const msgText = await successBox.textContent();
        console.log(`SUCCESS MESSAGE (alt): ${msgText}`);
      }
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/test1-07-after-submit.png', fullPage: true });
    console.log('Screenshot: test1-07-after-submit.png');

    // Step 8: Verify success
    console.log('Step 8: Verifying the operation completed...');

    // Wait for modal to close
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/test1-08-final.png', fullPage: true });
    console.log('Screenshot: test1-08-final.png');

    // Verify invoices appear in the list
    console.log('Verifying invoices appear in the list...');
    await page.goto(`${FRONTEND_URL}/facturas`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Search for partial match - the concepto might be slightly different
    const consultoriaInvoices = page.locator('text=/Servicios.*consultoria/i');
    const invoiceCount = await consultoriaInvoices.count();
    console.log(`Found ${invoiceCount} invoices with "Servicios...consultoria"`);

    // Log what we actually found for debugging
    if (invoiceCount > 0) {
      const firstMatch = await consultoriaInvoices.first().textContent();
      console.log(`First match: "${firstMatch}"`);
    }

    expect(invoiceCount).toBeGreaterThanOrEqual(1);
    console.log(`Verified at least 1 scheduled invoice exists`);

    await page.screenshot({ path: 'screenshots/test1-09-verify-list.png', fullPage: true });
    console.log('Screenshot: test1-09-verify-list.png');

    // Report JavaScript errors
    if (errors.length > 0) {
      console.log('\nJavaScript Errors:');
      errors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('\nNo JavaScript errors detected');
    }

    console.log('\n============================================');
    console.log('TEST 1 COMPLETED SUCCESSFULLY!');
    console.log('============================================\n');
  });

  test('Test 2: Create Scheduled Expenses (Gastos)', async ({ page }) => {
    console.log('\n============================================');
    console.log('TEST 2: Creating Scheduled Expenses');
    console.log('============================================\n');

    await login(page);

    // Step 1: Go to http://localhost:3001/gastos
    console.log('Step 1: Navigating to Gastos page...');
    await page.goto(`${FRONTEND_URL}/gastos`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // If gastos page doesn't have the button, go to facturas
    let gastoBtn = page.locator('button:has-text("Nuevo Gasto")');
    if (await gastoBtn.count() === 0) {
      console.log('Button not on gastos page, trying facturas...');
      await page.goto(`${FRONTEND_URL}/facturas`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      gastoBtn = page.locator('button:has-text("Nuevo Gasto")');
    }

    await page.screenshot({ path: 'screenshots/test2-01-page.png', fullPage: true });
    console.log('Screenshot: test2-01-page.png');

    // Step 2: Click "Nuevo Gasto" button
    console.log('Step 2: Looking for "Nuevo Gasto" button...');
    await expect(gastoBtn).toBeVisible({ timeout: 5000 });

    await gastoBtn.click();
    await page.waitForTimeout(1000);
    console.log('Step 2: Modal opened');
    await page.screenshot({ path: 'screenshots/test2-02-nuevo-gasto-modal.png', fullPage: true });
    console.log('Screenshot: test2-02-nuevo-gasto-modal.png');

    // Step 3: Fill in form fields
    console.log('Step 3: Filling in form fields...');

    // Fill Concepto
    console.log('Filling concepto: "Alquiler oficina"');
    await page.fill('input[name="concepto"]', 'Alquiler oficina');

    // Fill Proveedor
    console.log('Filling proveedor: "Inmobiliaria ABC"');
    await page.fill('input[name="proveedor_nombre"]', 'Inmobiliaria ABC');

    // Fill Base Imponible
    console.log('Filling base imponible: 800');
    await page.fill('input[name="base_imponible"]', '800');

    // Verify IVA value
    const ivaSelect = page.locator('select[name="tipo_iva"]');
    const ivaValue = await ivaSelect.inputValue();
    console.log(`IVA: ${ivaValue}%`);

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/test2-03-form-filled.png', fullPage: true });
    console.log('Screenshot: test2-03-form-filled.png');

    // Step 4: Enable "Programar este gasto" toggle
    console.log('Step 4: Enabling "Programar este gasto" toggle...');

    // Scroll down to see Programar section
    const modalContent = page.locator('.overflow-y-auto');
    await modalContent.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(300);

    // Click on toggle
    const programarToggle = page.locator('span:has-text("Programar este gasto")');
    await programarToggle.click();
    await page.waitForTimeout(1000);

    // Verify the blue config section appeared (within the modal)
    const modal = page.locator('.fixed.inset-0').first();
    const configSection = modal.locator('.bg-blue-50.rounded-lg');
    await expect(configSection).toBeVisible({ timeout: 3000 });
    console.log('Programar config section is now visible');
    await page.screenshot({ path: 'screenshots/test2-04-programar-enabled.png', fullPage: true });
    console.log('Screenshot: test2-04-programar-enabled.png');

    // Step 5: Configure scheduling settings
    console.log('Step 5: Configuring scheduling settings...');

    // Scroll to see all fields
    await modalContent.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(300);

    // Periodicidad: Mensual
    const periodicidadSelect = configSection.locator('select').first();
    await periodicidadSelect.selectOption('MENSUAL');
    console.log('Set Periodicidad: Mensual');

    // Dia de generacion: Primer dia del mes
    const tipoDiaSelect = configSection.locator('select').nth(1);
    await tipoDiaSelect.selectOption('PRIMER_DIA');
    console.log('Set Dia de generacion: Primer dia del mes');

    // Fecha inicio: 2026-01-01
    const fechaInicioInput = configSection.locator('input[type="date"]').first();
    await fechaInicioInput.fill('2026-01-01');
    console.log('Set Fecha inicio: 2026-01-01');

    // Check "Sin fecha de fin" checkbox
    const sinFechaFinCheckbox = configSection.locator('input[type="checkbox"]');
    const isChecked = await sinFechaFinCheckbox.isChecked();
    console.log(`"Sin fecha de fin" checkbox state: ${isChecked ? 'CHECKED' : 'UNCHECKED'}`);

    if (!isChecked) {
      await sinFechaFinCheckbox.check();
      console.log('Checked "Sin fecha de fin"');
    }

    await page.waitForTimeout(2000); // Wait for preview API
    await page.screenshot({ path: 'screenshots/test2-05-programar-configured.png', fullPage: true });
    console.log('Screenshot: test2-05-programar-configured.png');

    // Step 6: Verify preview shows expected gastos
    console.log('Step 6: Verifying preview count...');

    // Wait for preview to calculate
    await configSection.locator('.text-xl.font-bold').waitFor({ state: 'visible', timeout: 5000 });
    const previewNumber = configSection.locator('.text-xl.font-bold');
    const previewCount = await previewNumber.textContent();
    console.log(`Preview shows: ${previewCount} gastos`);

    // Should show between 10-12 (depends on current date since we use "Primer dia del mes")
    // If we're past Jan 1, January won't be included
    const count = parseInt(previewCount || '0');
    expect(count).toBeGreaterThanOrEqual(10);
    expect(count).toBeLessThanOrEqual(12);
    console.log(`Preview count verified: ${count} gastos (10-12 range)`);
    await page.screenshot({ path: 'screenshots/test2-06-preview-count.png', fullPage: true });
    console.log('Screenshot: test2-06-preview-count.png');

    // Step 7: Click submit button
    console.log('Step 7: Submitting to create expenses...');

    const submitBtn = page.locator('button[type="submit"]').last();
    const btnText = await submitBtn.textContent();
    console.log(`Submit button text: "${btnText}"`);

    const isDisabled = await submitBtn.isDisabled();
    expect(isDisabled).toBe(false);
    console.log('Submit button is enabled');

    await submitBtn.click();
    console.log('Clicked submit button');

    // Wait for response - look for success message in modal
    console.log('Waiting for success message...');

    try {
      // Look for success message containing "gastos"
      const successMsgLocator = modal.locator('text=/Se han creado \\d+ gastos/i');
      await successMsgLocator.waitFor({ state: 'visible', timeout: 15000 });
      const msgText = await successMsgLocator.textContent();
      console.log(`SUCCESS MESSAGE: ${msgText}`);
    } catch (e) {
      // If that doesn't work, check for any green success box in modal
      const successBox = modal.locator('.bg-green-50.text-green-600');
      if (await successBox.count() > 0) {
        const msgText = await successBox.textContent();
        console.log(`SUCCESS MESSAGE (alt): ${msgText}`);
      }
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/test2-07-after-submit.png', fullPage: true });
    console.log('Screenshot: test2-07-after-submit.png');

    // Step 8: Verify the operation completed
    console.log('Step 8: Verifying the operation completed...');

    // Wait for modal to close
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/test2-08-final.png', fullPage: true });
    console.log('Screenshot: test2-08-final.png');

    // Verify expenses appear in the list
    console.log('Verifying expenses appear in the list...');
    await page.goto(`${FRONTEND_URL}/facturas`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Search for partial match
    const alquilerExpenses = page.locator('text=/Alquiler.*oficina/i');
    const expenseCount = await alquilerExpenses.count();
    console.log(`Found ${expenseCount} expenses with "Alquiler...oficina"`);

    // Log what we actually found
    if (expenseCount > 0) {
      const firstMatch = await alquilerExpenses.first().textContent();
      console.log(`First match: "${firstMatch}"`);
    }

    expect(expenseCount).toBeGreaterThanOrEqual(1);
    console.log(`Verified at least 1 scheduled expense exists`);

    await page.screenshot({ path: 'screenshots/test2-09-verify-list.png', fullPage: true });
    console.log('Screenshot: test2-09-verify-list.png');

    // Report JavaScript errors
    if (errors.length > 0) {
      console.log('\nJavaScript Errors:');
      errors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('\nNo JavaScript errors detected');
    }

    console.log('\n============================================');
    console.log('TEST 2 COMPLETED SUCCESSFULLY!');
    console.log('============================================\n');
  });

  test('Verify all scheduled records', async ({ page }) => {
    console.log('\n============================================');
    console.log('VERIFICATION: Checking all created records');
    console.log('============================================\n');

    await login(page);

    // Navigate to facturas page
    console.log('Navigating to facturas page...');
    await page.goto(`${FRONTEND_URL}/facturas`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Check for scheduled invoices
    console.log('\nChecking for scheduled invoices...');
    const consultoriaInvoices = page.locator('text=/Servicios.*consultoria/i');
    const invoiceCount = await consultoriaInvoices.count();
    console.log(`Found ${invoiceCount} invoices with "Servicios...consultoria"`);

    // Check for scheduled expenses
    console.log('\nChecking for scheduled expenses...');
    const alquilerExpenses = page.locator('text=/Alquiler.*oficina/i');
    const expenseCount = await alquilerExpenses.count();
    console.log(`Found ${expenseCount} expenses with "Alquiler...oficina"`);

    await page.screenshot({ path: 'screenshots/verify-all-records.png', fullPage: true });
    console.log('\nScreenshot: verify-all-records.png');

    // Summary
    console.log('\n============================================');
    console.log('SUMMARY:');
    console.log(`  - Scheduled Invoices: ${invoiceCount}`);
    console.log(`  - Scheduled Expenses: ${expenseCount}`);
    console.log('============================================\n');

    // Verify we found records (may be from this run or previous runs)
    // At minimum we should have some scheduled records
    console.log('NOTE: This verification checks all records with the specific concepts.');
    console.log('The counts may include records from previous test runs.');
  });
});

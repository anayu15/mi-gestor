import { test, expect, Page } from '@playwright/test';

test.describe('Test Programar Feature for Facturas and Gastos', () => {
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
        // Ignore resource loading errors, focus on JavaScript errors
        if (!text.includes('Failed to load resource') &&
            !text.includes('404') &&
            !text.includes('favicon.ico')) {
          errors.push(`Console error: ${text}`);
        }
      }
    });
  });

  async function login(page: Page) {
    console.log('Navigating to login page...');
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });

    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    console.log('Login page loaded');

    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    console.log('Credentials filled');

    await page.click('button[type="submit"]');

    // Wait for navigation away from login page
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    console.log(`Current URL after login: ${currentUrl}`);

    if (currentUrl.includes('/login')) {
      throw new Error('Login failed - still on login page');
    }
    console.log('Login successful');
  }

  test('Test creating programmed Facturas (Ingresos)', async ({ page }) => {
    await login(page);

    // Navigate to Facturas page
    console.log('\n=== Testing Programmed Facturas ===');
    console.log('Navigating to Facturas page...');
    await page.goto(`${FRONTEND_URL}/facturas`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Take screenshot of facturas page
    await page.screenshot({ path: 'screenshots/01-facturas-page.png', fullPage: true });
    console.log('Screenshot: 01-facturas-page.png');

    // Click "+ Nuevo Ingreso" button
    console.log('Looking for "+ Nuevo Ingreso" button...');
    const nuevoIngresoBtn = page.locator('button:has-text("Nuevo Ingreso")');
    const btnExists = await nuevoIngresoBtn.count() > 0;

    if (!btnExists) {
      console.log('Button not found, looking for alternative...');
      const allButtons = await page.locator('button').allTextContents();
      console.log('Available buttons:', allButtons);
      throw new Error('Could not find "Nuevo Ingreso" button');
    }

    await nuevoIngresoBtn.click();
    await page.waitForTimeout(1000);
    console.log('Modal opened');

    // Take screenshot of the modal
    await page.screenshot({ path: 'screenshots/02-nueva-factura-modal.png', fullPage: true });
    console.log('Screenshot: 02-nueva-factura-modal.png');

    // Select a client
    console.log('Selecting client...');
    const clientSelect = page.locator('select[name="cliente_id"]');
    await clientSelect.waitFor({ state: 'visible', timeout: 5000 });

    // Get first available client option (skip the "Seleccionar cliente..." placeholder)
    const clientOptions = await clientSelect.locator('option').all();
    let clientSelected = false;
    for (const option of clientOptions) {
      const value = await option.getAttribute('value');
      if (value && value !== '') {
        await clientSelect.selectOption(value);
        const text = await option.textContent();
        console.log(`Selected client: ${text}`);
        clientSelected = true;
        break;
      }
    }

    if (!clientSelected) {
      console.log('WARNING: No clients available. Cannot proceed with factura creation.');
      await page.screenshot({ path: 'screenshots/02b-no-clients.png', fullPage: true });
      return;
    }

    // Fill in fecha de emision (today)
    const today = new Date().toISOString().split('T')[0];
    console.log(`Setting fecha emision to: ${today}`);
    await page.fill('input[name="fecha_emision"]', today);

    // Fill in concepto
    console.log('Filling concepto...');
    await page.fill('textarea[name="concepto"]', 'Servicios de consultoria mensual');

    // Fill in base imponible
    console.log('Filling base imponible...');
    await page.fill('input[name="base_imponible"]', '1000');

    // Verify IVA and IRPF are set (they should default to 21% and 7%)
    const ivaValue = await page.locator('select[name="tipo_iva"]').inputValue();
    const irpfValue = await page.locator('select[name="tipo_irpf"]').inputValue();
    console.log(`IVA: ${ivaValue}%, IRPF: ${irpfValue}%`);

    await page.waitForTimeout(500);

    // Scroll down to see the Programar section
    console.log('Scrolling to Programar section...');
    const modalContent = page.locator('.overflow-y-auto');
    await modalContent.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/03-form-filled.png', fullPage: true });
    console.log('Screenshot: 03-form-filled.png');

    // Enable the "Programar" toggle by clicking on the label text
    console.log('\nEnabling Programar toggle...');

    // Click on "Programar este ingreso" label to toggle
    const programarLabel = page.locator('span:has-text("Programar este ingreso")');
    if (await programarLabel.count() > 0) {
      await programarLabel.click();
      console.log('Clicked on "Programar este ingreso" label');
    } else {
      // Alternative: click on the toggle's visible div
      const toggleDiv = page.locator('label.relative.inline-flex.items-center.cursor-pointer div');
      if (await toggleDiv.count() > 0) {
        await toggleDiv.first().click();
        console.log('Clicked on toggle div');
      }
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/04-programar-enabled.png', fullPage: true });
    console.log('Screenshot: 04-programar-enabled.png');

    // Verify the blue config section is visible
    const configSection = page.locator('.bg-blue-50');
    const configVisible = await configSection.count() > 0;
    console.log(`Programar config section visible: ${configVisible}`);

    if (!configVisible) {
      console.log('ERROR: Programar config section not appearing after toggle');
      throw new Error('Programar section did not expand after clicking toggle');
    }

    // Configure Programar settings
    console.log('\nConfiguring Programar settings...');

    // Scroll to make sure all fields are visible
    await modalContent.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(300);

    // Set Frecuencia to Mensual (should be default)
    const frecSelect = page.locator('.bg-blue-50 select').first();
    if (await frecSelect.count() > 0) {
      await frecSelect.selectOption('MENSUAL');
      console.log('Set frecuencia to: MENSUAL');
    }

    // Set Fecha inicio to today
    const fechaInicioInput = page.locator('.bg-blue-50 input[type="date"]').first();
    if (await fechaInicioInput.count() > 0) {
      await fechaInicioInput.fill(today);
      console.log(`Set fecha inicio to: ${today}`);
    }

    // Check the state of "Sin fecha de fin" checkbox - it should already be checked by default
    console.log('Checking "Sin fecha de fin" checkbox state...');
    const sinFechaFinCheckbox = page.locator('.bg-blue-50 input[type="checkbox"]');
    const isChecked = await sinFechaFinCheckbox.isChecked();
    console.log(`Sin fecha de fin checkbox is currently: ${isChecked ? 'CHECKED' : 'UNCHECKED'}`);

    // If not checked, check it
    if (!isChecked) {
      console.log('Clicking to check "Sin fecha de fin"...');
      const sinFechaFinLabel = page.locator('.bg-blue-50 label:has-text("Sin fecha de fin")');
      if (await sinFechaFinLabel.count() > 0) {
        await sinFechaFinLabel.click();
        console.log('Clicked on "Sin fecha de fin" label');
      }
    } else {
      console.log('"Sin fecha de fin" is already checked - leaving as is');
    }

    await page.waitForTimeout(2000); // Wait for API preview call
    await page.screenshot({ path: 'screenshots/05-programar-configured.png', fullPage: true });
    console.log('Screenshot: 05-programar-configured.png');

    // Wait for preview count to update
    console.log('Waiting for preview count...');
    await page.waitForTimeout(1500);

    // Check the preview count - look in the blue section for the bold number
    const previewNumber = page.locator('.bg-blue-50 .text-xl.font-bold');
    let previewCountValue = '0';
    if (await previewNumber.count() > 0) {
      previewCountValue = await previewNumber.textContent() || '0';
      console.log(`Preview count: ${previewCountValue} facturas will be created`);
    } else {
      console.log('Preview count element not found');
    }

    // Check the full preview text
    const previewDiv = page.locator('.bg-blue-50 .text-blue-800');
    if (await previewDiv.count() > 0) {
      const text = await previewDiv.textContent();
      console.log(`Preview text: ${text}`);
    }

    // Check if there's a loading or error state
    const loadingText = page.locator('text=Calculando...');
    if (await loadingText.count() > 0) {
      console.log('Preview is still calculating... waiting more');
      await page.waitForTimeout(3000);
    }

    const errorText = page.locator('.bg-blue-50 .text-red-600');
    if (await errorText.count() > 0) {
      const errMsg = await errorText.textContent();
      console.log(`ERROR in preview: ${errMsg}`);
    }

    await page.screenshot({ path: 'screenshots/06-preview-count.png', fullPage: true });
    console.log('Screenshot: 06-preview-count.png');

    // Find and click the "Generar X Facturas" button
    console.log('\nLooking for generate button...');
    const generateBtn = page.locator('button[type="submit"]');
    const btnText = await generateBtn.textContent();
    console.log(`Submit button text: "${btnText}"`);

    // Check if button is enabled
    const isDisabled = await generateBtn.isDisabled();
    console.log(`Button disabled: ${isDisabled}`);

    if (isDisabled) {
      console.log('WARNING: Generate button is disabled!');

      // Check why it might be disabled - look for any issues
      const previewCountCheck = page.locator('.bg-blue-50 .text-xl.font-bold');
      if (await previewCountCheck.count() > 0) {
        const countText = await previewCountCheck.textContent();
        console.log(`Current preview count: ${countText}`);
        if (countText === '0') {
          console.log('Button is disabled because preview count is 0');
          console.log('This could be a BUG - the preview API might not be returning correct counts');
        }
      }

      // Check if fecha fin field still shows placeholder
      const fechaFinInput = page.locator('.bg-blue-50 input[type="date"]').nth(1);
      if (await fechaFinInput.count() > 0) {
        const fechaFinValue = await fechaFinInput.inputValue();
        console.log(`Fecha fin value: "${fechaFinValue}"`);
      }

      await page.screenshot({ path: 'screenshots/06b-button-disabled.png', fullPage: true });
    } else {
      console.log('Clicking generate button...');
      await generateBtn.click();

      // Wait for response
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'screenshots/07-after-generate.png', fullPage: true });
      console.log('Screenshot: 07-after-generate.png');

      // Check for success message
      const successMsg = page.locator('.bg-green-50');
      if (await successMsg.count() > 0) {
        const msgText = await successMsg.textContent();
        console.log(`SUCCESS: ${msgText}`);
      }

      // Check for error message
      const errorMsg = page.locator('.bg-red-50');
      if (await errorMsg.count() > 0) {
        const msgText = await errorMsg.textContent();
        console.log(`ERROR: ${msgText}`);
      }
    }

    // Wait a bit and check final state
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/08-final-facturas.png', fullPage: true });
    console.log('Screenshot: 08-final-facturas.png');

    // Report any JavaScript errors
    if (errors.length > 0) {
      console.log('\nJavaScript Errors detected:');
      errors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('\nNo JavaScript errors detected');
    }
  });

  test('Test creating programmed Gastos', async ({ page }) => {
    await login(page);

    // Navigate to Facturas page (gastos are created from the same page)
    console.log('\n=== Testing Programmed Gastos ===');
    console.log('Navigating to Facturas page...');
    await page.goto(`${FRONTEND_URL}/facturas`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click "+ Nuevo Gasto" button
    console.log('Looking for "+ Nuevo Gasto" button...');
    const nuevoGastoBtn = page.locator('button:has-text("Nuevo Gasto")');
    const btnExists = await nuevoGastoBtn.count() > 0;

    if (!btnExists) {
      console.log('Button not found on facturas page, trying gastos page...');
      await page.goto(`${FRONTEND_URL}/gastos`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots/10-gastos-page.png', fullPage: true });
    }

    // Try again to find the button
    const gastoBtn = page.locator('button:has-text("Nuevo Gasto")');
    if (await gastoBtn.count() === 0) {
      const allButtons = await page.locator('button').allTextContents();
      console.log('Available buttons:', allButtons);
      throw new Error('Could not find "Nuevo Gasto" button');
    }

    await gastoBtn.click();
    await page.waitForTimeout(1000);
    console.log('Gasto modal opened');

    await page.screenshot({ path: 'screenshots/11-nuevo-gasto-modal.png', fullPage: true });
    console.log('Screenshot: 11-nuevo-gasto-modal.png');

    // Fill in the form
    const today = new Date().toISOString().split('T')[0];

    // Fill concepto
    console.log('Filling gasto form...');
    await page.fill('input[name="concepto"]', 'Alquiler oficina mensual');

    // Fill fecha_emision
    await page.fill('input[name="fecha_emision"]', today);

    // Fill proveedor
    await page.fill('input[name="proveedor_nombre"]', 'Inmobiliaria Test');

    // Fill base imponible
    await page.fill('input[name="base_imponible"]', '500');

    await page.waitForTimeout(500);

    // Scroll down to see the Programar section
    console.log('Scrolling to Programar section...');
    const modalContent = page.locator('.overflow-y-auto');
    await modalContent.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/12-gasto-form-filled.png', fullPage: true });
    console.log('Screenshot: 12-gasto-form-filled.png');

    // Enable Programar toggle
    console.log('Enabling Programar toggle for gastos...');

    // Click on "Programar este gasto" label
    const programarLabel = page.locator('span:has-text("Programar este gasto")');
    if (await programarLabel.count() > 0) {
      await programarLabel.click();
      console.log('Clicked on "Programar este gasto" label');
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/13-gasto-programar-enabled.png', fullPage: true });
    console.log('Screenshot: 13-gasto-programar-enabled.png');

    // Verify config section is visible
    const configSection = page.locator('.bg-blue-50');
    const configVisible = await configSection.count() > 0;
    console.log(`Programar config section visible: ${configVisible}`);

    if (!configVisible) {
      console.log('ERROR: Programar config section not appearing after toggle');
      throw new Error('Programar section did not expand after clicking toggle');
    }

    // Configure: Frecuencia Mensual, Fecha inicio today, Sin fecha de fin
    console.log('Configuring gasto programar settings...');

    // Scroll to make fields visible
    await modalContent.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(300);

    // Set fecha inicio
    const fechaInput = page.locator('.bg-blue-50 input[type="date"]').first();
    if (await fechaInput.count() > 0) {
      await fechaInput.fill(today);
      console.log(`Set fecha inicio: ${today}`);
    }

    // Check the state of "Sin fecha de fin" checkbox - it should already be checked by default
    console.log('Checking "Sin fecha de fin" checkbox state...');
    const sinFechaFinCheckbox = page.locator('.bg-blue-50 input[type="checkbox"]');
    const isChecked = await sinFechaFinCheckbox.isChecked();
    console.log(`Sin fecha de fin checkbox is currently: ${isChecked ? 'CHECKED' : 'UNCHECKED'}`);

    // If not checked, check it
    if (!isChecked) {
      console.log('Clicking to check "Sin fecha de fin"...');
      const sinFechaFinLabel = page.locator('.bg-blue-50 label:has-text("Sin fecha de fin")');
      if (await sinFechaFinLabel.count() > 0) {
        await sinFechaFinLabel.click();
        console.log('Clicked on "Sin fecha de fin" label');
      }
    } else {
      console.log('"Sin fecha de fin" is already checked - leaving as is');
    }

    await page.waitForTimeout(2000); // Wait for API preview call
    await page.screenshot({ path: 'screenshots/14-gasto-programar-configured.png', fullPage: true });
    console.log('Screenshot: 14-gasto-programar-configured.png');

    // Check preview count - use more specific selector in the blue section
    const previewNumber = page.locator('.bg-blue-50 .text-xl.font-bold');
    if (await previewNumber.count() > 0) {
      const count = await previewNumber.textContent();
      console.log(`Preview: ${count} gastos will be created`);
    }

    // Find and click the "Crear X Gastos" button
    console.log('Looking for create gastos button...');
    const createBtn = page.locator('button[type="submit"]');
    const btnText = await createBtn.last().textContent();
    console.log(`Submit button text: "${btnText}"`);

    // Use the last submit button (the one in the gasto modal)
    const gastoSubmitBtn = page.locator('button[type="submit"]').last();
    const isDisabled = await gastoSubmitBtn.isDisabled();
    console.log(`Button disabled: ${isDisabled}`);

    if (isDisabled) {
      console.log('WARNING: Create button is disabled!');
      await page.screenshot({ path: 'screenshots/14b-button-disabled.png', fullPage: true });
    } else {
      console.log('Clicking create button...');
      await gastoSubmitBtn.click();

      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'screenshots/15-after-create-gastos.png', fullPage: true });
      console.log('Screenshot: 15-after-create-gastos.png');

      // Check for success/error messages
      const successMsg = page.locator('.bg-green-50');
      if (await successMsg.count() > 0) {
        const msgText = await successMsg.textContent();
        console.log(`SUCCESS: ${msgText}`);
      }

      const errorMsg = page.locator('.bg-red-50');
      if (await errorMsg.count() > 0) {
        const msgText = await errorMsg.textContent();
        console.log(`ERROR: ${msgText}`);
      }
    }

    // Final state
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/16-final-gastos.png', fullPage: true });
    console.log('Screenshot: 16-final-gastos.png');

    // Report JavaScript errors
    if (errors.length > 0) {
      console.log('\nJavaScript Errors detected:');
      errors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('\nNo JavaScript errors detected');
    }
  });

  test('Verify created records', async ({ page }) => {
    await login(page);

    console.log('\n=== Verifying Created Records ===');

    // Navigate to facturas page and check for new invoices
    console.log('Checking facturas page...');
    await page.goto(`${FRONTEND_URL}/facturas`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/20-verify-facturas.png', fullPage: true });
    console.log('Screenshot: 20-verify-facturas.png');

    // Count invoices in the list
    const invoiceRows = page.locator('table tbody tr');
    const invoiceCount = await invoiceRows.count();
    console.log(`Found ${invoiceCount} invoices in the list`);

    // Navigate to gastos page and check for new expenses
    console.log('Checking gastos page...');
    await page.goto(`${FRONTEND_URL}/gastos`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/21-verify-gastos.png', fullPage: true });
    console.log('Screenshot: 21-verify-gastos.png');

    // Count expenses in the list
    const expenseRows = page.locator('table tbody tr');
    const expenseCount = await expenseRows.count();
    console.log(`Found ${expenseCount} expenses in the list`);

    // Look for the specific records we created
    console.log('\nLooking for programmed invoices with "Servicios de consultoria mensual"...');
    const consultoriaInvoices = page.locator('text=Servicios de consultoria mensual');
    const consultoriaCount = await consultoriaInvoices.count();
    console.log(`Found ${consultoriaCount} invoices with "Servicios de consultoria mensual"`);

    console.log('\nLooking for programmed expenses with "Alquiler oficina mensual"...');
    const alquilerExpenses = page.locator('text=Alquiler oficina mensual');
    const alquilerCount = await alquilerExpenses.count();
    console.log(`Found ${alquilerCount} expenses with "Alquiler oficina mensual"`);

    // Final report
    if (errors.length > 0) {
      console.log('\nJavaScript Errors detected during verification:');
      errors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('\nNo JavaScript errors detected');
    }
  });
});

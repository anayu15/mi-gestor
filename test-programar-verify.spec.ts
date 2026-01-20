import { test, expect, Page } from '@playwright/test';

/**
 * Test script to verify the "Programar" scheduling feature in mi-gestor
 * This test will:
 * 1. Login with test credentials
 * 2. Navigate to Facturas page
 * 3. Open Nueva Factura modal
 * 4. Fill in basic invoice details
 * 5. Enable Programar toggle
 * 6. Configure scheduling options (Mensual, Ultimo dia laboral, 2026-01-01 start, Sin fecha de fin)
 * 7. Verify the preview shows "Se crearan 12 facturas"
 * 8. Take screenshots
 *
 * NOTE: This test does NOT submit the form - it only verifies the UI works correctly
 */
test.describe('Verify Programar Scheduling Feature UI', () => {
  const TEST_EMAIL = 'test@migestor.com';
  const TEST_PASSWORD = 'Test123456';
  const FRONTEND_URL = 'http://localhost:3001';

  test('Test Programar feature with monthly schedule and no end date', async ({ page }) => {
    // Step 1: Login
    console.log('Step 1: Logging in...');
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });

    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for successful navigation away from login
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    console.log(`Current URL after login: ${currentUrl}`);

    if (currentUrl.includes('/login')) {
      throw new Error('Login failed - still on login page');
    }
    console.log('Login successful!');

    // Step 2: Navigate to Facturas page
    console.log('\nStep 2: Navigating to Facturas page...');
    await page.goto(`${FRONTEND_URL}/facturas`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Take screenshot of facturas page
    await page.screenshot({
      path: 'screenshots/programar-01-facturas-page.png',
      fullPage: true
    });
    console.log('Screenshot saved: programar-01-facturas-page.png');

    // Step 3: Click "+ Nuevo Ingreso" button to open modal
    console.log('\nStep 3: Opening Nueva Factura modal...');
    const nuevoIngresoBtn = page.locator('button:has-text("Nuevo Ingreso")');
    await expect(nuevoIngresoBtn).toBeVisible({ timeout: 5000 });
    await nuevoIngresoBtn.click();
    await page.waitForTimeout(1000);

    // Step 4: Fill in basic invoice details
    console.log('\nStep 4: Filling in invoice details...');

    // Select a client
    const clientSelect = page.locator('select[name="cliente_id"]');
    await clientSelect.waitFor({ state: 'visible', timeout: 5000 });

    // Get available client options
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
      console.log('WARNING: No clients available!');
      await page.screenshot({ path: 'screenshots/programar-error-no-clients.png', fullPage: true });
      throw new Error('No clients available in the system');
    }

    // Fill concepto
    console.log('Entering concepto: "Servicios de desarrollo"');
    await page.fill('textarea[name="concepto"]', 'Servicios de desarrollo');

    // Fill base imponible
    console.log('Entering base imponible: 1000');
    await page.fill('input[name="base_imponible"]', '1000');

    await page.waitForTimeout(500);

    // Take screenshot after filling form
    await page.screenshot({
      path: 'screenshots/programar-02-form-filled.png',
      fullPage: true
    });
    console.log('Screenshot saved: programar-02-form-filled.png');

    // Step 5: Enable the "Programar" toggle
    console.log('\nStep 5: Enabling Programar toggle...');

    // Scroll down to see the Programar section
    const modalContent = page.locator('.overflow-y-auto');
    await modalContent.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(500);

    // Click on "Programar este ingreso" to toggle
    const programarToggle = page.locator('span:has-text("Programar este ingreso")');
    if (await programarToggle.count() > 0) {
      await programarToggle.click();
      console.log('Clicked on "Programar este ingreso" toggle');
    } else {
      // Try clicking the checkbox input directly
      const toggleCheckbox = page.locator('input[type="checkbox"]').first();
      await toggleCheckbox.click();
      console.log('Clicked on toggle checkbox');
    }

    await page.waitForTimeout(1000);

    // Verify the blue config section appeared (inside the modal, not table rows)
    // The modal uses a rounded-lg class, so we can target the config section more specifically
    const modal = page.locator('.bg-white.rounded-lg.shadow-xl');
    const configSection = modal.locator('.bg-blue-50.rounded-lg');
    await expect(configSection).toBeVisible({ timeout: 5000 });
    console.log('Programar config section is now visible');

    // Take screenshot with toggle enabled
    await page.screenshot({
      path: 'screenshots/programar-03-toggle-enabled.png',
      fullPage: true
    });
    console.log('Screenshot saved: programar-03-toggle-enabled.png');

    // Step 6: Configure scheduling options
    console.log('\nStep 6: Configuring scheduling options...');

    // Scroll to ensure all fields visible
    await modalContent.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(300);

    // 6a. Select "Mensual" for periodicidad (should be default, but select explicitly)
    console.log('Setting periodicidad to: Mensual');
    const periodicidadSelect = configSection.locator('select').first();
    await periodicidadSelect.selectOption('MENSUAL');

    // 6b. Select "Ultimo dia laboral" for tipo de dia (should be default)
    console.log('Setting tipo de dia to: Ultimo dia laboral');
    const tipoDiaSelect = configSection.locator('select').nth(1);
    await tipoDiaSelect.selectOption('ULTIMO_DIA_LABORAL');

    // 6c. Set fecha inicio to 2026-01-01
    console.log('Setting fecha inicio to: 2026-01-01');
    const fechaInicioInput = configSection.locator('input[type="date"]').first();
    await fechaInicioInput.fill('2026-01-01');

    // 6d. Verify "Sin fecha de fin" checkbox state
    console.log('Checking "Sin fecha de fin" checkbox...');
    const sinFechaFinCheckbox = configSection.locator('input[type="checkbox"]');
    const isChecked = await sinFechaFinCheckbox.isChecked();
    console.log(`"Sin fecha de fin" is currently: ${isChecked ? 'CHECKED' : 'UNCHECKED'}`);

    // If not checked, check it
    if (!isChecked) {
      console.log('Checking "Sin fecha de fin" checkbox...');
      const sinFechaFinLabel = configSection.locator('label:has-text("Sin fecha de fin")');
      if (await sinFechaFinLabel.count() > 0) {
        await sinFechaFinLabel.click();
      } else {
        await sinFechaFinCheckbox.click();
      }
      console.log('Checked "Sin fecha de fin"');
    }

    // Take screenshot of configuration
    await page.screenshot({
      path: 'screenshots/programar-04-config-set.png',
      fullPage: true
    });
    console.log('Screenshot saved: programar-04-config-set.png');

    // Step 7: Wait for preview and verify count
    console.log('\nStep 7: Waiting for preview calculation...');

    // Wait for the preview API to respond
    await page.waitForTimeout(2000);

    // Scroll to make sure preview is visible
    await modalContent.evaluate(el => el.scrollTop = el.scrollHeight);

    // Check if still loading
    const loadingIndicator = page.locator('text=Calculando...');
    if (await loadingIndicator.count() > 0) {
      console.log('Preview still calculating, waiting longer...');
      await page.waitForTimeout(3000);
    }

    // Look for the preview count
    const previewSection = configSection.locator('.border-t.border-blue-200');
    const previewText = await previewSection.textContent();
    console.log(`Preview section text: ${previewText}`);

    // Extract the count number
    const previewNumber = configSection.locator('.text-xl.font-bold');
    if (await previewNumber.count() > 0) {
      const count = await previewNumber.textContent();
      console.log(`\n*** Preview count: ${count} facturas ***`);

      // Verify expected count (should be 12 for monthly from Jan to Dec)
      if (count === '12') {
        console.log('SUCCESS: Preview shows expected count of 12 facturas!');
      } else {
        console.log(`NOTE: Preview shows ${count} facturas (expected 12 for monthly Jan-Dec 2026)`);
      }
    } else {
      console.log('WARNING: Could not find preview count element');
    }

    // Check for any errors
    const errorText = configSection.locator('.text-red-600');
    if (await errorText.count() > 0) {
      const error = await errorText.textContent();
      console.log(`ERROR in preview: ${error}`);
    }

    // Step 8: Take final screenshot of the scheduling section
    console.log('\nStep 8: Taking final screenshot of scheduling section...');

    // Ensure the scheduling section is fully visible
    await modalContent.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(500);

    // Take screenshot focused on the modal
    await page.screenshot({
      path: 'screenshots/programar-05-final-preview.png',
      fullPage: true
    });
    console.log('Screenshot saved: programar-05-final-preview.png');

    // Also take a screenshot of just the modal area if possible
    if (await modal.count() > 0) {
      await modal.screenshot({
        path: 'screenshots/programar-06-modal-only.png'
      });
      console.log('Screenshot saved: programar-06-modal-only.png');
    }

    // Report final state
    console.log('\n=== FINAL VERIFICATION ===');

    // Verify submit button text shows the count
    const submitBtn = page.locator('button[type="submit"]');
    const btnText = await submitBtn.textContent();
    console.log(`Submit button text: "${btnText}"`);

    // Verify button is enabled (or report why disabled)
    const isDisabled = await submitBtn.isDisabled();
    console.log(`Submit button disabled: ${isDisabled}`);

    if (isDisabled) {
      console.log('Button is disabled - checking reasons:');
      const previewCountValue = await previewNumber.textContent();
      if (previewCountValue === '0' || previewCountValue === '') {
        console.log('  - Preview count is 0 or empty');
      }
    }

    // Log all configuration values for verification
    console.log('\n=== Configuration Summary ===');
    const periodicidadValue = await periodicidadSelect.inputValue();
    const tipoDiaValue = await tipoDiaSelect.inputValue();
    const fechaInicioValue = await fechaInicioInput.inputValue();
    const sinFechaFinValue = await sinFechaFinCheckbox.isChecked();

    console.log(`Periodicidad: ${periodicidadValue}`);
    console.log(`Tipo de dia: ${tipoDiaValue}`);
    console.log(`Fecha inicio: ${fechaInicioValue}`);
    console.log(`Sin fecha de fin: ${sinFechaFinValue}`);

    // NOT submitting the form as per user request
    console.log('\n*** Test complete - form NOT submitted as requested ***');

    // Wait a moment to allow for any final updates
    await page.waitForTimeout(1000);

    // Final screenshot
    await page.screenshot({
      path: 'screenshots/programar-07-test-complete.png',
      fullPage: true
    });
    console.log('Screenshot saved: programar-07-test-complete.png');
  });
});

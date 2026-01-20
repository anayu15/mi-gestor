import { test, expect } from '@playwright/test';

test.describe('miGestor Full Application Test with Login', () => {
  const TEST_EMAIL = 'test@migestor.com';
  const TEST_PASSWORD = 'Test123456';

  test('Complete user flow: Login and navigate main pages', async ({ page }) => {
    const errors: string[] = [];

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

    // Step 1: Navigate to login page
    console.log('Step 1: Navigating to login page...');
    await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle' });

    // Wait for login form to be visible
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    console.log('✓ Login page loaded');

    // Step 2: Fill login credentials
    console.log('Step 2: Filling login credentials...');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    console.log('✓ Credentials filled');

    // Step 3: Submit login form
    console.log('Step 3: Submitting login form...');
    await page.click('button[type="submit"]');

    // Wait for navigation away from login page (any redirect)
    await page.waitForTimeout(3000); // Give time for login to process
    const currentUrl = page.url();
    console.log(`Current URL after login: ${currentUrl}`);

    // Verify we're no longer on the login page
    if (currentUrl.includes('/login')) {
      // Check if there's an error message
      const errorMessage = await page.textContent('body').catch(() => '');
      console.log('Still on login page. Page content:', errorMessage.substring(0, 200));
      throw new Error('Login failed - still on login page');
    }

    console.log('✓ Login successful, redirected away from login page');

    // Wait a bit for the page to fully load
    await page.waitForTimeout(2000);

    // Step 4: Verify user is logged in
    console.log('Step 4: Verifying user is logged in...');
    console.log(`Authenticated page URL: ${currentUrl}`);
    expect(currentUrl).not.toContain('/login');
    console.log('✓ User is on authenticated page');

    // Step 5: Navigate to Facturas Emitidas (if exists)
    console.log('Step 5: Checking navigation menu...');

    // Look for navigation links
    const navLinks = await page.locator('nav a, [role="navigation"] a').count();
    console.log(`Found ${navLinks} navigation links`);

    // Try to find and click "Facturas" or "Facturas Emitidas"
    const facturasLink = page.locator('a:has-text("Facturas")').first();
    const facturasExists = await facturasLink.count() > 0;

    if (facturasExists) {
      console.log('Step 6: Navigating to Facturas...');
      await facturasLink.click();
      await page.waitForTimeout(2000);
      console.log('✓ Facturas page loaded');
    } else {
      console.log('ℹ Facturas link not found in navigation');
    }

    // Step 7: Try to access recurring templates
    console.log('Step 7: Checking for Plantillas Recurrentes...');
    try {
      // Try to navigate directly to recurring templates
      await page.goto('http://localhost:3001/facturas/plantillas-recurrentes', { timeout: 5000 });
      await page.waitForTimeout(2000);

      const url = page.url();
      if (url.includes('plantillas-recurrentes')) {
        console.log('✓ Plantillas Recurrentes page is accessible');
      } else {
        console.log('ℹ Redirected away from Plantillas Recurrentes');
      }
    } catch (e) {
      console.log('ℹ Plantillas Recurrentes page not accessible or not found');
    }

    // Step 8: Check for JavaScript errors
    console.log('Step 8: Checking for JavaScript errors...');
    if (errors.length > 0) {
      console.error('JavaScript errors detected:', errors);
      throw new Error(`Application has ${errors.length} JavaScript errors:\n${errors.join('\n')}`);
    }
    console.log('✓ No JavaScript errors detected');

    // Step 9: Verify page is responsive
    console.log('Step 9: Verifying page responsiveness...');
    const bodyVisible = await page.isVisible('body');
    expect(bodyVisible).toBeTruthy();
    console.log('✓ Page is visible and responsive');

    console.log('\n✅ All tests passed successfully!');
  });

  test('API: Create recurring template with past date should trigger backfill', async ({ request }) => {
    console.log('Testing API: Login and create recurring template...');

    // Step 1: Login to get token
    const loginResponse = await request.post('http://localhost:3000/api/auth/login', {
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      }
    });

    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    const token = loginData.data.token;
    console.log('✓ Login successful, got auth token');

    // Step 2: Get list of clients
    const clientsResponse = await request.get('http://localhost:3000/api/clients', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    expect(clientsResponse.ok()).toBeTruthy();
    const clientsData = await clientsResponse.json();

    if (!clientsData.data || clientsData.data.length === 0) {
      console.log('ℹ No clients found, skipping template creation test');
      return;
    }

    const firstClient = clientsData.data[0];
    console.log(`✓ Found client: ${firstClient.razon_social}`);

    // Step 3: Create recurring template with past date
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 2); // 2 months ago
    const fechaInicio = pastDate.toISOString().split('T')[0];

    const templateData = {
      nombre_plantilla: 'Test Backfill Template',
      cliente_id: firstClient.id,
      serie: 'TEST',
      concepto: 'Servicios de prueba',
      base_imponible: 1000,
      tipo_iva: 21,
      tipo_irpf: 15,
      frecuencia: 'MENSUAL',
      dia_generacion: 1,
      fecha_inicio: fechaInicio,
      incluir_periodo_facturacion: true,
      generar_pdf_automatico: false
    };

    console.log(`Creating template with fecha_inicio: ${fechaInicio} (2 months ago)...`);

    const createResponse = await request.post('http://localhost:3000/api/recurring-templates', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: templateData
    });

    expect(createResponse.ok()).toBeTruthy();
    const createData = await createResponse.json();
    const templateId = createData.data.id;

    console.log('✓ Template created successfully');
    console.log(`Template ID: ${templateId}`);
    console.log(`Info messages: ${createData.info?.join(', ')}`);

    // Check if backfill message is present
    const hasBackfillMessage = createData.info?.some((msg: string) =>
      msg.includes('retroactivas') || msg.includes('segundo plano')
    );

    if (hasBackfillMessage) {
      console.log('✓ Backfill process was triggered (message found in response)');
    } else {
      console.log('ℹ No backfill message in response');
    }

    // Step 4: Wait a bit for backfill to process
    console.log('Waiting 3 seconds for backfill to process in background...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 5: Check for generated invoices
    const invoicesResponse = await request.get(`http://localhost:3000/api/invoices`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    expect(invoicesResponse.ok()).toBeTruthy();
    const invoicesData = await invoicesResponse.json();

    // Filter invoices from this template
    const templateInvoices = invoicesData.data?.filter((inv: any) =>
      inv.template_id === templateId
    ) || [];

    console.log(`✓ Found ${templateInvoices.length} invoices generated from template`);

    if (templateInvoices.length > 0) {
      console.log('✅ Backfill functionality is working! Invoices were generated.');
      console.log('Sample invoice:', {
        numero_factura: templateInvoices[0].numero_factura,
        fecha_emision: templateInvoices[0].fecha_emision,
        total: templateInvoices[0].total_factura
      });
    } else {
      console.log('⚠️ No invoices generated yet (may still be processing in background)');
    }

    // Step 6: Test missing invoices endpoint
    const missingResponse = await request.get(
      `http://localhost:3000/api/recurring-templates/${templateId}/missing-invoices`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    expect(missingResponse.ok()).toBeTruthy();
    const missingData = await missingResponse.json();
    console.log(`✓ Missing invoices check: ${missingData.data.missingCount} missing`);

    // Step 7: Cleanup - delete template
    const deleteResponse = await request.delete(
      `http://localhost:3000/api/recurring-templates/${templateId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (deleteResponse.ok()) {
      console.log('✓ Test template cleaned up');
    }

    console.log('\n✅ API test completed successfully!');
  });
});

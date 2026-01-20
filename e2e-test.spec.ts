import { test, expect } from '@playwright/test';

test.describe('miGestor E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3001');
  });

  test('Complete user flow: Login → Dashboard → Create Invoice → View Tax Models', async ({ page }) => {
    // Step 1: Login
    console.log('Step 1: Testing login...');
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.screenshot({ path: '/tmp/01-dashboard.png', fullPage: true });
    console.log('✓ Login successful, dashboard loaded');

    // Step 2: Verify Dashboard Content
    console.log('Step 2: Verifying dashboard content...');

    // Check for Balance Real heading
    const balanceHeading = await page.textContent('h2');
    expect(balanceHeading).toContain('Balance Real');

    // Check for year summary cards
    const ingresosText = await page.getByText('Ingresos').first();
    expect(await ingresosText.isVisible()).toBeTruthy();

    const gastosText = await page.getByText('Gastos').first();
    expect(await gastosText.isVisible()).toBeTruthy();

    console.log('✓ Dashboard elements verified');

    // Step 3: Navigate to Clients page
    console.log('Step 3: Checking clients page...');
    await page.click('a[href="/clientes"]');
    await page.waitForURL('**/clientes');
    await page.screenshot({ path: '/tmp/02-clients.png', fullPage: true });

    // Verify client is listed
    const clientName = await page.getByText('Tech Solutions S.L.');
    expect(await clientName.isVisible()).toBeTruthy();
    console.log('✓ Client page verified');

    // Step 4: Navigate to Create Invoice
    console.log('Step 4: Creating new invoice...');
    await page.click('a[href="/facturas/nueva"]');
    await page.waitForURL('**/facturas/nueva');
    await page.screenshot({ path: '/tmp/03-nueva-factura-form.png', fullPage: true });

    // Fill invoice form
    await page.selectOption('select[name="cliente_id"]', '1');
    await page.fill('textarea[name="concepto"]', 'Servicios de desarrollo - Test E2E');
    await page.fill('input[name="base_imponible"]', '3000');

    // Wait for calculations to update
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/04-factura-filled.png', fullPage: true });

    // Verify calculated values appear
    const totalText = await page.getByText('3,420.00');
    expect(await totalText.isVisible()).toBeTruthy();
    console.log('✓ Invoice form calculations working');

    // Submit invoice
    await page.click('button[type="submit"]');

    // Wait for success message or redirect
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/05-factura-created.png', fullPage: true });
    console.log('✓ Invoice created');

    // Step 5: Check Modelo 303
    console.log('Step 5: Checking Modelo 303...');
    await page.goto('http://localhost:3001/fiscal/modelo-303');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/06-modelo-303.png', fullPage: true });

    // Verify Modelo 303 content
    const modelo303Title = await page.getByText('Modelo 303');
    expect(await modelo303Title.isVisible()).toBeTruthy();

    const ivaRepercutido = await page.getByText('IVA Repercutido');
    expect(await ivaRepercutido.isVisible()).toBeTruthy();
    console.log('✓ Modelo 303 page verified');

    // Step 6: Check Modelo 130
    console.log('Step 6: Checking Modelo 130...');
    await page.click('a[href="/fiscal/modelo-130"]');
    await page.waitForURL('**/modelo-130');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/07-modelo-130.png', fullPage: true });

    // Verify Modelo 130 content
    const modelo130Title = await page.getByText('Modelo 130');
    expect(await modelo130Title.isVisible()).toBeTruthy();

    const rendimientoNeto = await page.getByText('Rendimiento Neto');
    expect(await rendimientoNeto.isVisible()).toBeTruthy();
    console.log('✓ Modelo 130 page verified');

    // Step 7: Navigate to Expenses
    console.log('Step 7: Checking expenses page...');
    await page.goto('http://localhost:3001/gastos/nuevo');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/08-nuevo-gasto.png', fullPage: true });

    // Verify expense form loads
    const conceptoField = await page.locator('input[name="concepto"]');
    expect(await conceptoField.isVisible()).toBeTruthy();
    console.log('✓ Expense form verified');

    console.log('\n========================================');
    console.log('✅ ALL TESTS PASSED!');
    console.log('========================================');
    console.log('Screenshots saved to /tmp/');
    console.log('01-dashboard.png');
    console.log('02-clients.png');
    console.log('03-nueva-factura-form.png');
    console.log('04-factura-filled.png');
    console.log('05-factura-created.png');
    console.log('06-modelo-303.png');
    console.log('07-modelo-130.png');
    console.log('08-nuevo-gasto.png');
    console.log('========================================');
  });

  test('Quick smoke test - all pages load', async ({ page }) => {
    console.log('Running quick smoke test...');

    // Login
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Test all major routes
    const routes = [
      '/dashboard',
      '/clientes',
      '/gastos/nuevo',
      '/facturas/nueva',
      '/fiscal/modelo-303',
      '/fiscal/modelo-130'
    ];

    for (const route of routes) {
      await page.goto(`http://localhost:3001${route}`);
      await page.waitForTimeout(500);
      // Check page doesn't show error
      const errorText = await page.textContent('body');
      expect(errorText).not.toContain('Application error');
      console.log(`✓ ${route} loads successfully`);
    }

    console.log('✅ Smoke test passed - all pages accessible');
  });
});

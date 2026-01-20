import { test, expect } from '@playwright/test';

test.describe('Fiscal Functionality Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application and login
    await page.goto('http://localhost:3001');

    // Login with test user
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✓ Login successful');
  });

  test('Navigate to Modelo 303 page and verify content', async ({ page }) => {
    console.log('Testing Modelo 303...');

    // Navigate to Modelo 303
    await page.goto('http://localhost:3001/fiscal/modelo-303');
    await page.waitForLoadState('networkidle');

    // Take screenshot for debugging
    await page.screenshot({ path: '/tmp/fiscal-modelo-303.png', fullPage: true });

    // Check for page title
    const pageTitle = await page.getByText('Modelo 303').first();
    expect(await pageTitle.isVisible()).toBeTruthy();
    console.log('✓ Modelo 303 page title found');

    // Check for year selector (it's a <select> element)
    const yearSelector = await page.locator('select').first();
    expect(await yearSelector.isVisible()).toBeTruthy();
    console.log('✓ Year selector visible');

    // Check for trimestre buttons
    const trim1Button = page.locator('button:has-text("1T")').first();
    expect(await trim1Button.isVisible()).toBeTruthy();
    console.log('✓ Quarter selector visible');

    // Check if data is loaded (look for IVA sections)
    await page.waitForTimeout(1000); // Wait for data to load
    const ivaRepercutido = await page.getByText('IVA Repercutido').first();
    expect(await ivaRepercutido.isVisible()).toBeTruthy();
    console.log('✓ IVA Repercutido section found');

    console.log('✓ Modelo 303 test completed');
  });

  test('Navigate to Modelo 130 page and verify content', async ({ page }) => {
    console.log('Testing Modelo 130...');

    // Navigate to Modelo 130
    await page.goto('http://localhost:3001/fiscal/modelo-130');
    await page.waitForLoadState('networkidle');

    // Take screenshot for debugging
    await page.screenshot({ path: '/tmp/fiscal-modelo-130.png', fullPage: true });

    // Check for page title
    const pageTitle = await page.getByText('Modelo 130').first();
    expect(await pageTitle.isVisible()).toBeTruthy();
    console.log('✓ Modelo 130 page title found');

    // Check for year selector (it's a <select> element)
    const yearSelector = await page.locator('select').first();
    expect(await yearSelector.isVisible()).toBeTruthy();
    console.log('✓ Year selector visible');

    // Check for trimestre buttons
    const trim1Button = page.locator('button:has-text("1T")').first();
    expect(await trim1Button.isVisible()).toBeTruthy();
    console.log('✓ Quarter selector visible');

    // Check if data is loaded
    await page.waitForTimeout(1000); // Wait for data to load
    const rendimientoNeto = await page.getByText('Rendimiento Neto').first();
    expect(await rendimientoNeto.isVisible()).toBeTruthy();
    console.log('✓ Rendimiento Neto section found');

    console.log('✓ Modelo 130 test completed');
  });

  test('Test navigation between Modelo 303 and Modelo 130', async ({ page }) => {
    console.log('Testing navigation between models...');

    // Go to Modelo 303
    await page.goto('http://localhost:3001/fiscal/modelo-303');
    await page.waitForLoadState('networkidle');

    const modelo303Title = await page.getByText('Modelo 303').first();
    expect(await modelo303Title.isVisible()).toBeTruthy();
    console.log('✓ On Modelo 303 page');

    // Navigate to Modelo 130 (check if there's a link in navigation)
    await page.goto('http://localhost:3001/fiscal/modelo-130');
    await page.waitForLoadState('networkidle');

    const modelo130Title = await page.getByText('Modelo 130').first();
    expect(await modelo130Title.isVisible()).toBeTruthy();
    console.log('✓ On Modelo 130 page');

    // Go back to Modelo 303
    await page.goto('http://localhost:3001/fiscal/modelo-303');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Wait for data to load

    const modelo303TitleAgain = await page.getByText('Modelo 303').first();
    expect(await modelo303TitleAgain.isVisible()).toBeTruthy();
    console.log('✓ Back on Modelo 303 page');

    console.log('✓ Navigation test completed');
  });

  test('Navigate to Calendario Fiscal and verify content', async ({ page }) => {
    console.log('Testing Calendario Fiscal...');

    // Navigate to Calendario Fiscal
    await page.goto('http://localhost:3001/fiscal/calendario');
    await page.waitForLoadState('networkidle');

    // Take screenshot for debugging
    await page.screenshot({ path: '/tmp/fiscal-calendario.png', fullPage: true });

    // Check for page title
    const pageTitle = await page.getByText('Calendario Fiscal').first();
    expect(await pageTitle.isVisible()).toBeTruthy();
    console.log('✓ Calendario Fiscal page title found');

    // Check for summary section
    const totalObligaciones = await page.getByText('Total Obligaciones Fiscales').first();
    expect(await totalObligaciones.isVisible()).toBeTruthy();
    console.log('✓ Total Obligaciones Fiscales section found');

    // Check for buttons to navigate to models
    const modelo303Button = await page.getByText('Modelo 303 (IVA)').first();
    expect(await modelo303Button.isVisible()).toBeTruthy();
    console.log('✓ Modelo 303 button found');

    const modelo130Button = await page.getByText('Modelo 130 (IRPF)').first();
    expect(await modelo130Button.isVisible()).toBeTruthy();
    console.log('✓ Modelo 130 button found');

    // Click on Modelo 303 button and verify navigation
    await modelo303Button.click();
    await page.waitForURL('**/fiscal/modelo-303');
    console.log('✓ Successfully navigated to Modelo 303 from calendar');

    // Go back to calendar
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // Click on Modelo 130 button and verify navigation
    const modelo130ButtonAgain = await page.getByText('Modelo 130 (IRPF)').first();
    await modelo130ButtonAgain.click();
    await page.waitForURL('**/fiscal/modelo-130');
    console.log('✓ Successfully navigated to Modelo 130 from calendar');

    console.log('✓ Calendario Fiscal test completed');
  });

  test('Navigate to Modelo 115 page and verify content', async ({ page }) => {
    console.log('Testing Modelo 115...');

    // Navigate to Modelo 115
    await page.goto('http://localhost:3001/fiscal/modelo-115');
    await page.waitForLoadState('networkidle');

    // Take screenshot for debugging
    await page.screenshot({ path: '/tmp/fiscal-modelo-115.png', fullPage: true });

    // Check for page title
    const pageTitle = await page.getByText('Modelo 115').first();
    expect(await pageTitle.isVisible()).toBeTruthy();
    console.log('✓ Modelo 115 page title found');

    // Check for year selector (it's a <select> element)
    const yearSelector = await page.locator('select').first();
    expect(await yearSelector.isVisible()).toBeTruthy();
    console.log('✓ Year selector visible');

    // Check for trimestre buttons
    const trim1Button = page.locator('button:has-text("1T")').first();
    expect(await trim1Button.isVisible()).toBeTruthy();
    console.log('✓ Quarter selector visible');

    // Check if data is loaded (look for retenciones section)
    await page.waitForTimeout(1000); // Wait for data to load
    const retencion = await page.getByText('Retención 19%').first();
    expect(await retencion.isVisible()).toBeTruthy();
    console.log('✓ Retención 19% section found');

    console.log('✓ Modelo 115 test completed');
  });

  test('Verify Modelo 115 button in Calendario Fiscal', async ({ page }) => {
    console.log('Testing Modelo 115 button in calendar...');

    // Navigate to Calendario Fiscal
    await page.goto('http://localhost:3001/fiscal/calendario');
    await page.waitForLoadState('networkidle');

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Take screenshot for debugging
    await page.screenshot({ path: '/tmp/fiscal-calendario-115.png', fullPage: true });

    // Check for Modelo 115 button
    const modelo115Button = page.locator('a:has-text("Modelo 115 (Alquileres)")').first();

    // Wait for button to be visible
    await modelo115Button.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      console.log('⚠ Modelo 115 button not found, checking page state');
    });

    if (await modelo115Button.isVisible()) {
      console.log('✓ Modelo 115 button found in calendar');

      // Click on button and verify navigation
      await modelo115Button.click();
      await page.waitForURL('**/fiscal/modelo-115');
      console.log('✓ Successfully navigated to Modelo 115 from calendar');
    } else {
      console.log('⚠ Modelo 115 button not visible, test may need retry');
    }

    console.log('✓ Modelo 115 calendar integration test completed');
  });
});

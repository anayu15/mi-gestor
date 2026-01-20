import { test, expect } from '@playwright/test';

test('Investigate facturas settings navigation issue', async ({ page }) => {
  // Go to login page
  await page.goto('http://localhost:3001/login');
  await page.waitForLoadState('networkidle');

  // Login with test credentials (inputs are identified by type, not name)
  await page.fill('input[type="email"]', 'test@migestor.com');
  await page.fill('input[type="password"]', 'Test123456');
  await page.click('button[type="submit"]');

  // Wait for dashboard to load (successful login)
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  console.log('Login successful, now on dashboard');

  // Navigate to facturas page
  await page.goto('http://localhost:3001/facturas');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // Extra wait for React hydration
  console.log('Navigated to /facturas');

  // Take screenshot of the facturas page before clicking settings
  await page.screenshot({
    path: '/Users/anayusta/workspace/mi-gestor/screenshots/1-facturas-page-before-settings.png',
    fullPage: true
  });
  console.log('Screenshot 1: Facturas page before clicking settings');

  // Find the settings icon link (it's a Link component to /facturas/settings)
  const settingsLink = page.locator('a[href="/facturas/settings"]');
  const settingsLinkCount = await settingsLink.count();
  console.log(`Found ${settingsLinkCount} settings link(s)`);

  if (settingsLinkCount > 0) {
    // Click on the settings link
    await settingsLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Extra wait for React hydration

    console.log('Current URL after clicking settings:', page.url());

    // Take screenshot after clicking settings
    await page.screenshot({
      path: '/Users/anayusta/workspace/mi-gestor/screenshots/2-after-clicking-settings.png',
      fullPage: true
    });
    console.log('Screenshot 2: After clicking settings icon');

    // Check if we're on the settings page
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    // Analysis: Check for elements that should NOT be on settings page
    // (Control panel elements from /facturas)
    console.log('\n--- Checking for /facturas control panel elements on settings page ---');

    // Year dropdown selector (from facturas page)
    const yearDropdown = page.locator('#year-dropdown');
    const yearDropdownVisible = await yearDropdown.isVisible().catch(() => false);
    console.log('Year dropdown (#year-dropdown):', yearDropdownVisible ? 'VISIBLE - ISSUE!' : 'not visible (correct)');

    // "Nuevo Ingreso" button (from facturas page)
    const nuevoIngresoBtn = page.locator('button:has-text("Nuevo Ingreso")');
    const nuevoIngresoBtnVisible = await nuevoIngresoBtn.isVisible().catch(() => false);
    console.log('"Nuevo Ingreso" button:', nuevoIngresoBtnVisible ? 'VISIBLE - ISSUE!' : 'not visible (correct)');

    // "Nuevo Gasto" button (from facturas page)
    const nuevoGastoBtn = page.locator('button:has-text("Nuevo Gasto")');
    const nuevoGastoBtnVisible = await nuevoGastoBtn.isVisible().catch(() => false);
    console.log('"Nuevo Gasto" button:', nuevoGastoBtnVisible ? 'VISIBLE - ISSUE!' : 'not visible (correct)');

    // Summary cards (from facturas page - "Ingresos", "Gastos", "Balance")
    const ingresosCard = page.locator('text=/Ingresos \\d{4}/').first();
    const ingresosCardVisible = await ingresosCard.isVisible().catch(() => false);
    console.log('Summary card (Ingresos 20XX):', ingresosCardVisible ? 'VISIBLE - ISSUE!' : 'not visible (correct)');

    // Analysis: Check for elements that SHOULD be on settings page
    console.log('\n--- Checking for /facturas/settings elements ---');

    // Settings page heading
    const settingsHeading = page.locator('h1:has-text("Configuración de Facturas")');
    const settingsHeadingVisible = await settingsHeading.isVisible().catch(() => false);
    console.log('Settings heading:', settingsHeadingVisible ? 'visible (correct)' : 'NOT VISIBLE - ISSUE!');

    // "Volver a Facturas" link (should be on settings page)
    const volverLink = page.locator('text=Volver a Facturas');
    const volverLinkVisible = await volverLink.isVisible().catch(() => false);
    console.log('"Volver a Facturas" link:', volverLinkVisible ? 'visible (correct)' : 'NOT VISIBLE');

    // "Configuración de Facturación" section
    const facturacionSection = page.locator('h2:has-text("Configuración de Facturación")');
    const facturacionSectionVisible = await facturacionSection.isVisible().catch(() => false);
    console.log('"Configuración de Facturación" section:', facturacionSectionVisible ? 'visible (correct)' : 'NOT VISIBLE');

    // "Gestión de Clientes" section
    const clientesSection = page.locator('h2:has-text("Gestión de Clientes")');
    const clientesSectionVisible = await clientesSection.isVisible().catch(() => false);
    console.log('"Gestión de Clientes" section:', clientesSectionVisible ? 'visible (correct)' : 'NOT VISIBLE');

    // Determine if there's a rendering issue
    const hasControlPanelElements = yearDropdownVisible || nuevoIngresoBtnVisible || nuevoGastoBtnVisible || ingresosCardVisible;
    const hasSettingsElements = settingsHeadingVisible || facturacionSectionVisible || clientesSectionVisible;

    console.log('\n--- DIAGNOSIS ---');
    if (hasControlPanelElements && hasSettingsElements) {
      console.log('BUG CONFIRMED: Both /facturas control panel AND settings content are visible simultaneously!');
      console.log('This indicates a routing or rendering issue where the parent page content is not being replaced.');
    } else if (hasSettingsElements && !hasControlPanelElements) {
      console.log('NAVIGATION WORKS CORRECTLY: Only settings page content is visible.');
    } else if (!hasSettingsElements) {
      console.log('ISSUE: Settings page content is not visible. Navigation may have failed.');
    }

    // Take a final screenshot
    await page.screenshot({
      path: '/Users/anayusta/workspace/mi-gestor/screenshots/3-final-analysis.png',
      fullPage: true
    });
    console.log('Screenshot 3: Final analysis screenshot');

  } else {
    console.log('Could not find settings link on /facturas page');

    // Try direct navigation
    console.log('Trying direct navigation to /facturas/settings...');
    await page.goto('http://localhost:3001/facturas/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: '/Users/anayusta/workspace/mi-gestor/screenshots/2-direct-navigation.png',
      fullPage: true
    });
    console.log('Screenshot 2: Direct navigation to /facturas/settings');
  }
});

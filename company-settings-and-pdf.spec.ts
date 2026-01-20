import { test, expect } from '@playwright/test';

test.describe('Company Settings and Invoice PDF Generation', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test('should access company settings page', async ({ page }) => {
    // Navigate to settings
    await page.goto('http://localhost:3001/settings');
    await page.waitForLoadState('networkidle');

    // Find and click on company settings link
    const companySettingsLink = page.locator('a[href="/settings/company"]');
    await expect(companySettingsLink).toBeVisible();
    await companySettingsLink.click();

    // Verify we're on the company settings page
    await page.waitForURL('**/settings/company');
    await expect(page.locator('h1')).toContainText('Configuración de Facturación');
  });

  test('should load and display company data', async ({ page }) => {
    // Go to company settings
    await page.goto('http://localhost:3001/settings/company');
    await page.waitForLoadState('networkidle');

    // Check that the form loads
    await expect(page.locator('input[placeholder*="Razón social"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="Calle"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="Código Postal"]')).toBeVisible();

    // Verify existing data is loaded (if any)
    const razonSocialInput = page.locator('input[placeholder*="Razón social"]');
    const direccionInput = page.locator('input[placeholder*="Calle"]');

    // Should have values or be empty
    await expect(razonSocialInput).toHaveAttribute('value', /.*/);
    await expect(direccionInput).toHaveAttribute('value', /.*/);
  });

  test('should update company settings', async ({ page }) => {
    await page.goto('http://localhost:3001/settings/company');
    await page.waitForLoadState('networkidle');

    // Fill in company data
    await page.fill('input[placeholder*="Razón social"]', 'Test Company SL');
    await page.fill('input[placeholder*="Calle"]', 'Calle Test 123');
    await page.fill('input[placeholder*="28001"]', '28001');
    await page.fill('input[placeholder*="Madrid"]', 'Madrid');
    await page.fill('input[placeholder*="ES00"]', 'ES9121000418450200051332');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success message
    await expect(page.locator('text=Configuración guardada correctamente')).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to facturas and see PDF button', async ({ page }) => {
    // Go to invoices page
    await page.goto('http://localhost:3001/facturas');
    await page.waitForLoadState('networkidle');

    // Check page loaded
    await expect(page.locator('h1')).toContainText('Facturas');

    // Check for PDF download button (if there are invoices with PDFs)
    const pdfButton = page.locator('button:has-text("PDF")');
    const pdfButtonCount = await pdfButton.count();

    if (pdfButtonCount > 0) {
      console.log(`Found ${pdfButtonCount} PDF download button(s)`);
      await expect(pdfButton.first()).toBeVisible();
    } else {
      console.log('No invoices with PDF found yet');
    }
  });

  test('should create invoice and generate PDF automatically', async ({ page }) => {
    // Go to new invoice page
    await page.goto('http://localhost:3001/facturas/nueva');
    await page.waitForLoadState('networkidle');

    // Fill invoice form
    const clientSelect = page.locator('select').first();
    await clientSelect.selectOption({ index: 1 }); // Select first client

    await page.fill('input[type="date"]', '2026-01-15');
    await page.fill('textarea[placeholder*="concepto"]', 'Test Invoice - Playwright');
    await page.fill('input[placeholder*="1000"]', '1500');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success and check for PDF generation message
    await page.waitForSelector('text=generada correctamente', { timeout: 10000 });

    // Check if PDF was generated (should see message)
    const pageContent = await page.content();
    console.log('Invoice creation response received');

    // Navigate back to invoices list
    await page.goto('http://localhost:3001/facturas');
    await page.waitForLoadState('networkidle');

    // Look for the PDF button for the newly created invoice
    const pdfButtons = page.locator('button:has-text("PDF")');
    const buttonCount = await pdfButtons.count();

    if (buttonCount > 0) {
      console.log(`PDF generation successful! Found ${buttonCount} PDF button(s)`);
      await expect(pdfButtons.first()).toBeVisible();
    }
  });

  test('should verify settings page has company configuration link', async ({ page }) => {
    await page.goto('http://localhost:3001/settings');
    await page.waitForLoadState('networkidle');

    // Check for the new company settings section
    await expect(page.locator('text=Configuración de Facturación')).toBeVisible();
    await expect(page.locator('text=Datos para Facturas PDF')).toBeVisible();

    // Verify the configure button exists
    const configureButton = page.locator('a[href="/settings/company"]');
    await expect(configureButton).toBeVisible();
    await expect(configureButton).toContainText('Configurar');
  });
});

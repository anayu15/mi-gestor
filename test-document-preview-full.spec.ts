import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Document Preview Full Analysis', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging for errors
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        consoleErrors.push(text);
        console.log(`Browser ERROR: ${text}`);
      } else if (type === 'warning') {
        consoleWarnings.push(text);
        console.log(`Browser WARNING: ${text}`);
      }
    });

    // Log network failures
    page.on('requestfailed', request => {
      console.log(`Request FAILED: ${request.url()} - ${request.failure()?.errorText}`);
    });

    // Log HTTP errors
    page.on('response', response => {
      if (response.status() >= 400) {
        console.log(`HTTP ${response.status()}: ${response.url()}`);
      }
    });
  });

  test('should verify document preview works with image upload', async ({ page }) => {
    // Login
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Navigate to facturas
    await page.click('a[href="/facturas"]');
    await page.waitForURL('**/facturas', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Open Nuevo Gasto modal
    await page.locator('button:has-text("Nuevo Gasto")').click();
    await page.waitForSelector('h2:has-text("Generar Nuevo Gasto")', { timeout: 5000 });

    // Verify initial state
    const uploadButtonBefore = page.locator('button:has-text("Subir factura")');
    expect(await uploadButtonBefore.isVisible()).toBe(true);

    // Create a larger test image (valid PNG)
    const testImagePath = path.join(process.cwd(), 'test-invoice-larger.png');
    const pngData = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAADklEQVQYlWP4////GYQJAIvbB/0crcE2AAAAAElFTkSuQmCC',
      'base64'
    );
    fs.writeFileSync(testImagePath, pngData);

    // Upload the file
    const fileInput = page.locator('input#invoice-upload-modal');
    await fileInput.setInputFiles(testImagePath);

    // Wait for preview to load
    await page.waitForTimeout(1500);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/full-test-after-upload.png', fullPage: true });

    // Verify preview appeared
    const previewImage = page.locator('img[alt="Vista previa de factura"]');
    const extractButton = page.locator('button:has-text("Extraer datos")');
    const uploadButtonAfter = page.locator('button:has-text("Subir factura")');

    // Assertions
    expect(await previewImage.isVisible()).toBe(true);
    expect(await extractButton.isVisible()).toBe(true);
    expect(await uploadButtonAfter.isVisible()).toBe(false);

    // Check that the modal expanded (should have three-column layout)
    const previewContainer = page.locator('.lg\\:col-span-1');
    expect(await previewContainer.count()).toBe(1);

    // Verify we can click the extract button (but not actually extract - that needs OCR)
    expect(await extractButton.isEnabled()).toBe(true);

    // Verify the clear button exists (x button on preview)
    const clearButton = page.locator('.bg-rose-400.rounded-full');
    expect(await clearButton.isVisible()).toBe(true);

    // Click clear and verify we return to initial state
    await clearButton.click();
    await page.waitForTimeout(500);

    // After clearing, upload button should be visible again
    expect(await uploadButtonBefore.isVisible()).toBe(true);
    expect(await previewImage.isVisible()).toBe(false);

    await page.screenshot({ path: 'screenshots/full-test-after-clear.png', fullPage: true });

    // Clean up
    fs.unlinkSync(testImagePath);

    console.log('\n=== TEST PASSED: Document preview functionality is working correctly ===');
  });

  test('should verify PDF upload shows PDF icon', async ({ page }) => {
    // Login
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Navigate to facturas
    await page.click('a[href="/facturas"]');
    await page.waitForURL('**/facturas', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Open Nuevo Gasto modal
    await page.locator('button:has-text("Nuevo Gasto")').click();
    await page.waitForSelector('h2:has-text("Generar Nuevo Gasto")', { timeout: 5000 });

    // Create a minimal valid PDF file
    const testPdfPath = path.join(process.cwd(), 'test-invoice.pdf');
    const pdfContent = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF'
    );
    fs.writeFileSync(testPdfPath, pdfContent);

    // Upload the PDF
    const fileInput = page.locator('input#invoice-upload-modal');
    await fileInput.setInputFiles(testPdfPath);

    // Wait for preview to load
    await page.waitForTimeout(1500);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/pdf-upload-test.png', fullPage: true });

    // Verify PDF preview appeared (should show "Documento PDF" text)
    const pdfLabel = page.locator('text=Documento PDF');
    expect(await pdfLabel.isVisible()).toBe(true);

    // Verify extract button is visible
    const extractButton = page.locator('button:has-text("Extraer datos")');
    expect(await extractButton.isVisible()).toBe(true);

    // Clean up
    fs.unlinkSync(testPdfPath);

    console.log('\n=== TEST PASSED: PDF preview functionality is working correctly ===');
  });

  test('should reject invalid file types', async ({ page }) => {
    // Login
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Navigate to facturas
    await page.click('a[href="/facturas"]');
    await page.waitForURL('**/facturas', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Open Nuevo Gasto modal
    await page.locator('button:has-text("Nuevo Gasto")').click();
    await page.waitForSelector('h2:has-text("Generar Nuevo Gasto")', { timeout: 5000 });

    // Create a text file (invalid type)
    const testTxtPath = path.join(process.cwd(), 'test-invalid.txt');
    fs.writeFileSync(testTxtPath, 'This is not an image or PDF');

    // Try to upload the invalid file
    const fileInput = page.locator('input#invoice-upload-modal');
    await fileInput.setInputFiles(testTxtPath);

    // Wait for error message
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/invalid-file-test.png', fullPage: true });

    // The file input should reject this (accept attribute)
    // But we need to check if there's an error message displayed
    const errorMessage = page.locator('.bg-rose-50');
    const hasError = await errorMessage.isVisible().catch(() => false);

    // Clean up
    fs.unlinkSync(testTxtPath);

    // Upload button should still be visible (file was rejected)
    const uploadButton = page.locator('button:has-text("Subir factura")');
    expect(await uploadButton.isVisible()).toBe(true);

    console.log(`\n=== TEST: Invalid file handling - Error shown: ${hasError} ===`);
  });
});

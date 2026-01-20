import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Document Preview in Nuevo Gasto Modal', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        console.log(`Browser ${type}: ${msg.text()}`);
      }
    });

    // Enable request logging for failed requests
    page.on('requestfailed', request => {
      console.log(`Request failed: ${request.url()} - ${request.failure()?.errorText}`);
    });

    // Log network responses with errors
    page.on('response', response => {
      if (response.status() >= 400) {
        console.log(`HTTP Error ${response.status()}: ${response.url()}`);
      }
    });
  });

  test('should inspect document preview functionality', async ({ page }) => {
    console.log('\n=== Step 1: Navigate to login page ===');
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');

    // Take screenshot of login page
    await page.screenshot({ path: 'screenshots/01-login-page.png', fullPage: true });
    console.log('Screenshot saved: screenshots/01-login-page.png');

    console.log('\n=== Step 2: Login with test credentials ===');
    // Use type=email and type=password selectors since there are no name attributes
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');

    // Wait for navigation
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('Logged in successfully, redirected to dashboard');

    await page.screenshot({ path: 'screenshots/02-dashboard.png', fullPage: true });
    console.log('Screenshot saved: screenshots/02-dashboard.png');

    console.log('\n=== Step 3: Navigate to facturas page ===');
    // Click on Facturas in navigation
    await page.click('a[href="/facturas"]');
    await page.waitForURL('**/facturas', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'screenshots/03-facturas-page.png', fullPage: true });
    console.log('Screenshot saved: screenshots/03-facturas-page.png');

    console.log('\n=== Step 4: Open Nuevo Gasto modal ===');
    // Look for the "Nuevo Gasto" button
    const nuevoGastoBtn = page.locator('button:has-text("Nuevo Gasto")');
    await nuevoGastoBtn.waitFor({ state: 'visible' });
    await nuevoGastoBtn.click();

    // Wait for modal to appear
    await page.waitForSelector('h2:has-text("Generar Nuevo Gasto")', { timeout: 5000 });
    console.log('Nuevo Gasto modal opened');

    await page.screenshot({ path: 'screenshots/04-nuevo-gasto-modal.png', fullPage: true });
    console.log('Screenshot saved: screenshots/04-nuevo-gasto-modal.png');

    console.log('\n=== Step 5: Check for upload button ===');
    // Find the upload button
    const uploadButton = page.locator('button:has-text("Subir factura")');
    const isUploadVisible = await uploadButton.isVisible();
    console.log(`Upload button visible: ${isUploadVisible}`);

    if (isUploadVisible) {
      // Check the file input
      const fileInput = page.locator('input#invoice-upload-modal');
      const fileInputExists = await fileInput.count() > 0;
      console.log(`File input exists: ${fileInputExists}`);

      console.log('\n=== Step 6: Create a test image and upload it ===');
      // Create a simple valid PNG using base64
      const testImagePath = path.join(process.cwd(), 'test-invoice-image.png');

      const pngData = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAADklEQVQYlWP4////GYQJAIvbB/0crcE2AAAAAElFTkSuQmCC',
        'base64'
      );
      fs.writeFileSync(testImagePath, pngData);
      console.log(`Test image created at: ${testImagePath}`);

      // Upload the file
      await fileInput.setInputFiles(testImagePath);
      console.log('File uploaded to input');

      // Wait a moment for the preview to load
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'screenshots/05-after-upload.png', fullPage: true });
      console.log('Screenshot saved: screenshots/05-after-upload.png');

      // Check if preview appeared
      const previewImage = page.locator('img[alt="Vista previa de factura"]');
      const previewImageVisible = await previewImage.isVisible().catch(() => false);
      console.log(`Preview image visible: ${previewImageVisible}`);

      // Check for PDF preview (in case it was detected as PDF)
      const pdfPreview = page.locator('text=Documento PDF');
      const pdfPreviewVisible = await pdfPreview.isVisible().catch(() => false);
      console.log(`PDF preview visible: ${pdfPreviewVisible}`);

      // Check for error messages
      const errorDiv = page.locator('.bg-rose-50');
      const hasError = await errorDiv.isVisible().catch(() => false);
      if (hasError) {
        const errorText = await errorDiv.textContent();
        console.log(`Error displayed: ${errorText}`);
      } else {
        console.log('No error message displayed');
      }

      // Check if the "Extraer datos" button appeared
      const extractButton = page.locator('button:has-text("Extraer datos")');
      const extractVisible = await extractButton.isVisible().catch(() => false);
      console.log(`Extract data button visible: ${extractVisible}`);

      // Clean up test file
      fs.unlinkSync(testImagePath);

      console.log('\n=== Step 7: Check browser console for errors ===');

      await page.screenshot({ path: 'screenshots/06-final-state.png', fullPage: true });
      console.log('Screenshot saved: screenshots/06-final-state.png');
    }

    console.log('\n=== Step 8: Inspect DOM for preview element ===');
    // Check imagePreview state by looking for the grid layout
    const hasThreeColumnLayout = await page.locator('.lg\\:col-span-1').count();
    console.log(`Three column layout elements: ${hasThreeColumnLayout}`);

    const hasImagePreviewContainer = await page.locator('.bg-slate-50.rounded-lg.p-4.sticky').count();
    console.log(`Image preview container count: ${hasImagePreviewContainer}`);

    // Final analysis
    console.log('\n=== Analysis ===');
    const uploadBtnStillVisible = await page.locator('button:has-text("Subir factura")').isVisible();
    const extractBtnVisible = await page.locator('button:has-text("Extraer datos")').isVisible().catch(() => false);
    console.log(`Upload button still visible: ${uploadBtnStillVisible}`);
    console.log(`Extract button visible: ${extractBtnVisible}`);

    if (uploadBtnStillVisible && !extractBtnVisible) {
      console.log('\n>>> ISSUE DETECTED: Upload button is still visible after file selection.');
      console.log('>>> This suggests the imagePreview state was not set properly.');
    } else if (extractBtnVisible) {
      console.log('\n>>> SUCCESS: Preview is working correctly - Extract button is visible.');
    }
  });
});

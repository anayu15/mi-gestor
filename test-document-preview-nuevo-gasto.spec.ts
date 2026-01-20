import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('NuevoGastoModal Document Preview Test', () => {
  const baseUrl = 'http://localhost:3001';
  const testEmail = 'test@migestor.com';
  const testPassword = 'Test123456';

  // Create a simple test image
  function createTestImage(): string {
    const testImagePath = path.join(__dirname, 'test-image-for-preview.png');

    // Create a simple 1x1 pixel PNG (base64 decoded)
    // This is a minimal valid PNG file
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64, // 100x100 pixels
      0x08, 0x06, 0x00, 0x00, 0x00, 0x70, 0xE2, 0x95, // 8-bit RGBA
      0x54, 0x00, 0x00, 0x00, 0x01, 0x73, 0x52, 0x47, // sRGB chunk
      0x42, 0x00, 0xAE, 0xCE, 0x1C, 0xE9, 0x00, 0x00,
      0x00, 0x04, 0x67, 0x41, 0x4D, 0x41, 0x00, 0x00, // gAMA chunk
      0xB1, 0x8F, 0x0B, 0xFC, 0x61, 0x05, 0x00, 0x00,
      0x00, 0x09, 0x70, 0x48, 0x59, 0x73, 0x00, 0x00, // pHYs chunk
      0x0E, 0xC3, 0x00, 0x00, 0x0E, 0xC3, 0x01, 0xC7,
      0x6F, 0xA8, 0x64, 0x00, 0x00, 0x00, 0x0A, 0x49, // IDAT chunk (compressed image data)
      0x44, 0x41, 0x54, 0x78, 0x9C, 0x62, 0x60, 0x00,
      0x00, 0x00, 0x01, 0x00, 0x01, 0x6A, 0xB7, 0xC5,
      0xEF, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND chunk
      0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    fs.writeFileSync(testImagePath, pngBuffer);
    return testImagePath;
  }

  test.beforeAll(async () => {
    // Create test image before tests
    createTestImage();
  });

  test.afterAll(async () => {
    // Clean up test image
    const testImagePath = path.join(__dirname, 'test-image-for-preview.png');
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
  });

  test('should display document preview when uploading an image in Nuevo Gasto modal', async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    // Listen to console messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Listen to page errors
    page.on('pageerror', error => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });

    // Step 1: Go to login page
    console.log('Step 1: Navigating to login page...');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'screenshots/01-login-page.png' });

    // Step 2: Login with test credentials
    console.log('Step 2: Logging in...');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForURL(`${baseUrl}/dashboard`, { timeout: 10000 });
    await page.screenshot({ path: 'screenshots/02-after-login.png' });
    console.log('Login successful!');

    // Step 3: Navigate to Facturas page
    console.log('Step 3: Navigating to Facturas page...');
    await page.goto(`${baseUrl}/facturas`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000); // Wait for page to stabilize
    await page.screenshot({ path: 'screenshots/03-facturas-page.png' });

    // Step 4: Click on "Nuevo Gasto" button
    console.log('Step 4: Opening Nuevo Gasto modal...');
    const nuevoGastoButton = page.locator('button:has-text("Nuevo Gasto")');
    await expect(nuevoGastoButton).toBeVisible();
    await nuevoGastoButton.click();

    // Wait for modal to appear
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/04-nuevo-gasto-modal-before-upload.png' });

    // Step 5: Check if modal is open
    const modalTitle = page.locator('h2:has-text("Generar Nuevo Gasto")');
    await expect(modalTitle).toBeVisible();
    console.log('Modal opened successfully!');

    // Step 6: Upload test image
    console.log('Step 5: Uploading test image...');

    // Find the file input
    const fileInput = page.locator('#invoice-upload-modal');

    // Check if file input exists
    const fileInputCount = await fileInput.count();
    console.log(`File input found: ${fileInputCount > 0}`);

    if (fileInputCount === 0) {
      console.log('File input not found, checking for button to trigger file input...');
      const uploadButton = page.locator('button:has-text("Subir factura")');
      console.log(`Upload button visible: ${await uploadButton.isVisible()}`);
    }

    // Use a real test image
    const testImagePath = path.join(__dirname, 'test-image-for-preview.png');

    // Wait for the file input to be available
    await expect(fileInput).toBeAttached();

    // Upload the file
    await fileInput.setInputFiles(testImagePath);

    // Wait for preview to load
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/05-after-upload.png' });

    // Step 7: Check if preview is displayed
    console.log('Step 6: Checking document preview...');

    // The preview should be an img element with alt="Vista previa de factura"
    const previewImage = page.locator('img[alt="Vista previa de factura"]');
    const pdfPreview = page.locator('text=Documento PDF');

    const imagePreviewVisible = await previewImage.isVisible().catch(() => false);
    const pdfPreviewVisible = await pdfPreview.isVisible().catch(() => false);

    console.log(`Image preview visible: ${imagePreviewVisible}`);
    console.log(`PDF preview visible: ${pdfPreviewVisible}`);

    if (imagePreviewVisible) {
      // Get the src attribute to verify it's a data URL
      const src = await previewImage.getAttribute('src');
      console.log(`Preview image src starts with: ${src?.substring(0, 50)}...`);

      if (src && src.startsWith('data:image')) {
        console.log('SUCCESS: Image preview is showing with data URL');
      } else {
        console.log(`WARNING: Image preview src is unexpected: ${src?.substring(0, 100)}`);
      }

      // Take a screenshot of just the preview area
      await previewImage.screenshot({ path: 'screenshots/06-preview-image.png' });
    } else {
      console.log('WARNING: Image preview is NOT visible!');

      // Inspect the DOM to understand what's rendered
      const modalContent = await page.locator('.fixed.inset-0').innerHTML();
      console.log('Modal content HTML length:', modalContent.length);

      // Look for any image elements in the modal
      const allImages = page.locator('.fixed.inset-0 img');
      const imageCount = await allImages.count();
      console.log(`Total images in modal: ${imageCount}`);

      for (let i = 0; i < imageCount; i++) {
        const img = allImages.nth(i);
        const alt = await img.getAttribute('alt');
        const src = await img.getAttribute('src');
        console.log(`  Image ${i}: alt="${alt}", src="${src?.substring(0, 50)}..."`);
      }
    }

    // Step 8: Check for console errors
    console.log('\nStep 7: Checking console for errors...');

    if (consoleErrors.length > 0) {
      console.log('Console Errors Found:');
      consoleErrors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    } else {
      console.log('No console errors found.');
    }

    if (consoleWarnings.length > 0) {
      console.log('\nConsole Warnings Found:');
      consoleWarnings.forEach((warning, i) => {
        console.log(`  ${i + 1}. ${warning}`);
      });
    }

    // Step 9: Check for "Extraer datos" button to verify modal state
    console.log('\nStep 8: Verifying modal state...');
    const extractButton = page.locator('button:has-text("Extraer datos")');
    const extractButtonVisible = await extractButton.isVisible();
    console.log(`"Extraer datos" button visible: ${extractButtonVisible}`);

    // If the extract button is visible, it means the preview panel should be showing
    if (extractButtonVisible) {
      console.log('The modal is in "file uploaded" state - preview panel should be visible');

      // Check for the preview container
      const previewContainer = page.locator('.lg\\:col-span-1');
      const containerVisible = await previewContainer.isVisible();
      console.log(`Preview container visible: ${containerVisible}`);

      // Get the container's HTML for debugging
      if (containerVisible) {
        const containerHTML = await previewContainer.innerHTML();
        console.log(`Preview container HTML snippet: ${containerHTML.substring(0, 500)}...`);
      }
    }

    // Take final screenshot
    await page.screenshot({ path: 'screenshots/07-final-state.png', fullPage: true });

    // Final report
    console.log('\n===== TEST SUMMARY =====');
    console.log(`Image preview visible: ${imagePreviewVisible}`);
    console.log(`PDF preview visible: ${pdfPreviewVisible}`);
    console.log(`Console errors: ${consoleErrors.length}`);
    console.log(`Console warnings: ${consoleWarnings.length}`);

    // Assert that either image or PDF preview is visible
    expect(imagePreviewVisible || pdfPreviewVisible).toBe(true);
  });
});

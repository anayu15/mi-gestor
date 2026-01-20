import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Comprehensive Document Preview Test', () => {
  const baseUrl = 'http://localhost:3001';
  const testEmail = 'test@migestor.com';
  const testPassword = 'Test123456';

  // Create a more visible test image (100x100 red square with text)
  function createVisibleTestImage(): string {
    const testImagePath = path.join(__dirname, 'test-visible-image.png');

    // Create a simple PNG with some actual content
    // This is a valid 10x10 red PNG
    const pngData = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQY' +
      'V2P8z8Dwn4EIwDiqkL4KAIKYBB8BsXq3AAAAAElFTkSuQmCC',
      'base64'
    );

    fs.writeFileSync(testImagePath, pngData);
    return testImagePath;
  }

  // Create a test PDF file
  function createTestPDF(): string {
    const testPDFPath = path.join(__dirname, 'test-document.pdf');

    // Minimal valid PDF
    const pdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer << /Size 4 /Root 1 0 R >>
startxref
191
%%EOF`;

    fs.writeFileSync(testPDFPath, pdfContent);
    return testPDFPath;
  }

  test.beforeAll(async () => {
    createVisibleTestImage();
    createTestPDF();
  });

  test.afterAll(async () => {
    const imagePath = path.join(__dirname, 'test-visible-image.png');
    const pdfPath = path.join(__dirname, 'test-document.pdf');
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
  });

  test('Full preview test - image upload, PDF upload, and clear functionality', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Login
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${baseUrl}/dashboard`, { timeout: 10000 });

    // Navigate to Facturas page
    await page.goto(`${baseUrl}/facturas`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Open Nuevo Gasto modal
    await page.locator('button:has-text("Nuevo Gasto")').click();
    await page.waitForTimeout(500);

    // Verify initial state - no preview, only upload button
    const uploadButton = page.locator('button:has-text("Subir factura")');
    await expect(uploadButton).toBeVisible();
    console.log('Initial state: Upload button is visible');

    // Test 1: Upload image file
    console.log('\n--- Test 1: Image Upload ---');
    const fileInput = page.locator('#invoice-upload-modal');
    const imagePath = path.join(__dirname, 'test-visible-image.png');
    await fileInput.setInputFiles(imagePath);
    await page.waitForTimeout(500);

    // Verify image preview
    const imagePreview = page.locator('img[alt="Vista previa de factura"]');
    await expect(imagePreview).toBeVisible();
    console.log('Image preview is visible');

    const imgSrc = await imagePreview.getAttribute('src');
    expect(imgSrc).toContain('data:image');
    console.log(`Image src is a data URL: ${imgSrc?.substring(0, 30)}...`);

    // Verify "Extraer datos" button appears
    const extractButton = page.locator('button:has-text("Extraer datos")');
    await expect(extractButton).toBeVisible();
    console.log('"Extraer datos" button is visible');

    // Verify modal expanded (3-column layout)
    const expandedModal = page.locator('.max-w-5xl');
    const isExpanded = await expandedModal.count() > 0;
    console.log(`Modal expanded to 3-column layout: ${isExpanded}`);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/full-test-after-upload.png' });

    // Test 2: Clear file
    console.log('\n--- Test 2: Clear File ---');
    // Click the X button near the preview
    const closePreviewButton = page.locator('.absolute.-top-2.-right-2');
    await closePreviewButton.click();
    await page.waitForTimeout(300);

    // Verify preview is gone and upload button is back
    await expect(imagePreview).not.toBeVisible();
    await expect(uploadButton).toBeVisible();
    console.log('File cleared successfully - upload button is back');

    await page.screenshot({ path: 'screenshots/full-test-after-clear.png' });

    // Test 3: Upload PDF file
    console.log('\n--- Test 3: PDF Upload ---');
    const pdfPath = path.join(__dirname, 'test-document.pdf');
    await fileInput.setInputFiles(pdfPath);
    await page.waitForTimeout(500);

    // Verify PDF preview (should show PDF icon, not image)
    const pdfPreviewText = page.locator('text=Documento PDF');
    await expect(pdfPreviewText).toBeVisible();
    console.log('PDF preview indicator visible');

    // Verify the PDF icon/container is shown
    const pdfIcon = page.locator('svg.w-16.h-16.text-rose-400');
    const hasPdfIcon = await pdfIcon.count() > 0;
    console.log(`PDF icon displayed: ${hasPdfIcon}`);

    await page.screenshot({ path: 'screenshots/pdf-upload-test.png' });

    // Test 4: Verify invalid file type handling
    console.log('\n--- Test 4: Invalid File Type ---');
    await closePreviewButton.click();
    await page.waitForTimeout(300);

    // Create a fake text file
    const textFilePath = path.join(__dirname, 'test.txt');
    fs.writeFileSync(textFilePath, 'This is a test text file');

    // Try to upload text file
    await fileInput.setInputFiles(textFilePath);
    await page.waitForTimeout(500);

    // Check for error message
    const errorMessage = page.locator('text=Solo se aceptan archivos JPG, JPEG, PNG o PDF');
    const hasError = await errorMessage.count() > 0;
    console.log(`Invalid file error shown: ${hasError}`);

    // Clean up text file
    fs.unlinkSync(textFilePath);

    await page.screenshot({ path: 'screenshots/invalid-file-test.png' });

    // Report
    console.log('\n===== TEST SUMMARY =====');
    console.log('1. Image upload preview: WORKING');
    console.log('2. Clear file functionality: WORKING');
    console.log('3. PDF upload preview: WORKING');
    console.log(`4. Invalid file handling: ${hasError ? 'WORKING' : 'NEEDS REVIEW'}`);
    console.log(`Console errors found: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('Errors:', consoleErrors);
    }
  });
});

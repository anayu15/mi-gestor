const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await browser.newPage();

  try {
    // Go to login
    await page.goto('http://localhost:3001/login');
    await page.fill('input[name="email"]', 'test@migestor.com');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button:has-text("Iniciar sesión")');
    await page.waitForTimeout(2000);

    // Navigate to facturas
    await page.goto('http://localhost:3001/facturas');
    await page.waitForTimeout(2000);

    // Click first PDF button
    const pdfLink = await page.locator('a:has-text("PDF")').first();
    if (await pdfLink.isVisible()) {
      await pdfLink.click();
      await page.waitForTimeout(3000);

      // Take screenshot
      await page.screenshot({ path: '/tmp/pdf-viewer-success.png', fullPage: true });
      console.log('✅ Screenshot guardado en /tmp/pdf-viewer-success.png');
    }

    await page.waitForTimeout(5000);
  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: '/tmp/pdf-viewer-error.png' });
  } finally {
    await browser.close();
  }
})();

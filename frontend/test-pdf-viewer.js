const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('1. Navegando a login...');
    await page.goto('http://localhost:3001/login');

    console.log('2. Ingresando credenciales...');
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button[type="submit"]');

    console.log('3. Esperando redirect a dashboard...');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✓ Login exitoso');

    console.log('4. Navegando a facturas...');
    await page.goto('http://localhost:3001/facturas');
    await page.waitForLoadState('networkidle');

    console.log('5. Esperando tabla de facturas...');
    await page.waitForSelector('table', { timeout: 10000 });
    console.log('✓ Tabla cargada');

    // List all invoices with PDF
    const invoiceRows = await page.locator('tr').count();
    console.log(`Total de filas en tabla: ${invoiceRows}`);

    // Find PDF button
    const pdfButtons = page.locator('a:has-text("PDF")');
    const count = await pdfButtons.count();
    console.log(`Botones PDF encontrados: ${count}`);

    if (count > 0) {
      // Get the invoice ID from the href
      const href = await pdfButtons.first().getAttribute('href');
      console.log(`Href del primer botón PDF: ${href}`);

      console.log('6. Haciendo clic en botón PDF...');
      await pdfButtons.first().click();

      console.log('7. Esperando página de PDF...');
      await page.waitForURL(/\/facturas\/\d+\/pdf/, { timeout: 10000 });
      console.log(`✓ URL actual: ${page.url()}`);

      // Check for error message
      const errorText = await page.textContent('body');
      if (errorText.includes('Factura no encontrada')) {
        console.error('❌ Error: Factura no encontrada en la página');

        // Check localStorage
        const token = await page.evaluate(() => localStorage.getItem('token'));
        console.log('Token present:', !!token);

        // Take screenshot of error
        await page.screenshot({ path: '/tmp/pdf-error.png', fullPage: true });
        console.log('Screenshot de error guardado en /tmp/pdf-error.png');
      } else {
        console.log('8. Esperando iframe del PDF...');
        await page.waitForSelector('iframe', { timeout: 15000 });
        console.log('✓ Iframe encontrado');

        // Take screenshot
        await page.screenshot({ path: '/tmp/pdf-preview.png', fullPage: true });
        console.log('✅ PDF viewer cargado exitosamente');
        console.log('Screenshot guardado en /tmp/pdf-preview.png');
      }
    } else {
      console.error('❌ No se encontró ningún botón PDF en la tabla');
      await page.screenshot({ path: '/tmp/no-pdf-button.png', fullPage: true });
    }

    // Wait to see the page
    await page.waitForTimeout(3000);

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: '/tmp/error-screenshot.png', fullPage: true });
    console.log('Screenshot de error guardado en /tmp/error-screenshot.png');
  } finally {
    await browser.close();
  }
})();

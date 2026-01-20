import { test, expect } from '@playwright/test';

test.describe('Documentos Viewer Test', () => {
  test('Verificar visualización de documentos', async ({ page }) => {
    console.log('\n=== INICIANDO TEST DE VISUALIZACIÓN DE DOCUMENTOS ===\n');

    // ========== 1. LOGIN ==========
    console.log('1️⃣  Testeando LOGIN...');
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('   ✅ Login exitoso\n');

    // ========== 2. NAVEGACIÓN A DOCUMENTOS ==========
    console.log('2️⃣  Navegando a Documentos...');
    await page.click('a[href="/documentos"]');
    await page.waitForURL('**/documentos', { timeout: 5000 });
    await page.waitForTimeout(1000);
    console.log('   ✅ Navegación exitosa\n');

    // ========== 3. VERIFICAR QUE HAY DOCUMENTOS ==========
    console.log('3️⃣  Verificando que hay documentos...');
    const documentCards = page.locator('[class*="bg-white rounded-lg shadow"]').filter({ hasText: 'Ver' });
    const count = await documentCards.count();
    console.log(`   📄 Documentos encontrados: ${count}`);

    if (count === 0) {
      console.log('   ⚠️  No hay documentos para probar. Saltando test.');
      return;
    }

    // ========== 4. OBTENER INFO DEL PRIMER DOCUMENTO ==========
    console.log('4️⃣  Obteniendo información del primer documento...');
    const firstCard = documentCards.first();
    const docTitle = await firstCard.locator('h3').first().textContent();
    console.log(`   📝 Documento: ${docTitle}`);

    // ========== 5. VERIFICAR BOTÓN "VER" ==========
    console.log('5️⃣  Verificando botón "Ver"...');
    const verButton = firstCard.locator('button:has-text("Ver")');
    expect(await verButton.isVisible()).toBeTruthy();
    console.log('   ✅ Botón "Ver" encontrado\n');

    // ========== 6. CLICK EN BOTÓN "VER" ==========
    console.log('6️⃣  Haciendo click en botón "Ver"...');

    // Listen for console messages and errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`   ❌ Console Error: ${msg.text()}`);
      } else if (msg.text().includes('Error')) {
        console.log(`   ⚠️  Console: ${msg.text()}`);
      }
    });

    // Listen for page errors
    page.on('pageerror', error => {
      console.log(`   ❌ Page Error: ${error.message}`);
    });

    // Listen for failed requests
    page.on('requestfailed', request => {
      console.log(`   ❌ Request Failed: ${request.url()} - ${request.failure()?.errorText}`);
    });

    // Listen for responses
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/documents/') && url.includes('/view')) {
        console.log(`   📡 Response /view: ${response.status()} - ${response.statusText()}`);
        if (response.status() !== 200) {
          response.text().then(text => {
            console.log(`   📄 Response body: ${text}`);
          });
        }
      }
    });

    await verButton.click();
    await page.waitForTimeout(2000);

    // ========== 7. VERIFICAR QUE EL MODAL SE ABRE ==========
    console.log('7️⃣  Verificando que el modal se abre...');
    const modal = page.locator('[class*="fixed inset-0 bg-black"]');
    const isModalVisible = await modal.isVisible();

    if (isModalVisible) {
      console.log('   ✅ Modal abierto\n');

      // ========== 8. VERIFICAR CONTENIDO DEL MODAL ==========
      console.log('8️⃣  Verificando contenido del modal...');

      // Check for iframe (PDF) or image
      const iframe = modal.locator('iframe');
      const image = modal.locator('img');
      const noPreviewMessage = modal.locator('text=No hay vista previa disponible');

      const hasIframe = await iframe.count() > 0;
      const hasImage = await image.count() > 0;
      const hasNoPreview = await noPreviewMessage.count() > 0;

      console.log(`   📊 Has iframe: ${hasIframe}`);
      console.log(`   📊 Has image: ${hasImage}`);
      console.log(`   📊 Has no preview message: ${hasNoPreview}`);

      if (hasIframe) {
        const iframeSrc = await iframe.getAttribute('src');
        console.log(`   📄 Iframe src: ${iframeSrc ? iframeSrc.substring(0, 100) : 'null'}`);
        console.log('   ✅ PDF viewer cargado\n');
      } else if (hasImage) {
        const imageSrc = await image.getAttribute('src');
        console.log(`   🖼️  Image src: ${imageSrc ? imageSrc.substring(0, 100) : 'null'}`);
        console.log('   ✅ Image viewer cargado\n');
      } else if (hasNoPreview) {
        console.log('   ℹ️  Tipo de archivo sin preview\n');
      } else {
        console.log('   ⚠️  No se encontró contenido del documento\n');
      }

      // ========== 9. VERIFICAR BOTONES DEL MODAL ==========
      console.log('9️⃣  Verificando botones del modal...');
      const shareButton = modal.locator('button:has-text("Compartir")');
      const downloadButton = modal.locator('button:has-text("Descargar")');
      const closeButton = modal.locator('button[title="Cerrar"]');

      expect(await shareButton.isVisible()).toBeTruthy();
      expect(await downloadButton.isVisible()).toBeTruthy();
      expect(await closeButton.isVisible()).toBeTruthy();
      console.log('   ✅ Botones del modal encontrados\n');

      // ========== 10. CERRAR MODAL ==========
      console.log('🔟 Cerrando modal...');
      await closeButton.click();
      await page.waitForTimeout(500);

      const isModalClosed = !(await modal.isVisible());
      expect(isModalClosed).toBeTruthy();
      console.log('   ✅ Modal cerrado correctamente\n');

    } else {
      console.log('   ❌ El modal NO se abrió\n');

      // Check for alerts
      const alerts = await page.locator('[role="alert"]').allTextContents();
      if (alerts.length > 0) {
        console.log(`   ⚠️  Alerts en página: ${alerts.join(', ')}`);
      }

      throw new Error('Modal did not open');
    }

    console.log('\n=== TEST COMPLETADO ===\n');
  });
});

const { chromium } = require('playwright');

async function testLoginDetailed() {
  console.log('🔍 Test detallado de login con usuario de prueba\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500 // Slow down to see what's happening
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Go to login page
    console.log('1. Navegando a login page...');
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/step1-login-page.png', fullPage: true });
    console.log('   ✅ Login page cargada\n');

    // 2. Fill credentials
    console.log('2. Rellenando credenciales...');
    console.log('   Email: test@migestor.com');
    console.log('   Password: Test123456');
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');
    await page.screenshot({ path: '/tmp/step2-credentials-filled.png', fullPage: true });
    console.log('   ✅ Credenciales rellenadas\n');

    // 3. Click login button
    console.log('3. Haciendo click en Login...');
    await page.click('button[type="submit"]');
    console.log('   ⏳ Esperando redirección...\n');

    // 4. Wait for redirect and check URL
    try {
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      console.log('   ✅ Redirigido a dashboard\n');
    } catch (error) {
      console.log('   ⚠️  No redirigió a dashboard, URL actual:', page.url());
      await page.screenshot({ path: '/tmp/step3-after-login-attempt.png', fullPage: true });
    }

    // 5. Wait a bit and take screenshot
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/step4-after-redirect.png', fullPage: true });
    console.log('4. Screenshot después de login guardado\n');

    // 6. Check what's visible on the page
    console.log('5. Verificando contenido de la página...');
    const bodyText = await page.textContent('body');
    console.log('   URL actual:', page.url());
    console.log('   Título de página:', await page.title());

    // Check for common elements
    const hasNavigation = await page.isVisible('nav').catch(() => false);
    const hasSpinner = await page.isVisible('.animate-spin').catch(() => false);
    const hasError = bodyText.includes('Error') || bodyText.includes('error');

    console.log('   - Tiene navegación:', hasNavigation ? '✅' : '❌');
    console.log('   - Tiene spinner de carga:', hasSpinner ? '⏳' : '✅');
    console.log('   - Tiene errores:', hasError ? '❌' : '✅');
    console.log('');

    // 7. Try to navigate to recurring templates
    console.log('6. Intentando navegar a Facturas Recurrentes...');
    await page.goto('http://localhost:3001/facturas/recurrentes');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/step5-recurring-templates.png', fullPage: true });
    console.log('   ✅ Página de plantillas cargada\n');

    console.log('📸 Screenshots guardados:');
    console.log('   - /tmp/step1-login-page.png');
    console.log('   - /tmp/step2-credentials-filled.png');
    console.log('   - /tmp/step3-after-login-attempt.png (si hubo problema)');
    console.log('   - /tmp/step4-after-redirect.png');
    console.log('   - /tmp/step5-recurring-templates.png\n');

    console.log('🔍 Manteniendo navegador abierto durante 10 segundos...');
    console.log('   Puedes ver la interfaz actual en el navegador.\n');

    await page.waitForTimeout(10000);

    console.log('✅ Test completado');

  } catch (error) {
    console.error('\n❌ Error durante el test:', error.message);
    await page.screenshot({ path: '/tmp/error-detailed.png', fullPage: true });
    console.log('📸 Screenshot del error: /tmp/error-detailed.png\n');
    throw error;
  } finally {
    await browser.close();
  }
}

// Run test
testLoginDetailed()
  .then(() => {
    console.log('\n✅ Test finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test falló');
    process.exit(1);
  });

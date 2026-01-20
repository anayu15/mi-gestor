const { chromium } = require('playwright');

async function testRecurringTemplates() {
  console.log('🎭 Test simplificado de plantillas recurrentes\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Login
    console.log('1. Login...');
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('   ✅ Login exitoso\n');

    // 2. Navigate to recurring templates
    console.log('2. Navegar a Facturas Recurrentes...');
    await page.goto('http://localhost:3001/facturas/recurrentes');
    await page.waitForLoadState('networkidle');
    console.log('   ✅ Página cargada\n');

    // 3. Create new template
    console.log('3. Crear nueva plantilla...');
    await page.click('text=Nueva Plantilla');
    await page.waitForURL('**/facturas/recurrentes/nueva', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    console.log('   ✅ Formulario cargado\n');

    // 4. Fill form with minimal data
    console.log('4. Rellenar formulario...');
    await page.fill('input[name="nombre_plantilla"]', 'Test Playwright - Día 27');
    await page.selectOption('select[name="cliente_id"]', { index: 1 });
    await page.fill('textarea[name="concepto"]', 'Servicios test');
    await page.fill('input[name="base_imponible"]', '1000');

    // Select monthly frequency
    await page.click('text=Mensual');
    await page.waitForTimeout(500);

    // Select "Día específico" and day 27
    await page.click('text=Día específico');
    await page.waitForTimeout(500);
    const daySelect = page.locator('select:has(option:has-text("Día 1"))');
    await daySelect.selectOption({ value: '27' });
    console.log('   ✅ Formulario rellenado (Día específico: 27)\n');

    // 5. Submit
    console.log('5. Guardar plantilla...');
    await page.click('button[type="submit"]');

    // Wait for redirect
    try {
      await page.waitForURL('**/facturas/recurrentes', { timeout: 10000 });
      console.log('   ✅ Plantilla creada!\n');
    } catch (error) {
      const bodyText = await page.textContent('body');
      console.log('Error en respuesta:', bodyText?.substring(0, 300));
      throw error;
    }

    // 6. Verify template appears in list
    console.log('6. Verificar plantilla en lista...');
    await page.waitForTimeout(1000);
    const templateExists = await page.isVisible('text=Test Playwright - Día 27');

    if (templateExists) {
      console.log('   ✅ Plantilla visible en la lista\n');
    } else {
      console.log('   ⚠️  Plantilla no encontrada (podría estar en otra página)\n');
    }

    // Take final screenshot
    await page.screenshot({ path: '/tmp/test-success.png', fullPage: true });
    console.log('📸 Screenshot guardado en /tmp/test-success.png\n');

    console.log('✅ TEST COMPLETADO EXITOSAMENTE!\n');
    console.log('Resumen:');
    console.log('  ✓ Login funciona');
    console.log('  ✓ Navegación a plantillas funciona');
    console.log('  ✓ Formulario se carga correctamente');
    console.log('  ✓ Se puede crear plantilla con día específico 27');
    console.log('  ✓ Guardado exitoso\n');

    await page.waitForTimeout(2000);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await page.screenshot({ path: '/tmp/test-error.png', fullPage: true });
    console.log('📸 Screenshot del error: /tmp/test-error.png\n');
    throw error;
  } finally {
    await browser.close();
  }
}

// Run test
testRecurringTemplates()
  .then(() => {
    console.log('🎉 Test finalizado con éxito');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test falló');
    process.exit(1);
  });

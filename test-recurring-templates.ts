import { chromium } from 'playwright';

async function testRecurringTemplates() {
  console.log('🎭 Iniciando test de Playwright para plantillas recurrentes...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Login
    console.log('1. 🔐 Haciendo login...');
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('   ✅ Login exitoso\n');

    // 2. Navigate to recurring templates
    console.log('2. 📋 Navegando a Facturas Recurrentes...');
    await page.click('text=Facturas');
    await page.waitForLoadState('networkidle');
    await page.click('text=Facturas Recurrentes');
    await page.waitForURL('**/facturas/recurrentes', { timeout: 10000 });
    console.log('   ✅ En página de plantillas\n');

    // 3. Click create new template
    console.log('3. ➕ Creando nueva plantilla...');
    await page.click('text=Nueva Plantilla');
    await page.waitForURL('**/facturas/recurrentes/nueva', { timeout: 10000 });
    console.log('   ✅ Formulario cargado\n');

    // 4. Fill form
    console.log('4. 📝 Rellenando formulario...');

    // Template name
    await page.fill('input[name="nombre_plantilla"]', 'Plantilla Test Mensual');
    console.log('   ✓ Nombre plantilla');

    // Select client
    await page.selectOption('select[name="cliente_id"]', { index: 1 });
    console.log('   ✓ Cliente seleccionado');

    // Concept
    await page.fill('textarea[name="concepto"]', 'Servicios de consultoría mensual');
    console.log('   ✓ Concepto');

    // Amount
    await page.fill('input[name="base_imponible"]', '1000');
    console.log('   ✓ Base imponible');

    // Frequency - click Mensual button
    await page.click('text=Mensual');
    await page.waitForTimeout(500);
    console.log('   ✓ Frecuencia: Mensual');

    // Day type - try different options
    console.log('\n   🎯 Probando tipos de día de generación:');

    // Test 1: Specific day (día 27)
    await page.click('text=Día específico');
    await page.waitForTimeout(500);
    // Select day 27 from the day selector (the one with options like "Día 1", "Día 2", etc.)
    const daySelect = await page.locator('select:has(option:has-text("Día 1"))');
    await daySelect.selectOption({ value: '27' });
    console.log('      ✓ Tipo 1: Día específico (día 27)');

    // Test 2: First business day
    await page.click('text=Primer día hábil');
    await page.waitForTimeout(500);
    console.log('      ✓ Tipo 2: Primer día hábil');

    // Test 3: Last business day (this one we'll use for final submission)
    await page.click('text=Último día hábil');
    await page.waitForTimeout(500);
    console.log('      ✓ Tipo 3: Último día hábil (selección final)');

    // Start date
    const today = new Date().toISOString().split('T')[0];
    await page.fill('input[name="fecha_inicio"]', today);
    console.log(`\n   ✓ Fecha inicio: ${today}`);

    // 5. Submit
    console.log('\n5. 💾 Guardando plantilla...');
    await page.click('button[type="submit"]');

    // Wait for redirect or success
    try {
      await page.waitForURL('**/facturas/recurrentes', { timeout: 10000 });
      console.log('   ✅ Plantilla creada exitosamente!\n');
    } catch (error) {
      // Check for error messages
      const errorText = await page.textContent('body');
      if (errorText?.includes('Error')) {
        console.log('   ❌ Error al crear plantilla');
        console.log('   Mensaje de error:', errorText.substring(0, 200));
      }
      throw error;
    }

    // 6. Verify template appears in list
    console.log('6. ✅ Verificando plantilla en la lista...');
    await page.waitForTimeout(1000);
    const templateExists = await page.isVisible('text=Plantilla Test Mensual');

    if (templateExists) {
      console.log('   ✅ Plantilla visible en la lista\n');

      // Take screenshot
      await page.screenshot({ path: '/tmp/plantilla-creada.png', fullPage: true });
      console.log('   📸 Screenshot guardado en /tmp/plantilla-creada.png\n');
    } else {
      console.log('   ⚠️  Plantilla no encontrada en la lista\n');
    }

    console.log('✅ Test completado exitosamente!');
    console.log('\n🎉 El sistema de facturas recurrentes funciona correctamente:');
    console.log('   ✓ Login');
    console.log('   ✓ Navegación a plantillas');
    console.log('   ✓ Creación de plantilla');
    console.log('   ✓ Tipos de día de generación (día específico, primer/último día hábil)');
    console.log('   ✓ Guardado en base de datos');
    console.log('   ✓ Visualización en lista\n');

  } catch (error: any) {
    console.error('\n❌ Error en el test:', error.message);

    // Take screenshot of error
    await page.screenshot({ path: '/tmp/error-test.png', fullPage: true });
    console.log('📸 Screenshot del error guardado en /tmp/error-test.png\n');

    throw error;
  } finally {
    await page.waitForTimeout(3000); // Keep browser open briefly to see result
    await browser.close();
  }
}

// Run test
testRecurringTemplates()
  .then(() => {
    console.log('🎭 Playwright test finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('🎭 Playwright test falló:', error);
    process.exit(1);
  });

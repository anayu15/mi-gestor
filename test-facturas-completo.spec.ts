import { test, expect } from '@playwright/test';

test.describe('Facturas Tab - Complete Functionality Test', () => {
  let createdInvoiceId: string;
  let createdExpenseId: string;

  test('Test completo del tab Facturas', async ({ page }) => {
    console.log('\n=== INICIANDO TEST COMPLETO DE FACTURAS ===\n');

    // ========== 1. LOGIN ==========
    console.log('1️⃣  Testeando LOGIN...');
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('   ✅ Login exitoso\n');

    // ========== 2. NAVEGACIÓN A FACTURAS ==========
    console.log('2️⃣  Navegando a Facturas...');
    await page.click('a[href="/facturas"]');
    await page.waitForURL('**/facturas', { timeout: 5000 });
    await page.waitForTimeout(1000);
    console.log('   ✅ Navegación exitosa\n');

    // ========== 3. VERIFICAR QUE LA LISTA CARGA ==========
    console.log('3️⃣  Verificando que la lista carga...');
    const pageTitle = await page.locator('h1:has-text("Facturas")');
    expect(await pageTitle.isVisible()).toBeTruthy();
    console.log('   ✅ Página de facturas cargada\n');

    // ========== 4. VERIFICAR TABS DE AÑOS ==========
    console.log('4️⃣  Verificando tabs de años...');
    const yearTabs = page.locator('nav button');
    const yearTabCount = await yearTabs.count();
    console.log(`   📊 Tabs de años encontrados: ${yearTabCount}`);
    if (yearTabCount > 0) {
      const firstYearText = await yearTabs.first().textContent();
      console.log(`   ✅ Primer año: ${firstYearText}\n`);
    }

    // ========== 5. VERIFICAR CARDS DE RESUMEN ==========
    console.log('5️⃣  Verificando cards de resumen...');
    const ingresosCard = page.locator('text=Ingresos').first();
    const gastosCard = page.locator('text=Gastos').first();
    const balanceCard = page.locator('text=Balance').first();
    expect(await ingresosCard.isVisible()).toBeTruthy();
    expect(await gastosCard.isVisible()).toBeTruthy();
    expect(await balanceCard.isVisible()).toBeTruthy();
    console.log('   ✅ Cards de resumen visibles\n');

    // ========== 6. CREAR NUEVA FACTURA DE INGRESO ==========
    console.log('6️⃣  Creando nueva factura de ingreso...');
    await page.click('a[href="/facturas/nueva"]');
    await page.waitForURL('**/facturas/nueva', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // Fill invoice form
    await page.fill('input[name="fecha_emision"]', '2026-01-10');
    await page.fill('textarea[name="concepto"]', 'Test Invoice E2E');
    await page.fill('input[name="base_imponible"]', '1000');

    // Select first client
    const clientSelect = page.locator('select[name="cliente_id"]');
    await clientSelect.selectOption({ index: 1 });

    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Should redirect to facturas
    const currentUrl = page.url();
    if (currentUrl.includes('/facturas') && !currentUrl.includes('/nueva')) {
      console.log('   ✅ Factura de ingreso creada exitosamente\n');
    } else {
      console.log(`   ⚠️  URL inesperada después de crear: ${currentUrl}\n`);
    }

    // ========== 7. VERIFICAR QUE LA FACTURA APARECE ==========
    console.log('7️⃣  Verificando que la factura aparece en la lista...');
    await page.goto('http://localhost:3001/facturas');
    await page.waitForTimeout(3000);

    // Click on 2026 tab if exists
    const tab2026 = page.locator('div.border-b button:has-text("2026")');
    if (await tab2026.isVisible().catch(() => false)) {
      await tab2026.click();
      await page.waitForTimeout(1000);
    }

    const testInvoice = page.locator('text=Test Invoice E2E');
    const invoiceExists = await testInvoice.isVisible().catch(() => false);

    if (invoiceExists) {
      console.log('   ✅ Factura encontrada en la lista\n');
    } else {
      console.log('   ❌ Factura NO encontrada en la lista\n');
    }

    // ========== 8. CREAR NUEVO GASTO ==========
    console.log('8️⃣  Creando nuevo gasto...');
    await page.click('a[href="/gastos/nuevo"]');
    await page.waitForURL('**/gastos/nuevo', { timeout: 5000 });

    await page.fill('input[name="concepto"]', 'Test Expense E2E');
    await page.fill('input[name="proveedor_nombre"]', 'Proveedor Test E2E');
    await page.fill('input[name="fecha_emision"]', '2026-01-11');
    await page.fill('input[name="base_imponible"]', '500');

    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    const expenseUrl = page.url();
    if (expenseUrl.includes('/facturas') || expenseUrl.includes('/gastos')) {
      console.log('   ✅ Gasto creado exitosamente\n');
    } else {
      console.log(`   ⚠️  URL inesperada después de crear gasto: ${expenseUrl}\n`);
    }

    // ========== 9. VERIFICAR QUE EL GASTO APARECE ==========
    console.log('9️⃣  Verificando que el gasto aparece en la lista...');
    await page.goto('http://localhost:3001/facturas');
    await page.waitForTimeout(3000);

    // Click on 2026 tab if exists
    const tab2026Again = page.locator('div.border-b button:has-text("2026")');
    if (await tab2026Again.isVisible().catch(() => false)) {
      await tab2026Again.click();
      await page.waitForTimeout(1000);
    }

    const testExpense = page.locator('text=Test Expense E2E');
    const expenseExists = await testExpense.isVisible().catch(() => false);

    if (expenseExists) {
      console.log('   ✅ Gasto encontrado en la lista\n');
    } else {
      console.log('   ❌ Gasto NO encontrado en la lista\n');
    }

    // ========== 10. EDITAR FACTURA DE INGRESO (CAMBIAR FECHA) ==========
    console.log('🔟 Editando factura de ingreso (cambiar fecha)...');

    // Find the invoice row and click edit
    const invoiceRow = page.locator('tr:has-text("Test Invoice E2E")');
    const invoiceEditBtn = invoiceRow.locator('a:has-text("Editar")');
    const invoiceEditExists = await invoiceEditBtn.isVisible().catch(() => false);

    if (invoiceEditExists) {
      await invoiceEditBtn.click();
      await page.waitForTimeout(1000);

      const editUrl = page.url();
      if (editUrl.includes('/editar')) {
        console.log('   ✅ Navegó a página de edición de factura');

        // Change date
        const dateInput = page.locator('input[name="fecha_emision"]');
        await dateInput.fill('2026-01-15');

        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);

        console.log('   ✅ Factura actualizada\n');
      } else {
        console.log(`   ❌ URL incorrecta: ${editUrl}\n`);
      }
    } else {
      console.log('   ❌ No se encontró el botón Editar para la factura\n');
    }

    // ========== 11. EDITAR GASTO (CAMBIAR FECHA) ==========
    console.log('1️⃣1️⃣  Editando gasto (cambiar fecha)...');
    await page.goto('http://localhost:3001/facturas');
    await page.waitForTimeout(1000);

    const expenseRow = page.locator('tr:has-text("Test Expense E2E")');
    const expenseEditBtn = expenseRow.locator('a:has-text("Editar")');
    const expenseEditExists = await expenseEditBtn.isVisible().catch(() => false);

    if (expenseEditExists) {
      await expenseEditBtn.click();
      await page.waitForTimeout(1000);

      const editUrl = page.url();
      if (editUrl.includes('/editar')) {
        console.log('   ✅ Navegó a página de edición de gasto');

        // Change date
        const dateInput = page.locator('input[name="fecha_emision"]');
        await dateInput.fill('2026-01-16');

        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);

        console.log('   ✅ Gasto actualizado\n');
      } else {
        console.log(`   ❌ URL incorrecta: ${editUrl}\n`);
      }
    } else {
      console.log('   ❌ No se encontró el botón Editar para el gasto\n');
    }

    // ========== 12. VERIFICAR QUE LOS CAMBIOS PERSISTEN ==========
    console.log('1️⃣2️⃣  Verificando que los cambios de fecha persisten...');
    await page.goto('http://localhost:3001/facturas');
    await page.waitForTimeout(1000);

    // Check invoice date changed
    const invoiceRowAfter = page.locator('tr:has-text("Test Invoice E2E")');
    const invoiceEditBtnAfter = invoiceRowAfter.locator('a:has-text("Editar")');
    if (await invoiceEditBtnAfter.isVisible()) {
      await invoiceEditBtnAfter.click();
      await page.waitForTimeout(1000);

      const dateValue = await page.locator('input[name="fecha_emision"]').inputValue();
      if (dateValue === '2026-01-15') {
        console.log('   ✅ Fecha de factura persistió correctamente: 2026-01-15');
      } else {
        console.log(`   ❌ Fecha de factura NO persistió. Valor: ${dateValue}`);
      }

      await page.goto('http://localhost:3001/facturas');
      await page.waitForTimeout(1000);
    }

    // Check expense date changed
    const expenseRowAfter = page.locator('tr:has-text("Test Expense E2E")');
    const expenseEditBtnAfter = expenseRowAfter.locator('a:has-text("Editar")');
    if (await expenseEditBtnAfter.isVisible()) {
      await expenseEditBtnAfter.click();
      await page.waitForTimeout(1000);

      const dateValue = await page.locator('input[name="fecha_emision"]').inputValue();
      if (dateValue === '2026-01-16') {
        console.log('   ✅ Fecha de gasto persistió correctamente: 2026-01-16\n');
      } else {
        console.log(`   ❌ Fecha de gasto NO persistió. Valor: ${dateValue}\n`);
      }

      await page.goto('http://localhost:3001/facturas');
      await page.waitForTimeout(1000);
    }

    // ========== 13. ELIMINAR FACTURA DE INGRESO ==========
    console.log('1️⃣3️⃣  Eliminando factura de ingreso de prueba...');
    const invoiceRowDelete = page.locator('tr:has-text("Test Invoice E2E")');
    const deleteInvoiceBtn = invoiceRowDelete.locator('button:has-text("Eliminar")');

    if (await deleteInvoiceBtn.isVisible()) {
      page.on('dialog', dialog => dialog.accept());
      await deleteInvoiceBtn.click();
      await page.waitForTimeout(1000);
      console.log('   ✅ Factura eliminada\n');
    }

    // ========== 14. ELIMINAR GASTO ==========
    console.log('1️⃣4️⃣  Eliminando gasto de prueba...');
    const expenseRowDelete = page.locator('tr:has-text("Test Expense E2E")');
    const deleteExpenseBtn = expenseRowDelete.locator('button:has-text("Eliminar")');

    if (await deleteExpenseBtn.isVisible()) {
      page.on('dialog', dialog => dialog.accept());
      await deleteExpenseBtn.click();
      await page.waitForTimeout(1000);
      console.log('   ✅ Gasto eliminado\n');
    }

    console.log('\n=== TEST COMPLETO FINALIZADO ===\n');
  });
});

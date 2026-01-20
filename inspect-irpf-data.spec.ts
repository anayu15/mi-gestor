import { test, expect } from '@playwright/test';

test('Inspect IRPF data in API responses', async ({ page, request }) => {
  // Set viewport for better screenshots
  await page.setViewportSize({ width: 1400, height: 900 });

  // Navigate to login page
  await page.goto('http://localhost:3001/login');
  await page.waitForLoadState('networkidle');

  // Fill login credentials
  await page.fill('input[type="email"]', 'test@migestor.com');
  await page.fill('input[type="password"]', 'Test123456');

  // Click login button
  await page.click('button[type="submit"]');

  // Wait for navigation after login
  await page.waitForURL('**/dashboard**', { timeout: 10000 });

  // Get the token from localStorage
  const token = await page.evaluate(() => localStorage.getItem('token'));
  console.log('Token obtained:', token ? 'Yes' : 'No');

  // Make direct API calls to check the data
  console.log('\n=== CHECKING EXPENSES API ===');
  const expensesResponse = await request.get('http://localhost:3000/api/expenses', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const expensesData = await expensesResponse.json();
  console.log('Expenses count:', expensesData.data?.length || 0);

  if (expensesData.data?.length > 0) {
    console.log('\nFirst expense fields:');
    const firstExpense = expensesData.data[0];
    console.log('  id:', firstExpense.id);
    console.log('  concepto:', firstExpense.concepto);
    console.log('  base_imponible:', firstExpense.base_imponible);
    console.log('  tipo_iva:', firstExpense.tipo_iva);
    console.log('  cuota_iva:', firstExpense.cuota_iva);
    console.log('  tipo_irpf:', firstExpense.tipo_irpf);
    console.log('  cuota_irpf:', firstExpense.cuota_irpf);
    console.log('  total_factura:', firstExpense.total_factura);

    // Check all expenses for IRPF values
    console.log('\n--- All expenses IRPF check ---');
    expensesData.data.forEach((exp: any, idx: number) => {
      console.log(`  [${idx}] ${exp.concepto?.substring(0, 30)}: tipo_irpf=${exp.tipo_irpf}, cuota_irpf=${exp.cuota_irpf}`);
    });
  }

  console.log('\n=== CHECKING INVOICES API ===');
  const invoicesResponse = await request.get('http://localhost:3000/api/invoices', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const invoicesData = await invoicesResponse.json();
  console.log('Invoices count:', invoicesData.data?.length || 0);

  if (invoicesData.data?.length > 0) {
    console.log('\nFirst invoice fields:');
    const firstInvoice = invoicesData.data[0];
    console.log('  id:', firstInvoice.id);
    console.log('  numero_factura:', firstInvoice.numero_factura);
    console.log('  base_imponible:', firstInvoice.base_imponible);
    console.log('  tipo_iva:', firstInvoice.tipo_iva);
    console.log('  cuota_iva:', firstInvoice.cuota_iva);
    console.log('  tipo_irpf:', firstInvoice.tipo_irpf);
    console.log('  cuota_irpf:', firstInvoice.cuota_irpf);
    console.log('  total_factura:', firstInvoice.total_factura);

    // Check all invoices for IRPF values
    console.log('\n--- All invoices IRPF check ---');
    invoicesData.data.forEach((inv: any, idx: number) => {
      console.log(`  [${idx}] ${inv.numero_factura}: tipo_irpf=${inv.tipo_irpf}, cuota_irpf=${inv.cuota_irpf}`);
    });
  }

  // Now navigate to facturas page and take screenshot
  await page.goto('http://localhost:3001/facturas');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/Users/anayusta/workspace/mi-gestor/screenshots/07-facturas-with-data.png', fullPage: true });

  // Find expense rows and check what's displayed
  console.log('\n=== UI CHECK ===');
  const rows = await page.locator('table tbody tr').all();
  console.log(`Found ${rows.length} total rows in table`);

  // Check the IRPF column values for each visible row
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = await rows[i].locator('td').allTextContents();
    if (cells.length > 7) {
      console.log(`Row ${i}: Type=${cells[0]?.trim()}, IRPF cell=${cells[7]?.trim()}`);
    }
  }
});

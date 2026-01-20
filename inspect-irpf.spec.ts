import { test, expect } from '@playwright/test';

test('Inspect IRPF display in expenses and invoices tables', async ({ page }) => {
  // Set viewport for better screenshots
  await page.setViewportSize({ width: 1400, height: 900 });

  // Navigate to login page
  await page.goto('http://localhost:3001/login');
  await page.waitForLoadState('networkidle');

  console.log('=== LOGIN PAGE ===');
  await page.screenshot({ path: '/Users/anayusta/workspace/mi-gestor/screenshots/01-login-page.png', fullPage: true });

  // Fill login credentials
  await page.fill('input[type="email"]', 'test@migestor.com');
  await page.fill('input[type="password"]', 'Test123456');

  // Click login button
  await page.click('button[type="submit"]');

  // Wait for navigation after login
  await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {
    console.log('Did not redirect to dashboard, checking current URL');
  });

  console.log('Current URL after login:', page.url());
  await page.screenshot({ path: '/Users/anayusta/workspace/mi-gestor/screenshots/02-after-login.png', fullPage: true });

  // Navigate to expenses page (gastos)
  console.log('=== NAVIGATING TO EXPENSES PAGE ===');
  await page.goto('http://localhost:3001/gastos');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // Wait for data to load

  await page.screenshot({ path: '/Users/anayusta/workspace/mi-gestor/screenshots/03-expenses-page.png', fullPage: true });

  // Check table headers
  const expenseTableHeaders = await page.locator('table th').allTextContents();
  console.log('Expense table headers:', expenseTableHeaders);

  // Check if IRPF column exists
  const hasIrpfHeader = expenseTableHeaders.some(h => h.toLowerCase().includes('irpf'));
  console.log('Has IRPF header in expenses:', hasIrpfHeader);

  // Get table content
  const expenseTableRows = await page.locator('table tbody tr').count();
  console.log('Number of expense rows:', expenseTableRows);

  if (expenseTableRows > 0) {
    // Get first row content
    const firstRowCells = await page.locator('table tbody tr:first-child td').allTextContents();
    console.log('First row cells:', firstRowCells);
  }

  // Take a closer screenshot of the table
  const expenseTable = page.locator('table').first();
  if (await expenseTable.isVisible()) {
    await expenseTable.screenshot({ path: '/Users/anayusta/workspace/mi-gestor/screenshots/04-expense-table-detail.png' });
  }

  // Navigate to invoices page (facturas)
  console.log('=== NAVIGATING TO INVOICES PAGE ===');
  await page.goto('http://localhost:3001/facturas');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // Wait for data to load

  await page.screenshot({ path: '/Users/anayusta/workspace/mi-gestor/screenshots/05-invoices-page.png', fullPage: true });

  // Check table headers
  const invoiceTableHeaders = await page.locator('table th').allTextContents();
  console.log('Invoice table headers:', invoiceTableHeaders);

  // Check if IRPF column exists
  const hasIrpfHeaderInvoices = invoiceTableHeaders.some(h => h.toLowerCase().includes('irpf'));
  console.log('Has IRPF header in invoices:', hasIrpfHeaderInvoices);

  // Get table content
  const invoiceTableRows = await page.locator('table tbody tr').count();
  console.log('Number of invoice rows:', invoiceTableRows);

  if (invoiceTableRows > 0) {
    // Get first row content
    const firstInvoiceRowCells = await page.locator('table tbody tr:first-child td').allTextContents();
    console.log('First invoice row cells:', firstInvoiceRowCells);
  }

  // Take a closer screenshot of the invoice table
  const invoiceTable = page.locator('table').first();
  if (await invoiceTable.isVisible()) {
    await invoiceTable.screenshot({ path: '/Users/anayusta/workspace/mi-gestor/screenshots/06-invoice-table-detail.png' });
  }

  console.log('=== INSPECTION COMPLETE ===');
});

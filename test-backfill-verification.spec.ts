import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'test@migestor.com';
const TEST_PASSWORD = 'Test123456';

test('Verify backfill generates and persists retroactive invoices', async ({ request }) => {
  console.log('======================================');
  console.log('Backfill Verification Test');
  console.log('======================================\n');

  // 1. Login
  console.log('1. Authenticating...');
  const loginResponse = await request.post('http://localhost:3000/api/auth/login', {
    data: {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    }
  });
  const loginData = await loginResponse.json();
  const token = loginData.data.token;
  console.log('✅ Login successful\n');

  // 2. Get a client
  console.log('2. Getting client...');
  const clientsResponse = await request.get('http://localhost:3000/api/clients', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const clientsData = await clientsResponse.json();
  const clientId = clientsData.data[0].id;
  console.log(`✅ Client ID: ${clientId}\n`);

  // 3. Create template with past date (4 months ago)
  console.log('3. Creating recurring template with past date...');
  const pastDate = new Date();
  pastDate.setMonth(pastDate.getMonth() - 4);
  const fechaInicio = pastDate.toISOString().split('T')[0];
  console.log(`   Start date: ${fechaInicio} (4 months ago)`);

  const templateResponse = await request.post('http://localhost:3000/api/recurring-templates', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    data: {
      nombre_plantilla: `Backfill Verification ${Date.now()}`,
      cliente_id: clientId,
      serie: 'BV',
      concepto: 'Servicios de verificación',
      base_imponible: 1500,
      tipo_iva: 21,
      tipo_irpf: 15,
      frecuencia: 'MENSUAL',
      dia_generacion: 1,
      fecha_inicio: fechaInicio,
      incluir_periodo_facturacion: true,
      generar_pdf_automatico: false
    }
  });

  const templateData = await templateResponse.json();
  const templateId = templateData.data.id;
  console.log(`✅ Template created: ID ${templateId}`);
  console.log(`   Message: ${templateData.message || 'Template created'}\n`);

  // 4. Wait for backfill to complete (generous timeout)
  console.log('4. Waiting 10 seconds for backfill to complete...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // 5. Check generated invoices
  console.log('\n5. Checking generated invoices...');
  const invoicesResponse = await request.get('http://localhost:3000/api/invoices', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const invoicesData = await invoicesResponse.json();

  const generatedInvoices = invoicesData.data.filter(
    (inv: any) => inv.template_id === templateId
  );

  console.log(`✅ Generated invoices: ${generatedInvoices.length}`);

  if (generatedInvoices.length > 0) {
    console.log('\n   Invoice details:');
    generatedInvoices.forEach((inv: any) => {
      console.log(`   - ${inv.numero_factura} | ${inv.fecha_emision} | €${inv.total_factura}`);
    });
  }

  // 6. Verify expected number of invoices (should be 5: 4 months + current)
  const today = new Date();
  const monthsDiff = (today.getFullYear() - pastDate.getFullYear()) * 12 +
                     (today.getMonth() - pastDate.getMonth()) + 1;

  console.log(`\n   Expected: ${monthsDiff} invoices`);
  console.log(`   Actual: ${generatedInvoices.length} invoices`);

  expect(generatedInvoices.length).toBe(monthsDiff);

  // 7. Check for missing invoices via API
  console.log('\n6. Checking for missing invoices...');
  const missingResponse = await request.get(
    `http://localhost:3000/api/recurring-templates/${templateId}/missing-invoices`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  const missingData = await missingResponse.json();
  console.log(`   Missing invoices: ${missingData.data.missingCount}`);

  expect(missingData.data.missingCount).toBe(0);
  console.log('✅ No missing invoices - backfill completed successfully!\n');

  // 8. Verify invoice numbers are sequential within each year
  console.log('7. Verifying sequential invoice numbering...');
  const sortedInvoices = generatedInvoices.sort((a: any, b: any) =>
    new Date(a.fecha_emision).getTime() - new Date(b.fecha_emision).getTime()
  );

  const invoicesByYear: { [key: string]: string[] } = {};
  sortedInvoices.forEach((inv: any) => {
    const year = new Date(inv.fecha_emision).getFullYear().toString();
    if (!invoicesByYear[year]) {
      invoicesByYear[year] = [];
    }
    invoicesByYear[year].push(inv.numero_factura);
  });

  let allSequential = true;
  Object.entries(invoicesByYear).forEach(([year, numbers]) => {
    console.log(`   ${year}: ${numbers.join(', ')}`);

    // Extract numeric parts and verify they're sequential
    const nums = numbers.map(n => parseInt(n.split('-')[1]));
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] !== nums[i-1] + 1) {
        allSequential = false;
      }
    }
  });

  expect(allSequential).toBe(true);
  console.log('✅ Invoice numbers are sequential\n');

  // 9. Cleanup - delete template and invoices
  console.log('8. Cleaning up test data...');
  await request.delete(`http://localhost:3000/api/recurring-templates/${templateId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('✅ Cleanup complete\n');

  console.log('======================================');
  console.log('✅ ALL VERIFICATION TESTS PASSED!');
  console.log('======================================');
});

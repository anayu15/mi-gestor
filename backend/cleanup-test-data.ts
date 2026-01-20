import { query, pool } from './src/config/database';

async function cleanup() {
  try {
    console.log('Cleaning up test data...');

    // Delete test templates
    const templatesResult = await query(`
      DELETE FROM recurring_invoice_templates
      WHERE nombre_plantilla LIKE '%Test%' OR nombre_plantilla LIKE '%Manual%'
      RETURNING id, nombre_plantilla;
    `);
    console.log(`✓ Deleted ${templatesResult.rows.length} test templates`);

    // Delete test invoices
    const invoicesResult = await query(`
      DELETE FROM facturas_emitidas
      WHERE serie IN ('TEST', 'MT') OR concepto LIKE '%prueba%'
      RETURNING numero_factura;
    `);
    console.log(`✓ Deleted ${invoicesResult.rows.length} test invoices`);

    // Delete orphan invoices with template_id but template doesn't exist
    const orphanResult = await query(`
      DELETE FROM facturas_emitidas
      WHERE template_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM recurring_invoice_templates
        WHERE recurring_invoice_templates.id = facturas_emitidas.template_id
      )
      RETURNING numero_factura;
    `);
    console.log(`✓ Deleted ${orphanResult.rows.length} orphan invoices`);

    console.log('\n✅ Cleanup complete!');

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Cleanup failed:', error.message || error);
    await pool.end();
    process.exit(1);
  }
}

cleanup();

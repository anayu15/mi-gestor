import { query } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  try {
    console.log('🔄 Ejecutando migración de facturas recurrentes...\n');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../../database/migrations/007_add_recurring_invoices.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Remove comments and execute as single transaction
    const cleanSQL = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .trim();

    console.log('1. Creando tabla recurring_invoice_templates...');
    console.log('2. Creando tabla recurring_invoice_history...');
    console.log('3. Modificando tabla invoices...');
    console.log('4. Creando índices...');
    console.log('5. Agregando comentarios...\n');

    // Execute the entire migration as one transaction
    await query(cleanSQL);
    console.log('✅ Migración ejecutada\n');

    console.log('✅ Migración completada exitosamente\n');

    // Verify tables were created
    console.log('🔍 Verificando tablas creadas...');

    const tablesResult = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('recurring_invoice_templates', 'recurring_invoice_history')
      ORDER BY table_name;
    `);

    console.log('📋 Tablas verificadas:');
    tablesResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    // Verify facturas_emitidas table was modified
    const invoicesColumns = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'facturas_emitidas'
      AND column_name IN ('template_id', 'es_recurrente')
      ORDER BY column_name;
    `);

    console.log('\n📋 Columnas agregadas a facturas_emitidas:');
    invoicesColumns.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name} (${row.data_type})`);
    });

    console.log('\n✨ Sistema de facturas recurrentes listo para usar!\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error ejecutando migración:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

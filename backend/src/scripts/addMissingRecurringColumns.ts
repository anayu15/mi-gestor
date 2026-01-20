import { query } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  try {
    console.log('🔄 Ejecutando migración de columnas faltantes en recurring_invoice_templates...\n');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../../database/migrations/009_add_missing_recurring_columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Remove comments and execute
    const cleanSQL = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .trim();

    console.log('1. Agregando descripcion_detallada...');
    console.log('2. Agregando enviar_email_automatico...');
    console.log('3. Agregando motivo_pausa...');
    console.log('4. Agregando ultima_factura_generada_id...\n');

    await query(cleanSQL);
    console.log('✅ Migración ejecutada\n');

    // Verify columns were added
    const columnsResult = await query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'recurring_invoice_templates'
      AND column_name IN ('descripcion_detallada', 'enviar_email_automatico', 'motivo_pausa', 'ultima_factura_generada_id')
      ORDER BY column_name;
    `);

    console.log('📋 Columnas verificadas:');
    columnsResult.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name} (${row.data_type}${row.column_default ? ', default: ' + row.column_default : ''})`);
    });

    console.log('\n✨ Todas las columnas necesarias están ahora disponibles!\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error ejecutando migración:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

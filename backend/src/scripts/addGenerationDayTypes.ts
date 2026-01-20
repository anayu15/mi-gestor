import { query } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  try {
    console.log('🔄 Ejecutando migración de tipos de día de generación...\n');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../../database/migrations/008_add_generation_day_type.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Remove comments and execute
    const cleanSQL = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .trim();

    console.log('1. Agregando columna tipo_dia_generacion...');
    console.log('2. Actualizando plantillas existentes...');
    console.log('3. Agregando comentarios...\n');

    await query(cleanSQL);
    console.log('✅ Migración ejecutada\n');

    // Verify column was added
    const columnsResult = await query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'recurring_invoice_templates'
      AND column_name = 'tipo_dia_generacion';
    `);

    console.log('📋 Columna verificada:');
    columnsResult.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name} (${row.data_type}, default: ${row.column_default})`);
    });

    console.log('\n✨ Tipos de día de generación disponibles:\n');
    console.log('  • DIA_ESPECIFICO - Día específico del mes (ej: día 27)');
    console.log('  • PRIMER_DIA_NATURAL - Primer día del mes (día 1)');
    console.log('  • PRIMER_DIA_LECTIVO - Primer día hábil del mes (lunes-viernes)');
    console.log('  • ULTIMO_DIA_NATURAL - Último día del mes (28-31)');
    console.log('  • ULTIMO_DIA_LECTIVO - Último día hábil del mes (lunes-viernes)\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error ejecutando migración:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

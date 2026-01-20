import { query } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration026() {
  try {
    console.log('🔄 Ejecutando migración 026: Modelo 036 Analysis...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../../database/migrations/026_modelo_036_analysis.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    console.log('1. Creando tabla modelo_036_analysis...');
    await query(migrationSQL);
    console.log('✅ Tabla creada\n');

    // Verify table exists
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'modelo_036_analysis'
      );
    `);

    if (tableCheck.rows[0].exists) {
      console.log('✅ Tabla modelo_036_analysis verificada\n');
    } else {
      throw new Error('La tabla no se creó correctamente');
    }

    // Check column in usuarios
    const columnCheck = await query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'usuarios' AND column_name = 'last_modelo_036_analysis_id'
    `);

    if (columnCheck.rows.length > 0) {
      console.log('✅ Columna last_modelo_036_analysis_id agregada a usuarios\n');
    }

    console.log('✅ Migración 026 completada exitosamente\n');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error ejecutando migración:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration026();

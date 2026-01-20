import { query } from '../config/database';
import fs from 'fs';
import path from 'path';

async function runOCRMigration() {
  try {
    console.log('🔄 Ejecutando migración de campos OCR...');

    const migrationPath = path.join(__dirname, '../../database/migrations/012_add_ocr_fields_to_gastos.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Ejecutando:', statement.substring(0, 50) + '...');
        await query(statement);
      }
    }

    console.log('✅ Migración completada exitosamente');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error en la migración:', error.message);
    process.exit(1);
  }
}

runOCRMigration();

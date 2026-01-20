import { query } from '../config/database';
import fs from 'fs';
import path from 'path';

async function runMigration015() {
  try {
    console.log('🔄 Executing migration 015: Add programaciones table...');

    const migrationPath = path.join(__dirname, '../../database/migrations/015_add_programaciones.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('Running migration...');
    await query(migrationSQL);

    console.log('✅ Migration 015 completed successfully');
    console.log('   - Created programaciones table');
    console.log('   - Added programacion_id to facturas_emitidas');
    console.log('   - Added programacion_id to expenses');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration error:', error.message);
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    process.exit(1);
  }
}

runMigration015();

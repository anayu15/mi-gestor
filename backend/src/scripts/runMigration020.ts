import { query } from '../config/database';
import fs from 'fs';
import path from 'path';

async function runMigration020() {
  try {
    console.log('Running migration 020: Add contract support to programaciones...');

    const migrationPath = path.join(__dirname, '../../database/migrations/020_add_contract_to_programaciones.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('Running migration...');
    await query(migrationSQL);

    console.log('Migration 020 completed successfully');
    console.log('   Added columns: contrato_document_id, contrato_datos_extraidos, contrato_confianza');
    process.exit(0);
  } catch (error: any) {
    console.error('Migration error:', error.message);
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    process.exit(1);
  }
}

runMigration020();

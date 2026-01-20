import { query } from '../config/database';
import fs from 'fs';
import path from 'path';

async function runMigration014() {
  try {
    console.log('🔄 Executing migration 014: Rename gastos to expenses...');

    const migrationPath = path.join(__dirname, '../../database/migrations/014_rename_gastos_to_expenses.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // For migrations with DO blocks, execute as a whole
    console.log('Running migration...');
    await query(migrationSQL);

    console.log('✅ Migration 014 completed successfully');
    console.log('   Table "gastos" has been renamed to "expenses"');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration error:', error.message);
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    process.exit(1);
  }
}

runMigration014();

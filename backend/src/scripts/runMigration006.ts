import { query } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  try {
    console.log('Starting migration 006: Reorder clientes columns...');

    const migrationPath = path.join(__dirname, '../../../database/migrations/006_reorder_clients_columns.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await query(sql);

    console.log('✓ Migration 006 completed successfully');
    console.log('✓ Column "direccion" is now positioned after "cif" in clientes table');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

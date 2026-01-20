import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'migestor',
  user: process.env.DB_USER || 'anayusta',
  password: process.env.DB_PASSWORD || '',
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Iniciando migración 011b (fix invoices table)...');

    // Read migration file
    const migrationPath = path.join(__dirname, '../../database/migrations/011b_fix_invoices_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Archivo de migración cargado');

    // Execute migration
    await client.query(migrationSQL);

    console.log('✅ Migración 011b ejecutada correctamente');
    console.log('');
    console.log('Cambios aplicados a tabla invoices:');
    console.log('  - Agregada columna pagada');
    console.log('  - Agregada columna fecha_pago');
    console.log('  - Agregada columna metodo_pago');
    console.log('  - Creado índice idx_invoices_pagado');
    console.log('  - Sincronizados datos existentes');
    console.log('');

  } catch (error: any) {
    console.error('❌ Error ejecutando migración:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('✨ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });

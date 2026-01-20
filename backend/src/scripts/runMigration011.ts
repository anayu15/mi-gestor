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
    console.log('🚀 Iniciando migración 011...');

    // Read migration file
    const migrationPath = path.join(__dirname, '../../database/migrations/011_add_gastos_estado.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Archivo de migración cargado');

    // Execute migration
    await client.query(migrationSQL);

    console.log('✅ Migración 011 ejecutada correctamente');
    console.log('');
    console.log('Cambios aplicados:');
    console.log('  - Agregada columna metodo_pago a gastos');
    console.log('  - Verificada columna fecha_pago en gastos');
    console.log('  - Creado índice idx_gastos_pagado');
    console.log('  - Creado trigger sync_invoice_status()');
    console.log('  - Sincronizados datos existentes en facturas_emitidas');
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

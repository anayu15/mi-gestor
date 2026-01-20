/**
 * Migration 029: Add etiquetas to existing documents
 * 
 * Run with: cd backend && npx ts-node src/scripts/runMigration029.ts
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'migestor',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Migration 029: Add etiquetas to existing documents...\n');
    
    await client.query('BEGIN');
    
    // 1. Update AEAT documents (Hacienda)
    const aeatResult = await client.query(`
      UPDATE documents
      SET etiquetas = ARRAY['Fiscal', 'Hacienda']::text[]
      WHERE tipo_documento = 'AEAT'
        AND (etiquetas IS NULL OR etiquetas = '{}')
      RETURNING id
    `);
    console.log(`✅ Updated ${aeatResult.rowCount} Hacienda (AEAT) documents with ['Fiscal', 'Hacienda']`);
    
    // 2. Update SS documents (Seguridad Social)
    const ssResult = await client.query(`
      UPDATE documents
      SET etiquetas = ARRAY['Fiscal', 'SS']::text[]
      WHERE tipo_documento = 'SS'
        AND (etiquetas IS NULL OR etiquetas = '{}')
      RETURNING id
    `);
    console.log(`✅ Updated ${ssResult.rowCount} Seguridad Social documents with ['Fiscal', 'SS']`);
    
    // 3. Update expense invoices
    const gastosResult = await client.query(`
      UPDATE documents
      SET etiquetas = ARRAY['Facturas', 'Gasto']::text[]
      WHERE categoria = 'FACTURA_GASTO'
        AND (etiquetas IS NULL OR etiquetas = '{}')
      RETURNING id
    `);
    console.log(`✅ Updated ${gastosResult.rowCount} expense documents with ['Facturas', 'Gasto']`);
    
    // 4. Update income invoices
    const ingresosResult = await client.query(`
      UPDATE documents
      SET etiquetas = ARRAY['Facturas', 'Ingreso']::text[]
      WHERE categoria = 'FACTURA_INGRESO'
        AND (etiquetas IS NULL OR etiquetas = '{}')
      RETURNING id
    `);
    console.log(`✅ Updated ${ingresosResult.rowCount} income documents with ['Facturas', 'Ingreso']`);
    
    // 5. Update contracts
    const contratosResult = await client.query(`
      UPDATE documents
      SET etiquetas = ARRAY['Contrato']::text[]
      WHERE categoria = 'CONTRATO'
        AND (etiquetas IS NULL OR etiquetas = '{}')
      RETURNING id
    `);
    console.log(`✅ Updated ${contratosResult.rowCount} contract documents with ['Contrato']`);
    
    await client.query('COMMIT');
    
    // Report final counts
    const statsResult = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE 'Hacienda' = ANY(etiquetas)) as hacienda,
        COUNT(*) FILTER (WHERE 'SS' = ANY(etiquetas)) as ss,
        COUNT(*) FILTER (WHERE 'Gasto' = ANY(etiquetas)) as gastos,
        COUNT(*) FILTER (WHERE 'Ingreso' = ANY(etiquetas)) as ingresos,
        COUNT(*) FILTER (WHERE 'Contrato' = ANY(etiquetas)) as contratos,
        COUNT(*) as total
      FROM documents
      WHERE etiquetas IS NOT NULL AND etiquetas != '{}'
    `);
    
    const stats = statsResult.rows[0];
    console.log('\n📊 Final Statistics:');
    console.log(`   - Total documents with tags: ${stats.total}`);
    console.log(`   - Fiscal (Hacienda): ${stats.hacienda}`);
    console.log(`   - Fiscal (SS): ${stats.ss}`);
    console.log(`   - Gastos: ${stats.gastos}`);
    console.log(`   - Ingresos: ${stats.ingresos}`);
    console.log(`   - Contratos: ${stats.contratos}`);
    
    console.log('\n✅ Migration 029 completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((error) => {
  console.error('Migration error:', error);
  process.exit(1);
});

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'migestor',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('📦 Conectando a la base de datos...');
    console.log(`   Host: ${process.env.DB_HOST}`);
    console.log(`   Database: ${process.env.DB_NAME}`);
    console.log(`   User: ${process.env.DB_USER}`);

    // Leer archivo SQL
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '006_create_documents_tables.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('\n📄 Ejecutando migración 006_create_documents_tables.sql...');

    // Ejecutar migración
    await client.query(sql);

    console.log('\n✅ Migración completada exitosamente!');
    console.log('\n📊 Verificando tablas creadas:');

    // Verificar tablas
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('documents', 'document_versions', 'document_shares', 'document_access_logs')
      ORDER BY table_name
    `);

    console.log('\nTablas creadas:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    // Verificar funciones
    const functionsResult = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name LIKE '%document%' OR routine_name LIKE '%share%'
      ORDER BY routine_name
    `);

    console.log('\nFunciones creadas:');
    functionsResult.rows.forEach(row => {
      console.log(`   ✓ ${row.routine_name}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error al ejecutar migración:', error.message);
    console.error('\nDetalles:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

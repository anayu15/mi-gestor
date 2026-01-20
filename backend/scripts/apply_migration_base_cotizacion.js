const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'migestor',
  user: process.env.DB_USER || 'anayusta',
  password: process.env.DB_PASSWORD || '',
});

async function applyMigration() {
  const client = await pool.connect();

  try {
    console.log('Verificando si la columna base_cotizacion ya existe...');

    // Verificar si la columna ya existe
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name = 'base_cotizacion'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ La columna base_cotizacion ya existe. No es necesario aplicar la migración.');
      return;
    }

    console.log('Aplicando migración 004_add_base_cotizacion.sql...');

    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, '../database/migrations/004_add_base_cotizacion.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Ejecutar la migración
    await client.query(migrationSQL);

    console.log('✅ Migración aplicada exitosamente');

    // Verificar que la columna se creó correctamente
    const verify = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name = 'base_cotizacion'
    `);

    console.log('Columna creada:', verify.rows[0]);

  } catch (error) {
    console.error('❌ Error aplicando migración:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration().catch(console.error);

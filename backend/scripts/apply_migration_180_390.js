/**
 * Script to apply Modelo 180 and 390 migration
 * Run: node backend/scripts/apply_migration_180_390.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'migestor',
  user: process.env.DB_USER || 'anayusta',
  password: process.env.DB_PASSWORD || '',
});

async function checkColumnsExist() {
  const query = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name IN ('mostrar_modelo_180', 'mostrar_modelo_390')
    ORDER BY column_name;
  `;

  const result = await pool.query(query);
  return result.rows;
}

async function applyMigration() {
  console.log('========================================');
  console.log('Aplicando migración Modelos 180 y 390');
  console.log('========================================');
  console.log('');

  try {
    // Check if columns already exist
    console.log('1. Verificando si las columnas ya existen...');
    const existingColumns = await checkColumnsExist();

    if (existingColumns.length === 2) {
      console.log('✅ Las columnas ya existen. No es necesario aplicar la migración.');
      console.log('');
      console.log('Columnas encontradas:');
      existingColumns.forEach(col => console.log(`  - ${col.column_name}`));

      // Show current values
      const values = await pool.query(`
        SELECT email, mostrar_modelo_180, mostrar_modelo_390
        FROM users
        LIMIT 5
      `);
      console.log('');
      console.log('Valores actuales:');
      console.table(values.rows);

      await pool.end();
      return;
    }

    console.log('⚠️  Las columnas no existen. Aplicando migración...');
    console.log('');

    // Read migration file
    const migrationPath = path.join(__dirname, '../../database/migrations/003_add_modelo_180_390_preferences.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    console.log('2. Ejecutando migración...');
    await pool.query(migrationSQL);

    console.log('✅ Migración aplicada correctamente');
    console.log('');

    // Verify changes
    console.log('3. Verificando cambios...');
    const columns = await checkColumnsExist();
    console.log(`Columnas creadas: ${columns.length}/2`);
    columns.forEach(col => console.log(`  - ${col.column_name}`));

    const values = await pool.query(`
      SELECT email, mostrar_modelo_180, mostrar_modelo_390
      FROM users
      LIMIT 5
    `);
    console.log('');
    console.log('Valores actuales:');
    console.table(values.rows);

    console.log('');
    console.log('========================================');
    console.log('✅ TODO LISTO');
    console.log('========================================');
    console.log('Ahora puedes:');
    console.log('1. Reiniciar el backend (si está corriendo)');
    console.log('2. Ir a Configuración en la app');
    console.log('3. Activar Modelos 180 y 390');
    console.log('4. Guardar cambios');

  } catch (error) {
    console.error('');
    console.error('❌ Error al aplicar la migración:');
    console.error(error.message);
    console.error('');
    console.error('Detalles completos:');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
applyMigration().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});

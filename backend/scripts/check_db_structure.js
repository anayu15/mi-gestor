const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'migestor',
  user: process.env.DB_USER || 'anayusta',
  password: process.env.DB_PASSWORD || '',
});

async function checkStructure() {
  const client = await pool.connect();

  try {
    console.log('\n📊 Verificando estructura de tabla usuarios...\n');

    // Get all columns from usuarios table
    const result = await client.query(`
      SELECT
        column_name,
        data_type,
        column_default,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'usuarios'
      ORDER BY ordinal_position
    `);

    console.log('Columnas encontradas en tabla "usuarios":');
    console.log('='.repeat(80));
    result.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(30)} | ${row.data_type.padEnd(20)} | ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    console.log('\n');
    console.log('Columnas esperadas por el código:');
    console.log('='.repeat(80));
    const expectedColumns = [
      'id',
      'email',
      'password_hash',
      'nombre_comercial',
      'nif',
      'es_trade',
      'actividad_economica',
      'mostrar_modelo_303',
      'mostrar_modelo_130',
      'mostrar_modelo_115',
      'mostrar_modelo_180',
      'mostrar_modelo_390',
      'tiene_tarifa_plana_ss',
      'base_cotizacion',
      'timezone',
      'idioma',
      'created_at',
      'updated_at'
    ];

    const existingColumns = result.rows.map(r => r.column_name);
    const missingColumns = expectedColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      console.log('\n⚠️  COLUMNAS FALTANTES:');
      missingColumns.forEach(col => console.log(`  - ${col}`));
    } else {
      console.log('\n✅ Todas las columnas esperadas existen');
    }

    // Check for users table (alternative name)
    console.log('\n📊 Verificando si existe tabla "users"...\n');
    const usersCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'users'
      ) as exists
    `);

    if (usersCheck.rows[0].exists) {
      console.log('✅ Tabla "users" encontrada');
      const usersResult = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);
      console.log('Columnas en "users":');
      usersResult.rows.forEach(row => console.log(`  - ${row.column_name}`));
    } else {
      console.log('⚠️  Tabla "users" NO encontrada');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkStructure().catch(console.error);

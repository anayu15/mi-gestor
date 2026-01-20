import { query } from '../config/database';

async function checkColumns() {
  try {
    console.log('Verificando columnas de la tabla usuarios...\n');

    const result = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'usuarios'
      ORDER BY ordinal_position;
    `);

    console.log('Columnas encontradas:');
    result.rows.forEach((col: any) => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    process.exit(0);
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkColumns();

import { query } from '../config/database';

async function runMigration() {
  try {
    console.log('Adding NIF column to datos_facturacion table...\n');

    // Check if column already exists
    const checkColumn = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'datos_facturacion' AND column_name = 'nif'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('Column NIF already exists. Skipping migration.\n');
      process.exit(0);
    }

    // Add NIF column
    console.log('1. Adding NIF column...');
    await query(`
      ALTER TABLE datos_facturacion
      ADD COLUMN nif VARCHAR(9) NOT NULL DEFAULT ''
    `);
    console.log('Column added\n');

    // Remove default after column creation (for new rows to require NIF)
    console.log('2. Removing default value...');
    await query(`
      ALTER TABLE datos_facturacion
      ALTER COLUMN nif DROP DEFAULT
    `);
    console.log('Default removed\n');

    // Add comment
    console.log('3. Adding column comment...');
    await query(`
      COMMENT ON COLUMN datos_facturacion.nif IS 'NIF/CIF - Tax identification number (required)'
    `);
    console.log('Comment added\n');

    console.log('Migration completed successfully\n');

    // Verify column exists
    const result = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'datos_facturacion' AND column_name = 'nif'
    `);

    console.log('Column verification:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error in migration:', error);
    process.exit(1);
  }
}

runMigration();

import { getClient } from '../config/database';
import fs from 'fs';
import path from 'path';

/**
 * Migration 019: Drop metodo_pago column from facturas_emitidas
 * Removes the payment method field as it's no longer needed
 */
async function runMigration() {
  const client = await getClient();

  try {
    console.log('🚀 Starting migration 019: Drop metodo_pago column...\n');

    // Read migration SQL file
    const sqlPath = path.join(__dirname, '../../database/migrations/019_drop_metodo_pago_column.sql');

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found: ${sqlPath}`);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('📄 Migration file loaded successfully');
    console.log('📝 Executing SQL...\n');

    // Execute migration
    await client.query(sql);

    console.log('\n✅ Migration 019 completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  - Dropped metodo_pago column from facturas_emitidas table');
    console.log('\n🎉 Payment method field has been removed!');

    // Verify the column was dropped
    console.log('\n🔍 Verifying column removal...');
    const verifyResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'facturas_emitidas'
      AND column_name = 'metodo_pago'
    `);

    if (verifyResult.rows.length === 0) {
      console.log('✅ Column successfully removed');
    } else {
      console.warn('⚠️  Warning: Column still exists (may need manual check)');
    }

  } catch (error: any) {
    console.error('\n❌ Migration 019 failed!');
    console.error('Error:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('\n👋 Migration process complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration process failed:', error.message);
    process.exit(1);
  });

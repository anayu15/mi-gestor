import { getClient } from '../config/database';
import fs from 'fs';
import path from 'path';

/**
 * Migration 013: Fix invoice numero_factura UNIQUE constraint
 * Changes global UNIQUE constraint to user-scoped UNIQUE(user_id, numero_factura)
 * This fixes the "duplicate key value violates unique constraint" error
 */
async function runMigration() {
  const client = await getClient();

  try {
    console.log('🚀 Starting migration 013: Fix invoice numero constraint...\n');

    // Read migration SQL file
    const sqlPath = path.join(__dirname, '../../database/migrations/013_fix_invoice_numero_constraint.sql');

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found: ${sqlPath}`);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('📄 Migration file loaded successfully');
    console.log('📝 Executing SQL...\n');

    // Execute migration
    await client.query(sql);

    console.log('\n✅ Migration 013 completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  - Dropped global UNIQUE constraint on numero_factura');
    console.log('  - Added user-scoped UNIQUE constraint (user_id, numero_factura)');
    console.log('  - Created performance index (user_id, serie, numero_factura)');
    console.log('\n🎉 Invoice creation should now work without duplicate key errors!');

    // Verify the constraint was created
    console.log('\n🔍 Verifying constraint...');
    const verifyResult = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'facturas_emitidas'::regclass
      AND conname LIKE '%numero%'
    `);

    if (verifyResult.rows.length > 0) {
      console.log('✅ Constraint verified:');
      verifyResult.rows.forEach(row => {
        console.log(`   - ${row.conname}: ${row.definition}`);
      });
    } else {
      console.warn('⚠️  Warning: Could not verify constraint (may need manual check)');
    }

  } catch (error: any) {
    console.error('\n❌ Migration 013 failed!');
    console.error('Error:', error.message);

    if (error.message?.includes('Duplicate invoice numbers')) {
      console.error('\n🔧 Action Required:');
      console.error('   Duplicate invoice numbers exist for the same user.');
      console.error('   Run this query to find duplicates:');
      console.error('   SELECT user_id, numero_factura, COUNT(*) FROM facturas_emitidas');
      console.error('   GROUP BY user_id, numero_factura HAVING COUNT(*) > 1');
    }

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

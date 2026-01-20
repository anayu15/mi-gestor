import { query } from '../config/database';

async function runMigration() {
  try {
    console.log('🔧 Fixing facturas_emitidas foreign key constraint...\n');
    console.log('Issue: user_id FK references wrong table (usuarios instead of users)\n');

    // Step 1: Check current column type and FK reference
    console.log('1. Checking current state...');
    
    const colCheck = await query(`
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_name = 'facturas_emitidas' AND column_name = 'user_id';
    `);
    
    const usersIdCheck = await query(`
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'id';
    `);
    
    const feType = colCheck.rows[0]?.udt_name || 'missing';
    const usersType = usersIdCheck.rows[0]?.udt_name || 'missing';
    
    console.log(`   facturas_emitidas.user_id: ${feType}`);
    console.log(`   users.id: ${usersType}`);
    
    // Check current FK constraint
    const fkCheck = await query(`
      SELECT tc.constraint_name, ccu.table_name AS foreign_table
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'facturas_emitidas'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name LIKE '%user_id%';
    `);
    
    if (fkCheck.rows.length > 0) {
      console.log(`   Current FK: ${fkCheck.rows[0].constraint_name} → ${fkCheck.rows[0].foreign_table}`);
      
      if (fkCheck.rows[0].foreign_table === 'users' && feType === usersType) {
        console.log('\n✅ FK constraint already correct! No migration needed.\n');
        process.exit(0);
      }
    } else {
      console.log('   Current FK: (none found)');
    }
    
    // Check if types match
    if (feType !== usersType) {
      console.log(`\n⚠️ Type mismatch! facturas_emitidas.user_id is ${feType} but users.id is ${usersType}`);
      console.log('   Will need to change column type.\n');
      
      // Step 2: Drop existing FK constraint if any
      console.log('2. Dropping existing constraints and indexes...');
      await query('ALTER TABLE facturas_emitidas DROP CONSTRAINT IF EXISTS facturas_emitidas_user_id_fkey');
      await query('DROP INDEX IF EXISTS idx_facturas_user');
      await query('DROP INDEX IF EXISTS idx_facturas_user_serie_numero');
      console.log('   ✓ Dropped\n');
      
      // Step 3: Check for existing data
      const dataCheck = await query('SELECT COUNT(*) as count FROM facturas_emitidas');
      const recordCount = parseInt(dataCheck.rows[0].count);
      console.log(`3. Found ${recordCount} existing records.`);
      
      if (recordCount > 0) {
        console.log('   Clearing table for type change...');
        await query('DELETE FROM facturas_emitidas');
        console.log('   ✓ Table cleared\n');
      }
      
      // Step 4: Drop and recreate user_id column with correct type
      console.log(`4. Changing user_id column type from ${feType} to ${usersType}...`);
      await query('ALTER TABLE facturas_emitidas DROP COLUMN user_id');
      await query(`ALTER TABLE facturas_emitidas ADD COLUMN user_id ${usersType === 'int4' ? 'INTEGER' : 'UUID'} NOT NULL`);
      console.log('   ✓ Column type changed\n');
      
      // Step 5: Add FK constraint
      console.log('5. Adding FK constraint to users(id)...');
      await query(`
        ALTER TABLE facturas_emitidas 
        ADD CONSTRAINT facturas_emitidas_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      `);
      console.log('   ✓ FK constraint added\n');
      
      // Step 6: Recreate indexes
      console.log('6. Recreating indexes...');
      await query('CREATE INDEX IF NOT EXISTS idx_facturas_user ON facturas_emitidas(user_id)');
      await query('CREATE INDEX IF NOT EXISTS idx_facturas_user_serie_numero ON facturas_emitidas(user_id, serie, numero_factura)');
      console.log('   ✓ Indexes created\n');
      
    } else {
      // Types match, just fix the FK constraint
      console.log('\n✅ Column types match. Just fixing FK constraint...\n');
      
      // Step 2: Drop wrong FK and add correct one
      console.log('2. Dropping existing constraints...');
      await query('ALTER TABLE facturas_emitidas DROP CONSTRAINT IF EXISTS facturas_emitidas_user_id_fkey');
      console.log('   ✓ Dropped\n');
      
      // Step 3: Clear any orphaned data
      console.log('3. Cleaning up orphaned data...');
      const cleanupResult = await query(`
        DELETE FROM facturas_emitidas 
        WHERE user_id IS NOT NULL 
          AND user_id NOT IN (SELECT id FROM users)
      `);
      console.log(`   ✓ Removed ${cleanupResult.rowCount || 0} orphaned records\n`);
      
      // Step 4: Add correct FK constraint
      console.log('4. Adding FK constraint to users(id)...');
      await query(`
        ALTER TABLE facturas_emitidas 
        ADD CONSTRAINT facturas_emitidas_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      `);
      console.log('   ✓ FK constraint added\n');
      
      // Step 5: Ensure indexes exist
      console.log('5. Ensuring indexes exist...');
      await query('CREATE INDEX IF NOT EXISTS idx_facturas_user ON facturas_emitidas(user_id)');
      await query('CREATE INDEX IF NOT EXISTS idx_facturas_user_serie_numero ON facturas_emitidas(user_id, serie, numero_factura)');
      console.log('   ✓ Indexes verified\n');
    }

    // Verify final state
    console.log('📋 Final verification:');
    const finalColCheck = await query(`
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_name = 'facturas_emitidas' AND column_name = 'user_id';
    `);
    console.log(`   user_id type: ${finalColCheck.rows[0]?.udt_name}`);
    
    const finalFkCheck = await query(`
      SELECT tc.constraint_name, ccu.table_name AS foreign_table
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'facturas_emitidas'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name LIKE '%user_id%';
    `);
    
    if (finalFkCheck.rows.length > 0) {
      console.log(`   FK: ${finalFkCheck.rows[0].constraint_name} → ${finalFkCheck.rows[0].foreign_table}`);
    }

    console.log('\n🎉 Migration completed successfully!\n');
    console.log('You can now create invoices (facturas emitidas).\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error in migration:', error);
    process.exit(1);
  }
}

runMigration();

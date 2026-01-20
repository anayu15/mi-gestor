import { query } from '../config/database';

async function runMigration() {
  try {
    console.log('🔧 Fixing datos_facturacion foreign key constraint...\n');
    console.log('Issue: user_id column type and FK reference need to match users table\n');

    // Step 1: Check current column type
    console.log('1. Checking current user_id column type...');
    const colCheck = await query(`
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_name = 'datos_facturacion' AND column_name = 'user_id';
    `);
    
    const usersIdCheck = await query(`
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'id';
    `);
    
    const dfType = colCheck.rows[0]?.udt_name || 'missing';
    const usersType = usersIdCheck.rows[0]?.udt_name || 'missing';
    
    console.log(`   datos_facturacion.user_id: ${dfType}`);
    console.log(`   users.id: ${usersType}`);
    
    // If types don't match, we need to fix
    if (dfType !== usersType) {
      console.log(`\n⚠️ Type mismatch! datos_facturacion.user_id is ${dfType} but users.id is ${usersType}\n`);
      
      // Step 2: Drop existing FK constraint if any
      console.log('2. Dropping existing constraints and indexes...');
      await query('ALTER TABLE datos_facturacion DROP CONSTRAINT IF EXISTS datos_facturacion_user_id_fkey');
      await query('DROP INDEX IF EXISTS idx_datos_facturacion_user');
      await query('DROP INDEX IF EXISTS idx_datos_facturacion_activo');
      await query('DROP INDEX IF EXISTS idx_datos_facturacion_principal');
      console.log('   ✓ Dropped\n');
      
      // Step 3: Check for existing data
      const dataCheck = await query('SELECT COUNT(*) as count FROM datos_facturacion');
      const recordCount = parseInt(dataCheck.rows[0].count);
      console.log(`3. Found ${recordCount} existing records. Clearing table for type change...`);
      await query('DELETE FROM datos_facturacion');
      console.log('   ✓ Table cleared\n');
      
      // Step 4: Drop and recreate user_id column with correct type
      console.log('4. Changing user_id column type to INTEGER...');
      await query('ALTER TABLE datos_facturacion DROP COLUMN user_id');
      await query('ALTER TABLE datos_facturacion ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0');
      // Remove default after adding
      await query('ALTER TABLE datos_facturacion ALTER COLUMN user_id DROP DEFAULT');
      console.log('   ✓ Column type changed\n');
      
      // Step 5: Add FK constraint
      console.log('5. Adding FK constraint to users(id)...');
      await query(`
        ALTER TABLE datos_facturacion 
        ADD CONSTRAINT datos_facturacion_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      `);
      console.log('   ✓ FK constraint added\n');
      
      // Step 6: Recreate indexes
      console.log('6. Recreating indexes...');
      await query('CREATE INDEX idx_datos_facturacion_user ON datos_facturacion(user_id)');
      await query('CREATE INDEX idx_datos_facturacion_activo ON datos_facturacion(user_id, activo) WHERE activo = true');
      await query('CREATE UNIQUE INDEX idx_datos_facturacion_principal ON datos_facturacion(user_id) WHERE es_principal = true');
      console.log('   ✓ Indexes created\n');
      
    } else {
      console.log('\n✅ Column types match. Checking FK constraint...\n');
      
      // Check if FK exists
      const fkCheck = await query(`
        SELECT tc.constraint_name, ccu.table_name AS foreign_table
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'datos_facturacion'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND tc.constraint_name LIKE '%user_id%';
      `);
      
      if (fkCheck.rows.length > 0 && fkCheck.rows[0].foreign_table === 'users') {
        console.log(`✅ FK constraint already correct: → users`);
        console.log('\n🎉 No migration needed!\n');
        process.exit(0);
      }
      
      // Drop wrong FK and add correct one
      console.log('Fixing FK constraint...');
      await query('ALTER TABLE datos_facturacion DROP CONSTRAINT IF EXISTS datos_facturacion_user_id_fkey');
      await query(`
        ALTER TABLE datos_facturacion 
        ADD CONSTRAINT datos_facturacion_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      `);
      console.log('   ✓ FK constraint fixed\n');
    }

    // Verify final state
    console.log('📋 Final verification:');
    const finalColCheck = await query(`
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_name = 'datos_facturacion' AND column_name = 'user_id';
    `);
    console.log(`   user_id type: ${finalColCheck.rows[0]?.udt_name}`);
    
    const finalFkCheck = await query(`
      SELECT tc.constraint_name, ccu.table_name AS foreign_table
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'datos_facturacion'
        AND tc.constraint_type = 'FOREIGN KEY';
    `);
    
    finalFkCheck.rows.forEach(row => {
      console.log(`   FK: ${row.constraint_name} → ${row.foreign_table}`);
    });

    console.log('\n🎉 Migration completed successfully!\n');
    console.log('You can now create billing configurations (datos de facturación).\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error in migration:', error);
    process.exit(1);
  }
}

runMigration();

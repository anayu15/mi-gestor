import { query } from '../config/database';

// Helper function to fix a single table's FK constraint
async function fixTableFK(
  tableName: string,
  constraintName: string,
  columnName: string = 'user_id'
): Promise<boolean> {
  try {
    // Check if table exists
    const tableCheck = await query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)
    `, [tableName]);
    
    if (!tableCheck.rows[0].exists) {
      console.log(`   ⚠️ ${tableName} table no existe, saltando...\n`);
      return false;
    }
    
    // Drop existing constraint
    await query(`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${constraintName}`);
    
    // Delete orphaned records
    await query(`DELETE FROM ${tableName} WHERE ${columnName} NOT IN (SELECT id FROM users)`);
    
    // Add correct constraint
    await query(`ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} 
      FOREIGN KEY (${columnName}) REFERENCES users(id) ON DELETE CASCADE`);
    
    console.log(`   ✅ ${tableName} FK corregido\n`);
    return true;
  } catch (err: any) {
    console.log(`   ⚠️ ${tableName}: ${err.message}\n`);
    return false;
  }
}

async function runMigration033() {
  try {
    console.log('🔄 Ejecutando migración 033: Corrigiendo foreign keys de usuarios a users...\n');

    // 1. FIX modelo_036_analysis TABLE
    console.log('1. Corrigiendo modelo_036_analysis...');
    await fixTableFK('modelo_036_analysis', 'modelo_036_analysis_user_id_fkey');

    // 2. FIX alta_ss_analysis TABLE  
    console.log('2. Corrigiendo alta_ss_analysis...');
    await fixTableFK('alta_ss_analysis', 'alta_ss_analysis_user_id_fkey');

    // 3. FIX fiscal_obligation_documents TABLE
    console.log('3. Corrigiendo fiscal_obligation_documents...');
    await fixTableFK('fiscal_obligation_documents', 'fiscal_obligation_documents_user_id_fkey');

    // 4. FIX documents TABLE
    console.log('4. Corrigiendo documents...');
    await fixTableFK('documents', 'documents_user_id_fkey');

    // 5. FIX ai_document_suggestions TABLE
    console.log('5. Corrigiendo ai_document_suggestions...');
    await fixTableFK('ai_document_suggestions', 'ai_document_suggestions_user_id_fkey');

    // 6. FIX alta_autonomo_progress TABLE
    console.log('6. Corrigiendo alta_autonomo_progress...');
    await fixTableFK('alta_autonomo_progress', 'alta_autonomo_progress_user_id_fkey');

    // 7. FIX document_versions TABLE
    console.log('7. Corrigiendo document_versions...');
    await fixTableFK('document_versions', 'document_versions_creado_por_user_id_fkey', 'creado_por_user_id');

    // 8. FIX document_shares TABLE
    console.log('8. Corrigiendo document_shares...');
    await fixTableFK('document_shares', 'document_shares_user_id_fkey');

    console.log('✅ Migración 033 completada exitosamente\n');

    // Verify constraints
    console.log('📋 Verificando constraints...');
    const constraints = await query(`
      SELECT tc.table_name, tc.constraint_name, ccu.table_name AS foreign_table
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name IN ('modelo_036_analysis', 'alta_ss_analysis', 'documents', 'fiscal_obligation_documents')
        AND tc.constraint_name LIKE '%user_id_fkey%'
      ORDER BY tc.table_name
    `);
    
    constraints.rows.forEach((row: any) => {
      const status = row.foreign_table === 'users' ? '✓' : '✗';
      console.log(`  ${status} ${row.table_name} -> ${row.foreign_table} (${row.constraint_name})`);
    });

    console.log('\n🎉 Todos los FK ahora apuntan a users(id)');
    console.log('   Puedes volver a intentar subir el documento "Alta en Hacienda"');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error ejecutando migración:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration033();

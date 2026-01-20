/**
 * Script to run migration 034: Modelo 036 Document Types
 * Adds columns for distinguishing between ALTA and MODIFICACION documents
 */

import { query } from '../config/database';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  console.log('🚀 Running migration 034: Modelo 036 Document Types...');
  
  try {
    const migrationPath = path.join(__dirname, '../../database/migrations/034_modelo_036_document_types.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await query(migrationSQL);
    
    console.log('✅ Migration 034 completed successfully!');
    console.log('   - Added tipo_documento_036 column');
    console.log('   - Added parent_analysis_id column');
    console.log('   - Added is_active column');
    console.log('   - Added campos_modificados column');
    console.log('   - Added fecha_efectos column');
    
    process.exit(0);
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('ℹ️  Migration 034 already applied (columns exist)');
      process.exit(0);
    }
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();

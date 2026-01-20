import { query } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  try {
    console.log('🔄 Ejecutando migración de preferencias de modelos...\n');

    // Execute ALTER TABLE to add columns
    console.log('1. Agregando columnas...');
    await query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS mostrar_modelo_303 BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS mostrar_modelo_130 BOOLEAN DEFAULT true;
    `);
    console.log('✅ Columnas agregadas\n');

    // Add comments
    console.log('2. Agregando comentarios...');
    await query(`
      COMMENT ON COLUMN users.mostrar_modelo_303 IS 'Controls visibility of Modelo 303 (VAT) in navigation and direct access';
    `);
    await query(`
      COMMENT ON COLUMN users.mostrar_modelo_130 IS 'Controls visibility of Modelo 130 (IRPF) in navigation and direct access';
    `);
    console.log('✅ Comentarios agregados\n');

    // Create index
    console.log('3. Creando índice...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_model_visibility ON users(mostrar_modelo_303, mostrar_modelo_130);
    `);
    console.log('✅ Índice creado\n');

    console.log('✅ Migración completada exitosamente\n');

    // Verify columns exist
    const result = await query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('mostrar_modelo_303', 'mostrar_modelo_130')
      ORDER BY column_name;
    `);

    console.log('📋 Columnas verificadas:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name} (${row.data_type}, default: ${row.column_default})`);
    });

    // Check existing users
    const userCount = await query(`SELECT COUNT(*) FROM usuarios`);
    console.log(`\n👥 Usuarios existentes: ${userCount.rows[0].count}`);
    console.log('   (Todos tendrán ambos modelos habilitados por defecto)\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error ejecutando migración:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

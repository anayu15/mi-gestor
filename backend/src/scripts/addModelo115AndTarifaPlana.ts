import { query } from '../config/database';

async function addNewPreferences() {
  try {
    console.log('🔄 Agregando preferencias de Modelo 115 y Tarifa Plana SS...\n');

    // Execute ALTER TABLE to add columns
    console.log('1. Agregando columnas...');
    await query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS mostrar_modelo_115 BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS tiene_tarifa_plana_ss BOOLEAN DEFAULT false;
    `);
    console.log('✅ Columnas agregadas\n');

    // Add comments
    console.log('2. Agregando comentarios...');
    await query(`
      COMMENT ON COLUMN users.mostrar_modelo_115 IS 'Controls visibility of Modelo 115 (IRPF rent withholdings) - 19% retention on rental payments';
    `);
    await query(`
      COMMENT ON COLUMN users.tiene_tarifa_plana_ss IS 'Indicates if user has flat-rate Social Security (80€/month for first 12 months)';
    `);
    console.log('✅ Comentarios agregados\n');

    console.log('✅ Migración completada exitosamente\n');

    // Verify columns exist
    const result = await query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('mostrar_modelo_115', 'tiene_tarifa_plana_ss')
      ORDER BY column_name;
    `);

    console.log('📋 Columnas verificadas:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name} (${row.data_type}, default: ${row.column_default})`);
    });

    // Check existing users
    const userCount = await query(`SELECT COUNT(*) FROM usuarios`);
    console.log(`\n👥 Usuarios existentes: ${userCount.rows[0].count}`);
    console.log('   - Modelo 115: Desactivado por defecto (no todos alquilan locales)');
    console.log('   - Tarifa Plana SS: Desactivada por defecto (depende de cada caso)\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error ejecutando migración:', error.message);
    console.error(error);
    process.exit(1);
  }
}

addNewPreferences();

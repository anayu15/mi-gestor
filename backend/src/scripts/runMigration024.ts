import { query } from '../config/database';

async function runMigration() {
  console.log('Running migration 024: Add extended fiscal preferences...');

  try {
    // Add columns one by one
    const alterStatements = [
      // IVA Section Extensions
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS mostrar_modelo_349 BOOLEAN DEFAULT false",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS mostrar_sii BOOLEAN DEFAULT false",
      // IRPF Section Extensions
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS mostrar_modelo_131 BOOLEAN DEFAULT false",
      // Retenciones Section Extensions
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS mostrar_modelo_111 BOOLEAN DEFAULT false",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS mostrar_modelo_190 BOOLEAN DEFAULT false",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS mostrar_modelo_123 BOOLEAN DEFAULT false",
      // Declaraciones Informativas Section
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS mostrar_modelo_347 BOOLEAN DEFAULT false",
      // Registros Censales Section
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS mostrar_vies_roi BOOLEAN DEFAULT false",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS mostrar_redeme BOOLEAN DEFAULT false",
      // User situation flags
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS tiene_empleados BOOLEAN DEFAULT false",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS tiene_operaciones_ue BOOLEAN DEFAULT false",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS usa_modulos BOOLEAN DEFAULT false",
    ];

    for (const statement of alterStatements) {
      try {
        await query(statement);
        console.log('  + Added column successfully');
      } catch (err: any) {
        if (err.message.includes('already exists')) {
          console.log('  - Column already exists, skipping...');
        } else {
          throw err;
        }
      }
    }

    // Drop old index if exists
    try {
      await query('DROP INDEX IF EXISTS idx_users_model_visibility');
      console.log('  - Dropped old index');
    } catch (err) {
      console.log('  - Index did not exist');
    }

    // Create new index
    try {
      await query(`
        CREATE INDEX idx_users_model_visibility ON users(
          mostrar_modelo_303, mostrar_modelo_130, mostrar_modelo_115,
          mostrar_modelo_180, mostrar_modelo_390, mostrar_modelo_349,
          mostrar_modelo_131, mostrar_modelo_111, mostrar_modelo_190,
          mostrar_modelo_123, mostrar_modelo_347
        )
      `);
      console.log('  + Created new index');
    } catch (err: any) {
      if (err.message.includes('already exists')) {
        console.log('  - Index already exists');
      } else {
        console.log('  ! Warning creating index:', err.message);
      }
    }

    // Add comments
    const comments = [
      "COMMENT ON COLUMN users.mostrar_modelo_349 IS 'Modelo 349 - Operaciones Intracomunitarias'",
      "COMMENT ON COLUMN users.mostrar_sii IS 'SII - Suministro Inmediato de Informacion'",
      "COMMENT ON COLUMN users.mostrar_modelo_131 IS 'Modelo 131 - IRPF Estimacion Objetiva (modulos)'",
      "COMMENT ON COLUMN users.mostrar_modelo_111 IS 'Modelo 111 - Retenciones trabajadores/profesionales'",
      "COMMENT ON COLUMN users.mostrar_modelo_190 IS 'Modelo 190 - Resumen anual de retenciones (111)'",
      "COMMENT ON COLUMN users.mostrar_modelo_123 IS 'Modelo 123 - Retenciones capital mobiliario'",
      "COMMENT ON COLUMN users.mostrar_modelo_347 IS 'Modelo 347 - Operaciones con terceros >3.005,06 EUR'",
      "COMMENT ON COLUMN users.mostrar_vies_roi IS 'VIES/ROI - Registro Operadores Intracomunitarios'",
      "COMMENT ON COLUMN users.mostrar_redeme IS 'REDEME - Registro Devolucion Mensual IVA'",
      "COMMENT ON COLUMN users.tiene_empleados IS 'Indica si tiene empleados o contrata profesionales'",
      "COMMENT ON COLUMN users.tiene_operaciones_ue IS 'Indica si realiza operaciones intracomunitarias'",
      "COMMENT ON COLUMN users.usa_modulos IS 'Indica si tributa por estimacion objetiva (modulos)'",
    ];

    for (const comment of comments) {
      try {
        await query(comment);
      } catch (err) {
        // Ignore comment errors
      }
    }
    console.log('  + Added column comments');

    console.log('\nMigration 024 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

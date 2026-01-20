import { query } from '../config/database';

async function runOCRMigration() {
  try {
    console.log('🔄 Ejecutando migración de campos OCR (faltantes)...');

    // Add missing columns one by one
    const migrations = [
      'ALTER TABLE gastos ADD COLUMN IF NOT EXISTS descripcion TEXT',
      'ALTER TABLE gastos ADD COLUMN IF NOT EXISTS numero_factura VARCHAR(100)',
      'ALTER TABLE gastos ADD COLUMN IF NOT EXISTS porcentaje_deducible DECIMAL(5,2) DEFAULT 100.00',
      'ALTER TABLE gastos ADD COLUMN IF NOT EXISTS notas_riesgo TEXT',
      'ALTER TABLE gastos ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT \'PENDIENTE\'',
      'ALTER TABLE gastos ADD COLUMN IF NOT EXISTS ocr_procesado BOOLEAN DEFAULT false',
      'ALTER TABLE gastos ADD COLUMN IF NOT EXISTS archivo_url VARCHAR(500)',

      // Create indexes
      'CREATE INDEX IF NOT EXISTS idx_gastos_ocr_procesado ON gastos(ocr_procesado)',
      'CREATE INDEX IF NOT EXISTS idx_gastos_estado ON gastos(estado)',
      'CREATE INDEX IF NOT EXISTS idx_gastos_user_ocr ON gastos(user_id, ocr_procesado)',
      'CREATE INDEX IF NOT EXISTS idx_gastos_numero_factura ON gastos(numero_factura)',
      'CREATE INDEX IF NOT EXISTS idx_gastos_ocr_datos ON gastos USING GIN (ocr_datos_extraidos)',
    ];

    for (const migration of migrations) {
      try {
        console.log('Ejecutando:', migration.substring(0, 60) + '...');
        await query(migration);
        console.log('✅ OK');
      } catch (error: any) {
        console.log('⚠️  Ya existe o error:', error.message);
      }
    }

    console.log('✅ Migración completada exitosamente');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error en la migración:', error.message);
    process.exit(1);
  }
}

runOCRMigration();

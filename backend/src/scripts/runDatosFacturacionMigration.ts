import { query } from '../config/database';

async function runMigration() {
  try {
    console.log('Ejecutando migracion de datos_facturacion...\n');

    // Create table
    console.log('1. Creando tabla datos_facturacion...');
    await query(`
      CREATE TABLE IF NOT EXISTS datos_facturacion (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        -- Identificador (nombre o razon social)
        razon_social VARCHAR(255) NOT NULL,

        -- Direccion
        direccion TEXT,
        codigo_postal VARCHAR(10),
        ciudad VARCHAR(100),
        provincia VARCHAR(100),

        -- Contacto
        telefono VARCHAR(20),
        email_facturacion VARCHAR(255),

        -- Datos bancarios
        iban VARCHAR(34),

        -- Branding
        logo_url TEXT,

        -- Notas para facturas
        notas_factura TEXT,

        -- Estado (solo uno activo por usuario)
        activo BOOLEAN DEFAULT false,

        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Tabla creada\n');

    // Create indexes
    console.log('2. Creando indices...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_datos_facturacion_user ON datos_facturacion(user_id);
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_datos_facturacion_activo ON datos_facturacion(user_id, activo) WHERE activo = true;
    `);
    console.log('Indices creados\n');

    // Add comments
    console.log('3. Agregando comentarios...');
    await query(`
      COMMENT ON TABLE datos_facturacion IS 'Multiple billing configurations per user for invoice generation';
    `);
    await query(`
      COMMENT ON COLUMN datos_facturacion.razon_social IS 'Business name or personal name for this billing config';
    `);
    await query(`
      COMMENT ON COLUMN datos_facturacion.activo IS 'Only one config can be active per user at a time';
    `);
    console.log('Comentarios agregados\n');

    console.log('Migracion completada exitosamente\n');

    // Verify table exists
    const result = await query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'datos_facturacion'
      ORDER BY ordinal_position;
    `);

    console.log('Columnas verificadas:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}${row.column_default ? ', default: ' + row.column_default : ''})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error en migracion:', error);
    process.exit(1);
  }
}

runMigration();

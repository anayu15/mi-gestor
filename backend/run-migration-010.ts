import { query, pool } from './src/config/database';

async function runMigration() {
  try {
    console.log('Running migration 010: Add missing invoice columns...');

    // Execute ALTER TABLE statements first
    const alterStatements = [
      {
        name: 'fecha_vencimiento',
        sql: 'ALTER TABLE facturas_emitidas ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE'
      },
      {
        name: 'descripcion_detallada',
        sql: 'ALTER TABLE facturas_emitidas ADD COLUMN IF NOT EXISTS descripcion_detallada TEXT'
      },
      {
        name: 'pagada',
        sql: 'ALTER TABLE facturas_emitidas ADD COLUMN IF NOT EXISTS pagada BOOLEAN DEFAULT false'
      },
      {
        name: 'pdf_generado',
        sql: 'ALTER TABLE facturas_emitidas ADD COLUMN IF NOT EXISTS pdf_generado BOOLEAN DEFAULT false'
      }
    ];

    for (const stmt of alterStatements) {
      console.log(`Adding column: ${stmt.name}...`);
      await query(stmt.sql);
      console.log(`✓ ${stmt.name} added`);
    }

    console.log('\n✅ Migration 010 completed successfully!');

    // Verify the columns were added
    const result = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'facturas_emitidas'
      AND column_name IN ('fecha_vencimiento', 'descripcion_detallada', 'pagada', 'pdf_generado')
      ORDER BY column_name;
    `);

    console.log('\nColumns in facturas_emitidas:');
    console.table(result.rows);

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message || error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();

import { query } from '../config/database';

async function checkUsers() {
  try {
    console.log('🔍 Verificando usuarios en la base de datos...\n');

    // Check usuarios table structure
    const schemaResult = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'usuarios'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Estructura de la tabla usuarios:');
    schemaResult.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}${col.column_default ? ' DEFAULT ' + col.column_default : ''}`);
    });

    // Check if any users exist
    const usersResult = await query(`
      SELECT id, email, nombre_comercial
      FROM usuarios
      LIMIT 5;
    `);

    console.log('\n👥 Usuarios en la base de datos:');
    if (usersResult.rows.length === 0) {
      console.log('  ⚠️  No hay usuarios registrados');
    } else {
      usersResult.rows.forEach(user => {
        console.log(`  - ID: ${user.id} (${typeof user.id}), Email: ${user.email}, Nombre: ${user.nombre_comercial}`);
      });
    }

    // Check recurring_invoice_templates foreign key
    const fkResult = await query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name='recurring_invoice_templates'
        AND kcu.column_name='user_id';
    `);

    console.log('\n🔗 Foreign key de user_id en recurring_invoice_templates:');
    fkResult.rows.forEach(fk => {
      console.log(`  ${fk.constraint_name}: ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkUsers();

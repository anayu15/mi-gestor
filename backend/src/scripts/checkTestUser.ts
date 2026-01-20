import { query } from '../config/database';

async function checkTestUser() {
  try {
    console.log('🔍 Verificando usuario de prueba...\n');

    // Check if test user exists
    const userResult = await query(`
      SELECT id, email, nombre_comercial, es_trade
      FROM usuarios
      WHERE email = 'test@migestor.com' OR id = 2;
    `);

    if (userResult.rows.length === 0) {
      console.log('⚠️  Usuario de prueba NO encontrado');
      console.log('📝 Para crear el usuario, ejecuta: npm run seed\n');
    } else {
      console.log('✅ Usuario de prueba encontrado:');
      userResult.rows.forEach(user => {
        console.log(`  - ID: ${user.id}`);
        console.log(`  - Email: ${user.email}`);
        console.log(`  - Nombre: ${user.nombre_comercial}`);
        console.log(`  - Es TRADE: ${user.es_trade}`);
      });

      // Check if user has clients
      const clientsResult = await query(`
        SELECT id, razon_social, cif, activo
        FROM clientes
        WHERE user_id = $1
        LIMIT 5;
      `, [userResult.rows[0].id]);

      console.log('\n📋 Clientes del usuario:');
      if (clientsResult.rows.length === 0) {
        console.log('  ⚠️  No tiene clientes registrados');
      } else {
        clientsResult.rows.forEach(client => {
          console.log(`  - ID: ${client.id}, ${client.razon_social} (${client.cif}) - ${client.activo ? 'Activo' : 'Inactivo'}`);
        });
      }
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkTestUser();

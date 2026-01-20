import { query, getClient } from '../config/database';
import bcrypt from 'bcrypt';

async function createTestUser() {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    console.log('🔄 Creando usuario de prueba...\n');

    // Hash password
    const passwordHash = await bcrypt.hash('Test123456', 10);

    // Check if user already exists
    const existingUser = await client.query(
      `SELECT id FROM usuarios WHERE email = 'test@migestor.com'`
    );

    let userId: number;

    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      console.log(`✅ Usuario ya existe con ID: ${userId}\n`);
    } else {
      // Create user
      const userResult = await client.query(
        `INSERT INTO usuarios (
          email, password_hash, nombre_comercial, nif, es_trade, actividad_economica
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [
          'test@migestor.com',
          passwordHash,
          'Test User TRADE',
          'X1234567X',
          true,
          'Servicios de consultoría'
        ]
      );

      userId = userResult.rows[0].id;
      console.log(`✅ Usuario creado con ID: ${userId}`);
      console.log(`   Email: test@migestor.com`);
      console.log(`   Password: Test123456\n`);
    }

    // Check if user has clients
    const existingClients = await client.query(
      `SELECT id FROM clientes WHERE user_id = $1`,
      [userId]
    );

    if (existingClients.rows.length === 0) {
      // Create sample clients
      const clients = [
        {
          nombre: 'Cliente Ejemplo SL',
          cif: 'B12345678',
          email: 'cliente1@example.com',
          telefono: '600123456',
          direccion: 'Calle Mayor 1',
          ciudad: 'Madrid',
          codigo_postal: '28001',
          activo: true
        },
        {
          nombre: 'Empresa Demo SA',
          cif: 'A87654321',
          email: 'demo@example.com',
          telefono: '600654321',
          direccion: 'Av. Principal 100',
          ciudad: 'Barcelona',
          codigo_postal: '08001',
          activo: true
        }
      ];

      console.log('📋 Creando clientes de ejemplo:');
      for (const clientData of clients) {
        const clientResult = await client.query(
          `INSERT INTO clientes (
            user_id, nombre, cif, email, telefono, direccion, ciudad, codigo_postal, activo
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id, nombre`,
          [
            userId,
            clientData.nombre,
            clientData.cif,
            clientData.email,
            clientData.telefono,
            clientData.direccion,
            clientData.ciudad,
            clientData.codigo_postal,
            clientData.activo
          ]
        );

        console.log(`  ✓ ${clientResult.rows[0].nombre} (ID: ${clientResult.rows[0].id})`);
      }
    } else {
      console.log(`✅ Usuario ya tiene ${existingClients.rows.length} cliente(s)\n`);
    }

    await client.query('COMMIT');

    console.log('\n✨ Base de datos lista para pruebas!');
    console.log('\n📝 Credenciales de acceso:');
    console.log('   Email: test@migestor.com');
    console.log('   Password: Test123456');
    console.log('\n🌐 URL Frontend: http://localhost:3001/login\n');

    process.exit(0);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
  }
}

createTestUser();

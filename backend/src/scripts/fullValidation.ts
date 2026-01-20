import { query } from '../config/database';

const API_URL = 'http://localhost:3000/api';
const TEST_EMAIL = 'test@migestor.com';
const TEST_PASSWORD = 'Test123456';

async function apiPost(endpoint: string, data: any, token?: string) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify(data)
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} - ${JSON.stringify(json)}`);
  }
  return json;
}

async function fullValidation() {
  console.log('🔍 VALIDACIÓN COMPLETA DEL SISTEMA\n');
  console.log('═'.repeat(70) + '\n');

  try {
    // FASE 1: Verificar usuario y clientes
    console.log('📋 FASE 1: Verificando usuario de prueba...\n');

    const userResult = await query(`
      SELECT id, email, nombre_comercial
      FROM usuarios
      WHERE email = $1;
    `, [TEST_EMAIL]);

    if (userResult.rows.length === 0) {
      throw new Error('Usuario de prueba no encontrado');
    }

    const userId = userResult.rows[0].id;
    console.log(`✅ Usuario encontrado:`);
    console.log(`   - ID: ${userId} (${typeof userId})`);
    console.log(`   - Email: ${userResult.rows[0].email}\n`);

    // Verificar clientes
    const clientsResult = await query(`
      SELECT id, nombre, cif, activo
      FROM clientes
      WHERE user_id = $1
      ORDER BY id;
    `, [userId]);

    if (clientsResult.rows.length === 0) {
      throw new Error('Usuario no tiene clientes');
    }

    const clientId = clientsResult.rows[0].id;
    console.log(`✅ Clientes encontrados: ${clientsResult.rows.length}`);
    clientsResult.rows.forEach((c, i) => {
      console.log(`   ${i+1}. ID: ${c.id} (${typeof c.id}) - ${c.nombre}`);
    });

    // FASE 2: Login
    console.log('\n' + '═'.repeat(70));
    console.log('📋 FASE 2: Validando autenticación...\n');

    const loginResp: any = await apiPost('/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    console.log('Login response:', JSON.stringify(loginResp, null, 2));
    const token = loginResp.data?.token || loginResp.token;
    if (!token) {
      throw new Error('Token no encontrado en la respuesta');
    }
    console.log(`✅ Login exitoso`);
    console.log(`   - Token: ${token.substring(0, 30)}...\n`);

    // FASE 3: Crear plantilla
    console.log('═'.repeat(70));
    console.log('📋 FASE 3: Creando plantilla recurrente...\n');

    const templateData = {
      nombre_plantilla: 'Validación Test - Día 27',
      descripcion: 'Plantilla de prueba automática',
      cliente_id: clientId,
      serie: 'TEST',
      concepto: 'Servicios mensuales de validación',
      descripcion_detallada: 'Descripción detallada de los servicios prestados',
      base_imponible: 1000,
      tipo_iva: 21,
      tipo_irpf: 7,
      dias_vencimiento: 30,
      incluir_periodo_facturacion: true,
      duracion_periodo_dias: 30,
      frecuencia: 'MENSUAL',
      tipo_dia_generacion: 'DIA_ESPECIFICO',
      dia_generacion: 27,
      fecha_inicio: new Date().toISOString().split('T')[0],
      generar_pdf_automatico: true,
      enviar_email_automatico: false
    };

    console.log(`📤 Datos enviados:`);
    console.log(`   - cliente_id: ${clientId} (${typeof clientId})`);
    console.log(`   - tipo_dia_generacion: ${templateData.tipo_dia_generacion}`);
    console.log(`   - dia_generacion: ${templateData.dia_generacion}\n`);

    const createResp: any = await apiPost('/recurring-templates', templateData, token);

    const templateId = createResp.data.id;
    console.log(`✅ Plantilla creada:`);
    console.log(`   - ID: ${templateId}`);
    console.log(`   - Nombre: ${createResp.data.nombre_plantilla}`);
    console.log(`   - Próxima generación: ${new Date(createResp.data.proxima_generacion).toLocaleDateString('es-ES')}\n`);

    // FASE 4: Verificar en BD
    console.log('═'.repeat(70));
    console.log('📋 FASE 4: Verificando en base de datos...\n');

    const verifyResult = await query(`
      SELECT
        id,
        nombre_plantilla,
        cliente_id,
        user_id,
        frecuencia,
        tipo_dia_generacion,
        dia_generacion,
        proxima_generacion,
        activo
      FROM recurring_invoice_templates
      WHERE id = $1;
    `, [templateId]);

    if (verifyResult.rows.length === 0) {
      throw new Error('Plantilla no encontrada en BD');
    }

    const tmpl = verifyResult.rows[0];
    console.log(`✅ Plantilla verificada en BD:`);
    console.log(`   - ID: ${tmpl.id}`);
    console.log(`   - Nombre: ${tmpl.nombre_plantilla}`);
    console.log(`   - User ID: ${tmpl.user_id} (${typeof tmpl.user_id})`);
    console.log(`   - Cliente ID: ${tmpl.cliente_id} (${typeof tmpl.cliente_id})`);
    console.log(`   - Frecuencia: ${tmpl.frecuencia}`);
    console.log(`   - Tipo día: ${tmpl.tipo_dia_generacion}`);
    console.log(`   - Día: ${tmpl.dia_generacion}`);
    console.log(`   - Próxima: ${new Date(tmpl.proxima_generacion).toLocaleDateString('es-ES')}`);
    console.log(`   - Activo: ${tmpl.activo}\n`);

    // FASE 5: Limpiar
    console.log('═'.repeat(70));
    console.log('📋 FASE 5: Limpiando datos de prueba...\n');

    await query(`DELETE FROM recurring_invoice_templates WHERE id = $1`, [templateId]);
    console.log(`✅ Plantilla ${templateId} eliminada\n`);

    // RESUMEN
    console.log('═'.repeat(70));
    console.log('✅ VALIDACIÓN EXITOSA\n');
    console.log('Resumen:');
    console.log('  ✅ Usuario y clientes verificados');
    console.log('  ✅ API de autenticación funciona');
    console.log('  ✅ Creación de plantilla exitosa');
    console.log('  ✅ Datos correctos en BD');
    console.log('  ✅ Limpieza completada\n');
    console.log(`🎉 Sistema funcionando correctamente!\n`);

    process.exit(0);
  } catch (error: any) {
    console.error('\n' + '═'.repeat(70));
    console.error('❌ VALIDACIÓN FALLIDA\n');
    console.error('Error:', error.message);
    console.error('');
    process.exit(1);
  }
}

fullValidation();

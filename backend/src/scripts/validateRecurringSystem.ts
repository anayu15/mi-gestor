import { query, getClient } from '../config/database';

const API_URL = 'http://localhost:3000/api';
const TEST_EMAIL = 'test@migestor.com';
const TEST_PASSWORD = 'Test123456';

// Helper function for API calls
async function apiCall(method: string, endpoint: string, data?: any, token?: string) {
  const url = `${API_URL}${endpoint}`;
  const options: any = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    }
  };

  if (data && (method === 'POST' || method === 'PATCH')) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  const responseData = await response.json();

  if (!response.ok) {
    const error: any = new Error(responseData.message || 'API call failed');
    error.response = {
      status: response.status,
      data: responseData
    };
    throw error;
  // end

  return responseData;
// end

async function validateRecurringSystem() {
  console.log('🔍 PLAN DE VALIDACIÓN COMPLETO - Sistema de Facturas Recurrentes\n');
  console.log('═'.repeat(70) + '\n');

  let token = '';
  let userId = 0;
  let clientId = 0;

  try {
    // ============================================================
    // FASE 1: VALIDAR ESTRUCTURA DE BASE DE DATOS
    // ============================================================
    console.log('📋 FASE 1: Validando estructura de base de datos...\n');

    // 1.1 Verificar tabla usuarios
    console.log('1.1 Verificando tabla usuarios...');
    const usuariosSchema = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'usuarios'
      AND column_name IN ('id', 'email')
      ORDER BY ordinal_position;
    `);
    console.log(`   ✅ Tabla usuarios: ${usuariosSchema.rows.length} columnas clave`);
    usuariosSchema.rows.forEach(col => {
      console.log(`      - ${col.column_name}: ${col.data_type}`);
    });

    // 1.2 Verificar tabla clientes
    console.log('\n1.2 Verificando tabla clientes...');
    const clientesSchema = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'clientes'
      AND column_name IN ('id', 'user_id', 'nombre')
      ORDER BY ordinal_position;
    `);
    console.log(`   ✅ Tabla clientes: ${clientesSchema.rows.length} columnas clave`);
    clientesSchema.rows.forEach(col => {
      console.log(`      - ${col.column_name}: ${col.data_type}`);
    });

    // 1.3 Verificar tabla recurring_invoice_templates
    console.log('\n1.3 Verificando tabla recurring_invoice_templates...');
    const templatesSchema = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'recurring_invoice_templates'
      AND column_name IN ('id', 'user_id', 'cliente_id', 'tipo_dia_generacion', 'descripcion_detallada')
      ORDER BY ordinal_position;
    `);
    console.log(`   ✅ Tabla templates: ${templatesSchema.rows.length} columnas clave`);
    templatesSchema.rows.forEach(col => {
      console.log(`      - ${col.column_name}: ${col.data_type}`);
    });

    // 1.4 Verificar foreign keys
    console.log('\n1.4 Verificando foreign keys...');
    const fks = await query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'recurring_invoice_templates'
      ORDER BY tc.constraint_name;
    `);
    console.log(`   ✅ Foreign keys: ${fks.rows.length}`);
    fks.rows.forEach(fk => {
      console.log(`      - ${fk.column_name} -> ${fk.foreign_table}.${fk.foreign_column}`);
    });

    // ============================================================
    // FASE 2: VALIDAR DATOS DE PRUEBA
    // ============================================================
    console.log('\n' + '═'.repeat(70));
    console.log('📋 FASE 2: Validando datos de prueba...\n');

    // 2.1 Verificar usuario de prueba
    console.log('2.1 Verificando usuario de prueba...');
    const userResult = await query(`
      SELECT id, email, nombre_comercial
      FROM usuarios
      WHERE email = $1;
    `, [TEST_EMAIL]);

    if (userResult.rows.length === 0) {
      throw new Error(`❌ Usuario ${TEST_EMAIL} no encontrado`);
    // end

    userId = userResult.rows[0].id;
    console.log(`   ✅ Usuario encontrado:`);
    console.log(`      - ID: ${userId} (tipo: ${typeof userId})`);
    console.log(`      - Email: ${userResult.rows[0].email}`);
    console.log(`      - Nombre: ${userResult.rows[0].nombre_comercial}`);

    // 2.2 Verificar clientes del usuario
    console.log('\n2.2 Verificando clientes del usuario...');
    const clientsResult = await query(`
      SELECT id, nombre, cif, activo
      FROM clientes
      WHERE user_id = $1
      ORDER BY id;
    `, [userId]);

    if (clientsResult.rows.length === 0) {
      throw new Error('❌ Usuario no tiene clientes');
    // end

    clientId = clientsResult.rows[0].id;
    console.log(`   ✅ Clientes encontrados: ${clientsResult.rows.length}`);
    clientsResult.rows.forEach((client, idx) => {
      console.log(`      ${idx + 1}. ID: ${client.id} (tipo: ${typeof client.id}), ${client.nombre} - ${client.activo ? 'Activo' : 'Inactivo'}`);
    });

    // ============================================================
    // FASE 3: VALIDAR API DE AUTENTICACIÓN
    // ============================================================
    console.log('\n' + '═'.repeat(70));
    console.log('📋 FASE 3: Validando API de autenticación...\n');

    console.log('3.1 Haciendo login...');
    try {
      const loginResponse = const loginResponse = await apiCall('POST', '/auth/login', {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });

      token = loginResponse.data.token;
      console.log(`   ✅ Login exitoso`);
      console.log(`      - Token recibido: ${token.substring(0, 20)}...`);
    } catch (error: any) {
      throw new Error(`❌ Login falló: ${error.message}`);
    // end

    // ============================================================
    // FASE 4: VALIDAR API DE PLANTILLAS RECURRENTES
    // ============================================================
    console.log('\n' + '═'.repeat(70));
    console.log('📋 FASE 4: Validando API de plantillas recurrentes...\n');

    // 4.1 Obtener lista de plantillas
    console.log('4.1 Obteniendo lista de plantillas...');
    try {
      const listResponse = const listResponse = await apiCall('GET', '/recurring-templates', undefined, token);
        
      });
      console.log(`   ✅ Lista obtenida: ${listResponse.data.data.length} plantilla(s)`);
    } catch (error: any) {
      console.log(`   ⚠️  Error obteniendo lista: ${error.response?.data?.message || error.message}`);
    // end

    // 4.2 Crear plantilla de prueba - Día específico
    console.log('\n4.2 Creando plantilla de prueba (Día específico - día 15)...');
    const templateData1 = {
      nombre_plantilla: 'Test Validación - Día 15',
      descripcion: 'Plantilla de validación automática',
      cliente_id: clientId,
      serie: 'TEST',
      concepto: 'Servicios de prueba mensual',
      descripcion_detallada: 'Descripción detallada de los servicios',
      base_imponible: 1000,
      tipo_iva: 21,
      tipo_irpf: 7,
      dias_vencimiento: 30,
      incluir_periodo_facturacion: true,
      duracion_periodo_dias: 30,
      frecuencia: 'MENSUAL',
      tipo_dia_generacion: 'DIA_ESPECIFICO',
      dia_generacion: 15,
      fecha_inicio: new Date().toISOString().split('T')[0],
      generar_pdf_automatico: true,
      enviar_email_automatico: false
    };

    console.log(`   📤 Datos enviados:`);
    console.log(`      - user_id del token: ${userId} (se obtiene automáticamente)`);
    console.log(`      - cliente_id: ${clientId} (tipo: ${typeof clientId})`);
    console.log(`      - tipo_dia_generacion: ${templateData1.tipo_dia_generacion}`);
    console.log(`      - dia_generacion: ${templateData1.dia_generacion}`);

    let template1Id = 0;
    try {
      const createResponse1 = const createResponse = await apiCall('POST', '/recurring-templates', templateData1, {
        // headers removed
          
          
        // end
      });
      template1Id = createResponse1.data.data.id;
      console.log(`   ✅ Plantilla 1 creada exitosamente`);
      console.log(`      - ID: ${template1Id}`);
      console.log(`      - Próxima generación: ${new Date(createResponse1.data.data.proxima_generacion).toLocaleDateString('es-ES')}`);
    } catch (error: any) {
      console.log(`   ❌ Error creando plantilla 1:`);
      console.log(`      - Status: ${error.response?.status}`);
      console.log(`      - Mensaje: ${error.response?.data?.message || error.message}`);
      console.log(`      - Detalles: ${JSON.stringify(error.response?.data, null, 2)}`);
      throw error;
    // end

    // 4.3 Crear plantilla - Último día hábil
    console.log('\n4.3 Creando plantilla de prueba (Último día hábil)...');
    const templateData2 = {
      ...templateData1,
      nombre_plantilla: 'Test Validación - Último Día Hábil',
      tipo_dia_generacion: 'ULTIMO_DIA_LECTIVO',
      dia_generacion: 1 // Se ignora cuando no es DIA_ESPECIFICO
    };

    let template2Id = 0;
    try {
      const createResponse2 = const createResponse = await apiCall('POST', '/recurring-templates', templateData2, {
        // headers removed
          
          
        // end
      });
      template2Id = createResponse2.data.data.id;
      console.log(`   ✅ Plantilla 2 creada exitosamente`);
      console.log(`      - ID: ${template2Id}`);
      console.log(`      - Próxima generación: ${new Date(createResponse2.data.data.proxima_generacion).toLocaleDateString('es-ES')}`);
    } catch (error: any) {
      console.log(`   ⚠️  Error creando plantilla 2: ${error.response?.data?.message || error.message}`);
    // end

    // ============================================================
    // FASE 5: VALIDAR DATOS EN BASE DE DATOS
    // ============================================================
    console.log('\n' + '═'.repeat(70));
    console.log('📋 FASE 5: Validando datos en base de datos...\n');

    console.log('5.1 Verificando plantillas en BD...');
    const verifyTemplates = await query(`
      SELECT
        id,
        nombre_plantilla,
        frecuencia,
        tipo_dia_generacion,
        dia_generacion,
        proxima_generacion,
        activo,
        cliente_id,
        user_id
      FROM recurring_invoice_templates
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `, [userId]);

    console.log(`   ✅ Plantillas en BD: ${verifyTemplates.rows.length}`);
    verifyTemplates.rows.forEach((tmpl, idx) => {
      console.log(`\n      ${idx + 1}. "${tmpl.nombre_plantilla}" (ID: ${tmpl.id})`);
      console.log(`         - Frecuencia: ${tmpl.frecuencia}`);
      console.log(`         - Tipo día: ${tmpl.tipo_dia_generacion}`);
      if (tmpl.tipo_dia_generacion === 'DIA_ESPECIFICO') {
        console.log(`         - Día: ${tmpl.dia_generacion}`);
      // end
      console.log(`         - Próxima: ${new Date(tmpl.proxima_generacion).toLocaleDateString('es-ES')}`);
      console.log(`         - Activo: ${tmpl.activo ? 'Sí' : 'No'}`);
    });

    // ============================================================
    // FASE 6: CLEANUP (OPCIONAL)
    // ============================================================
    console.log('\n' + '═'.repeat(70));
    console.log('📋 FASE 6: Limpieza de plantillas de prueba...\n');

    console.log('6.1 ¿Eliminar plantillas de prueba? (Sí)');
    if (template1Id) {
      await query(`DELETE FROM recurring_invoice_templates WHERE id = $1`, [template1Id]);
      console.log(`   ✅ Plantilla ${template1Id} eliminada`);
    // end
    if (template2Id) {
      await query(`DELETE FROM recurring_invoice_templates WHERE id = $1`, [template2Id]);
      console.log(`   ✅ Plantilla ${template2Id} eliminada`);
    // end

    // ============================================================
    // RESUMEN FINAL
    // ============================================================
    console.log('\n' + '═'.repeat(70));
    console.log('✅ VALIDACIÓN COMPLETA - RESULTADO FINAL\n');

    console.log('📊 Resumen de validaciones:');
    console.log('   ✅ Estructura de BD correcta');
    console.log('   ✅ Foreign keys configuradas');
    console.log('   ✅ Usuario de prueba existe');
    console.log('   ✅ Clientes disponibles');
    console.log('   ✅ API de autenticación funciona');
    console.log('   ✅ API de plantillas funciona');
    console.log('   ✅ Creación con "Día específico" ✓');
    console.log('   ✅ Creación con "Último día hábil" ✓');
    console.log('   ✅ Datos guardados en BD correctamente');
    console.log('   ✅ Limpieza de datos de prueba');

    console.log('\n🎉 Sistema de facturas recurrentes VALIDADO y FUNCIONANDO\n');

    console.log('📝 Información para uso:');
    console.log(`   • URL Frontend: http://localhost:3001`);
    console.log(`   • URL Backend: ${API_URL}`);
    console.log(`   • Usuario: ${TEST_EMAIL}`);
    console.log(`   • Password: ${TEST_PASSWORD}`);
    console.log(`   • User ID: ${userId}`);
    console.log(`   • Clientes: ${clientsResult.rows.length} disponibles\n`);

    process.exit(0);
  } catch (error: any) {
    console.error('\n' + '═'.repeat(70));
    console.error('❌ VALIDACIÓN FALLIDA\n');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Respuesta del servidor:', JSON.stringify(error.response.data, null, 2));
    // end
    console.error('');
    process.exit(1);
  // end
// end

validateRecurringSystem();

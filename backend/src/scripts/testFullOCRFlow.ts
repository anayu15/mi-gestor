import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';

/**
 * Test completo del flujo de OCR simulando una petición real del frontend
 */
async function testFullOCRFlow() {
  console.log('🧪 Test Completo de Flujo OCR\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Paso 1: Verificar que el backend esté corriendo
  console.log('1️⃣ Verificando backend...');
  try {
    const healthCheck = await axios.get('http://localhost:3000/health');
    if (healthCheck.data.success) {
      console.log('✅ Backend corriendo correctamente\n');
    }
  } catch (error) {
    console.error('❌ Backend no está corriendo. Ejecuta: npm run dev');
    process.exit(1);
  }

  // Paso 2: Crear credenciales de test (user ID 2)
  console.log('2️⃣ Preparando autenticación...');
  const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJ0ZXN0QG1pZ2VzdG9yLmNvbSIsIm5vbWJyZV9jb21wbGV0byI6IlRlc3QgVXNlciBUUkFERSIsImVzX3RyYWRlIjp0cnVlLCJpYXQiOjE3NjgwODQyMTIsImV4cCI6MTc2ODY4OTAxMn0.L6kHrb5A8Azhrex6Av33TR1Af1KoQXrnSFDWOXPWI9g';
  console.log('✅ Token de test obtenido\n');

  // Paso 3: Crear una imagen de factura de prueba (PNG simple)
  console.log('3️⃣ Creando imagen de factura de prueba...');
  const testDir = path.join(__dirname, '../../test-uploads');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Crear un PNG simple de 1x1 pixel (el mínimo válido)
  // PNG de 1x1 pixel blanco en base64
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  const pngBuffer = Buffer.from(pngBase64, 'base64');

  const pngPath = path.join(testDir, 'test-invoice.png');
  fs.writeFileSync(pngPath, pngBuffer);
  console.log('✅ Imagen de prueba creada:', pngPath);
  console.log('   Nota: Esta es una imagen PNG simple para probar el flujo\n');

  // Paso 4: Simular la subida del archivo al endpoint de OCR
  console.log('4️⃣ Simulando subida de factura al endpoint /api/expenses/extract-from-invoice...');

  try {
    const formData = new FormData();
    formData.append('invoice', fs.createReadStream(pngPath));

    const response = await axios.post(
      'http://localhost:3000/api/expenses/extract-from-invoice',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${testToken}`,
        },
        timeout: 30000, // 30 segundos
      }
    );

    console.log('✅ Respuesta recibida del servidor\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DATOS EXTRAÍDOS:\n');

    const { data } = response.data;

    console.log('Datos extraídos:', JSON.stringify(data.extracted, null, 2));
    console.log('\n📈 Confianza:', data.confidence + '%');
    console.log('⚠️  Requiere revisión:', data.requiresReview ? 'Sí' : 'No');
    console.log('\n📁 Archivo guardado:');
    console.log('   URL:', data.archivo_url);
    console.log('   Nombre:', data.archivo_nombre);
    console.log('   Tipo:', data.archivo_tipo);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 TEST COMPLETADO EXITOSAMENTE\n');

    console.log('💡 PRÓXIMOS PASOS:');
    console.log('1. Los datos extraídos se mostrarían en el formulario del frontend');
    console.log('2. El usuario puede revisar y editar los campos');
    console.log('3. Al hacer clic en "Guardar Gasto", se crea con estos datos OCR');
    console.log('4. El sistema guarda el metadata de OCR (confianza, datos extraídos, archivo)');

  } catch (error: any) {
    console.error('❌ Error al procesar la factura:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Mensaje:', error.response.data.error?.message || error.response.data);
    } else {
      console.error('   ', error.message);
    }

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Asegúrate de que el backend esté corriendo: npm run dev');
    }
  }

  // Paso 5: Información sobre cómo probar en el frontend
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 PRUEBA EN EL NAVEGADOR:');
  console.log('\n1. Abre: http://localhost:3001/gastos/nuevo');
  console.log('2. Verás el formulario con panel OCR a la izquierda');
  console.log('3. Haz clic o arrastra una imagen de factura (JPG, PNG) o PDF');
  console.log('4. Haz clic en "Extraer datos de factura"');
  console.log('5. Espera 3-8 segundos mientras GPT-4o procesa');
  console.log('6. Los campos se llenarán automáticamente');
  console.log('7. Revisa y edita si es necesario');
  console.log('8. Haz clic en "Guardar Gasto"');
  console.log('\n✨ El gasto se creará con todos los datos OCR guardados!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(0);
}

testFullOCRFlow();

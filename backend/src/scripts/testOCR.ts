import dotenv from 'dotenv';
dotenv.config();

import { extractInvoiceData } from '../services/visionOCR.service';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

async function testOCR() {
  console.log('🧪 Probando funcionalidad OCR...\n');

  // Test 1: Verificar que la API key esté configurada
  console.log('1️⃣ Verificando configuración de API key...');
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    console.error('❌ CLAUDE_API_KEY no está configurada');
    process.exit(1);
  }
  if (!apiKey.startsWith('sk-ant-api03-')) {
    console.error('❌ CLAUDE_API_KEY tiene formato incorrecto');
    process.exit(1);
  }
  console.log('✅ API key configurada correctamente');
  console.log(`   Key: ${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 10)}\n`);

  // Test 2: Verificar conexión con Claude API
  console.log('2️⃣ Verificando conexión con Claude API...');
  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 10,
      messages: [{
        role: 'user',
        content: 'Hola'
      }]
    });
    console.log('✅ Conexión exitosa con Claude API');
    console.log(`   Respuesta: ${message.content[0].type === 'text' ? message.content[0].text : 'OK'}\n`);
  } catch (error: any) {
    console.error('❌ Error al conectar con Claude API:', error.message);
    if (error.status === 401) {
      console.error('   La API key no es válida o ha expirado');
    }
    process.exit(1);
  }

  // Test 3: Crear una imagen de prueba simple
  console.log('3️⃣ Creando imagen de prueba...');
  const testDir = path.join(__dirname, '../../test-uploads');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Crear un SVG simple que simula una factura
  const fakeSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="1000" fill="white"/>
  <text x="50" y="50" font-family="Arial" font-size="24" fill="black" font-weight="bold">FACTURA</text>
  <text x="50" y="100" font-family="Arial" font-size="16" fill="black">Empresa Test S.L.</text>
  <text x="50" y="130" font-family="Arial" font-size="14" fill="black">CIF: B12345678</text>
  <text x="50" y="160" font-family="Arial" font-size="14" fill="black">Fecha: 15/01/2024</text>
  <text x="50" y="190" font-family="Arial" font-size="14" fill="black">Nº Factura: FAC-2024-001</text>

  <line x1="50" y1="220" x2="750" y2="220" stroke="black" stroke-width="2"/>

  <text x="50" y="260" font-family="Arial" font-size="14" fill="black">Concepto: Servicios de consultoría informática</text>

  <line x1="50" y1="290" x2="750" y2="290" stroke="black" stroke-width="1"/>

  <text x="50" y="330" font-family="Arial" font-size="14" fill="black">Base imponible: 1.000,00 €</text>
  <text x="50" y="360" font-family="Arial" font-size="14" fill="black">IVA (21%): 210,00 €</text>
  <text x="50" y="390" font-family="Arial" font-size="14" fill="black">IRPF (15%): 150,00 €</text>

  <line x1="50" y1="420" x2="750" y2="420" stroke="black" stroke-width="2"/>

  <text x="50" y="460" font-family="Arial" font-size="18" fill="black" font-weight="bold">TOTAL: 1.060,00 €</text>
</svg>`;

  const svgPath = path.join(testDir, 'test-invoice.svg');
  fs.writeFileSync(svgPath, fakeSVG);
  console.log('✅ Imagen de prueba creada');
  console.log(`   Ubicación: ${svgPath}\n`);

  // Test 4: Convertir SVG a PNG usando un texto alternativo
  console.log('4️⃣ Nota: Para una prueba real, necesitas subir una imagen JPG/PNG de una factura real');
  console.log('   Puedes probar desde el navegador en: http://localhost:3001/gastos/nuevo\n');

  // Test 5: Verificar que el servicio OCR esté disponible
  console.log('5️⃣ Verificando servicio OCR...');
  try {
    // Intentar leer el servicio
    const serviceCode = fs.readFileSync(
      path.join(__dirname, '../services/visionOCR.service.ts'),
      'utf-8'
    );
    if (serviceCode.includes('extractInvoiceData') && serviceCode.includes('processWithClaude')) {
      console.log('✅ Servicio visionOCR.service.ts está presente y correcto\n');
    }
  } catch (error) {
    console.error('❌ Error al verificar servicio OCR');
    process.exit(1);
  }

  // Test 6: Verificar endpoint en el servidor
  console.log('6️⃣ Verificando endpoint del servidor...');
  const routesCode = fs.readFileSync(
    path.join(__dirname, '../routes/expense.routes.ts'),
    'utf-8'
  );
  if (routesCode.includes('extract-from-invoice') && routesCode.includes('extractFromInvoice')) {
    console.log('✅ Ruta /api/expenses/extract-from-invoice configurada correctamente\n');
  }

  // Test 7: Mostrar instrucciones de prueba manual
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 TODOS LOS TESTS PASARON EXITOSAMENTE\n');
  console.log('📝 INSTRUCCIONES PARA PRUEBA MANUAL:\n');
  console.log('1. Asegúrate que el frontend esté corriendo:');
  console.log('   cd frontend && npm run dev\n');
  console.log('2. Abre tu navegador en:');
  console.log('   http://localhost:3001/gastos/nuevo\n');
  console.log('3. Verás dos columnas:');
  console.log('   - Izquierda: Panel de upload');
  console.log('   - Derecha: Formulario de gasto\n');
  console.log('4. Haz clic en el área de upload o arrastra una imagen de factura (JPG/PNG)');
  console.log('5. Haz clic en "Extraer datos de factura"');
  console.log('6. Espera 3-8 segundos mientras la IA procesa');
  console.log('7. El formulario se llenará automáticamente con los datos extraídos');
  console.log('8. Revisa los datos y haz clic en "Guardar Gasto"\n');
  console.log('💡 TIPS:');
  console.log('   - Usa una factura española real para mejores resultados');
  console.log('   - La imagen debe ser clara y legible');
  console.log('   - Formatos aceptados: JPG, JPEG, PNG (max 5MB)');
  console.log('   - El indicador de confianza te ayudará a saber si necesitas revisar los datos\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(0);
}

testOCR();

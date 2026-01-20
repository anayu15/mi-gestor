import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';
import config from '../config';

async function testOpenRouter() {
  console.log('🧪 Probando integración con OpenRouter...\n');

  // Test 1: Verificar configuración
  console.log('1️⃣ Verificando configuración...');
  console.log(`   Provider: ${config.vision.provider}`);
  console.log(`   Model: ${config.vision.openrouterModel}`);

  if (!config.vision.openrouterApiKey) {
    console.error('❌ OPENROUTER_API_KEY no está configurada');
    process.exit(1);
  }

  if (!config.vision.openrouterApiKey.startsWith('sk-or-v1-')) {
    console.error('❌ OPENROUTER_API_KEY tiene formato incorrecto');
    console.error(`   Expected: sk-or-v1-...`);
    console.error(`   Received: ${config.vision.openrouterApiKey.substring(0, 15)}...`);
    process.exit(1);
  }

  console.log('✅ Configuración correcta');
  console.log(`   Key: ${config.vision.openrouterApiKey.substring(0, 20)}...${config.vision.openrouterApiKey.substring(config.vision.openrouterApiKey.length - 10)}\n`);

  // Test 2: Verificar conexión con OpenRouter
  console.log('2️⃣ Verificando conexión con OpenRouter API...');
  try {
    const openrouter = new OpenAI({
      apiKey: config.vision.openrouterApiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    const response = await openrouter.chat.completions.create({
      model: config.vision.openrouterModel,
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: 'Di "Hola" en una palabra',
        },
      ],
    });

    const responseText = response.choices[0]?.message?.content || '';
    console.log('✅ Conexión exitosa con OpenRouter');
    console.log(`   Modelo: ${config.vision.openrouterModel}`);
    console.log(`   Respuesta: ${responseText}\n`);
  } catch (error: any) {
    console.error('❌ Error al conectar con OpenRouter:', error.message);
    if (error.status === 401) {
      console.error('   La API key no es válida o ha expirado');
    } else if (error.status === 402) {
      console.error('   Sin créditos suficientes en OpenRouter');
    } else if (error.status === 429) {
      console.error('   Límite de rate alcanzado');
    }
    console.error('\n   Detalles del error:', JSON.stringify(error, null, 2));
    process.exit(1);
  }

  // Test 3: Información sobre el modelo
  console.log('3️⃣ Información del modelo:');
  console.log('   Modelo: openai/gpt-4o');
  console.log('   Descripción: GPT-4o de OpenAI - Excelente para OCR y visión');
  console.log('   Características:');
  console.log('     - Soporte para imágenes (Vision)');
  console.log('     - Alta precisión en extracción de datos');
  console.log('     - Buen entendimiento de español');
  console.log('     - Velocidad: ~3-8 segundos por factura\n');

  // Success
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 TODOS LOS TESTS PASARON EXITOSAMENTE\n');
  console.log('📝 PRÓXIMOS PASOS:\n');
  console.log('1. Asegúrate que el backend esté corriendo:');
  console.log('   npm run dev\n');
  console.log('2. Asegúrate que el frontend esté corriendo:');
  console.log('   cd ../frontend && npm run dev\n');
  console.log('3. Abre el navegador en:');
  console.log('   http://localhost:3001/gastos/nuevo\n');
  console.log('4. Prueba la funcionalidad de OCR:');
  console.log('   - Sube una imagen de factura (JPG/PNG)');
  console.log('   - Haz clic en "Extraer datos de factura"');
  console.log('   - Verifica que los datos se extraen correctamente');
  console.log('   - Revisa el nivel de confianza');
  console.log('   - Guarda el gasto\n');
  console.log('💡 NOTA: GPT-4o es excelente para facturas españolas');
  console.log('   y debería dar resultados muy precisos.\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(0);
}

testOpenRouter();

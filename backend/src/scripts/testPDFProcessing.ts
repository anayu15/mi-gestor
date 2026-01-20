import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import config from '../config';

async function testPDFProcessing() {
  console.log('🧪 Test de Procesamiento de PDF con OpenRouter\n');

  // Test 1: Probar con imagen simple
  console.log('1️⃣ Test con imagen PNG simple...');
  try {
    const openrouter = new OpenAI({
      apiKey: config.vision.openrouterApiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    // Crear imagen PNG simple (1x1 pixel)
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

    const response = await openrouter.chat.completions.create({
      model: config.vision.openrouterModel,
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${pngBase64}`,
              },
            },
            {
              type: 'text',
              text: 'Describe esta imagen en una palabra.',
            },
          ],
        },
      ],
    });

    console.log('✅ Imagen PNG procesada correctamente');
    console.log('   Respuesta:', response.choices[0]?.message?.content || 'Sin respuesta');
  } catch (error: any) {
    console.error('❌ Error con imagen PNG:');
    console.error('   Status:', error.status);
    console.error('   Message:', error.message);
    if (error.response) {
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Test 2: Verificar si OpenRouter/GPT-4o soporta PDFs
  console.log('2️⃣ Test con PDF...');
  console.log('   Nota: GPT-4o de OpenAI no soporta PDFs directamente en Vision API');
  console.log('   Solo soporta: PNG, JPEG, WEBP, GIF\n');

  console.log('💡 SOLUCIÓN RECOMENDADA:');
  console.log('   Para PDFs, necesitamos:');
  console.log('   1. Convertir PDF a imagen usando una librería server-side');
  console.log('   2. Usar un servicio cloud que soporte PDFs nativamente');
  console.log('   3. O rechazar PDFs y solo aceptar imágenes\n');

  console.log('🎯 MEJOR OPCIÓN:');
  console.log('   Por ahora, vamos a:');
  console.log('   - Aceptar solo JPG, JPEG, PNG en el frontend');
  console.log('   - Informar al usuario que convierta PDFs a imagen primero');
  console.log('   - Mantener el sistema simple y sin dependencias\n');

  process.exit(0);
}

testPDFProcessing();

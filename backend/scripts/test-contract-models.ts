/**
 * Test script to compare different AI models for contract extraction
 * Usage: npx ts-node scripts/test-contract-models.ts <path-to-contract-image>
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Models to test via OpenRouter
const OPENROUTER_MODELS = [
  'anthropic/claude-sonnet-4',
  'anthropic/claude-3.5-sonnet',
  'google/gemini-2.0-flash-001',
  'google/gemini-pro-1.5',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
];

// Improved contract extraction prompt
const CONTRACT_EXTRACTION_PROMPT = `Eres un asistente experto en extraer datos de contratos españoles para rellenar formularios de gastos recurrentes. Tu objetivo es proporcionar datos ÚTILES Y ACCIONABLES.

CONTEXTO: El usuario es un autónomo español que quiere registrar un gasto recurrente. Necesita:
- Datos del PROVEEDOR (quien le cobra) - nombre completo y NIF/CIF
- Importe MENSUAL (base imponible, SIN IVA)
- IVA e IRPF aplicables según tipo de contrato
- Fecha de inicio del contrato
- Periodicidad del pago

TIPOS DE CONTRATO Y REGLAS FISCALES EN ESPAÑA:

1. CONTRATO DE ARRENDAMIENTO DE LOCAL COMERCIAL (para actividad profesional):
   - Arrendador (propietario) = PROVEEDOR (parte_a)
   - Arrendatario (inquilino) = CLIENTE (parte_b)
   - IVA = 21% (los alquileres de locales para actividad económica SÍ llevan IVA)
   - IRPF = 19% si el arrendador es persona física (no empresa)
   - Buscar: "renta mensual", "canon arrendaticio", "precio del arrendamiento"
   - La BASE IMPONIBLE es el importe SIN IVA y SIN retenciones

2. CONTRATO DE ARRENDAMIENTO DE VIVIENDA (uso residencial):
   - IVA = 0% (exento)
   - IRPF = 19% si arrendador es persona física

3. CONTRATO DE SUMINISTROS (electricidad, gas, agua, telecom):
   - Empresa suministradora = PROVEEDOR (parte_a)
   - Cliente = parte_b
   - IVA = 21%
   - IRPF = 0%
   - Si solo hay importe anual, dividir entre 12

4. CONTRATO DE SERVICIOS PROFESIONALES:
   - Empresa cliente = parte_a
   - Profesional/autónomo = parte_b
   - IVA = 21%
   - IRPF = 7% (nuevos autónomos) o 15% (general)

CAMPOS A EXTRAER:

1. parte_a_nombre: Nombre COMPLETO del proveedor/arrendador
2. parte_a_cif: NIF/CIF del proveedor (OBLIGATORIO - buscar en todo el documento)
3. parte_b_nombre: Nombre del cliente/arrendatario
4. parte_b_cif: NIF del cliente
5. fecha_inicio: Fecha inicio contrato (formato YYYY-MM-DD). Buscar:
   - "El presente contrato entrará en vigor el día..."
   - "A partir del día..."
   - "Con efectos desde..."
   - Fecha de firma si no hay otra
6. fecha_fin: Fecha fin o null si indefinido
7. importe: BASE IMPONIBLE mensual (el importe SIN IVA).
   - En alquileres, buscar "renta mensual" o el importe base antes de aplicar IVA
   - Ejemplo: si dice "renta de 950,50€ (785,12€ + 21% IVA)", el importe es 785.12
8. periodicidad: "MENSUAL" para alquileres y suministros
9. tipo_iva: 21 para locales comerciales, 0 para vivienda
10. tipo_irpf: 19 si arrendador es persona física, 0 si es empresa
11. concepto: Descripción clara (ej: "Alquiler local comercial C/ Febrero 88")
12. categoria: "Alquiler", "Suministros", "Servicios profesionales", etc.
13. tipo_contrato: "ALQUILER", "SUMINISTROS", "SERVICIOS", "OTRO"
14. notas_extraccion: Array con explicaciones detalladas:
    - Identificación de las partes con sus NIF/CIF
    - Cálculo del importe base (cómo se llegó al número)
    - Justificación de IVA e IRPF aplicados
    - Fecha de inicio identificada
    - Cualquier información relevante adicional

EJEMPLO PARA CONTRATO DE ALQUILER DE LOCAL:
Si el contrato dice:
- Arrendador: D. Alberto Rivilla González, DNI 12345678A
- Arrendataria: Dña. Ana Yusta Pliego, DNI 11096653Q
- Renta mensual: 785,12€ (base imponible) + 21% IVA = 950,50€
- Retención IRPF 19% sobre base: 149,17€
- Destino: actividad profesional
- Inicio: 1 de febrero de 2024

Resultado:
{
  "parte_a_nombre": "D. Alberto Rivilla González",
  "parte_a_cif": "12345678A",
  "parte_b_nombre": "Dña. Ana Yusta Pliego",
  "parte_b_cif": "11096653Q",
  "fecha_inicio": "2024-02-01",
  "fecha_fin": null,
  "importe": 785.12,
  "periodicidad": "MENSUAL",
  "tipo_iva": 21,
  "tipo_irpf": 19,
  "concepto": "Alquiler local comercial para actividad profesional",
  "categoria": "Alquiler",
  "tipo_contrato": "ALQUILER",
  "notas_extraccion": [
    "Arrendador (proveedor): D. Alberto Rivilla González, DNI 12345678A",
    "Arrendataria (cliente): Dña. Ana Yusta Pliego, DNI 11096653Q",
    "Base imponible mensual: 785,12€ (renta antes de IVA)",
    "IVA 21%: 164,87€ (aplicable por ser local para actividad económica)",
    "IRPF 19%: 149,17€ (retención por ser arrendador persona física)",
    "Total a pagar: 785,12 + 164,87 - 149,17 = 800,82€",
    "Fecha inicio: 1 de febrero de 2024",
    "Destino: despacho con cocina y sala de descanso (uso profesional)"
  ]
}

FORMATO DE NÚMEROS:
- Formato español: "3.852,04 €" = 3852.04
- Siempre devolver 2 decimales

Responde ÚNICAMENTE con JSON válido:

{
  "parte_a_nombre": "...",
  "parte_a_cif": "...",
  "parte_b_nombre": "...",
  "parte_b_cif": "...",
  "fecha_inicio": "YYYY-MM-DD",
  "fecha_fin": "YYYY-MM-DD o null",
  "importe": 0.00,
  "periodicidad": "MENSUAL",
  "tipo_iva": 21,
  "tipo_irpf": 0,
  "concepto": "...",
  "categoria": "...",
  "condiciones_pago": "...",
  "clausula_renovacion": "...",
  "tipo_contrato": "...",
  "notas_extraccion": ["..."]
}`;

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.pdf': 'application/pdf',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext] || 'image/jpeg';
}

async function testWithOpenRouter(imagePath: string, model: string): Promise<any> {
  const openrouter = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  });

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath);

  const startTime = Date.now();

  try {
    const response = await openrouter.chat.completions.create({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
            {
              type: 'text',
              text: CONTRACT_EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    const endTime = Date.now();
    const responseText = response.choices[0]?.message?.content || '';

    // Parse JSON from response
    let parsedData = null;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error(`  JSON parse error for ${model}`);
    }

    return {
      model,
      success: true,
      timeMs: endTime - startTime,
      rawResponse: responseText,
      parsedData,
      usage: response.usage,
    };
  } catch (error: any) {
    return {
      model,
      success: false,
      error: error.message,
      timeMs: Date.now() - startTime,
    };
  }
}

async function testWithClaude(imagePath: string): Promise<any> {
  if (!process.env.CLAUDE_API_KEY) {
    return { model: 'claude-direct', success: false, error: 'No CLAUDE_API_KEY' };
  }

  const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
  });

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  const startTime = Date.now();

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: CONTRACT_EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    const endTime = Date.now();
    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    let parsedData = null;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('  JSON parse error for Claude direct');
    }

    return {
      model: 'claude-sonnet-4 (direct)',
      success: true,
      timeMs: endTime - startTime,
      rawResponse: responseText,
      parsedData,
      usage: response.usage,
    };
  } catch (error: any) {
    return {
      model: 'claude-sonnet-4 (direct)',
      success: false,
      error: error.message,
      timeMs: Date.now() - startTime,
    };
  }
}

function evaluateExtraction(data: any): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  if (!data) {
    return { score: 0, issues: ['No data extracted'] };
  }

  // Check required fields
  if (!data.parte_a_nombre) {
    issues.push('Missing proveedor name');
    score -= 15;
  }
  if (!data.parte_a_cif) {
    issues.push('Missing proveedor CIF/NIF');
    score -= 20;
  }
  if (!data.parte_b_nombre) {
    issues.push('Missing cliente name');
    score -= 10;
  }
  if (!data.parte_b_cif) {
    issues.push('Missing cliente NIF');
    score -= 10;
  }
  if (!data.fecha_inicio) {
    issues.push('Missing fecha_inicio');
    score -= 15;
  }
  if (!data.importe || data.importe <= 0) {
    issues.push('Invalid or missing importe');
    score -= 20;
  }
  if (data.tipo_iva === undefined || data.tipo_iva === null) {
    issues.push('Missing tipo_iva');
    score -= 10;
  }
  if (data.tipo_irpf === undefined || data.tipo_irpf === null) {
    issues.push('Missing tipo_irpf');
    score -= 10;
  }
  if (!data.notas_extraccion || data.notas_extraccion.length === 0) {
    issues.push('Missing extraction notes');
    score -= 5;
  }

  return { score: Math.max(0, score), issues };
}

async function main() {
  const imagePath = process.argv[2];

  if (!imagePath) {
    console.log('Usage: npx ts-node scripts/test-contract-models.ts <path-to-contract-image>');
    console.log('\nExample: npx ts-node scripts/test-contract-models.ts ./uploads/documents/1/2026/contract.pdf');
    process.exit(1);
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`File not found: ${imagePath}`);
    process.exit(1);
  }

  console.log('='.repeat(80));
  console.log('CONTRACT EXTRACTION MODEL COMPARISON TEST');
  console.log('='.repeat(80));
  console.log(`\nTesting file: ${imagePath}`);
  console.log(`File size: ${(fs.statSync(imagePath).size / 1024).toFixed(1)} KB\n`);

  const results: any[] = [];

  // Test with Claude direct API first
  console.log('\n--- Testing Claude Sonnet 4 (Direct API) ---');
  const claudeResult = await testWithClaude(imagePath);
  results.push(claudeResult);
  if (claudeResult.success) {
    console.log(`  Time: ${claudeResult.timeMs}ms`);
    const eval_result = evaluateExtraction(claudeResult.parsedData);
    console.log(`  Score: ${eval_result.score}/100`);
    if (eval_result.issues.length > 0) {
      console.log(`  Issues: ${eval_result.issues.join(', ')}`);
    }
  } else {
    console.log(`  Error: ${claudeResult.error}`);
  }

  // Test with OpenRouter models
  for (const model of OPENROUTER_MODELS) {
    console.log(`\n--- Testing ${model} ---`);
    const result = await testWithOpenRouter(imagePath, model);
    results.push(result);

    if (result.success) {
      console.log(`  Time: ${result.timeMs}ms`);
      const eval_result = evaluateExtraction(result.parsedData);
      console.log(`  Score: ${eval_result.score}/100`);
      if (eval_result.issues.length > 0) {
        console.log(`  Issues: ${eval_result.issues.join(', ')}`);
      }
    } else {
      console.log(`  Error: ${result.error}`);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  const successfulResults = results.filter(r => r.success && r.parsedData);
  successfulResults.sort((a, b) => {
    const scoreA = evaluateExtraction(a.parsedData).score;
    const scoreB = evaluateExtraction(b.parsedData).score;
    return scoreB - scoreA;
  });

  console.log('\nRanking by extraction quality:\n');
  successfulResults.forEach((result, index) => {
    const eval_result = evaluateExtraction(result.parsedData);
    console.log(`${index + 1}. ${result.model}`);
    console.log(`   Score: ${eval_result.score}/100 | Time: ${result.timeMs}ms`);
    if (result.parsedData) {
      console.log(`   Proveedor: ${result.parsedData.parte_a_nombre || 'N/A'} (${result.parsedData.parte_a_cif || 'NO CIF'})`);
      console.log(`   Importe: ${result.parsedData.importe || 'N/A'}€ | IVA: ${result.parsedData.tipo_iva}% | IRPF: ${result.parsedData.tipo_irpf}%`);
      console.log(`   Fecha inicio: ${result.parsedData.fecha_inicio || 'N/A'}`);
    }
    console.log('');
  });

  // Show best result details
  if (successfulResults.length > 0) {
    const best = successfulResults[0];
    console.log('\n' + '='.repeat(80));
    console.log(`BEST RESULT: ${best.model}`);
    console.log('='.repeat(80));
    console.log('\nExtracted Data:');
    console.log(JSON.stringify(best.parsedData, null, 2));

    if (best.parsedData?.notas_extraccion) {
      console.log('\nExtraction Notes:');
      best.parsedData.notas_extraccion.forEach((note: string, i: number) => {
        console.log(`  ${i + 1}. ${note}`);
      });
    }
  }

  // Save full results to file
  const outputPath = path.join(path.dirname(imagePath), 'model-comparison-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nFull results saved to: ${outputPath}`);
}

main().catch(console.error);

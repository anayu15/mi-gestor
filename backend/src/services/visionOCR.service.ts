import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import config from '../config';
import { OCRResult, ExtractedInvoiceData, ContractOCRResult, ExtractedContractData } from '../types';
import { validarCIFoNIF } from '../utils/taxCalculations';
import { detectarCategoriaGasto } from '../utils/helpers';
import { createCanvas, loadImage } from 'canvas';

const CATEGORIAS_VALIDAS = [
  'Alquiler',
  'Suministros',
  'Telecomunicaciones',
  'Material de oficina',
  'Software y licencias',
  'Formación',
  'Transporte',
  'Comidas',
  'Publicidad',
  'Servicios profesionales',
  'Seguros',
  'Otros gastos',
];

const EXTRACTION_PROMPT = `Eres un experto en análisis de facturas españolas. Analiza esta imagen de factura y extrae la siguiente información en formato JSON.

CAMPOS A EXTRAER:
1. proveedor_nombre: Nombre de la empresa que emite la factura (obligatorio)
2. proveedor_cif: NIF/CIF del proveedor. NIF personal: 8 dígitos + letra (ej: 12345678A). CIF empresa: letra + 7 dígitos + control (ej: B12345678)
3. fecha_emision: Fecha de emisión (formato ISO: YYYY-MM-DD)
4. numero_factura: Número de factura
5. concepto: Descripción del servicio/producto facturado
6. base_imponible: Base imponible en euros (número decimal)
7. tipo_iva: Porcentaje de IVA aplicado (0, 4, 10, o 21)
8. cuota_iva: Importe del IVA en euros
9. tipo_irpf: Porcentaje de retención IRPF (0, 7, 15, o 19)
10. cuota_irpf: Importe de la retención IRPF en euros
11. total_factura: Total de la factura en euros
12. categoria: Categoría del gasto (ver lista abajo)

CATEGORÍAS VÁLIDAS (elige la más apropiada):
- Alquiler: Para alquiler de local, oficina, parking
- Suministros: Luz, agua, gas
- Telecomunicaciones: Internet, teléfono, móvil
- Material de oficina: Papelería, mobiliario
- Software y licencias: Suscripciones software, hosting
- Formación: Cursos, certificaciones
- Transporte: Combustible, taxis, transporte público
- Comidas: Comidas de negocio
- Publicidad: Marketing, publicidad online/offline
- Servicios profesionales: Asesoría, gestoría, abogados
- Seguros: Seguros de actividad, responsabilidad civil
- Otros gastos: Cualquier otro gasto deducible

INSTRUCCIONES:
- Si un campo no está visible o no puedes determinarlo con certeza, usa null
- Para importes, usa números decimales sin símbolo de euro (ej: 150.50, no "150,50€")
- Fecha en formato ISO: "2024-01-15"
- El NIF/CIF debe tener el formato correcto: NIF (8 dígitos + letra) o CIF (letra + 7 dígitos + control)
- Si no puedes determinar la categoría, usa "Otros gastos"
- Busca palabras clave: "Base imponible", "IVA", "IRPF", "Retención", "Total"

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional:

{
  "proveedor_nombre": "...",
  "proveedor_cif": "...",
  "fecha_emision": "YYYY-MM-DD",
  "numero_factura": "...",
  "concepto": "...",
  "base_imponible": 0.00,
  "tipo_iva": 21,
  "cuota_iva": 0.00,
  "tipo_irpf": 0,
  "cuota_irpf": 0.00,
  "total_factura": 0.00,
  "categoria": "..."
}`;

/**
 * Process invoice image with Claude Vision API
 */
async function processWithClaude(imagePath: string): Promise<OCRResult> {
  const anthropic = new Anthropic({
    apiKey: config.vision.claudeApiKey,
  });

  // Read and encode image
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath);

  // Call Claude Vision API
  const message = await anthropic.messages.create({
    model: config.vision.claudeModel,
    max_tokens: 1024,
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
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  // Extract JSON from response
  const responseText = message.content[0].type === 'text'
    ? message.content[0].text
    : '';

  const extractedData = parseJSONResponse(responseText);

  // Validate and post-process
  const processedData = postProcessExtractedData(extractedData);

  // Calculate confidence based on completeness
  const confidence = calculateConfidence(processedData);

  return {
    text: responseText,
    confidence,
    data: processedData,
    requiresReview: confidence < 80 || hasInvalidData(processedData),
  };
}

/**
 * Process invoice image with OpenAI GPT-4 Vision
 */
async function processWithOpenAI(imagePath: string): Promise<OCRResult> {
  const openai = new OpenAI({
    apiKey: config.vision.openaiApiKey,
  });

  // Read and encode image
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath);

  // Call OpenAI Vision API
  const response = await openai.chat.completions.create({
    model: config.vision.openaiModel,
    max_tokens: 1024,
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
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  const responseText = response.choices[0]?.message?.content || '';
  const extractedData = parseJSONResponse(responseText);
  const processedData = postProcessExtractedData(extractedData);
  const confidence = calculateConfidence(processedData);

  return {
    text: responseText,
    confidence,
    data: processedData,
    requiresReview: confidence < 80 || hasInvalidData(processedData),
  };
}

/**
 * Process invoice image with OpenRouter (supports multiple AI models)
 */
async function processWithOpenRouter(imagePath: string): Promise<OCRResult> {
  const openrouter = new OpenAI({
    apiKey: config.vision.openrouterApiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });

  // Read and encode image
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath);

  // Call OpenRouter API (compatible with OpenAI format)
  const response = await openrouter.chat.completions.create({
    model: config.vision.openrouterModel,
    max_tokens: 1024,
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
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  const responseText = response.choices[0]?.message?.content || '';
  const extractedData = parseJSONResponse(responseText);
  const processedData = postProcessExtractedData(extractedData);
  const confidence = calculateConfidence(processedData);

  return {
    text: responseText,
    confidence,
    data: processedData,
    requiresReview: confidence < 80 || hasInvalidData(processedData),
  };
}

/**
 * Check if file is PDF
 */
function isPDF(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.pdf';
}

/**
 * Convert PDF to PNG image using pdfjs-dist (renders ALL pages into one tall image)
 */
async function convertPDFToImage(pdfPath: string): Promise<string> {
  try {
    console.log('📄 Convirtiendo PDF a imagen (todas las páginas) con pdftoppm...');

    const outputDir = path.dirname(pdfPath);
    const baseName = path.basename(pdfPath, '.pdf');
    const outputPrefix = path.join(outputDir, baseName + '_page');
    const finalPngPath = path.join(outputDir, baseName + '_converted.png');

    // Use pdftoppm from poppler to convert pages to PNG
    // -png = output format
    // -r 300 = resolution (300 DPI for high quality OCR)
    // -l 3 = limit to first 3 pages (financial info is usually in first pages)
    const pdftoppmCmd = `pdftoppm -png -r 300 -l 3 "${pdfPath}" "${outputPrefix}"`;

    try {
      execSync(pdftoppmCmd, { stdio: 'pipe' });
    } catch (cmdError: any) {
      console.error('pdftoppm failed, trying fallback:', cmdError.message);
      return convertPDFToImageFallback(pdfPath);
    }

    // Find all generated page images
    const files = fs.readdirSync(outputDir);
    const pageFiles = files
      .filter(f => f.startsWith(baseName + '_page') && f.endsWith('.png'))
      .sort(); // Sort to ensure correct page order

    console.log(`📄 PDF tiene ${pageFiles.length} página(s)`);

    if (pageFiles.length === 0) {
      throw new Error('No se generaron imágenes de páginas');
    }

    // If only one page, just rename it
    if (pageFiles.length === 1) {
      const singlePagePath = path.join(outputDir, pageFiles[0]);
      fs.renameSync(singlePagePath, finalPngPath);
      console.log(`✅ PDF convertido a: ${finalPngPath} (1 página)`);
      return finalPngPath;
    }

    // Multiple pages - combine them into one tall image
    const pageImages = await Promise.all(
      pageFiles.map(async (f) => {
        const pagePath = path.join(outputDir, f);
        const img = await loadImage(pagePath);
        return { img, width: img.width, height: img.height, path: pagePath };
      })
    );

    // Calculate total dimensions (limit to max 8000px height for API compatibility)
    const MAX_HEIGHT = 8000;
    let totalHeight = 0;
    let maxWidth = 0;
    let pagesToUse = [];

    for (const page of pageImages) {
      if (totalHeight + page.height > MAX_HEIGHT) {
        console.log(`  ⚠️ Limitando a ${pagesToUse.length} páginas para no exceder ${MAX_HEIGHT}px de altura`);
        break;
      }
      pagesToUse.push(page);
      totalHeight += page.height;
      maxWidth = Math.max(maxWidth, page.width);
      console.log(`  ✓ Página cargada (${page.width}x${page.height})`);
    }

    // Clean up unused page files
    for (const page of pageImages) {
      if (!pagesToUse.includes(page) && fs.existsSync(page.path)) {
        fs.unlinkSync(page.path);
      }
    }

    // Create combined canvas
    const combinedCanvas = createCanvas(maxWidth, totalHeight);
    const ctx = combinedCanvas.getContext('2d');

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, maxWidth, totalHeight);

    // Draw all pages vertically
    let currentY = 0;
    for (const page of pagesToUse) {
      ctx.drawImage(page.img, 0, currentY);
      currentY += page.height;
      // Clean up individual page file
      if (fs.existsSync(page.path)) {
        fs.unlinkSync(page.path);
      }
    }

    // Save combined image
    const pngBuffer = combinedCanvas.toBuffer('image/png');
    fs.writeFileSync(finalPngPath, pngBuffer);

    console.log(`✅ PDF convertido a: ${finalPngPath} (${pagesToUse.length} páginas combinadas, ${maxWidth}x${totalHeight}px)`);
    return finalPngPath;
  } catch (error: any) {
    console.error('Error converting PDF:', error);
    console.log('⚠️ Intentando fallback con QuickLook...');
    return convertPDFToImageFallback(pdfPath);
  }
}

/**
 * Fallback PDF conversion using macOS qlmanage (only first page)
 */
async function convertPDFToImageFallback(pdfPath: string): Promise<string> {
  const outputDir = path.dirname(pdfPath);
  const command = `qlmanage -t -s 2048 -o "${outputDir}" "${pdfPath}"`;

  execSync(command, { stdio: 'pipe' });

  const generatedPngPath = `${pdfPath}.png`;
  if (!fs.existsSync(generatedPngPath)) {
    throw new Error('El archivo PNG no se creó correctamente');
  }

  const pngFileName = path.basename(pdfPath, '.pdf') + '_converted.png';
  const finalPngPath = path.join(outputDir, pngFileName);
  fs.renameSync(generatedPngPath, finalPngPath);

  console.log(`✅ PDF convertido (fallback - solo página 1): ${finalPngPath}`);
  return finalPngPath;
}

/**
 * Main function to process invoice with selected provider
 */
export async function extractInvoiceData(imagePath: string): Promise<OCRResult> {
  // Validate file exists and size
  const stats = fs.statSync(imagePath);
  if (stats.size > config.vision.maxImageSize) {
    throw new Error(`Archivo demasiado grande. Máximo ${config.vision.maxImageSize / 1048576}MB`);
  }

  let processPath = imagePath;
  let convertedImagePath: string | null = null;

  // Convert PDF to image if needed
  if (isPDF(imagePath)) {
    try {
      convertedImagePath = await convertPDFToImage(imagePath);
      processPath = convertedImagePath;
    } catch (error: any) {
      throw new Error(`Error al procesar el PDF: ${error.message}`);
    }
  }

  // Process with selected provider
  try {
    let result: OCRResult;
    const provider = config.vision.provider.toLowerCase().trim();

    if (provider === 'claude' || provider === 'anthropic') {
      result = await processWithClaude(processPath);
    } else if (provider === 'openai') {
      result = await processWithOpenAI(processPath);
    } else if (provider === 'openrouter') {
      result = await processWithOpenRouter(processPath);
    } else {
      throw new Error(`Provider no soportado: ${config.vision.provider}`);
    }

    // Clean up converted image
    if (convertedImagePath && fs.existsSync(convertedImagePath)) {
      fs.unlinkSync(convertedImagePath);
      console.log(`🧹 Imagen temporal eliminada: ${convertedImagePath}`);
    }

    return result;
  } catch (error: any) {
    console.error('Vision API error:', error);

    // Clean up converted image on error
    if (convertedImagePath && fs.existsSync(convertedImagePath)) {
      fs.unlinkSync(convertedImagePath);
      console.log(`🧹 Imagen temporal eliminada (error): ${convertedImagePath}`);
    }

    // Handle specific API errors
    if (error.status === 401) {
      throw new Error('API key inválida. Contacta al administrador.');
    } else if (error.status === 429) {
      throw new Error('Límite de API excedido. Intenta más tarde.');
    } else if (error.status === 413) {
      throw new Error('Archivo demasiado grande. Reduce el tamaño.');
    } else {
      throw new Error(`Error al procesar el archivo: ${error.message}`);
    }
  }
}

/**
 * Helper functions
 */

function getMimeType(filePath: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, any> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext] || 'image/jpeg';
}

function parseJSONResponse(text: string): ExtractedInvoiceData {
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Failed to parse JSON response:', text);
    return {};
  }
}

function postProcessExtractedData(data: ExtractedInvoiceData): ExtractedInvoiceData {
  const processed = { ...data };

  // Validate and correct NIF/CIF
  if (processed.proveedor_cif) {
    processed.proveedor_cif = processed.proveedor_cif.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!validarCIFoNIF(processed.proveedor_cif)) {
      console.warn('Invalid NIF/CIF detected:', processed.proveedor_cif);
    }
  }

  // Validate categoria
  if (processed.categoria && !CATEGORIAS_VALIDAS.includes(processed.categoria)) {
    // Try to auto-detect from concepto
    processed.categoria = detectarCategoriaGasto(processed.concepto || '');
  }

  // Ensure numeric fields are numbers
  if (processed.base_imponible !== undefined) {
    processed.base_imponible = parseFloat(String(processed.base_imponible));
  }
  if (processed.tipo_iva !== undefined) {
    processed.tipo_iva = parseFloat(String(processed.tipo_iva));
  }
  if (processed.cuota_iva !== undefined) {
    processed.cuota_iva = parseFloat(String(processed.cuota_iva));
  }
  if (processed.tipo_irpf !== undefined) {
    processed.tipo_irpf = parseFloat(String(processed.tipo_irpf));
  }
  if (processed.cuota_irpf !== undefined) {
    processed.cuota_irpf = parseFloat(String(processed.cuota_irpf));
  }
  if (processed.total_factura !== undefined) {
    processed.total_factura = parseFloat(String(processed.total_factura));
  }

  // Validate date format
  if (processed.fecha_emision && !/^\d{4}-\d{2}-\d{2}$/.test(processed.fecha_emision)) {
    console.warn('Invalid date format:', processed.fecha_emision);
    processed.fecha_emision = undefined;
  }

  return processed;
}

function calculateConfidence(data: ExtractedInvoiceData): number {
  const requiredFields = ['proveedor_nombre', 'fecha_emision', 'base_imponible', 'categoria'];
  const optionalFields = ['proveedor_cif', 'numero_factura', 'tipo_iva', 'total_factura'];

  let score = 0;
  let maxScore = 0;

  // Required fields: 20 points each
  requiredFields.forEach((field) => {
    maxScore += 20;
    if (data[field as keyof ExtractedInvoiceData] !== undefined &&
        data[field as keyof ExtractedInvoiceData] !== null) {
      score += 20;
    }
  });

  // Optional fields: 5 points each
  optionalFields.forEach((field) => {
    maxScore += 5;
    if (data[field as keyof ExtractedInvoiceData] !== undefined &&
        data[field as keyof ExtractedInvoiceData] !== null) {
      score += 5;
    }
  });

  return Math.round((score / maxScore) * 100);
}

function hasInvalidData(data: ExtractedInvoiceData): boolean {
  // Check for invalid NIF/CIF
  if (data.proveedor_cif && !validarCIFoNIF(data.proveedor_cif)) {
    return true;
  }

  // Check for invalid IVA percentage
  if (data.tipo_iva !== undefined && ![0, 4, 10, 21].includes(data.tipo_iva)) {
    return true;
  }

  // Check for invalid IRPF percentage
  if (data.tipo_irpf !== undefined && ![0, 7, 15, 19].includes(data.tipo_irpf)) {
    return true;
  }

  // Check for negative amounts
  if (data.base_imponible !== undefined && data.base_imponible < 0) {
    return true;
  }

  return false;
}

// ============================================================================
// CONTRACT EXTRACTION
// ============================================================================

const CONTRACT_EXTRACTION_PROMPT = `Eres un asistente experto en extraer datos de contratos españoles para rellenar formularios de gastos recurrentes. Tu objetivo es proporcionar datos ÚTILES Y ACCIONABLES para crear un gasto programado.

CONTEXTO: El usuario es un autónomo español que quiere registrar un gasto recurrente basado en un contrato. Necesita:
- Datos del PROVEEDOR (quien le cobra) - SIEMPRE incluir NIF/CIF
- Importe MENSUAL estimado (base imponible, SIN IVA)
- IVA e IRPF TAL COMO APARECEN EN EL CONTRATO
- Fecha de inicio del contrato
- Periodicidad del pago

REGLA IMPORTANTE: Los porcentajes de IVA e IRPF deben extraerse DIRECTAMENTE de lo que dice el contrato, no inferirse. Si el contrato especifica "IVA 21%" o "retención IRPF 19%", usar esos valores exactos.

IDENTIFICACIÓN DEL TIPO DE CONTRATO Y PARTES:

1. CONTRATO DE ARRENDAMIENTO (local comercial o vivienda):
   - ARRENDADOR (propietario) = PROVEEDOR (parte_a) - quien COBRA el alquiler
   - ARRENDATARIO (inquilino) = CLIENTE (parte_b) - quien PAGA el alquiler
   - Buscar "renta mensual", "canon arrendaticio", "precio del arrendamiento"
   - La BASE IMPONIBLE es el importe de renta SIN IVA y SIN retenciones
   - EXTRAER el IVA e IRPF tal como aparecen en el contrato
   - IMPORTANTE: Buscar el NIF/CIF del arrendador en TODO el documento (cabecera, cláusulas, firmas)

2. CONTRATO DE SUMINISTROS (electricidad, gas, agua, telecomunicaciones):
   - Empresa suministradora = PROVEEDOR (parte_a)
   - Cliente = parte_b
   - EXTRAER el IVA tal como aparece en el contrato
   - Si solo hay importe anual, dividir entre 12

3. CONTRATO DE SERVICIOS PROFESIONALES:
   - Empresa cliente = parte_a
   - Profesional/autónomo = parte_b
   - EXTRAER el IVA e IRPF tal como aparecen en el contrato

CAMPOS A EXTRAER (TODOS OBLIGATORIOS SALVO INDICACIÓN):

1. parte_a_nombre: Nombre COMPLETO del proveedor/arrendador (empresa o persona)
2. parte_a_cif: NIF/CIF del proveedor - BUSCAR EN TODO EL DOCUMENTO (cabecera, comparecencia, firmas)
   - NIF persona física: 8 dígitos + letra (ej: 12345678A, 51455371R)
   - CIF empresa: letra + 8 caracteres (ej: B16437717, A67760876)
   - Si hay representante de empresa, poner el CIF de la EMPRESA, no del representante
3. parte_b_nombre: Nombre del cliente/arrendatario
4. parte_b_cif: NIF del cliente
5. fecha_inicio: Fecha de INICIO DE VIGENCIA del contrato (formato YYYY-MM-DD).
   IMPORTANTE: NO es la fecha de firma. Buscar EN ESTE ORDEN DE PRIORIDAD:
   - PRIMERO buscar en cláusulas de duración: "a contar desde el día X", "con efectos desde el día X"
   - "El presente contrato entrará en vigor el día..."
   - "A partir del día..."
   - "La duración del contrato será de X años a contar desde el día..."
   - SOLO si no hay fecha de vigencia explícita, usar la fecha de firma como último recurso
   NOTA: La fecha de firma (ej: "En Madrid, a 14 de enero de 2026") es DIFERENTE de la fecha de inicio de vigencia
6. fecha_fin: Fecha fin o null si indefinido/renovable
7. importe: BASE IMPONIBLE mensual (el importe SIN IVA)
   - En alquileres: si dice "950€ IVA incluido" y el IVA es 21%, calcular: 950/1.21 = 785.12€
   - Si dice "renta de 785,12€ + IVA", el importe es 785.12
8. periodicidad: "MENSUAL" para alquileres y suministros
9. tipo_iva: EXTRAER del contrato (buscar "IVA X%", "21% de IVA", etc.)
10. tipo_irpf: EXTRAER del contrato (buscar "retención X%", "IRPF X%", etc.). Si no se menciona, usar 0
11. concepto: Descripción clara (ej: "Alquiler local comercial C/ Cebreros 88")
12. categoria: "Alquiler", "Suministros", "Servicios profesionales", etc.
13. condiciones_pago: Forma y plazo de pago (ej: "Domiciliación en los 5 primeros días del mes")
14. clausula_renovacion: Info sobre renovación automática si existe
15. tipo_contrato: "ALQUILER", "SUMINISTROS", "SERVICIOS", "OTRO"
16. notas_extraccion: Array con explicaciones detalladas:
    - Identificación de las partes con sus NIF/CIF completos
    - Cómo se determinó la base imponible
    - Justificación del IVA e IRPF aplicados
    - Fecha de inicio identificada y su ubicación en el documento
    - Cálculo del total a pagar si aplica

EJEMPLO PARA CONTRATO DE ALQUILER:
Si el contrato dice:
- Fecha de firma: "En Madrid, a 14 de enero de 2026"
- Arrendador: BATANHOUSE S.L. (CIF B16437717), representada por D. Alberto Rivilla González (DNI 51455371R)
- Arrendataria: Dña. Ana Yusta Pliego (DNI 11086683Q)
- Renta mensual: 950€ IVA incluido
- IVA: 21%
- Retención IRPF: 19%
- Cláusula de duración: "1 año a contar desde el día 17 de enero de 2026"

IMPORTANTE: La fecha de firma es 14 de enero, pero la fecha de INICIO DE VIGENCIA es 17 de enero.
Usar fecha_inicio = "2026-01-17" (la fecha de vigencia, NO la de firma)

Cálculo:
- Base imponible: 950 / 1.21 = 785.12€
- IVA 21% (según contrato): 785.12 * 0.21 = 164.88€
- IRPF 19% (según contrato): 785.12 * 0.19 = 149.17€
- Total a pagar: 785.12 + 164.88 - 149.17 = 800.83€

Resultado:
{
  "parte_a_nombre": "BATANHOUSE S.L.",
  "parte_a_cif": "B16437717",
  "parte_b_nombre": "Ana Yusta Pliego",
  "parte_b_cif": "11086683Q",
  "fecha_inicio": "2026-01-17",
  "fecha_fin": "2027-01-16",
  "importe": 785.12,
  "periodicidad": "MENSUAL",
  "tipo_iva": 21,
  "tipo_irpf": 19,
  "concepto": "Alquiler local comercial C/ Cebreros 88, 24A Madrid",
  "categoria": "Alquiler",
  "condiciones_pago": "Domiciliación bancaria en los 5 primeros días del mes",
  "clausula_renovacion": "Prórroga automática por períodos de 1 año salvo preaviso de 30 días",
  "tipo_contrato": "ALQUILER",
  "notas_extraccion": [
    "Arrendador (proveedor): BATANHOUSE S.L., CIF B16437717 (representada por Alberto Rivilla González)",
    "Arrendataria (cliente): Ana Yusta Pliego, DNI 11086683Q",
    "Base imponible: 785.12€ (950€ IVA incluido / 1.21)",
    "IVA 21% según contrato: 164.88€",
    "IRPF 19% según contrato: 149.17€",
    "Total mensual a pagar: 785.12 + 164.88 - 149.17 = 800.83€",
    "Fecha firma contrato: 14 de enero de 2026",
    "Fecha inicio vigencia: 17 de enero de 2026 (según cláusula de duración)",
    "Destino: uso profesional como despacho"
  ]
}

FORMATO DE NÚMEROS:
- Formato español: "3.852,04 €" = 3852.04
- Siempre devolver 2 decimales

INSTRUCCIONES PARA SUMINISTROS (electricidad, gas):
- Si hay importe anual, dividir entre 12
- IVA siempre 21%, IRPF siempre 0%

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

/**
 * Process contract image with Claude Vision API
 */
async function processContractWithClaude(imagePath: string): Promise<ContractOCRResult> {
  const anthropic = new Anthropic({
    apiKey: config.vision.claudeApiKey,
  });

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath);

  const message = await anthropic.messages.create({
    model: config.vision.claudeModel,
    max_tokens: 2048,
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

  const responseText = message.content[0].type === 'text'
    ? message.content[0].text
    : '';

  const extractedData = parseContractJSONResponse(responseText);
  const processedData = postProcessContractData(extractedData);
  const confidence = calculateContractConfidence(processedData);

  return {
    text: responseText,
    confidence,
    data: processedData,
    requiresReview: confidence < 80 || hasInvalidContractData(processedData),
  };
}

/**
 * Process contract image with OpenAI GPT-4 Vision
 */
async function processContractWithOpenAI(imagePath: string): Promise<ContractOCRResult> {
  const openai = new OpenAI({
    apiKey: config.vision.openaiApiKey,
  });

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath);

  const response = await openai.chat.completions.create({
    model: config.vision.openaiModel,
    max_tokens: 2048,
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

  const responseText = response.choices[0]?.message?.content || '';
  const extractedData = parseContractJSONResponse(responseText);
  const processedData = postProcessContractData(extractedData);
  const confidence = calculateContractConfidence(processedData);

  return {
    text: responseText,
    confidence,
    data: processedData,
    requiresReview: confidence < 80 || hasInvalidContractData(processedData),
  };
}

/**
 * Process contract image with OpenRouter
 */
async function processContractWithOpenRouter(imagePath: string): Promise<ContractOCRResult> {
  const openrouter = new OpenAI({
    apiKey: config.vision.openrouterApiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath);

  const response = await openrouter.chat.completions.create({
    model: config.vision.openrouterModel,
    max_tokens: 2048,
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

  const responseText = response.choices[0]?.message?.content || '';
  const extractedData = parseContractJSONResponse(responseText);
  const processedData = postProcessContractData(extractedData);
  const confidence = calculateContractConfidence(processedData);

  return {
    text: responseText,
    confidence,
    data: processedData,
    requiresReview: confidence < 80 || hasInvalidContractData(processedData),
  };
}

/**
 * Process contract with Gemini via OpenRouter (best for PDFs)
 * Gemini 2.0 Flash handles multi-page PDFs natively and performs best on contract extraction
 */
async function processContractWithGemini(filePath: string): Promise<ContractOCRResult> {
  const openrouter = new OpenAI({
    apiKey: config.vision.openrouterApiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });

  const fileBuffer = fs.readFileSync(filePath);
  const base64File = fileBuffer.toString('base64');

  // Determine mime type - Gemini supports PDF directly
  const ext = path.extname(filePath).toLowerCase();
  let mimeType: string;
  if (ext === '.pdf') {
    mimeType = 'application/pdf';
  } else {
    mimeType = getMimeType(filePath);
  }

  console.log(`📄 Procesando contrato con Gemini 2.0 Flash (${mimeType}, ${(fileBuffer.length / 1024).toFixed(1)} KB)`);

  const response = await openrouter.chat.completions.create({
    model: config.vision.contractModel,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64File}`,
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

  const responseText = response.choices[0]?.message?.content || '';
  const extractedData = parseContractJSONResponse(responseText);
  const processedData = postProcessContractData(extractedData);
  const confidence = calculateContractConfidence(processedData);

  console.log(`✅ Extracción completada. Confianza: ${confidence}%`);

  return {
    text: responseText,
    confidence,
    data: processedData,
    requiresReview: confidence < 80 || hasInvalidContractData(processedData),
  };
}

/**
 * Main function to extract contract data
 * Uses Gemini 2.0 Flash by default (via OpenRouter) for best PDF handling and accuracy
 */
export async function extractContractData(imagePath: string): Promise<ContractOCRResult> {
  const stats = fs.statSync(imagePath);
  // Allow larger files for contracts (they can be multi-page PDFs)
  const maxContractSize = 10 * 1024 * 1024; // 10MB for contracts
  if (stats.size > maxContractSize) {
    throw new Error(`Archivo demasiado grande. Máximo 10MB para contratos.`);
  }

  try {
    // Use Gemini by default for contracts - it handles PDFs natively without conversion
    // and has the best accuracy for Spanish contracts (tested: 100/100)
    if (config.vision.openrouterApiKey) {
      console.log('🚀 Usando Gemini 2.0 Flash para extracción de contratos');
      return await processContractWithGemini(imagePath);
    }

    // Fallback to configured provider if no OpenRouter key
    let processPath = imagePath;
    let convertedImagePath: string | null = null;

    if (isPDF(imagePath)) {
      try {
        convertedImagePath = await convertPDFToImage(imagePath);
        processPath = convertedImagePath;
      } catch (error: any) {
        throw new Error(`Error al procesar el PDF: ${error.message}`);
      }
    }

    let result: ContractOCRResult;
    const provider = config.vision.provider.toLowerCase().trim();

    if (provider === 'claude' || provider === 'anthropic') {
      result = await processContractWithClaude(processPath);
    } else if (provider === 'openai') {
      result = await processContractWithOpenAI(processPath);
    } else if (provider === 'openrouter') {
      result = await processContractWithOpenRouter(processPath);
    } else {
      throw new Error(`Provider no soportado: ${config.vision.provider}`);
    }

    if (convertedImagePath && fs.existsSync(convertedImagePath)) {
      fs.unlinkSync(convertedImagePath);
    }

    return result;
  } catch (error: any) {
    console.error('Error en extracción de contrato:', error);

    if (error.status === 401) {
      throw new Error('API key inválida. Contacta al administrador.');
    } else if (error.status === 429) {
      throw new Error('Límite de API excedido. Intenta más tarde.');
    } else if (error.status === 413) {
      throw new Error('Archivo demasiado grande. Reduce el tamaño.');
    } else {
      throw new Error(`Error al procesar el contrato: ${error.message}`);
    }
  }
}

function parseContractJSONResponse(text: string): ExtractedContractData {
  try {
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;
    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Failed to parse contract JSON response:', text);
    return {};
  }
}

function postProcessContractData(data: ExtractedContractData): ExtractedContractData {
  const processed = { ...data };

  // Validate and correct NIF/CIF for both parties
  if (processed.parte_a_cif) {
    processed.parte_a_cif = processed.parte_a_cif.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!validarCIFoNIF(processed.parte_a_cif)) {
      console.warn('Invalid parte_a NIF/CIF:', processed.parte_a_cif);
    }
  }

  if (processed.parte_b_cif) {
    processed.parte_b_cif = processed.parte_b_cif.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!validarCIFoNIF(processed.parte_b_cif)) {
      console.warn('Invalid parte_b NIF/CIF:', processed.parte_b_cif);
    }
  }

  // Validate categoria
  if (processed.categoria && !CATEGORIAS_VALIDAS.includes(processed.categoria)) {
    processed.categoria = detectarCategoriaGasto(processed.concepto || '');
  }

  // Ensure numeric fields are numbers
  if (processed.importe !== undefined) {
    processed.importe = parseFloat(String(processed.importe));
  }
  if (processed.tipo_iva !== undefined) {
    processed.tipo_iva = parseFloat(String(processed.tipo_iva));
  }
  if (processed.tipo_irpf !== undefined) {
    processed.tipo_irpf = parseFloat(String(processed.tipo_irpf));
  }

  // Validate date formats
  if (processed.fecha_inicio && !/^\d{4}-\d{2}-\d{2}$/.test(processed.fecha_inicio)) {
    console.warn('Invalid fecha_inicio format:', processed.fecha_inicio);
    processed.fecha_inicio = undefined;
  }
  if (processed.fecha_fin && !/^\d{4}-\d{2}-\d{2}$/.test(processed.fecha_fin)) {
    console.warn('Invalid fecha_fin format:', processed.fecha_fin);
    processed.fecha_fin = undefined;
  }

  // Validate periodicidad
  const validPeriodicidades = ['MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'];
  if (processed.periodicidad && !validPeriodicidades.includes(processed.periodicidad)) {
    processed.periodicidad = 'MENSUAL';
  }

  return processed;
}

function calculateContractConfidence(data: ExtractedContractData): number {
  const requiredFields = ['parte_a_nombre', 'parte_b_nombre', 'fecha_inicio', 'importe', 'periodicidad'];
  const optionalFields = ['parte_a_cif', 'parte_b_cif', 'tipo_iva', 'concepto', 'categoria', 'condiciones_pago'];

  let score = 0;
  let maxScore = 0;

  // Required fields: 15 points each
  requiredFields.forEach((field) => {
    maxScore += 15;
    if (data[field as keyof ExtractedContractData] !== undefined &&
        data[field as keyof ExtractedContractData] !== null) {
      score += 15;
    }
  });

  // Optional fields: 5 points each
  optionalFields.forEach((field) => {
    maxScore += 5;
    if (data[field as keyof ExtractedContractData] !== undefined &&
        data[field as keyof ExtractedContractData] !== null) {
      score += 5;
    }
  });

  return Math.round((score / maxScore) * 100);
}

function hasInvalidContractData(data: ExtractedContractData): boolean {
  // Check for invalid NIF/CIF on both parties
  if (data.parte_a_cif && !validarCIFoNIF(data.parte_a_cif)) {
    return true;
  }
  if (data.parte_b_cif && !validarCIFoNIF(data.parte_b_cif)) {
    return true;
  }

  // Check for invalid IVA percentage
  if (data.tipo_iva !== undefined && ![0, 4, 10, 21].includes(data.tipo_iva)) {
    return true;
  }

  // Check for invalid IRPF percentage
  if (data.tipo_irpf !== undefined && ![0, 7, 15, 19].includes(data.tipo_irpf)) {
    return true;
  }

  // Check for negative amounts
  if (data.importe !== undefined && data.importe < 0) {
    return true;
  }

  return false;
}

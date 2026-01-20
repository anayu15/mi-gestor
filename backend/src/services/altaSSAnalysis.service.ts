/**
 * Alta SS (RETA) Document Analysis Service
 * 
 * Analyzes uploaded "Alta en el RETA" (Régimen Especial de Trabajadores Autónomos)
 * documents using AI to extract Social Security settings and recommendations.
 * 
 * Similar architecture to modelo036Analysis.service.ts - uses Gemini 2.0 Flash
 * via OpenRouter for native PDF support.
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

// ============================================================================
// TYPES
// ============================================================================

export interface AltaSSExtractedData {
  nif: string | null;
  nombre_completo: string | null;
  numero_afiliacion: string | null;
  fecha_alta_reta: string | null;
  fecha_efectos: string | null;
  actividad_economica: string | null;
  cnae_codigo: string | null;
  base_cotizacion_elegida: number | null;
  base_minima_tramo: number | null;
  base_maxima_tramo: number | null;
  tramo_rendimientos: string | null;
  tiene_tarifa_plana: boolean;
  tipo_bonificacion: string | null;
  fecha_inicio_bonificacion: string | null;
  fecha_fin_bonificacion: string | null;
  cuota_bonificada: number | null;
  regimen: string | null;
  grupo_cotizacion: string | null;
  es_autonomo_societario: boolean;
  es_pluriactividad: boolean;
}

export interface AltaSSRecommendations {
  tarifa_plana: {
    requerido: boolean;
    explicacion: string;
  };
  base_cotizacion: {
    valor_recomendado: number | null;
    explicacion: string;
  };
}

export interface AltaSSAnalysisResult {
  datos_extraidos: AltaSSExtractedData;
  recomendaciones: AltaSSRecommendations;
  confianza: number;
  notas_extraccion: string[];
  raw_response: string;
}

// ============================================================================
// EXTRACTION PROMPT FOR ALTA RETA DOCUMENTS
// ============================================================================

const ALTA_SS_EXTRACTION_PROMPT = `Eres un experto en documentos de la Seguridad Social Española. Analiza este documento de Alta en el RETA (Régimen Especial de Trabajadores Autónomos) y extrae la información necesaria para configurar las opciones de Seguridad Social del autónomo.

IMPORTANTE: Lee TODAS las páginas del documento cuidadosamente. Los documentos de alta del RETA contienen información crítica sobre la cotización del trabajador autónomo.

## TIPOS DE DOCUMENTOS POSIBLES

1. **TA.0521/1 - Solicitud Alta/Baja/Variación RETA**
   - Formulario oficial de la Tesorería General de la Seguridad Social
   - Contiene datos de identificación, actividad y base de cotización

2. **Resolución de Alta en RETA**
   - Documento de resolución emitido por la TGSS
   - Confirma el alta efectiva y condiciones

3. **Comunicación de Alta/Bonificación**
   - Puede incluir información sobre tarifa plana u otras bonificaciones
   - Indica fechas de inicio y fin de bonificaciones

## INFORMACIÓN A BUSCAR

### DATOS DE IDENTIFICACIÓN
- NIF/NIE del trabajador
- Nombre completo
- Número de afiliación a la Seguridad Social (NAF) - formato: XX/XXXXXXXX/XX

### DATOS DEL ALTA
- Fecha de alta en el RETA
- Fecha de efectos (puede ser distinta a la fecha de alta)
- Actividad económica/profesional
- Código CNAE si aparece

### BASE DE COTIZACIÓN
- Base de cotización elegida (en euros mensuales)
- Tramo de rendimientos (T1, T2, T3... según tabla 2024-2025)
- Base mínima y máxima del tramo

### BONIFICACIONES
- **TARIFA PLANA**: Bonificación para nuevos autónomos
  - 80€/mes durante los primeros 12 meses (más MEI 0,9%)
  - Total aproximado: 88,56€/mes con base mínima
  - Puede extenderse 12 meses más con rendimientos < SMI
- **PLURIACTIVIDAD**: Reducción del 50% si también trabaja por cuenta ajena
- **OTRAS**: Discapacidad, víctimas violencia género, etc.

### RÉGIMEN Y SITUACIÓN
- Régimen: RETA, Agrario, del Mar, etc.
- Si es autónomo societario (administrador de sociedad)
- Si está en situación de pluriactividad

## CAMPOS A EXTRAER

Responde con este JSON exacto:

{
  "datos_extraidos": {
    "nif": "NIF/NIE del trabajador",
    "nombre_completo": "Nombre y apellidos completos",
    "numero_afiliacion": "Número de afiliación SS (NAF)",
    "fecha_alta_reta": "YYYY-MM-DD (fecha de alta)",
    "fecha_efectos": "YYYY-MM-DD (fecha de efectos)",
    "actividad_economica": "Descripción de la actividad",
    "cnae_codigo": "Código CNAE si aparece",
    "base_cotizacion_elegida": 950.98,
    "base_minima_tramo": 950.98,
    "base_maxima_tramo": 1168.38,
    "tramo_rendimientos": "T1|T2|T3|etc.",
    "tiene_tarifa_plana": true,
    "tipo_bonificacion": "TARIFA_PLANA|PLURIACTIVIDAD|DISCAPACIDAD|null",
    "fecha_inicio_bonificacion": "YYYY-MM-DD",
    "fecha_fin_bonificacion": "YYYY-MM-DD",
    "cuota_bonificada": 88.56,
    "regimen": "RETA|AGRARIO|MAR",
    "grupo_cotizacion": "Grupo si aparece",
    "es_autonomo_societario": false,
    "es_pluriactividad": false
  },
  "recomendaciones": {
    "tarifa_plana": {
      "requerido": true,
      "explicacion": "Explicación basada en lo encontrado en el documento"
    },
    "base_cotizacion": {
      "valor_recomendado": 950.98,
      "explicacion": "Explicación de la base recomendada según el documento"
    }
  },
  "confianza": 85,
  "notas_extraccion": [
    "Nota 1 sobre lo que encontraste",
    "Nota 2",
    "Campos identificados: NAF, fecha alta, base, etc."
  ]
}

## REGLAS DE DETERMINACIÓN

### Tarifa Plana:
- REQUERIDO=true si el documento indica bonificación de tarifa plana
- REQUERIDO=true si la fecha de alta es reciente (últimos 12-24 meses) y no hay indicación en contra
- REQUERIDO=false si el documento indica cuota completa sin bonificación
- Si no hay información clara, indica confianza baja y explica

### Base de Cotización:
- Usar la base que aparece en el documento
- Si no aparece, recomendar la base mínima (950,98€ en 2024-2025)
- Si hay tarifa plana, la base afecta solo al MEI (0,9%)

## TABLAS DE REFERENCIA 2025

### Tramos de rendimientos y bases:
- Tramo 1: Rendimientos < 670€ → Base 653,59€ - 718,94€
- Tramo 2: 670€ - 900€ → Base 718,95€ - 900,00€
- Tramo 3: 900€ - 1.166,70€ → Base 872,55€ - 1.166,70€
- Base mínima general: 950,98€
- Base máxima general: 4.720,50€ (2025)

### Cuotas con Tarifa Plana (2024-2025):
- Bonificación fija: 80€/mes
- MEI (0,9%): sobre la base elegida
- Ejemplo con base 950,98€: 80€ + 8,56€ = 88,56€/mes

## IMPORTANTE

- Si no puedes leer un campo, indica null y explica por qué en notas_extraccion
- La confianza debe reflejar la calidad del análisis (0-100)
- Menciona SIEMPRE los campos específicos que pudiste identificar
- Las explicaciones deben ser claras y útiles para el autónomo
- Responde SOLO con JSON válido, sin markdown ni texto adicional`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}

function parseJSONResponse(text: string): any {
  // Try to parse directly
  try {
    return JSON.parse(text);
  } catch (e) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (e2) {
        console.error('Failed to parse JSON from code block:', e2);
      }
    }
    
    // Try to find JSON object in text
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch (e3) {
        console.error('Failed to parse JSON object:', e3);
      }
    }
    
    return null;
  }
}

function getDefaultRecommendations(): AltaSSRecommendations {
  return {
    tarifa_plana: {
      requerido: false,
      explicacion: 'No se pudo determinar del documento',
    },
    base_cotizacion: {
      valor_recomendado: 950.98,
      explicacion: 'Base mínima general recomendada por defecto',
    },
  };
}

function getDefaultExtractedData(): AltaSSExtractedData {
  return {
    nif: null,
    nombre_completo: null,
    numero_afiliacion: null,
    fecha_alta_reta: null,
    fecha_efectos: null,
    actividad_economica: null,
    cnae_codigo: null,
    base_cotizacion_elegida: null,
    base_minima_tramo: null,
    base_maxima_tramo: null,
    tramo_rendimientos: null,
    tiene_tarifa_plana: false,
    tipo_bonificacion: null,
    fecha_inicio_bonificacion: null,
    fecha_fin_bonificacion: null,
    cuota_bonificada: null,
    regimen: null,
    grupo_cotizacion: null,
    es_autonomo_societario: false,
    es_pluriactividad: false,
  };
}

// ============================================================================
// GEMINI 2.0 FLASH PROCESSING (via OpenRouter)
// ============================================================================

/**
 * Process Alta SS document with Gemini 2.0 Flash via OpenRouter
 * Gemini handles multi-page PDFs natively without conversion
 */
async function processWithGemini(filePath: string): Promise<AltaSSAnalysisResult> {
  const openrouter = new OpenAI({
    apiKey: config.vision.openrouterApiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });

  const fileBuffer = fs.readFileSync(filePath);
  const base64File = fileBuffer.toString('base64');
  const mimeType = getMimeType(filePath);

  console.log(`📄 Procesando Alta SS con Gemini 2.0 Flash (${mimeType}, ${(fileBuffer.length / 1024).toFixed(1)} KB)`);

  const response = await openrouter.chat.completions.create({
    model: config.vision.contractModel, // Uses same model as contract extraction (Gemini 2.0 Flash)
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
            text: ALTA_SS_EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  const responseText = response.choices[0]?.message?.content || '';
  console.log('📝 Respuesta recibida, parseando JSON...');

  const parsed = parseJSONResponse(responseText);

  if (!parsed) {
    console.error('❌ No se pudo parsear la respuesta');
    throw new Error('No se pudo analizar la respuesta del modelo de IA');
  }

  const confianza = parsed.confianza || 50;
  console.log(`✅ Extracción completada. Confianza: ${confianza}%`);

  return {
    datos_extraidos: {
      ...getDefaultExtractedData(),
      ...parsed.datos_extraidos,
    },
    recomendaciones: parsed.recomendaciones || getDefaultRecommendations(),
    confianza,
    notas_extraccion: parsed.notas_extraccion || [],
    raw_response: responseText,
  };
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

/**
 * Analyze Alta SS (RETA) document
 * Uses Gemini 2.0 Flash via OpenRouter for native PDF support
 * Same architecture as Modelo 036 and contract extraction
 */
export async function analyzeAltaSS(imagePath: string): Promise<AltaSSAnalysisResult> {
  // Validate file exists
  if (!fs.existsSync(imagePath)) {
    throw new Error('El archivo no existe');
  }

  const stats = fs.statSync(imagePath);
  const maxSize = 10 * 1024 * 1024; // 10MB max

  if (stats.size > maxSize) {
    throw new Error('Archivo demasiado grande. Máximo 10MB');
  }

  try {
    // Use Gemini 2.0 Flash via OpenRouter (handles PDFs natively)
    if (config.vision.openrouterApiKey) {
      console.log('🚀 Usando Gemini 2.0 Flash para análisis de Alta SS');
      return await processWithGemini(imagePath);
    }

    // If no OpenRouter key, throw error
    throw new Error('Se requiere configurar OPENROUTER_API_KEY para analizar documentos PDF');
  } catch (error: any) {
    console.error('Error en análisis de Alta SS:', error);

    if (error.status === 401) {
      throw new Error('API key inválida. Contacta al administrador.');
    } else if (error.status === 429) {
      throw new Error('Límite de API excedido. Intenta más tarde.');
    } else if (error.status === 413) {
      throw new Error('Archivo demasiado grande.');
    } else {
      throw new Error(`Error al analizar el documento de Alta SS: ${error.message}`);
    }
  }
}

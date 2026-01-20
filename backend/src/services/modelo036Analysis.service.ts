import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import config from '../config';

// ============================================================================
// TYPES
// ============================================================================

export interface Modelo036ExtractedData {
  nif?: string;
  nombre_razon_social?: string;
  domicilio_fiscal?: string;
  fecha_presentacion?: string;
  fecha_alta_actividad?: string;
  epigrafe_iae?: string;
  epigrafe_iae_descripcion?: string;
  regimen_iva?: string;
  regimen_irpf?: string;
  tiene_empleados?: boolean;
  operaciones_intracomunitarias?: boolean;
  local_alquilado?: boolean;
  facturacion_estimada_anual?: number;
  sii_obligatorio?: boolean;
}

export interface ModeloRecomendacion {
  requerido: boolean;
  explicacion: string;
}

export interface Modelo036Recommendations {
  modelo_303: ModeloRecomendacion;
  modelo_130: ModeloRecomendacion;
  modelo_131: ModeloRecomendacion;
  modelo_115: ModeloRecomendacion;
  modelo_180: ModeloRecomendacion;
  modelo_390: ModeloRecomendacion;
  modelo_349: ModeloRecomendacion;
  modelo_111: ModeloRecomendacion;
  modelo_190: ModeloRecomendacion;
  sii: ModeloRecomendacion;
  vies_roi: ModeloRecomendacion;
}

export interface Modelo036AnalysisResult {
  datos_extraidos: Modelo036ExtractedData;
  recomendaciones: Modelo036Recommendations;
  confianza: number;
  notas_extraccion: string[];
  raw_response: string;
  // New fields for document type detection
  tipo_documento_detectado?: 'ALTA' | 'MODIFICACION';
  campos_modificados?: string[];
  fecha_efectos?: string;
}

// Document type options for upload
export type TipoDocumento036 = 'ALTA' | 'MODIFICACION';

// ============================================================================
// EXTRACTION PROMPT - VERY DETAILED FOR SPANISH TAX FORM
// Based on official AEAT guidance (Agencia Tributaria) - Updated January 2026
// Reference: https://sede.agenciatributaria.gob.es/Sede/Ayuda/guia-practica-declaracion-censal.html
// ============================================================================

// ============================================================================
// EXTRACTION PROMPT FOR ALTA (Complete new registration)
// ============================================================================

const MODELO_036_ALTA_EXTRACTION_PROMPT = `Eres un experto en documentos fiscales de la Agencia Tributaria Española. Tu tarea es analizar un Modelo 036 (Declaración Censal) y extraer información precisa para determinar las obligaciones fiscales.

## CONTEXTO IMPORTANTE

El Modelo 036 es el formulario oficial de la AEAT para:
- ALTA: Registro inicial en el censo de empresarios, profesionales y retenedores
- MODIFICACIÓN: Cambios en datos ya registrados
- BAJA: Cese de actividad

Desde febrero de 2025, el Modelo 037 (simplificado) fue eliminado. Ahora existe una versión simplificada del propio Modelo 036 para personas físicas que cumplan ciertos requisitos.

## ESTRUCTURA OFICIAL DEL MODELO 036

El formulario tiene múltiples páginas/secciones. NO todas se rellenan siempre - depende del tipo de declarante y causa de presentación.

### PÁGINA 1 - CAUSAS DE PRESENTACIÓN Y FIRMA
Esta página es CRÍTICA para entender el tipo de declaración.

**SECCIÓN: CAUSAS DE PRESENTACIÓN (buscar casillas marcadas con X)**
- Casilla 110: Solicitud de NIF provisional
- Casilla 111: Solicitud de NIF definitivo
- Casilla 120: Alta - Obligado a efectuar operaciones empresariales/profesionales
- Casilla 121: Alta - Obligado a efectuar pagos
- Casilla 122: Alta - Obligado a retener o ingresar a cuenta
- Casilla 127: Alta en el Censo de Empresarios, Profesionales y Retenedores
- Casilla 130: Modificación de datos identificativos
- Casilla 131: Modificación de datos relativos a actividades económicas y locales
- Casilla 132: Modificación de régimen de IVA
- Casilla 133: Modificación de régimen de IRPF
- Casilla 134: Modificación de retenciones e ingresos a cuenta
- Casilla 150: Baja - Cese de actividad

**Fecha y Lugar**: Buscar fecha de presentación en formato DD/MM/YYYY

### PÁGINA 2 - IDENTIFICACIÓN DEL DECLARANTE

Existen 3 versiones según tipo de declarante:
- **Página 2A**: Personas físicas (autónomos individuales)
- **Página 2B**: Personas jurídicas y entidades (sociedades, asociaciones)
- **Página 2C**: Establecimientos permanentes de entidades no residentes

**Campos clave:**
- NIF/CIF: 8 dígitos + letra (personas físicas) o letra + 8 caracteres (sociedades)
- Nombre y apellidos / Razón social
- Domicilio fiscal: Tipo vía, nombre, número, código postal, municipio, provincia
- Teléfono y email de contacto

### PÁGINA 3 - REPRESENTANTES
Solo si actúa mediante representante legal o voluntario.
- NIF del representante
- Nombre del representante
- Tipo de representación

### PÁGINA 4 - ACTIVIDADES ECONÓMICAS Y LOCALES
SECCIÓN MUY IMPORTANTE para determinar obligaciones.

**Datos de la actividad principal:**
- Casilla 400: FECHA DE INICIO de la actividad (formato DD/MM/YYYY) - MUY IMPORTANTE
- Casilla 401: Fecha prevista de cese (si aplica)
- Casilla 402: Epígrafe del IAE (código numérico, ej: 861.1, 749, 841)
- Casilla 403: Descripción de la actividad económica
- Casilla 404-408: Actividades secundarias adicionales
- Casilla 409: Indica si tiene local afecto a la actividad

**Locales de actividad:**
- Dirección del local
- Tipo de local (oficina, taller, comercio, etc.)
- Superficie en m²

### PÁGINA 5 - IMPUESTO SOBRE EL VALOR AÑADIDO (IVA)
SECCIÓN CRÍTICA - Determina modelo 303, 390, etc.

**Alta en IVA y régimen aplicable:**
- Casilla 500: Alta en la obligación de presentar declaraciones-liquidaciones periódicas de IVA
- Casilla 501: Régimen GENERAL de IVA (EL MÁS COMÚN para autónomos profesionales)
- Casilla 502: Régimen SIMPLIFICADO de IVA (módulos, para ciertas actividades)
- Casilla 503: Régimen especial de RECARGO DE EQUIVALENCIA (comercio minorista)
- Casilla 504: Régimen especial de AGRICULTURA, ganadería y pesca
- Casilla 505: SII - Suministro Inmediato de Información (obligatorio si facturación > 6.010.121,04€/año)
- Casilla 506: Régimen especial de bienes usados
- Casilla 507: Régimen especial de agencias de viajes
- Casilla 508: Régimen especial del oro de inversión
- Casilla 513: EXENCIÓN de IVA por actividades del artículo 20 LIVA (sanitarios, educación, etc.)

**Operaciones especiales:**
- Casilla 520: Prorrata especial
- Casilla 526: Devolución mensual (REDEME)
- Casilla 532: Operaciones intracomunitarias
- Casilla 534: Alta en el ROI (Registro de Operadores Intracomunitarios) - necesario para VIES
- Casilla 540: Venta a distancia dentro de la UE
- Casilla 550: Régimen simplificado actividades incluidas

### PÁGINA 6 - IRPF / IS / IRNR
SECCIÓN CRÍTICA - Determina modelo 130, 131, etc.

**Para personas físicas (IRPF):**
- Casilla 600: Alta en obligación de efectuar pagos fraccionados IRPF
- Casilla 601: ESTIMACIÓN DIRECTA SIMPLIFICADA (la más común para autónomos)
  - Requisito: Ingresos < 600.000€/año en año anterior
  - Permite deducir gastos de difícil justificación (5%)
- Casilla 602: Estimación DIRECTA NORMAL
  - Sin límite de ingresos
  - Contabilidad obligatoria ajustada al Código de Comercio
- Casilla 603: Estimación OBJETIVA (Módulos)
  - Solo para actividades incluidas en la Orden de Módulos
  - No se calcula el beneficio real, sino por índices objetivos
- Casilla 609: Renuncia a la estimación objetiva
- Casilla 610: Revocación de la renuncia a estimación objetiva

**Para personas jurídicas (Impuesto de Sociedades):**
- Casilla 620-629: Obligaciones del Impuesto sobre Sociedades

**Para no residentes (IRNR):**
- Casilla 640-649: Impuesto sobre la Renta de No Residentes

### PÁGINA 7 - RETENCIONES E INGRESOS A CUENTA
Determina modelos 111, 115, 190, 180, etc.

**Retenciones por rendimientos del trabajo (empleados):**
- Casilla 700: Alta como obligado a retener por rendimientos del trabajo
- Casilla 701: Número de trabajadores
- Casilla 705: Periodo de declaración (mensual o trimestral)

**Retenciones a profesionales:**
- Casilla 710: Alta como obligado a retener rendimientos de actividades profesionales
- Casilla 711: Periodo de declaración

**Retenciones por arrendamiento de inmuebles urbanos (⚠️ MUY IMPORTANTE):**
- Casilla 702: Alta como obligado a retener por arrendamientos (ALQUILER DE LOCAL)
  
  TEXTO EXACTO EN EL FORMULARIO:
  "Obligación de realizar retenciones o ingresos a cuenta sobre rendimientos procedentes del arrendamiento o subarrendamiento de inmuebles urbanos (modelo 115)"
  
  - ⚠️ BUSCAR ESPECÍFICAMENTE ESTA CASILLA en la sección de RETENCIONES
  - Si esta casilla está marcada = paga alquiler = OBLIGATORIO Modelo 115 + Modelo 180
  - La casilla puede aparecer como "702 [ ]" o junto al texto largo anterior
  - Buscar también cualquier mención a "modelo 115" en la sección de retenciones
  - VERIFICAR CUIDADOSAMENTE si hay una X, check o marca dentro del recuadro

**Retenciones de capital mobiliario:**
- Casilla 723: Alta como obligado a retener sobre rendimientos del capital mobiliario

### PÁGINAS ADICIONALES (8, 9, 10)
- Página 8: Relación de socios/partícipes (para sociedades)
- Página 9: Relación de sucesores
- Página 10: TITULARES REALES (NUEVO desde febrero 2025) - obligatorio para personas jurídicas

## INSTRUCCIONES DE LECTURA VISUAL

1. **Busca casillas marcadas con X**: Las opciones se marcan con una X dentro del recuadro
2. **Casillas pueden estar marcadas con**: X, ✓, relleno oscuro, o cualquier marca visible
3. **Identifica campos rellenados con texto**: NIF, nombre, direcciones, fechas
4. **Lee los números de casilla**: Aparecen junto a cada campo (ej: "500 [ ]" o "Casilla 500")
5. **Revisa TODAS las páginas**: El documento puede tener 10+ páginas
6. **Presta atención a la fecha de presentación**: Suele estar al final de la página 1 o en el sello de entrada
7. **Identifica el tipo de formulario**: Puede ser versión completa o simplificada

## VERIFICACIÓN OBLIGATORIA - CASILLAS CRÍTICAS

Antes de responder, VERIFICA EXPLÍCITAMENTE estas casillas:
- [ ] Casilla 501-513: ¿Qué régimen de IVA está marcado?
- [ ] Casilla 601-603: ¿Qué régimen de IRPF está marcado?
- [ ] Casilla 700: ¿Tiene empleados?
- [ ] Casilla 702: ¿Paga alquiler de local? (BUSCAR ESPECÍFICAMENTE)
- [ ] Casilla 710: ¿Paga a profesionales?
- [ ] Casilla 532-534: ¿Operaciones intracomunitarias?

En notas_extraccion, INDICA EXPLÍCITAMENTE el estado de casilla 702.

## REGLAS DE INTERPRETACIÓN

### Para determinar régimen de IVA:
1. Si casilla 501 marcada → Régimen GENERAL (el más común)
2. Si casilla 502 marcada → Régimen SIMPLIFICADO (módulos IVA)
3. Si casilla 503 marcada → RECARGO DE EQUIVALENCIA (minoristas)
4. Si casilla 504 marcada → Régimen de AGRICULTURA
5. Si casilla 513 marcada → EXENTO de IVA (sanitarios, educación)
6. Si ninguna de las anteriores y casilla 500 marcada → Régimen GENERAL por defecto

### Para determinar régimen de IRPF:
1. Si casilla 601 marcada → DIRECTA SIMPLIFICADA (la más común)
2. Si casilla 602 marcada → DIRECTA NORMAL
3. Si casilla 603 marcada → OBJETIVA (Módulos)
4. Si ninguna marcada pero casilla 600 marcada → DIRECTA SIMPLIFICADA por defecto

### Reglas de exclusión mutua:
- Modelo 130 y Modelo 131 son MUTUAMENTE EXCLUYENTES
- Estimación Directa (601/602) implica Modelo 130
- Estimación Objetiva (603) implica Modelo 131
- Régimen simplificado de IVA suele ir con Estimación Objetiva de IRPF

### Para determinar obligaciones de retención:
1. Si casilla 700/701 marcada → Tiene empleados → Modelo 111 + 190
2. Si casilla 702 marcada → Paga alquiler de local → Modelo 115 + 180
3. Si casilla 710 marcada → Paga a otros profesionales → Modelo 111

## FORMATO DE RESPUESTA

REGLA CRÍTICA PARA local_alquilado:
- Si CASILLA 702 está MARCADA → "local_alquilado": true
- Si CASILLA 702 NO está marcada → "local_alquilado": false
- Casilla 702 = "Arrendamiento de inmuebles urbanos" en sección de retenciones

Responde con este JSON exacto (SIN markdown, SIN texto adicional antes o después):

{
  "datos_extraidos": {
    "nif": "NIF/CIF exacto como aparece en el documento",
    "nombre_razon_social": "Nombre completo o razón social",
    "domicilio_fiscal": "Dirección completa del domicilio fiscal",
    "fecha_presentacion": "YYYY-MM-DD",
    "fecha_alta_actividad": "YYYY-MM-DD (de casilla 400)",
    "epigrafe_iae": "Código numérico del epígrafe IAE",
    "epigrafe_iae_descripcion": "Descripción textual de la actividad",
    "regimen_iva": "GENERAL|SIMPLIFICADO|EXENTO|RECARGO_EQUIVALENCIA|AGRICULTURA",
    "regimen_irpf": "DIRECTA_SIMPLIFICADA|DIRECTA_NORMAL|OBJETIVA",
    "tiene_empleados": false,
    "operaciones_intracomunitarias": false,
    "local_alquilado": false,
    "facturacion_estimada_anual": null,
    "sii_obligatorio": false
  },
  "recomendaciones": {
    "modelo_303": {
      "requerido": true,
      "explicacion": "Casilla 501 marcada - Régimen general de IVA. Debe presentar declaración trimestral del IVA."
    },
    "modelo_130": {
      "requerido": true,
      "explicacion": "Casilla 601 marcada - Estimación directa simplificada. Pago fraccionado trimestral del IRPF."
    },
    "modelo_131": {
      "requerido": false,
      "explicacion": "No aplica. Usa estimación directa, no módulos."
    },
    "modelo_115": {
      "requerido": false,
      "explicacion": "Casilla 702 no marcada - No declara alquiler de local."
    },
    "modelo_180": {
      "requerido": false,
      "explicacion": "Depende del 115. Si no presenta 115, no presenta 180."
    },
    "modelo_390": {
      "requerido": true,
      "explicacion": "Resumen anual obligatorio si presenta IVA trimestral (303)."
    },
    "modelo_349": {
      "requerido": false,
      "explicacion": "Casillas 532-534 no marcadas - Sin operaciones intracomunitarias."
    },
    "modelo_111": {
      "requerido": false,
      "explicacion": "Casilla 700 no marcada - No tiene empleados ni paga a profesionales."
    },
    "modelo_190": {
      "requerido": false,
      "explicacion": "Depende del 111. Sin obligación de retenciones."
    },
    "sii": {
      "requerido": false,
      "explicacion": "Casilla 505 no marcada - No obligado al SII."
    },
    "vies_roi": {
      "requerido": false,
      "explicacion": "Casilla 534 no marcada - No inscrito en ROI."
    }
  },
  "confianza": 85,
  "notas_extraccion": [
    "Documento de ALTA en el censo",
    "Casillas IVA identificadas: 500, 501 (Régimen General)",
    "Casillas IRPF identificadas: 600, 601 (Directa Simplificada)",
    "⚠️ CASILLA 702 (alquiler): MARCADA/NO MARCADA - [indicar estado explícito]",
    "Casilla 700 (empleados): NO MARCADA",
    "Fecha de alta de actividad: 01/01/2026"
  ]
}

IMPORTANTE: En notas_extraccion SIEMPRE debes indicar explícitamente:
- "CASILLA 702 (alquiler): MARCADA" si está marcada
- "CASILLA 702 (alquiler): NO MARCADA" si no está marcada
- "CASILLA 702 (alquiler): NO ENCONTRADA" si no pudiste localizar la casilla

## REGLAS DE CALIDAD

1. **Confianza alta (80-100)**: Leíste claramente las casillas marcadas y los datos son legibles
2. **Confianza media (50-79)**: Algunas casillas no están claras pero pudiste inferir
3. **Confianza baja (0-49)**: Documento borroso, incompleto o no es un Modelo 036

SIEMPRE:
- Indica las casillas específicas que viste marcadas
- Si un dato no es legible, usa null y explica en notas_extraccion
- Las explicaciones deben ser útiles y claras para un autónomo

⚠️ VERIFICACIÓN FINAL OBLIGATORIA - ANTES DE RESPONDER:
1. ¿Has revisado la sección de RETENCIONES (páginas finales)?
2. ¿Has buscado específicamente la CASILLA 702 "Arrendamiento inmuebles"?
3. ¿Está la casilla 702 marcada con X, ✓ o cualquier marca? → local_alquilado: true
4. ¿Está la casilla 702 vacía o no la encontraste? → local_alquilado: false

Responde SOLO con JSON válido, sin markdown ni texto adicional`;

// ============================================================================
// EXTRACTION PROMPT FOR MODIFICACION (Modification that only changes some values)
// Based on official AEAT guidance - Updated January 2026
// ============================================================================

const MODELO_036_MODIFICACION_EXTRACTION_PROMPT = `Eres un experto en documentos fiscales de la Agencia Tributaria Española. Analiza este Modelo 036 de MODIFICACIÓN.

## ⚠️ REGLA FUNDAMENTAL PARA MODIFICACIONES ⚠️

Este es un documento de MODIFICACIÓN PARCIAL, NO un alta completa.

REGLA: SOLO extraer valores que APARECEN EXPLÍCITAMENTE en este documento.
- Si una casilla/campo NO aparece en el documento → devolver NULL
- Si una casilla/campo aparece y está marcada → devolver el valor correspondiente
- Los valores NULL serán ignorados y se mantendrán los valores anteriores

EJEMPLO:
- Si el documento solo modifica retenciones (casilla 134 marcada)
- Y la casilla 702 (alquiler) aparece marcada
- Entonces: local_alquilado: true, pero regimen_iva: null, regimen_irpf: null, etc.

## CONTEXTO: DECLARACIÓN DE MODIFICACIÓN

Una declaración de MODIFICACIÓN:
1. El contribuyente YA estaba dado de alta previamente
2. Este documento SOLO contiene los campos que CAMBIAN
3. Los campos que NO aparecen en el documento = devolver NULL (se mantienen los valores anteriores)
4. El documento original de alta sigue siendo válido
5. La fecha de efectos indica cuándo entra en vigor la modificación

Plazo de presentación: Generalmente 1 MES desde que ocurre el cambio.

## CÓMO IDENTIFICAR UNA MODIFICACIÓN

### Casillas de causa de presentación en PÁGINA 1:
BUSCA estas casillas marcadas con X para confirmar que es una MODIFICACIÓN:

- Casilla 130: Modificación de datos identificativos (NIF, nombre, domicilio)
- Casilla 131: Modificación de datos relativos a actividades económicas y locales
- Casilla 132: Modificación de régimen de IVA
- Casilla 133: Modificación de régimen de IRPF/IS/IRNR
- Casilla 134: Modificación de retenciones e ingresos a cuenta
- Casilla 135: Modificación de regímenes especiales
- Casilla 136: Modificación de operaciones con terceros países o intracomunitarias

Si VES casillas 120, 121, 122, 127 marcadas = ES UN ALTA, no una modificación.

## ESTRUCTURA DEL DOCUMENTO DE MODIFICACIÓN

### PÁGINA 1 - IDENTIFICACIÓN Y CAUSA
- NIF del declarante (SIEMPRE presente para identificación)
- Casillas 130-136 marcadas indicando QUÉ se modifica
- Fecha de presentación
- Fecha de efectos (cuándo entra en vigor el cambio)

### PÁGINAS AFECTADAS (solo se rellenan las que cambian):

**Si casilla 130 marcada - Modificación identificativa:**
- Página 2: Nuevo domicilio fiscal, nuevo nombre/razón social, nuevos datos de contacto

**Si casilla 131 marcada - Modificación de actividades:**
- Página 4: Nueva actividad, nuevo epígrafe IAE, nuevos locales
- Puede incluir ALTA de nueva actividad o BAJA de actividad existente

**Si casilla 132 marcada - Modificación de IVA:**
- Página 5: Cambio de régimen de IVA
- Ejemplos: Pasar de General a Simplificado, darse de alta en ROI, activar SII

**Si casilla 133 marcada - Modificación de IRPF/IS:**
- Página 6: Cambio de régimen de IRPF
- Ejemplos: Pasar de Directa Simplificada a Directa Normal, o a Módulos

**Si casilla 134 marcada - Modificación de retenciones:**
- Página 7: Cambio en obligaciones de retención
- Ejemplos: Empezar a tener empleados, empezar a pagar alquiler

## INSTRUCCIONES DE EXTRACCIÓN

1. CONFIRMA que es modificación: Buscar casillas 130-136 marcadas
2. IDENTIFICA qué se modifica: Lee las casillas de causa de presentación
3. LEE solo las páginas/secciones que aparecen en el documento
4. EXTRAE solo los valores que APARECEN EXPLÍCITAMENTE en el documento
5. USA null para TODOS los campos que NO aparecen en el documento
6. IDENTIFICA la fecha de efectos del cambio

## REGLA DE NULL PARA MODIFICACIONES

Devuelve NULL para un campo si:
- La casilla correspondiente NO aparece en el documento
- La sección correspondiente (IVA, IRPF, Retenciones) NO está en el documento
- No hay información sobre ese campo en ninguna página

Devuelve un VALOR (true/false/string) solo si:
- La casilla aparece EXPLÍCITAMENTE en el documento
- Puedes ver claramente si está marcada o no marcada

EJEMPLO - Si el documento solo tiene casilla 134 (modificación retenciones) y 702 marcada:
- local_alquilado: true (aparece y está marcada)
- tiene_empleados: null (no hay info sobre casilla 700)
- regimen_iva: null (no hay info sobre casillas 501-513)
- regimen_irpf: null (no hay info sobre casillas 601-603)
- modelo_115.requerido: true (porque 702 está marcada)
- modelo_303.requerido: null (no hay cambios en IVA)
- modelo_130.requerido: null (no hay cambios en IRPF)

## REGLAS CRÍTICAS DE INTERPRETACIÓN

### Para cambios de régimen de IVA (casilla 132):
- Busca casillas 501-513 para ver el NUEVO régimen
- Si marca 501 = Cambia a Régimen General
- Si marca 502 = Cambia a Régimen Simplificado
- Si marca 513 = Cambia a Exento
- El régimen anterior ya no aplica

### Para cambios de régimen de IRPF (casilla 133):
- Busca casillas 600-610 para ver el NUEVO régimen
- Si marca 601 = Cambia a Directa Simplificada
- Si marca 602 = Cambia a Directa Normal
- Si marca 603 = Cambia a Módulos (Objetiva)
- IMPORTANTE: Esto cambia de Modelo 130 a 131 o viceversa

### Para cambios de retenciones (casilla 134):
- Si marca 700 = ALTA en obligación de retener (tiene empleados)
- Si marca 702 = ALTA en retenciones por alquiler de local
  TEXTO EXACTO: "Obligación de realizar retenciones o ingresos a cuenta sobre rendimientos procedentes del arrendamiento o subarrendamiento de inmuebles urbanos (modelo 115)"
- Puede ser alta (empezar obligación) o baja (cesar obligación)

## FORMATO DE RESPUESTA

Responde con este JSON exacto (SIN markdown, SIN texto adicional):

{
  "tipo_documento_detectado": "MODIFICACION",
  "fecha_efectos": "YYYY-MM-DD",
  "campos_modificados": ["regimen_iva", "local_alquilado"],
  "datos_extraidos": {
    "nif": "NIF del declarante (siempre presente)",
    "nombre_razon_social": null,
    "domicilio_fiscal": null,
    "fecha_presentacion": "YYYY-MM-DD",
    "fecha_alta_actividad": null,
    "epigrafe_iae": null,
    "epigrafe_iae_descripcion": null,
    "regimen_iva": "GENERAL",
    "regimen_irpf": null,
    "tiene_empleados": null,
    "operaciones_intracomunitarias": null,
    "local_alquilado": true,
    "facturacion_estimada_anual": null,
    "sii_obligatorio": null
  },
  "recomendaciones": {
    "modelo_303": {
      "requerido": null,
      "explicacion": "Sin cambios en IVA"
    },
    "modelo_130": {
      "requerido": null,
      "explicacion": "Sin cambios en IRPF"
    },
    "modelo_131": {
      "requerido": null,
      "explicacion": "Sin cambios en IRPF"
    },
    "modelo_115": {
      "requerido": true,
      "explicacion": "Casilla 702 marcada - Alta en obligación de retenciones por alquiler. Debe presentar 115 trimestral."
    },
    "modelo_180": {
      "requerido": true,
      "explicacion": "Al tener obligación de 115, debe presentar resumen anual 180."
    },
    "modelo_390": {
      "requerido": null,
      "explicacion": "Sin cambios en IVA"
    },
    "modelo_349": {
      "requerido": null,
      "explicacion": "Sin cambios en operaciones UE"
    },
    "modelo_111": {
      "requerido": null,
      "explicacion": "Sin cambios en empleados"
    },
    "modelo_190": {
      "requerido": null,
      "explicacion": "Sin cambios"
    },
    "sii": {
      "requerido": null,
      "explicacion": "Sin cambios en SII"
    },
    "vies_roi": {
      "requerido": null,
      "explicacion": "Sin cambios en ROI"
    }
  },
  "confianza": 85,
  "notas_extraccion": [
    "Documento de MODIFICACIÓN identificado",
    "Casilla 132 marcada: Modificación de IVA",
    "Casilla 134 marcada: Modificación de retenciones",
    "Cambio: Alta en obligación de retener por alquiler (casilla 702)",
    "Fecha de efectos: 01/03/2026",
    "Los demás campos mantienen valores del documento original"
  ]
}

## REGLAS DE CALIDAD

- **Confianza alta (80-100)**: Claramente visible qué casillas están marcadas y qué cambia
- **Confianza media (50-79)**: Algunas casillas borrosas pero se puede inferir el cambio
- **Confianza baja (0-49)**: No se puede determinar qué se modifica

IMPORTANTE:
- Solo extrae valores que REALMENTE cambian (están explícitamente marcados/rellenados)
- Usa null para todo lo que NO cambia
- Este documento NO invalida el original - AMBOS están en vigor
- La fecha de efectos puede ser diferente a la fecha de presentación
- En notas_extraccion, indica SIEMPRE las casillas que viste marcadas
- Responde SOLO con JSON válido, sin markdown ni texto adicional`;

// Backward compatibility - keep old prompt name working
const MODELO_036_EXTRACTION_PROMPT = MODELO_036_ALTA_EXTRACTION_PROMPT;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

function parseJSONResponse(text: string): any {
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;
    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Failed to parse JSON response:', text.substring(0, 500));
    return null;
  }
}

function getDefaultRecommendations(): Modelo036Recommendations {
  return {
    modelo_303: { requerido: true, explicacion: 'No se pudo analizar el documento - recomendación por defecto' },
    modelo_130: { requerido: true, explicacion: 'No se pudo analizar el documento - recomendación por defecto' },
    modelo_131: { requerido: false, explicacion: 'No se pudo determinar el régimen de IRPF' },
    modelo_115: { requerido: false, explicacion: 'No se detectó información sobre alquiler' },
    modelo_180: { requerido: false, explicacion: 'Depende del Modelo 115' },
    modelo_390: { requerido: true, explicacion: 'Recomendación por defecto si presenta IVA' },
    modelo_349: { requerido: false, explicacion: 'No se detectaron operaciones intracomunitarias' },
    modelo_111: { requerido: false, explicacion: 'No se detectaron empleados' },
    modelo_190: { requerido: false, explicacion: 'Depende del Modelo 111' },
    sii: { requerido: false, explicacion: 'No se detectó SII obligatorio' },
    vies_roi: { requerido: false, explicacion: 'No se detectaron operaciones UE' },
  };
}

// ============================================================================
// SISTEMA PROMPT - Para mejorar la precisión en la lectura de casillas
// ============================================================================

const MODELO_036_SYSTEM_PROMPT = `⚠️ TAREA PRIORITARIA - LEER PRIMERO ⚠️

ANTES de analizar el documento completo, busca ESPECÍFICAMENTE estas casillas y reporta si están marcadas:

1. CASILLA 702 - RETENCIONES POR ALQUILER (BUSCAR CON ATENCIÓN)
   
   El texto EXACTO en el formulario es:
   "Obligación de realizar retenciones o ingresos a cuenta sobre rendimientos procedentes del arrendamiento o subarrendamiento de inmuebles urbanos (modelo 115)"
   
   TAMBIÉN puede aparecer como:
   - "702" seguido de un recuadro
   - "Arrendamiento de inmuebles urbanos"
   - "Retenciones arrendamiento"
   - Cualquier mención a "modelo 115" en la sección de retenciones
   
   UBICACIÓN: Sección de RETENCIONES E INGRESOS A CUENTA (páginas finales, 6-8)
   
   Si hay CUALQUIER marca (X, ✓, relleno, tachado) junto a este texto = local_alquilado: true
   Si el recuadro está vacío = local_alquilado: false

2. CASILLA 501 - Régimen general IVA
3. CASILLA 601 - Estimación directa simplificada IRPF  
4. CASILLA 700 - Retenciones trabajo (empleados)

---

CÓMO IDENTIFICAR UNA CASILLA MARCADA:
- Una X dentro del recuadro
- Un check ✓ dentro del recuadro  
- El recuadro está relleno, sombreado o tachado
- Cualquier marca manuscrita o impresa dentro del recuadro
- El texto "Sí" o "SI" junto al número de casilla

IMPORTANTE: 
- Lee TODAS las páginas del documento (puede tener 8-10 páginas)
- La sección de retenciones (casillas 700-723) suele estar en las ÚLTIMAS páginas
- NO asumas que una casilla no está marcada solo porque no la viste en las primeras páginas
- En caso de DUDA sobre casilla 702, indica local_alquilado: true y confianza baja`;

// ============================================================================
// AI PROCESSING (via OpenRouter) - HANDLES PDFs NATIVELY
// ============================================================================

/**
 * Process Modelo 036 with vision model via OpenRouter
 * Uses Gemini 2.0 Flash with enhanced prompts for better checkbox detection
 * 
 * @param filePath Path to the PDF/image file
 * @param tipoDocumento Type of document: ALTA (new registration) or MODIFICACION (modification)
 */
async function processWithVisionModel(
  filePath: string,
  tipoDocumento: TipoDocumento036 = 'ALTA'
): Promise<Modelo036AnalysisResult> {
  const openrouter = new OpenAI({
    apiKey: config.vision.openrouterApiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });

  const fileBuffer = fs.readFileSync(filePath);
  const base64File = fileBuffer.toString('base64');
  const mimeType = getMimeType(filePath);

  // Select the appropriate prompt based on document type
  const basePrompt = tipoDocumento === 'MODIFICACION' 
    ? MODELO_036_MODIFICACION_EXTRACTION_PROMPT 
    : MODELO_036_ALTA_EXTRACTION_PROMPT;

  // Combine system prompt with user prompt for better compatibility
  const fullPrompt = `${MODELO_036_SYSTEM_PROMPT}\n\n---\n\n${basePrompt}`;

  // Use dedicated model for Modelo 036, falls back to contract model
  const modelToUse = (config.vision as any).modelo036Model || config.vision.contractModel;
  
  console.log(`📄 Procesando Modelo 036 (${tipoDocumento}) con ${modelToUse} (${mimeType}, ${(fileBuffer.length / 1024).toFixed(1)} KB)`);

  const response = await openrouter.chat.completions.create({
    model: modelToUse,
    max_tokens: 8192, // Increased for more detailed analysis
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
            text: fullPrompt,
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
  console.log(`✅ Extracción completada (${tipoDocumento}). Confianza: ${confianza}%`);

  return {
    datos_extraidos: parsed.datos_extraidos || {},
    recomendaciones: parsed.recomendaciones || getDefaultRecommendations(),
    confianza,
    notas_extraccion: parsed.notas_extraccion || [],
    raw_response: responseText,
    // Include modification-specific fields
    tipo_documento_detectado: parsed.tipo_documento_detectado || tipoDocumento,
    campos_modificados: parsed.campos_modificados || [],
    fecha_efectos: parsed.fecha_efectos || null,
  };
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

/**
 * Analyze Modelo 036 document
 * Uses Gemini 2.0 Flash via OpenRouter for native PDF support
 * Same architecture as contract extraction in visionOCR.service.ts
 * 
 * @param imagePath Path to the PDF/image file
 * @param tipoDocumento Type of document: ALTA (new registration) or MODIFICACION (modification)
 */
export async function analyzeModelo036(
  imagePath: string,
  tipoDocumento: TipoDocumento036 = 'ALTA'
): Promise<Modelo036AnalysisResult> {
  // Validate file exists
  if (!fs.existsSync(imagePath)) {
    throw new Error('El archivo no existe');
  }

  const stats = fs.statSync(imagePath);
  const maxSize = 10 * 1024 * 1024; // 10MB max (same as contracts)

  if (stats.size > maxSize) {
    throw new Error('Archivo demasiado grande. Máximo 10MB');
  }

  try {
    // Use vision model via OpenRouter (Claude 3.5 Sonnet for better accuracy)
    if (config.vision.openrouterApiKey) {
      console.log(`🚀 Iniciando análisis de Modelo 036 (${tipoDocumento})`);
      return await processWithVisionModel(imagePath, tipoDocumento);
    }

    // If no OpenRouter key, throw error (vision model is required for PDF handling)
    throw new Error('Se requiere configurar OPENROUTER_API_KEY para analizar documentos PDF');
  } catch (error: any) {
    console.error('Error en análisis de Modelo 036:', error);

    if (error.status === 401) {
      throw new Error('API key inválida. Contacta al administrador.');
    } else if (error.status === 429) {
      throw new Error('Límite de API excedido. Intenta más tarde.');
    } else if (error.status === 413) {
      throw new Error('Archivo demasiado grande.');
    } else {
      throw new Error(`Error al analizar el Modelo 036: ${error.message}`);
    }
  }
}

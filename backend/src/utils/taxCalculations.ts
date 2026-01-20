/**
 * Utilidades para cálculos fiscales españoles
 * IVA, IRPF, amortizaciones, etc.
 */

// Redondeo a 2 decimales (céntimos)
export const roundToCents = (value: number): number => {
  return Math.round(value * 100) / 100;
};

/**
 * Calcular cuota IVA
 * @param baseImponible - Base imponible en euros
 * @param tipoIva - Tipo de IVA (21, 10, 4, etc.)
 * @returns Cuota de IVA redondeada a céntimos
 */
export const calcularCuotaIVA = (baseImponible: number, tipoIva: number): number => {
  return roundToCents((baseImponible * tipoIva) / 100);
};

/**
 * Calcular cuota IRPF
 * @param baseImponible - Base imponible en euros
 * @param tipoIrpf - Tipo de retención (7, 15, 19, etc.)
 * @returns Cuota de IRPF redondeada a céntimos
 */
export const calcularCuotaIRPF = (baseImponible: number, tipoIrpf: number): number => {
  return roundToCents((baseImponible * tipoIrpf) / 100);
};

/**
 * Calcular total de factura emitida
 * Total = Base + IVA - IRPF
 */
export const calcularTotalFactura = (
  baseImponible: number,
  cuotaIva: number,
  cuotaIrpf: number
): number => {
  return roundToCents(baseImponible + cuotaIva - cuotaIrpf);
};

/**
 * Calcular total de gasto
 * Total = Base + IVA - IRPF (si aplica, ej: alquiler)
 */
export const calcularTotalGasto = (
  baseImponible: number,
  cuotaIva: number,
  cuotaIrpf: number = 0
): number => {
  return roundToCents(baseImponible + cuotaIva - cuotaIrpf);
};

/**
 * Validar cálculo de IVA (con tolerancia de 1 céntimo por redondeos)
 */
export const validarCalculoIVA = (
  baseImponible: number,
  tipoIva: number,
  cuotaIvaDeclarada: number
): boolean => {
  const cuotaCalculada = calcularCuotaIVA(baseImponible, tipoIva);
  return Math.abs(cuotaCalculada - cuotaIvaDeclarada) <= 0.01;
};

/**
 * Validar cálculo de IRPF
 */
export const validarCalculoIRPF = (
  baseImponible: number,
  tipoIrpf: number,
  cuotaIrpfDeclarada: number
): boolean => {
  const cuotaCalculada = calcularCuotaIRPF(baseImponible, tipoIrpf);
  return Math.abs(cuotaCalculada - cuotaIrpfDeclarada) <= 0.01;
};

/**
 * Validar total de factura
 */
export const validarTotalFactura = (
  baseImponible: number,
  cuotaIva: number,
  cuotaIrpf: number,
  totalDeclarado: number
): boolean => {
  const totalCalculado = calcularTotalFactura(baseImponible, cuotaIva, cuotaIrpf);
  return Math.abs(totalCalculado - totalDeclarado) <= 0.01;
};

/**
 * =====================================================
 * MODELO 303 - IVA TRIMESTRAL
 * Basado en OCA/l10n-spain l10n_es_aeat_mod303
 * Fuente: https://github.com/OCA/l10n-spain
 * =====================================================
 */

/**
 * Desglose de IVA por tipo impositivo (según AEAT 2026)
 * Casillas oficiales:
 * - 4%: Base en casilla 01, tipo en 02, cuota en 03
 * - 10%: Base en casilla 04, tipo en 05, cuota en 06
 * - 21%: Base en casilla 07, tipo en 08, cuota en 09
 */
export interface DesgloseIVARepercutido {
  // IVA 4% (superreducido)
  base_4: number;
  cuota_4: number;
  // IVA 10% (reducido)
  base_10: number;
  cuota_10: number;
  // IVA 21% (general)
  base_21: number;
  cuota_21: number;
  // Totales
  base_total: number;
  cuota_total: number;
}

export interface DesgloseIVASoportado {
  // IVA soportado deducible (operaciones interiores)
  base_deducible: number;
  cuota_deducible: number;
  // IVA soportado en adquisiciones intracomunitarias (casillas 10-11)
  base_intracomunitaria: number;
  cuota_intracomunitaria: number;
  // Inversión sujeto pasivo (casillas 12-13)
  base_inversion_sp: number;
  cuota_inversion_sp: number;
  // Rectificaciones (casillas 14-15)
  base_rectificaciones: number;
  cuota_rectificaciones: number;
  // Totales
  base_total: number;
  cuota_total: number;
}

export interface Modelo303Result {
  // Desglose IVA repercutido
  desglose_repercutido: DesgloseIVARepercutido;
  // Desglose IVA soportado
  desglose_soportado: DesgloseIVASoportado;
  // Totales (compatibilidad hacia atrás)
  iva_repercutido: number;
  iva_soportado: number;
  // Resultado
  resultado: number;
  accion: 'A INGRESAR' | 'A COMPENSAR' | 'SIN ACTIVIDAD';
  // Casillas AEAT oficiales 2026
  casillas: {
    // IVA devengado (repercutido)
    casilla_01: number; // Base 4%
    casilla_02: number; // Tipo 4%
    casilla_03: number; // Cuota 4%
    casilla_04: number; // Base 10%
    casilla_05: number; // Tipo 10%
    casilla_06: number; // Cuota 10%
    casilla_07: number; // Base 21%
    casilla_08: number; // Tipo 21%
    casilla_09: number; // Cuota 21%
    casilla_10: number; // Base adquisiciones intracomunitarias
    casilla_11: number; // Cuota adquisiciones intracomunitarias
    casilla_12: number; // Base inversión sujeto pasivo
    casilla_13: number; // Cuota inversión sujeto pasivo
    casilla_14: number; // Base rectificaciones
    casilla_15: number; // Cuota rectificaciones
    casilla_27: number; // Total cuotas devengadas
    // IVA deducible (soportado)
    casilla_28: number; // Base bienes y servicios corrientes (interior)
    casilla_29: number; // Cuota bienes y servicios corrientes
    casilla_30: number; // Base bienes de inversión
    casilla_31: number; // Cuota bienes de inversión
    casilla_32: number; // Base importaciones bienes corrientes
    casilla_33: number; // Cuota importaciones bienes corrientes
    casilla_34: number; // Base importaciones bienes inversión
    casilla_35: number; // Cuota importaciones bienes inversión
    casilla_36: number; // Base adquisiciones intracomunitarias
    casilla_37: number; // Cuota adquisiciones intracomunitarias
    casilla_38: number; // Base rectificaciones
    casilla_39: number; // Cuota rectificaciones
    casilla_40: number; // Compensaciones régimen especial
    casilla_41: number; // Regularización bienes inversión
    casilla_42: number; // Regularización prorrata (si aplica)
    casilla_45: number; // Total cuotas deducibles
    // Resultado
    casilla_46: number; // Resultado régimen general (27 - 45)
    casilla_64: number; // Resultado régimen simplificado (si aplica)
    casilla_65: number; // Total (46 + 64)
    casilla_66: number; // Compensaciones de periodos anteriores
    casilla_67: number; // Regularización cuotas art. 80.5 LIVA
    casilla_69: number; // Resultado (65 - 66 + 67)
    casilla_71: number; // Resultado a ingresar (si positivo)
    casilla_72: number; // Resultado a compensar (si negativo)
  };
}

/**
 * Calcular IVA trimestral (Modelo 303) - Versión completa OCA
 * Según especificaciones OCA/l10n-spain y AEAT 2026
 */
export const calcularModelo303Completo = (
  desgloseRepercutido: DesgloseIVARepercutido,
  desgloseSoportado: DesgloseIVASoportado,
  compensacionesAnteriores: number = 0,
  regularizacionArt80: number = 0
): Modelo303Result => {
  // Total IVA devengado (casilla 27)
  const totalDevengado = roundToCents(
    desgloseRepercutido.cuota_total +
    desgloseSoportado.cuota_intracomunitaria +
    desgloseSoportado.cuota_inversion_sp
  );

  // Total IVA deducible (casilla 45)
  const totalDeducible = roundToCents(desgloseSoportado.cuota_total);

  // Resultado régimen general (casilla 46)
  const resultadoRegimenGeneral = roundToCents(totalDevengado - totalDeducible);

  // Resultado final (casilla 69)
  const resultadoFinal = roundToCents(
    resultadoRegimenGeneral - compensacionesAnteriores + regularizacionArt80
  );

  // Determinar acción
  let accion: 'A INGRESAR' | 'A COMPENSAR' | 'SIN ACTIVIDAD';
  if (resultadoFinal > 0) {
    accion = 'A INGRESAR';
  } else if (resultadoFinal < 0) {
    accion = 'A COMPENSAR';
  } else {
    accion = 'SIN ACTIVIDAD';
  }

  return {
    desglose_repercutido: desgloseRepercutido,
    desglose_soportado: desgloseSoportado,
    iva_repercutido: roundToCents(desgloseRepercutido.cuota_total),
    iva_soportado: roundToCents(desgloseSoportado.cuota_total),
    resultado: resultadoFinal,
    accion,
    casillas: {
      // IVA devengado
      casilla_01: roundToCents(desgloseRepercutido.base_4),
      casilla_02: 4,
      casilla_03: roundToCents(desgloseRepercutido.cuota_4),
      casilla_04: roundToCents(desgloseRepercutido.base_10),
      casilla_05: 10,
      casilla_06: roundToCents(desgloseRepercutido.cuota_10),
      casilla_07: roundToCents(desgloseRepercutido.base_21),
      casilla_08: 21,
      casilla_09: roundToCents(desgloseRepercutido.cuota_21),
      casilla_10: roundToCents(desgloseSoportado.base_intracomunitaria),
      casilla_11: roundToCents(desgloseSoportado.cuota_intracomunitaria),
      casilla_12: roundToCents(desgloseSoportado.base_inversion_sp),
      casilla_13: roundToCents(desgloseSoportado.cuota_inversion_sp),
      casilla_14: roundToCents(desgloseSoportado.base_rectificaciones),
      casilla_15: roundToCents(desgloseSoportado.cuota_rectificaciones),
      casilla_27: totalDevengado,
      // IVA deducible
      casilla_28: roundToCents(desgloseSoportado.base_deducible),
      casilla_29: roundToCents(desgloseSoportado.cuota_deducible),
      casilla_30: 0, // Bienes inversión (no implementado aún)
      casilla_31: 0,
      casilla_32: 0, // Importaciones (no implementado aún)
      casilla_33: 0,
      casilla_34: 0,
      casilla_35: 0,
      casilla_36: roundToCents(desgloseSoportado.base_intracomunitaria),
      casilla_37: roundToCents(desgloseSoportado.cuota_intracomunitaria),
      casilla_38: roundToCents(desgloseSoportado.base_rectificaciones),
      casilla_39: roundToCents(desgloseSoportado.cuota_rectificaciones),
      casilla_40: 0, // Compensaciones régimen especial
      casilla_41: 0, // Regularización bienes inversión
      casilla_42: 0, // Prorrata
      casilla_45: totalDeducible,
      // Resultado
      casilla_46: resultadoRegimenGeneral,
      casilla_64: 0, // Régimen simplificado
      casilla_65: resultadoRegimenGeneral, // Total (solo régimen general)
      casilla_66: roundToCents(compensacionesAnteriores),
      casilla_67: roundToCents(regularizacionArt80),
      casilla_69: resultadoFinal,
      casilla_71: resultadoFinal > 0 ? resultadoFinal : 0,
      casilla_72: resultadoFinal < 0 ? Math.abs(resultadoFinal) : 0,
    },
  };
};

/**
 * Versión simplificada para compatibilidad hacia atrás
 * Asume todo IVA al 21%
 */
export interface Modelo303ResultSimple {
  iva_repercutido: number;
  iva_soportado: number;
  resultado: number;
  accion: 'A INGRESAR' | 'A COMPENSAR' | 'SIN ACTIVIDAD';
}

export const calcularModelo303 = (
  ivaRepercutido: number,
  ivaSoportado: number
): Modelo303ResultSimple => {
  const resultado = roundToCents(ivaRepercutido - ivaSoportado);

  return {
    iva_repercutido: roundToCents(ivaRepercutido),
    iva_soportado: roundToCents(ivaSoportado),
    resultado,
    accion: resultado > 0 ? 'A INGRESAR' : resultado < 0 ? 'A COMPENSAR' : 'SIN ACTIVIDAD',
  };
};

/**
 * =====================================================
 * MODELO 130 - PAGO FRACCIONADO IRPF
 * Basado en OCA/l10n-spain l10n_es_aeat_mod130
 * Fuente: https://github.com/OCA/l10n-spain
 * =====================================================
 *
 * IMPORTANTE: Los datos son ACUMULADOS desde el 1 de enero
 * hasta el final del trimestre que se declara.
 * 
 * Fórmula oficial AEAT:
 * Casilla 01: Ingresos íntegros acumulados desde enero
 * Casilla 02: Gastos deducibles acumulados
 * Casilla 03: Rendimiento neto = 01 - 02
 * Casilla 04: 20% del rendimiento neto positivo
 * Casilla 05: Pagos fraccionados anteriores (solo positivos)
 * Casilla 06: Retenciones e ingresos a cuenta acumulados
 * Casilla 07: Resultado = 04 - 05 - 06
 */
export interface Modelo130Result {
  // Casillas oficiales AEAT
  casilla_01_ingresos_acumulados: number;
  casilla_02_gastos_acumulados: number;
  casilla_03_rendimiento_neto: number;
  casilla_04_pago_20_pct: number;
  casilla_05_pagos_anteriores: number;
  casilla_06_retenciones_acumuladas: number;
  casilla_07_resultado: number;
  // Desglose por actividades (si hay varias)
  actividades: Array<{
    epígrafe?: string;
    ingresos: number;
    gastos: number;
  }>;
  // Compatibilidad hacia atrás
  ingresos_computables: number;
  gastos_deducibles: number;
  rendimiento_neto: number;
  pago_fraccionado: number;
  retenciones_practicadas: number;
  pagos_anteriores: number;
  resultado: number;
  accion: 'A INGRESAR' | 'A COMPENSAR' | 'SIN ACTIVIDAD';
  // Metadata
  trimestre: number;
  ano: number;
  es_acumulado: boolean;
}

/**
 * Calcular Modelo 130 con datos ACUMULADOS (método oficial AEAT)
 * 
 * @param ingresosAcumulados - Ingresos desde 1 de enero hasta fin del trimestre
 * @param gastosAcumulados - Gastos deducibles desde 1 de enero hasta fin del trimestre
 * @param retencionesAcumuladas - Retenciones IRPF soportadas desde 1 de enero
 * @param pagosAnteriores - Suma de pagos fraccionados positivos de trimestres anteriores del mismo año
 * @param trimestre - Número del trimestre (1-4)
 * @param ano - Año fiscal
 * @param tipo - Porcentaje a aplicar (por defecto 20%)
 */
export const calcularModelo130Acumulado = (
  ingresosAcumulados: number,
  gastosAcumulados: number,
  retencionesAcumuladas: number = 0,
  pagosAnteriores: number = 0,
  trimestre: number = 1,
  ano: number = new Date().getFullYear(),
  tipo: number = 0.20
): Modelo130Result => {
  // Casilla 03: Rendimiento neto acumulado
  const rendimientoNeto = roundToCents(ingresosAcumulados - gastosAcumulados);

  // Casilla 04: 20% sobre rendimiento neto positivo
  // Si el rendimiento es negativo, la casilla 04 es 0
  const pago20Pct = rendimientoNeto > 0 ? roundToCents(rendimientoNeto * tipo) : 0;

  // Casilla 05: Pagos anteriores (solo positivos del mismo año)
  const pagosAnterioresPositivos = Math.max(0, pagosAnteriores);

  // Casilla 06: Retenciones acumuladas
  const retencionesTotal = roundToCents(retencionesAcumuladas);

  // Casilla 07: Resultado = 04 - 05 - 06
  // Puede ser negativo (a compensar en siguientes trimestres o en Renta)
  const resultado = roundToCents(pago20Pct - pagosAnterioresPositivos - retencionesTotal);

  // Determinar acción
  let accion: 'A INGRESAR' | 'A COMPENSAR' | 'SIN ACTIVIDAD';
  if (resultado > 0) {
    accion = 'A INGRESAR';
  } else if (resultado < 0) {
    accion = 'A COMPENSAR';
  } else {
    accion = 'SIN ACTIVIDAD';
  }

  return {
    // Casillas oficiales
    casilla_01_ingresos_acumulados: roundToCents(ingresosAcumulados),
    casilla_02_gastos_acumulados: roundToCents(gastosAcumulados),
    casilla_03_rendimiento_neto: rendimientoNeto,
    casilla_04_pago_20_pct: pago20Pct,
    casilla_05_pagos_anteriores: pagosAnterioresPositivos,
    casilla_06_retenciones_acumuladas: retencionesTotal,
    casilla_07_resultado: resultado,
    // Actividades (simplificado - una actividad)
    actividades: [{
      ingresos: roundToCents(ingresosAcumulados),
      gastos: roundToCents(gastosAcumulados),
    }],
    // Compatibilidad hacia atrás
    ingresos_computables: roundToCents(ingresosAcumulados),
    gastos_deducibles: roundToCents(gastosAcumulados),
    rendimiento_neto: rendimientoNeto,
    pago_fraccionado: pago20Pct,
    retenciones_practicadas: retencionesTotal,
    pagos_anteriores: pagosAnterioresPositivos,
    resultado,
    accion,
    // Metadata
    trimestre,
    ano,
    es_acumulado: true,
  };
};

/**
 * Versión simplificada para compatibilidad hacia atrás
 * NOTA: Esta versión NO usa datos acumulados, solo del trimestre actual
 * Para cálculos oficiales, usar calcularModelo130Acumulado
 */
export interface Modelo130ResultSimple {
  ingresos_computables: number;
  gastos_deducibles: number;
  rendimiento_neto: number;
  pago_fraccionado: number;
  retenciones_practicadas: number;
  resultado: number;
  accion: 'A INGRESAR' | 'A COMPENSAR' | 'SIN ACTIVIDAD';
}

export const calcularModelo130 = (
  ingresosComputables: number,
  gastosDeducibles: number,
  retencionesPracticadas: number = 0
): Modelo130ResultSimple => {
  const rendimientoNeto = roundToCents(ingresosComputables - gastosDeducibles);
  const pagoFraccionado = rendimientoNeto > 0 ? roundToCents(rendimientoNeto * 0.2) : 0;
  const resultado = roundToCents(pagoFraccionado - retencionesPracticadas);

  return {
    ingresos_computables: roundToCents(ingresosComputables),
    gastos_deducibles: roundToCents(gastosDeducibles),
    rendimiento_neto: rendimientoNeto,
    pago_fraccionado: pagoFraccionado,
    retenciones_practicadas: roundToCents(retencionesPracticadas),
    resultado,
    accion: resultado > 0 ? 'A INGRESAR' : resultado < 0 ? 'A COMPENSAR' : 'SIN ACTIVIDAD',
  };
};

/**
 * =====================================================
 * MODELO 111 - RETENCIONES IRPF (Profesionales/Trabajadores)
 * Basado en OCA/l10n-spain l10n_es_aeat_mod111
 * Fuente: https://github.com/OCA/l10n-spain
 * =====================================================
 *
 * Declaración trimestral de retenciones e ingresos a cuenta
 * sobre rendimientos del trabajo, actividades profesionales, etc.
 */
export interface Perceptor111 {
  nombre: string;
  nif: string;
  tipo: 'PROFESIONAL' | 'TRABAJADOR' | 'ADMINISTRADOR' | 'PREMIO' | 'OTROS';
  base_retenciones: number;
  tipo_retencion: number;
  retencion_aplicada: number;
}

export interface Modelo111Result {
  // Casillas principales
  casilla_01: number; // Número de perceptores (rendimientos trabajo)
  casilla_02: number; // Base retenciones trabajo
  casilla_03: number; // Retenciones e ingresos a cuenta trabajo
  casilla_04: number; // Número de perceptores (profesionales)
  casilla_05: number; // Base retenciones profesionales
  casilla_06: number; // Retenciones profesionales
  casilla_07: number; // Número de perceptores (premios)
  casilla_08: number; // Base premios
  casilla_09: number; // Retenciones premios
  casilla_10: number; // Número de perceptores (ganancias forestales)
  casilla_11: number; // Base ganancias forestales
  casilla_12: number; // Retenciones ganancias forestales
  casilla_13: number; // Número de perceptores (cesión imagen)
  casilla_14: number; // Base cesión imagen
  casilla_15: number; // Retenciones cesión imagen
  // Totales
  casilla_28: number; // Total retenciones a ingresar
  casilla_29: number; // A deducir (declaración complementaria)
  casilla_30: number; // Resultado a ingresar
  // Desglose
  perceptores: Perceptor111[];
  total_perceptores: number;
  total_base: number;
  total_retenciones: number;
  resultado: number;
  accion: 'A INGRESAR' | 'SIN ACTIVIDAD';
}

/**
 * Calcular Modelo 111 - Retenciones IRPF
 */
export const calcularModelo111 = (
  perceptores: Perceptor111[],
  aDeducir: number = 0
): Modelo111Result => {
  // Agrupar por tipo
  const profesionales = perceptores.filter(p => p.tipo === 'PROFESIONAL');
  const trabajadores = perceptores.filter(p => p.tipo === 'TRABAJADOR');
  const premios = perceptores.filter(p => p.tipo === 'PREMIO');

  // Casillas trabajo
  const casilla_01 = trabajadores.length;
  const casilla_02 = roundToCents(trabajadores.reduce((sum, p) => sum + p.base_retenciones, 0));
  const casilla_03 = roundToCents(trabajadores.reduce((sum, p) => sum + p.retencion_aplicada, 0));

  // Casillas profesionales
  const casilla_04 = profesionales.length;
  const casilla_05 = roundToCents(profesionales.reduce((sum, p) => sum + p.base_retenciones, 0));
  const casilla_06 = roundToCents(profesionales.reduce((sum, p) => sum + p.retencion_aplicada, 0));

  // Casillas premios
  const casilla_07 = premios.length;
  const casilla_08 = roundToCents(premios.reduce((sum, p) => sum + p.base_retenciones, 0));
  const casilla_09 = roundToCents(premios.reduce((sum, p) => sum + p.retencion_aplicada, 0));

  // Total retenciones
  const totalRetenciones = roundToCents(casilla_03 + casilla_06 + casilla_09);
  const resultado = roundToCents(totalRetenciones - aDeducir);

  return {
    casilla_01,
    casilla_02,
    casilla_03,
    casilla_04,
    casilla_05,
    casilla_06,
    casilla_07,
    casilla_08,
    casilla_09,
    casilla_10: 0,
    casilla_11: 0,
    casilla_12: 0,
    casilla_13: 0,
    casilla_14: 0,
    casilla_15: 0,
    casilla_28: totalRetenciones,
    casilla_29: roundToCents(aDeducir),
    casilla_30: resultado,
    perceptores,
    total_perceptores: perceptores.length,
    total_base: roundToCents(casilla_02 + casilla_05 + casilla_08),
    total_retenciones: totalRetenciones,
    resultado,
    accion: resultado > 0 ? 'A INGRESAR' : 'SIN ACTIVIDAD',
  };
};

/**
 * =====================================================
 * MODELO 115 - RETENCIONES ALQUILERES
 * Basado en OCA/l10n-spain l10n_es_aeat_mod115
 * Fuente: https://github.com/OCA/l10n-spain
 * =====================================================
 *
 * Declaración trimestral de retenciones por alquileres
 * de locales para actividad empresarial/profesional.
 * Tipo de retención: 19%
 */
export const TIPO_RETENCION_ALQUILER = 0.19; // 19%

export interface Perceptor115 {
  nombre: string;
  nif: string;
  direccion_inmueble: string;
  base_alquiler: number;
  retencion: number;
}

export interface Modelo115Result {
  // Casillas oficiales
  casilla_01: number; // Número de perceptores
  casilla_02: number; // Base de las retenciones (suma alquileres sin IVA)
  casilla_03: number; // Retenciones e ingresos a cuenta (base × 19%)
  casilla_04: number; // A deducir (declaración complementaria)
  casilla_05: number; // Resultado a ingresar
  // Desglose
  perceptores: Perceptor115[];
  total_base: number;
  total_retenciones: number;
  resultado: number;
  accion: 'A INGRESAR' | 'SIN ACTIVIDAD';
  // Metadata
  trimestre?: number;
  ano?: number;
}

/**
 * Calcular Modelo 115 - Retenciones Alquileres
 */
export const calcularModelo115 = (
  perceptores: Perceptor115[],
  aDeducir: number = 0,
  trimestre?: number,
  ano?: number
): Modelo115Result => {
  const numPerceptores = perceptores.length;
  const baseTotal = roundToCents(perceptores.reduce((sum, p) => sum + p.base_alquiler, 0));
  const retencionesTotal = roundToCents(perceptores.reduce((sum, p) => sum + p.retencion, 0));
  const resultado = roundToCents(retencionesTotal - aDeducir);

  return {
    casilla_01: numPerceptores,
    casilla_02: baseTotal,
    casilla_03: retencionesTotal,
    casilla_04: roundToCents(aDeducir),
    casilla_05: resultado,
    perceptores,
    total_base: baseTotal,
    total_retenciones: retencionesTotal,
    resultado,
    accion: resultado > 0 ? 'A INGRESAR' : 'SIN ACTIVIDAD',
    trimestre,
    ano,
  };
};

/**
 * Calcular retención de alquiler (helper)
 */
export const calcularRetencionAlquiler = (baseAlquiler: number): number => {
  return roundToCents(baseAlquiler * TIPO_RETENCION_ALQUILER);
};

/**
 * =====================================================
 * MODELO 180 - RESUMEN ANUAL RETENCIONES ALQUILERES
 * Basado en OCA/l10n-spain
 * =====================================================
 *
 * Declaración informativa anual que resume todos los
 * Modelos 115 presentados durante el año.
 */
export interface Perceptor180 extends Perceptor115 {
  provincia: string;
  referencia_catastral?: string;
  rentas_anuales: number;
  retenciones_anuales: number;
}

export interface Modelo180Result {
  // Resumen anual
  ano: number;
  num_perceptores: number;
  base_total_anual: number;
  retenciones_total_anual: number;
  // Desglose por perceptor
  perceptores: Perceptor180[];
  // Desglose trimestral (para verificar cuadre)
  desglose_trimestral: Array<{
    trimestre: number;
    base: number;
    retenciones: number;
  }>;
  // Verificación de cuadre con 115s
  cuadra_con_115s: boolean;
  diferencia: number;
}

/**
 * Calcular Modelo 180 - Resumen Anual Alquileres
 */
export const calcularModelo180 = (
  perceptores: Perceptor180[],
  modelos115: Modelo115Result[],
  ano: number
): Modelo180Result => {
  const numPerceptores = perceptores.length;
  const baseTotal = roundToCents(perceptores.reduce((sum, p) => sum + p.rentas_anuales, 0));
  const retencionesTotal = roundToCents(perceptores.reduce((sum, p) => sum + p.retenciones_anuales, 0));

  // Desglose trimestral desde los 115s
  const desgloseTrimestral = modelos115.map(m => ({
    trimestre: m.trimestre || 0,
    base: m.total_base,
    retenciones: m.total_retenciones,
  }));

  // Verificar cuadre
  const suma115Base = roundToCents(modelos115.reduce((sum, m) => sum + m.total_base, 0));
  const suma115Ret = roundToCents(modelos115.reduce((sum, m) => sum + m.total_retenciones, 0));
  const diferencia = roundToCents(Math.abs(retencionesTotal - suma115Ret));

  return {
    ano,
    num_perceptores: numPerceptores,
    base_total_anual: baseTotal,
    retenciones_total_anual: retencionesTotal,
    perceptores,
    desglose_trimestral: desgloseTrimestral,
    cuadra_con_115s: diferencia < 0.02, // Tolerancia de 1 céntimo por redondeos
    diferencia,
  };
};

/**
 * =====================================================
 * MODELO 390 - RESUMEN ANUAL IVA
 * Basado en OCA/l10n-spain l10n_es_aeat_mod390
 * =====================================================
 */
export interface Modelo390Result {
  ano: number;
  // Totales anuales
  total_base_repercutida: number;
  total_iva_repercutido: number;
  total_base_soportada: number;
  total_iva_soportado: number;
  resultado_anual: number;
  // Desglose por tipo IVA
  desglose_por_tipo: {
    tipo_4: { base: number; cuota: number };
    tipo_10: { base: number; cuota: number };
    tipo_21: { base: number; cuota: number };
  };
  // Desglose trimestral (para verificar cuadre)
  desglose_trimestral: Array<{
    trimestre: number;
    iva_repercutido: number;
    iva_soportado: number;
    resultado: number;
  }>;
  // Verificación de cuadre con 303s
  cuadra_con_303s: boolean;
  suma_303s: number;
}

/**
 * Calcular Modelo 390 - Resumen Anual IVA
 */
export const calcularModelo390 = (
  modelos303: Array<{ trimestre: number; iva_repercutido: number; iva_soportado: number; resultado: number }>,
  ano: number,
  desglosePorTipo?: {
    tipo_4: { base: number; cuota: number };
    tipo_10: { base: number; cuota: number };
    tipo_21: { base: number; cuota: number };
  }
): Modelo390Result => {
  const totalIvaRepercutido = roundToCents(modelos303.reduce((sum, m) => sum + m.iva_repercutido, 0));
  const totalIvaSoportado = roundToCents(modelos303.reduce((sum, m) => sum + m.iva_soportado, 0));
  const resultadoAnual = roundToCents(totalIvaRepercutido - totalIvaSoportado);
  const suma_303s = roundToCents(modelos303.reduce((sum, m) => sum + m.resultado, 0));

  // Desglose por tipo (si no se proporciona, asumir todo al 21%)
  const desglose = desglosePorTipo || {
    tipo_4: { base: 0, cuota: 0 },
    tipo_10: { base: 0, cuota: 0 },
    tipo_21: { base: roundToCents(totalIvaRepercutido / 0.21), cuota: totalIvaRepercutido },
  };

  return {
    ano,
    total_base_repercutida: roundToCents(desglose.tipo_4.base + desglose.tipo_10.base + desglose.tipo_21.base),
    total_iva_repercutido: totalIvaRepercutido,
    total_base_soportada: 0, // Se calculará desde los gastos
    total_iva_soportado: totalIvaSoportado,
    resultado_anual: resultadoAnual,
    desglose_por_tipo: desglose,
    desglose_trimestral: modelos303.map(m => ({
      trimestre: m.trimestre,
      iva_repercutido: m.iva_repercutido,
      iva_soportado: m.iva_soportado,
      resultado: m.resultado,
    })),
    cuadra_con_303s: Math.abs(resultadoAnual - suma_303s) < 0.02,
    suma_303s: suma_303s,
  };
};

/**
 * Estimar tramo de IRPF según rendimiento neto anual
 * Tramos 2026 (actualizados según normativa vigente)
 */
export const estimarTramoIRPF = (rendimientoNetoAnual: number): number => {
  if (rendimientoNetoAnual <= 12450) return 19;
  if (rendimientoNetoAnual <= 20200) return 24;
  if (rendimientoNetoAnual <= 35200) return 30;
  if (rendimientoNetoAnual <= 60000) return 37;
  if (rendimientoNetoAnual <= 300000) return 45;
  return 47;
};

/**
 * Calcular brecha IRPF
 * Diferencia entre el tipo retenido (7% nuevos autónomos) y el tipo real estimado
 */
export const calcularBrechaIRPF = (
  rendimientoNetoAnual: number,
  tipoRetenidoActual: number
): number => {
  const tipoEstimado = estimarTramoIRPF(rendimientoNetoAnual);
  const irpfRetenido = roundToCents((rendimientoNetoAnual * tipoRetenidoActual) / 100);
  const irpfEstimado = roundToCents((rendimientoNetoAnual * tipoEstimado) / 100);

  return roundToCents(irpfEstimado - irpfRetenido);
};

/**
 * Calcular balance real (dinero disponible real después de obligaciones fiscales)
 */
export interface BalanceReal {
  saldo_bancario: number;
  iva_pendiente_pagar: number;
  irpf_brecha: number;
  seguridad_social_pendiente: number;
  balance_real: number;
  diferencia: number;
}

export const calcularBalanceReal = (
  saldoBancario: number,
  ivaPendientePagar: number,
  irpfBrecha: number,
  seguridadSocialPendiente: number = 0
): BalanceReal => {
  const balanceReal = roundToCents(
    saldoBancario - ivaPendientePagar - irpfBrecha - seguridadSocialPendiente
  );
  const diferencia = roundToCents(saldoBancario - balanceReal);

  return {
    saldo_bancario: roundToCents(saldoBancario),
    iva_pendiente_pagar: roundToCents(ivaPendientePagar),
    irpf_brecha: roundToCents(irpfBrecha),
    seguridad_social_pendiente: roundToCents(seguridadSocialPendiente),
    balance_real: balanceReal,
    diferencia,
  };
};

/**
 * Calcular amortización anual de un activo
 */
export const calcularAmortizacionAnual = (
  importeAdquisicion: number,
  vidaUtilAnos: number
): number => {
  return roundToCents(importeAdquisicion / vidaUtilAnos);
};

/**
 * Calcular porcentaje de amortización anual
 */
export const calcularPorcentajeAmortizacion = (vidaUtilAnos: number): number => {
  return roundToCents((100 / vidaUtilAnos));
};

/**
 * Calcular valor residual de un activo
 */
export const calcularValorResidual = (
  importeAdquisicion: number,
  amortizacionAcumulada: number
): number => {
  return roundToCents(importeAdquisicion - amortizacionAcumulada);
};

/**
 * Calcular porcentaje de dependencia TRADE
 * @param facturacionClientePrincipal - Facturación al cliente principal
 * @param facturacionTotal - Facturación total anual
 */
export const calcularPorcentajeDependencia = (
  facturacionClientePrincipal: number,
  facturacionTotal: number
): number => {
  if (facturacionTotal === 0) return 0;
  return roundToCents((facturacionClientePrincipal / facturacionTotal) * 100);
};

/**
 * Verificar si cumple requisitos TRADE
 * Dependencia > 75% de un solo cliente
 */
export const cumpleRequisitosTRADE = (porcentajeDependencia: number): boolean => {
  return porcentajeDependencia >= 75;
};

/**
 * Calcular score de riesgo TRADE (0-100)
 * Factores:
 * - Dependencia > 75%: +40 puntos
 * - Dependencia > 85%: +20 puntos adicionales
 * - Sin gastos de independencia: +30 puntos
 * - Gastos de alto riesgo: +5 puntos por gasto
 */
export interface TradeRiskScore {
  score: number;
  nivel: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRÍTICO';
  factores: Array<{
    factor: string;
    puntos: number;
    descripcion: string;
  }>;
}

export const calcularRiesgoTRADE = (
  porcentajeDependencia: number,
  tieneGastosIndependencia: boolean,
  gastosAltoRiesgo: number = 0
): TradeRiskScore => {
  let score = 0;
  const factores: Array<{ factor: string; puntos: number; descripcion: string }> = [];

  // Factor 1: Dependencia
  if (porcentajeDependencia >= 75) {
    const puntos = 40;
    score += puntos;
    factores.push({
      factor: 'Dependencia > 75%',
      puntos,
      descripcion: `Dependencia del ${porcentajeDependencia.toFixed(1)}% de un solo cliente`,
    });
  }

  if (porcentajeDependencia >= 85) {
    const puntos = 20;
    score += puntos;
    factores.push({
      factor: 'Dependencia muy alta (>85%)',
      puntos,
      descripcion: 'Dependencia crítica de un solo cliente',
    });
  }

  // Factor 2: Gastos de independencia
  if (!tieneGastosIndependencia) {
    const puntos = 30;
    score += puntos;
    factores.push({
      factor: 'Sin gastos de independencia',
      puntos,
      descripcion: 'Faltan gastos obligatorios a tu nombre (alquiler, luz, internet)',
    });
  }

  // Factor 3: Gastos de alto riesgo
  if (gastosAltoRiesgo > 0) {
    const puntos = gastosAltoRiesgo * 5;
    score += puntos;
    factores.push({
      factor: 'Gastos de alto riesgo',
      puntos,
      descripcion: `${gastosAltoRiesgo} gasto(s) cuestionable(s) detectado(s)`,
    });
  }

  // Determinar nivel
  let nivel: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRÍTICO';
  if (score < 25) nivel = 'BAJO';
  else if (score < 50) nivel = 'MEDIO';
  else if (score < 75) nivel = 'ALTO';
  else nivel = 'CRÍTICO';

  return {
    score,
    nivel,
    factores,
  };
};

/**
 * Validar NIF español
 */
export const validarNIF = (nif: string): boolean => {
  const nifRegex = /^[0-9]{8}[A-Z]$/;
  if (!nifRegex.test(nif)) return false;

  const letras = 'TRWAGMYFPDXBNJZSQVHLCKE';
  const numero = parseInt(nif.substring(0, 8), 10);
  const letra = nif.charAt(8);

  return letras.charAt(numero % 23) === letra;
};

/**
 * Validar CIF español
 */
export const validarCIF = (cif: string): boolean => {
  const cifRegex = /^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/;
  return cifRegex.test(cif);
};

/**
 * Validar CIF o NIF español
 * Acepta tanto CIF (identificador de empresa) como NIF (identificador personal)
 */
export const validarCIFoNIF = (identificador: string): boolean => {
  return validarCIF(identificador) || validarNIF(identificador);
};

/**
 * Validar IBAN español
 */
export const validarIBAN = (iban: string): boolean => {
  // Eliminar espacios
  const ibanLimpio = iban.replace(/\s/g, '');

  // IBAN español: ES + 2 dígitos + 20 caracteres
  const ibanRegex = /^ES\d{22}$/;
  if (!ibanRegex.test(ibanLimpio)) return false;

  // Validación módulo 97
  const reordenado = ibanLimpio.substring(4) + ibanLimpio.substring(0, 4);
  const numerico = reordenado.replace(/[A-Z]/g, (letra) =>
    (letra.charCodeAt(0) - 55).toString()
  );

  let resto = 0;
  for (let i = 0; i < numerico.length; i++) {
    resto = (resto * 10 + parseInt(numerico[i])) % 97;
  }

  return resto === 1;
};

/**
 * Tramos de cotización 2026 con bases mínimas y máximas
 * Fuentes: AFINOM 2026, BBVA Mi Jubilación
 */
export interface TramoCotizacion {
  tramo: number;
  rendimientosDesde: number;
  rendimientosHasta: number;
  baseMinima: number;
  baseMaxima: number;
  esTablaReducida: boolean;
}

export const TRAMOS_COTIZACION_2026: TramoCotizacion[] = [
  // TABLA REDUCIDA (Tramos 1-6)
  { tramo: 1, rendimientosDesde: 0, rendimientosHasta: 670, baseMinima: 653.59, baseMaxima: 718.94, esTablaReducida: true },
  { tramo: 2, rendimientosDesde: 670.01, rendimientosHasta: 900, baseMinima: 718.95, baseMaxima: 900.00, esTablaReducida: true },
  { tramo: 3, rendimientosDesde: 900.01, rendimientosHasta: 1166.70, baseMinima: 849.67, baseMaxima: 1166.70, esTablaReducida: true },
  { tramo: 4, rendimientosDesde: 1166.71, rendimientosHasta: 1300, baseMinima: 960.50, baseMaxima: 1300.00, esTablaReducida: true },
  { tramo: 5, rendimientosDesde: 1300.01, rendimientosHasta: 1500, baseMinima: 970.40, baseMaxima: 1500.00, esTablaReducida: true },
  { tramo: 6, rendimientosDesde: 1500.01, rendimientosHasta: 1700, baseMinima: 970.40, baseMaxima: 1700.00, esTablaReducida: true },
  // TABLA GENERAL (Tramos 7-15)
  { tramo: 7, rendimientosDesde: 1700.01, rendimientosHasta: 1850, baseMinima: 1161.90, baseMaxima: 1850.00, esTablaReducida: false },
  { tramo: 8, rendimientosDesde: 1850.01, rendimientosHasta: 2030, baseMinima: 1227.30, baseMaxima: 2030.00, esTablaReducida: false },
  { tramo: 9, rendimientosDesde: 2030.01, rendimientosHasta: 2330, baseMinima: 1293.60, baseMaxima: 2330.00, esTablaReducida: false },
  { tramo: 10, rendimientosDesde: 2330.01, rendimientosHasta: 2760, baseMinima: 1383.30, baseMaxima: 2760.00, esTablaReducida: false },
  { tramo: 11, rendimientosDesde: 2760.01, rendimientosHasta: 3190, baseMinima: 1466.70, baseMaxima: 3190.00, esTablaReducida: false },
  { tramo: 12, rendimientosDesde: 3190.01, rendimientosHasta: 3620, baseMinima: 1549.00, baseMaxima: 3620.00, esTablaReducida: false },
  { tramo: 13, rendimientosDesde: 3620.01, rendimientosHasta: 4050, baseMinima: 1641.30, baseMaxima: 4050.00, esTablaReducida: false },
  { tramo: 14, rendimientosDesde: 4050.01, rendimientosHasta: 6000, baseMinima: 1775.30, baseMaxima: 5101.20, esTablaReducida: false },
  { tramo: 15, rendimientosDesde: 6000.01, rendimientosHasta: Infinity, baseMinima: 1976.40, baseMaxima: 5101.20, esTablaReducida: false },
];

/**
 * Tipo de cotización total 2026 (31,5%)
 * - Contingencias comunes: 28,3%
 * - AT/EP: 1,3%
 * - Cese de actividad: 0,9%
 * - Formación profesional: 0,1%
 * - MEI: 0,9%
 */
export const TIPO_COTIZACION_TOTAL_2026 = 0.315; // 31.5%

/**
 * Obtener el tramo correspondiente según rendimientos netos mensuales
 */
export const obtenerTramoPorRendimientos = (rendimientoNetoMensual: number): TramoCotizacion => {
  for (const tramo of TRAMOS_COTIZACION_2026) {
    if (rendimientoNetoMensual >= tramo.rendimientosDesde && rendimientoNetoMensual <= tramo.rendimientosHasta) {
      return tramo;
    }
  }
  // Por defecto, retornar el último tramo (>6000€)
  return TRAMOS_COTIZACION_2026[14];
};

/**
 * Calcular cuota según base de cotización elegida
 * @param baseCotizacion - Base de cotización en euros
 * @returns Cuota mensual de autónomos en euros
 */
export const calcularCuotaPorBase = (baseCotizacion: number): number => {
  return roundToCents(baseCotizacion * TIPO_COTIZACION_TOTAL_2026);
};

/**
 * Calcular cuota de autónomos según rendimientos netos mensuales (2026)
 * Basado en la tabla oficial de tramos para 2026
 *
 * @param rendimientoNetoMensual - Rendimiento neto mensual en euros
 * @param tieneTarifaPlana - Si el autónomo tiene tarifa plana (primeros 12 meses)
 * @param baseCotizacionElegida - Base de cotización elegida por el usuario (opcional)
 * @returns Cuota mensual de autónomos en euros
 */
export const calcularCuotaAutonomos = (
  rendimientoNetoMensual: number,
  tieneTarifaPlana: boolean = false,
  baseCotizacionElegida?: number
): number => {
  // Determinar la base a usar
  let baseAUsar: number;

  if (baseCotizacionElegida && baseCotizacionElegida > 0) {
    // Usuario eligió una base específica
    baseAUsar = baseCotizacionElegida;
  } else {
    // No eligió base: usar base mínima de tabla general
    baseAUsar = 950.98; // Base mínima tabla general 2026
  }

  // Si tiene tarifa plana: 80€ bonificados + MEI (0.9% sobre la base elegida)
  // El MEI NO está bonificado, se paga sobre la base de cotización
  if (tieneTarifaPlana) {
    const tarifaPlanaBonificada = 80.00;
    const porcentajeMEI = 0.009; // 0.9% MEI en 2026
    const cuotaMEI = roundToCents(baseAUsar * porcentajeMEI);
    return roundToCents(tarifaPlanaBonificada + cuotaMEI);
  }

  // Sin tarifa plana: cotización normal (31,5% sobre la base)
  return calcularCuotaPorBase(baseAUsar);
};

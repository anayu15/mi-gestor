import { format, startOfQuarter, endOfQuarter, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Generar número de factura secuencial
 * Formato: YYYY-NNN (ej: 2024-001)
 */
export const generarNumeroFactura = (year: number, lastNumber: number): string => {
  const nextNumber = lastNumber + 1;
  const paddedNumber = nextNumber.toString().padStart(3, '0');
  return `${year}-${paddedNumber}`;
};

/**
 * Formatear fecha para display
 */
export const formatearFecha = (date: Date, formatStr: string = 'dd/MM/yyyy'): string => {
  return format(date, formatStr, { locale: es });
};

/**
 * Obtener trimestre de una fecha
 * @returns Número del trimestre (1-4)
 */
export const obtenerTrimestre = (date: Date): number => {
  const month = date.getMonth();
  return Math.floor(month / 3) + 1;
};

/**
 * Obtener fechas límite fiscales
 */
export const obtenerFechaLimiteModelo = (trimestre: number, year: number): Date => {
  const fechasLimite = {
    1: new Date(year, 3, 20), // 20 de abril
    2: new Date(year, 6, 20), // 20 de julio
    3: new Date(year, 9, 20), // 20 de octubre
    4: new Date(year + 1, 0, 20), // 20 de enero del año siguiente
  };

  return fechasLimite[trimestre as keyof typeof fechasLimite];
};

/**
 * Calcular fecha de recordatorio (5 días antes)
 */
export const calcularFechaRecordatorio = (fechaLimite: Date): Date => {
  return addDays(fechaLimite, -5);
};

/**
 * Obtener inicio y fin de trimestre
 */
export const obtenerPeriodoTrimestre = (
  trimestre: number,
  year: number
): { inicio: Date; fin: Date } => {
  const month = (trimestre - 1) * 3;
  const date = new Date(year, month, 1);

  return {
    inicio: startOfQuarter(date),
    fin: endOfQuarter(date),
  };
};

/**
 * Sanitizar nombre de archivo
 */
export const sanitizarNombreArchivo = (filename: string): string => {
  return filename
    .replace(/[^a-z0-9.-]/gi, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
};

/**
 * Generar slug único
 */
export const generarSlug = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

/**
 * Formatear moneda (euros)
 */
export const formatearMoneda = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

/**
 * Formatear porcentaje
 */
export const formatearPorcentaje = (value: number, decimals: number = 2): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * Detectar categoría de gasto basada en keywords
 */
export const detectarCategoriaGasto = (concepto: string): string => {
  const conceptoLower = concepto.toLowerCase();

  if (
    conceptoLower.includes('alquiler') ||
    conceptoLower.includes('arrendamiento') ||
    conceptoLower.includes('renta')
  ) {
    return 'Alquiler';
  }

  if (
    conceptoLower.includes('electricidad') ||
    conceptoLower.includes('luz') ||
    conceptoLower.includes('endesa') ||
    conceptoLower.includes('iberdrola')
  ) {
    return 'Suministros';
  }

  if (
    conceptoLower.includes('internet') ||
    conceptoLower.includes('telefon') ||
    conceptoLower.includes('fibra') ||
    conceptoLower.includes('movistar') ||
    conceptoLower.includes('vodafone')
  ) {
    return 'Suministros';
  }

  if (conceptoLower.includes('comida') || conceptoLower.includes('restaurante')) {
    return 'Manutención';
  }

  if (conceptoLower.includes('formaci') || conceptoLower.includes('curso')) {
    return 'Formación';
  }

  if (conceptoLower.includes('software') || conceptoLower.includes('licencia')) {
    return 'Software';
  }

  if (conceptoLower.includes('ordenador') || conceptoLower.includes('laptop')) {
    return 'Equipamiento';
  }

  return 'Otros';
};

/**
 * Detectar si un gasto es de independencia TRADE
 */
export const esGastoIndependencia = (categoria: string, concepto: string): boolean => {
  const categoriaLower = categoria.toLowerCase();
  const conceptoLower = concepto.toLowerCase();

  // Alquiler
  if (
    categoriaLower.includes('alquiler') ||
    conceptoLower.includes('alquiler') ||
    conceptoLower.includes('arrendamiento')
  ) {
    return true;
  }

  // Suministros esenciales
  if (
    categoriaLower.includes('suministro') &&
    (conceptoLower.includes('electricidad') ||
      conceptoLower.includes('luz') ||
      conceptoLower.includes('internet') ||
      conceptoLower.includes('agua'))
  ) {
    return true;
  }

  return false;
};

/**
 * Calcular nivel de riesgo de un gasto
 */
export const calcularNivelRiesgoGasto = (
  categoria: string,
  fecha: Date,
  importe: number
): 'BAJO' | 'MEDIO' | 'ALTO' => {
  // Gastos de manutención en fin de semana = ALTO
  if (categoria === 'Manutención') {
    const dayOfWeek = fecha.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 'ALTO'; // Sábado o domingo
    }
    if (importe > 50) {
      return 'MEDIO'; // Importe alto en día laboral
    }
  }

  // Gastos muy altos
  if (importe > 1000 && categoria !== 'Alquiler') {
    return 'MEDIO';
  }

  return 'BAJO';
};

/**
 * Generar mensaje de alerta TRADE
 */
export const generarMensajeAlertaTRADE = (
  tipo: string,
  detalles?: any
): { titulo: string; descripcion: string; recomendacion: string } => {
  switch (tipo) {
    case 'FALTA_GASTO_INDEPENDENCIA':
      return {
        titulo: 'Falta gasto de independencia',
        descripcion: `No has registrado ${detalles.tipoGasto} de ${detalles.mes}/${detalles.ano} a tu nombre.`,
        recomendacion:
          'Como autónomo TRADE con local alquilado, debes demostrar independencia del cliente. Sube la factura a tu nombre lo antes posible.',
      };

    case 'EXCESO_DEPENDENCIA':
      return {
        titulo: 'Exceso de dependencia de cliente',
        descripcion: `Tu dependencia del cliente principal es del ${detalles.porcentaje}%, superando el límite del 75% para TRADE.`,
        recomendacion:
          'Considera buscar un segundo cliente para diversificar ingresos y reducir el riesgo fiscal.',
      };

    case 'GASTO_ALTO_RIESGO':
      return {
        titulo: 'Gasto de riesgo detectado',
        descripcion: detalles.descripcion,
        recomendacion:
          'Asegúrate de tener justificación adecuada y documentación adicional para este gasto.',
      };

    default:
      return {
        titulo: 'Alerta de cumplimiento',
        descripcion: 'Se ha detectado una situación que requiere tu atención.',
        recomendacion: 'Revisa los detalles y toma las acciones necesarias.',
      };
  }
};

/**
 * =====================================================
 * CASILLAS MODELO 303 - IVA TRIMESTRAL
 * Basado en AEAT 2026 y OCA/l10n-spain
 * =====================================================
 */
export interface Desglose303PorTipo {
  base_4?: number;
  cuota_4?: number;
  base_10?: number;
  cuota_10?: number;
  base_21?: number;
  cuota_21?: number;
}

export interface CasillasModelo303 {
  // IVA devengado (repercutido) - por tipo
  casilla_01: number; // Base 4%
  casilla_02: number; // Tipo 4%
  casilla_03: number; // Cuota 4%
  casilla_04: number; // Base 10%
  casilla_05: number; // Tipo 10%
  casilla_06: number; // Cuota 10%
  casilla_07: number; // Base 21%
  casilla_08: number; // Tipo 21%
  casilla_09: number; // Cuota 21%
  casilla_27: number; // Total IVA devengado
  // IVA deducible (soportado)
  casilla_28: number; // Base IVA soportado
  casilla_29: number; // Cuota IVA deducible
  casilla_45: number; // Total IVA deducible
  // Resultado
  casilla_46: number; // Resultado régimen general
  casilla_69: number; // Resultado final
  casilla_71: number; // A ingresar (si positivo)
  casilla_72: number; // A compensar (si negativo)
}

/**
 * Generar casillas para Modelo 303 - Versión completa con desglose por tipos
 */
export const generarCasillasModelo303Completo = (
  desgloseRepercutido: Desglose303PorTipo,
  baseSoportada: number,
  cuotaSoportada: number,
  compensacionesAnteriores: number = 0
): CasillasModelo303 => {
  const base_4 = desgloseRepercutido.base_4 || 0;
  const cuota_4 = desgloseRepercutido.cuota_4 || 0;
  const base_10 = desgloseRepercutido.base_10 || 0;
  const cuota_10 = desgloseRepercutido.cuota_10 || 0;
  const base_21 = desgloseRepercutido.base_21 || 0;
  const cuota_21 = desgloseRepercutido.cuota_21 || 0;

  const totalDevengado = Math.round((cuota_4 + cuota_10 + cuota_21) * 100) / 100;
  const totalDeducible = Math.round(cuotaSoportada * 100) / 100;
  const resultadoRegimenGeneral = Math.round((totalDevengado - totalDeducible) * 100) / 100;
  const resultadoFinal = Math.round((resultadoRegimenGeneral - compensacionesAnteriores) * 100) / 100;

  return {
    casilla_01: Math.round(base_4 * 100) / 100,
    casilla_02: 4,
    casilla_03: Math.round(cuota_4 * 100) / 100,
    casilla_04: Math.round(base_10 * 100) / 100,
    casilla_05: 10,
    casilla_06: Math.round(cuota_10 * 100) / 100,
    casilla_07: Math.round(base_21 * 100) / 100,
    casilla_08: 21,
    casilla_09: Math.round(cuota_21 * 100) / 100,
    casilla_27: totalDevengado,
    casilla_28: Math.round(baseSoportada * 100) / 100,
    casilla_29: totalDeducible,
    casilla_45: totalDeducible,
    casilla_46: resultadoRegimenGeneral,
    casilla_69: resultadoFinal,
    casilla_71: resultadoFinal > 0 ? resultadoFinal : 0,
    casilla_72: resultadoFinal < 0 ? Math.abs(resultadoFinal) : 0,
  };
};

/**
 * Generar casillas para Modelo 303 - Versión simplificada (compatibilidad hacia atrás)
 * Asume todo IVA al 21%
 */
export const generarCasillasModelo303 = (
  baseImponible21: number,
  cuotaIva21: number,
  ivaSoportado: number,
  cuotaIvaSoportado: number
): Record<string, number> => {
  const resultado = Math.round((cuotaIva21 - cuotaIvaSoportado) * 100) / 100;
  return {
    casilla_01: 0, // Base 4% (no usado)
    casilla_03: 0, // Cuota 4%
    casilla_04: 0, // Base 10% (no usado)
    casilla_06: 0, // Cuota 10%
    casilla_07: Math.round(baseImponible21 * 100) / 100, // Base 21%
    casilla_09: Math.round(cuotaIva21 * 100) / 100, // Cuota 21%
    casilla_27: Math.round(cuotaIva21 * 100) / 100, // Total devengado
    casilla_28: Math.round(ivaSoportado * 100) / 100, // Base soportado
    casilla_29: Math.round(cuotaIvaSoportado * 100) / 100, // Cuota deducible
    casilla_45: Math.round(cuotaIvaSoportado * 100) / 100, // Total deducible
    casilla_46: resultado, // Resultado
    casilla_69: resultado, // Resultado final
    casilla_71: resultado > 0 ? resultado : 0, // A ingresar
    casilla_72: resultado < 0 ? Math.abs(resultado) : 0, // A compensar
  };
};

/**
 * =====================================================
 * CASILLAS MODELO 130 - PAGO FRACCIONADO IRPF
 * Basado en AEAT 2026 y OCA/l10n-spain
 * IMPORTANTE: Datos ACUMULADOS desde el 1 de enero
 * =====================================================
 */
export interface CasillasModelo130 {
  casilla_01: number; // Ingresos íntegros acumulados
  casilla_02: number; // Gastos deducibles acumulados
  casilla_03: number; // Rendimiento neto (01 - 02)
  casilla_04: number; // 20% del rendimiento neto positivo
  casilla_05: number; // Pagos fraccionados anteriores (solo positivos)
  casilla_06: number; // Retenciones e ingresos a cuenta acumulados
  casilla_07: number; // Resultado (04 - 05 - 06)
}

/**
 * Generar casillas para Modelo 130 - Versión completa acumulada
 */
export const generarCasillasModelo130Acumulado = (
  ingresosAcumulados: number,
  gastosAcumulados: number,
  pagosAnteriores: number = 0,
  retencionesAcumuladas: number = 0
): CasillasModelo130 => {
  const rendimientoNeto = Math.round((ingresosAcumulados - gastosAcumulados) * 100) / 100;
  const pago20Pct = rendimientoNeto > 0 ? Math.round(rendimientoNeto * 0.2 * 100) / 100 : 0;
  const pagosAnterioresPositivos = Math.max(0, pagosAnteriores);
  const resultado = Math.round((pago20Pct - pagosAnterioresPositivos - retencionesAcumuladas) * 100) / 100;

  return {
    casilla_01: Math.round(ingresosAcumulados * 100) / 100,
    casilla_02: Math.round(gastosAcumulados * 100) / 100,
    casilla_03: rendimientoNeto,
    casilla_04: pago20Pct,
    casilla_05: Math.round(pagosAnterioresPositivos * 100) / 100,
    casilla_06: Math.round(retencionesAcumuladas * 100) / 100,
    casilla_07: resultado,
  };
};

/**
 * Generar casillas para Modelo 130 - Versión simplificada (compatibilidad hacia atrás)
 * NOTA: Esta versión usa casillas antiguas, no las oficiales acumuladas
 */
export const generarCasillasModelo130 = (
  ingresos: number,
  gastos: number,
  rendimientoNeto: number,
  pagoFraccionado: number,
  retenciones: number,
  resultado: number
): Record<string, number> => {
  return {
    casilla_01: Math.round(ingresos * 100) / 100,
    casilla_02: Math.round(gastos * 100) / 100,
    casilla_03: Math.round(rendimientoNeto * 100) / 100,
    casilla_04: Math.round(pagoFraccionado * 100) / 100, // 20% del rendimiento
    casilla_05: 0, // Pagos anteriores (no calculado en versión simple)
    casilla_06: Math.round(retenciones * 100) / 100,
    casilla_07: Math.round(resultado * 100) / 100,
    // Casillas antiguas para compatibilidad
    casilla_16: Math.round(retenciones * 100) / 100,
    casilla_19: Math.round(resultado * 100) / 100,
  };
};

/**
 * =====================================================
 * CASILLAS MODELO 115 - RETENCIONES ALQUILERES
 * =====================================================
 */
export interface CasillasModelo115 {
  casilla_01: number; // Número de perceptores
  casilla_02: number; // Base de las retenciones
  casilla_03: number; // Retenciones e ingresos a cuenta (19%)
  casilla_04: number; // A deducir (complementaria)
  casilla_05: number; // Resultado a ingresar
}

export const generarCasillasModelo115 = (
  numPerceptores: number,
  baseAlquiler: number,
  aDeducir: number = 0
): CasillasModelo115 => {
  const retenciones = Math.round(baseAlquiler * 0.19 * 100) / 100;
  const resultado = Math.round((retenciones - aDeducir) * 100) / 100;

  return {
    casilla_01: numPerceptores,
    casilla_02: Math.round(baseAlquiler * 100) / 100,
    casilla_03: retenciones,
    casilla_04: Math.round(aDeducir * 100) / 100,
    casilla_05: resultado,
  };
};

/**
 * =====================================================
 * CASILLAS MODELO 111 - RETENCIONES IRPF
 * =====================================================
 */
export interface CasillasModelo111 {
  // Trabajo
  casilla_01: number; // Número perceptores trabajo
  casilla_02: number; // Base trabajo
  casilla_03: number; // Retenciones trabajo
  // Profesionales
  casilla_04: number; // Número perceptores profesionales
  casilla_05: number; // Base profesionales
  casilla_06: number; // Retenciones profesionales
  // Totales
  casilla_28: number; // Total retenciones
  casilla_30: number; // Resultado a ingresar
}

export const generarCasillasModelo111 = (
  numTrabajadores: number,
  baseTrabajadores: number,
  retencionesTrabajadores: number,
  numProfesionales: number,
  baseProfesionales: number,
  retencionesProfesionales: number,
  aDeducir: number = 0
): CasillasModelo111 => {
  const totalRetenciones = Math.round((retencionesTrabajadores + retencionesProfesionales) * 100) / 100;
  const resultado = Math.round((totalRetenciones - aDeducir) * 100) / 100;

  return {
    casilla_01: numTrabajadores,
    casilla_02: Math.round(baseTrabajadores * 100) / 100,
    casilla_03: Math.round(retencionesTrabajadores * 100) / 100,
    casilla_04: numProfesionales,
    casilla_05: Math.round(baseProfesionales * 100) / 100,
    casilla_06: Math.round(retencionesProfesionales * 100) / 100,
    casilla_28: totalRetenciones,
    casilla_30: resultado,
  };
};

/**
 * Obtener el último día laborable de un mes
 * (Lunes a Viernes, no sábado ni domingo)
 */
export const obtenerUltimoDiaLaborable = (year: number, month: number): Date => {
  // Obtener el último día del mes
  const ultimoDiaMes = new Date(year, month, 0);
  let dia = ultimoDiaMes.getDate();
  let fecha = new Date(year, month - 1, dia);

  // Retroceder hasta encontrar un día laborable (lunes-viernes)
  while (fecha.getDay() === 0 || fecha.getDay() === 6) {
    dia--;
    fecha = new Date(year, month - 1, dia);
  }

  return fecha;
};

/**
 * Obtener el rango de fechas de presentación para modelos fiscales trimestrales
 * @param trimestre - Número del trimestre (1-4)
 * @param year - Año
 * @param modelo - Código del modelo fiscal (303, 130, 115, 111, etc.)
 * @returns Objeto con fecha_inicio y fecha_limite
 *
 * Plazos según AEAT 2026:
 * - Modelo 303 (IVA): 1-30 de enero (4T), 1-20 abril/julio/octubre (1T/2T/3T)
 * - Modelo 130 (IRPF): 1-30 de enero (4T), 1-20 abril/julio/octubre (1T/2T/3T)
 * - Modelos 111/115 (Retenciones): 1-20 de enero/abril/julio/octubre
 */
export const obtenerRangoFechasPresentacion = (
  trimestre: number,
  year: number,
  modelo?: string
): { fecha_inicio: string; fecha_limite: string } => {
  // Rangos base para cada trimestre
  const rangosTrimestre: Record<number, { mes: number; dia_limite_normal: number; dia_limite_retenciones: number }> = {
    1: { mes: 4, dia_limite_normal: 20, dia_limite_retenciones: 20 },   // Abril 1-20
    2: { mes: 7, dia_limite_normal: 20, dia_limite_retenciones: 20 },   // Julio 1-20
    3: { mes: 10, dia_limite_normal: 21, dia_limite_retenciones: 21 },  // Octubre 1-21 (21 en 2026 por festivo)
    4: { mes: 1, dia_limite_normal: 30, dia_limite_retenciones: 20 },   // Enero 1-30 (303/130) o 1-20 (111/115)
  };

  const rango = rangosTrimestre[trimestre];
  const yearFinal = trimestre === 4 ? year + 1 : year;

  // Determinar día límite según el modelo
  let dia_limite = rango.dia_limite_normal;

  // Modelos 111 y 115 tienen plazo de 20 días en el 4T (no 30)
  if (modelo === '111' || modelo === '115') {
    dia_limite = rango.dia_limite_retenciones;
  }

  // Fecha de inicio: día 1 del mes
  const fecha_inicio = new Date(yearFinal, rango.mes - 1, 1);

  // Fecha límite: día especificado del mes
  const fecha_limite = new Date(yearFinal, rango.mes - 1, dia_limite);

  // Formatear a YYYY-MM-DD
  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return {
    fecha_inicio: formatDate(fecha_inicio),
    fecha_limite: formatDate(fecha_limite),
  };
};

/**
 * Obtener el rango de fechas de presentación para la Renta
 * @param year - Año fiscal (la presentación es en year+1)
 */
export const obtenerRangoFechasRenta = (
  year: number
): { fecha_inicio: string; fecha_limite: string } => {
  const yearPresentacion = year + 1;

  const fecha_inicio = new Date(yearPresentacion, 3, 11); // 11 de abril
  const fecha_limite = new Date(yearPresentacion, 5, 30); // 30 de junio

  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return {
    fecha_inicio: formatDate(fecha_inicio),
    fecha_limite: formatDate(fecha_limite),
  };
};

/**
 * Obtener el rango de fechas de presentación para el Modelo 390
 * @param year - Año fiscal (la presentación es en year+1)
 */
export const obtenerRangoFechas390 = (
  year: number
): { fecha_inicio: string; fecha_limite: string } => {
  const yearPresentacion = year + 1;

  const fecha_inicio = new Date(yearPresentacion, 0, 1); // 1 de enero
  const fecha_limite = new Date(yearPresentacion, 0, 30); // 30 de enero

  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return {
    fecha_inicio: formatDate(fecha_inicio),
    fecha_limite: formatDate(fecha_limite),
  };
};

/**
 * Get presentation date range for Modelo 180 (Annual rental withholdings)
 * Modelo 180 is presented between January 1-31 of the following year
 */
export const obtenerRangoFechas180 = (
  year: number
): { fecha_inicio: string; fecha_limite: string } => {
  const yearPresentacion = year + 1;

  const fecha_inicio = new Date(yearPresentacion, 0, 1); // 1 de enero
  const fecha_limite = new Date(yearPresentacion, 0, 31); // 31 de enero

  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return {
    fecha_inicio: formatDate(fecha_inicio),
    fecha_limite: formatDate(fecha_limite),
  };
};

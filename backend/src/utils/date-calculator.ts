/**
 * Date Calculator Utilities for Recurring Invoices
 * Handles date calculations for recurring invoice generation
 */

/**
 * Get the number of days in a specific month
 */
function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Add months to a date, handling month-end edge cases
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Set the day of month, clamping to last day if needed
 * e.g., setDayOfMonth(Feb 2024, 31) => Feb 29 (leap year)
 */
function setDayOfMonth(date: Date, day: number): Date {
  const result = new Date(date);
  const daysInMonth = getDaysInMonth(result);
  result.setDate(Math.min(day, daysInMonth));
  return result;
}

/**
 * Get start of month
 */
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get end of month
 */
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Calculate next generation date based on frequency and generation day type
 *
 * @param frecuencia - MENSUAL, TRIMESTRAL, ANUAL, PERSONALIZADO
 * @param fechaBase - Base date to calculate from
 * @param tipoDiaGeneracion - Type of generation day
 * @param diaGeneracion - Day of month (1-31), only used when tipoDiaGeneracion = 'DIA_ESPECIFICO'
 * @param intervaloDias - Required for PERSONALIZADO frequency
 * @returns Next generation date
 */
export function calcularProximaGeneracion(
  frecuencia: 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL' | 'PERSONALIZADO',
  fechaBase: Date,
  tipoDiaGeneracion: 'DIA_ESPECIFICO' | 'PRIMER_DIA_NATURAL' | 'PRIMER_DIA_LECTIVO' | 'ULTIMO_DIA_NATURAL' | 'ULTIMO_DIA_LECTIVO',
  diaGeneracion?: number,
  intervaloDias?: number
): Date {
  let targetMonth: Date;

  switch (frecuencia) {
    case 'MENSUAL':
      // Add 1 month to get target month
      targetMonth = addMonths(fechaBase, 1);
      break;

    case 'TRIMESTRAL':
      // Add 3 months to get target month
      targetMonth = addMonths(fechaBase, 3);
      break;

    case 'ANUAL':
      // Add 12 months to get target month
      targetMonth = addMonths(fechaBase, 12);
      break;

    case 'PERSONALIZADO':
      if (!intervaloDias || intervaloDias <= 0) {
        throw new Error('intervalo_dias requerido para frecuencia PERSONALIZADO');
      }
      // For custom frequency, just add days (tipo_dia_generacion not applicable)
      return addDays(fechaBase, intervaloDias);

    default:
      throw new Error(`Frecuencia no válida: ${frecuencia}`);
  }

  // Calculate the specific generation day in the target month
  return getGenerationDay(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    tipoDiaGeneracion,
    diaGeneracion
  );
}

/**
 * Calculate billing period dates based on generation date and frequency
 * Returns the period that the invoice is billing for
 *
 * @param frecuencia - Frequency type
 * @param fechaEmision - Invoice emission date
 * @param duracionDias - Custom duration in days (optional)
 * @returns Object with inicio and fin dates
 */
export function calcularPeriodoFacturacion(
  frecuencia: string,
  fechaEmision: Date,
  duracionDias?: number
): { inicio: Date; fin: Date } {
  if (duracionDias && duracionDias > 0) {
    // Custom duration: period starts at beginning of emission month
    const inicio = startOfMonth(fechaEmision);
    const fin = addDays(inicio, duracionDias - 1);
    return { inicio, fin };
  }

  // Default: bill for the previous period based on frequency
  switch (frecuencia) {
    case 'MENSUAL': {
      // Bill for previous month
      const mesAnterior = addMonths(fechaEmision, -1);
      return {
        inicio: startOfMonth(mesAnterior),
        fin: endOfMonth(mesAnterior)
      };
    }

    case 'TRIMESTRAL': {
      // Bill for previous quarter (3 months)
      const inicioTrimestre = addMonths(fechaEmision, -3);
      return {
        inicio: startOfMonth(inicioTrimestre),
        fin: endOfMonth(addMonths(inicioTrimestre, 2))
      };
    }

    case 'ANUAL': {
      // Bill for previous year (12 months)
      const inicioAno = addMonths(fechaEmision, -12);
      return {
        inicio: startOfMonth(inicioAno),
        fin: endOfMonth(addMonths(inicioAno, 11))
      };
    }

    case 'PERSONALIZADO': {
      // Default to current month if no duration specified
      return {
        inicio: startOfMonth(fechaEmision),
        fin: endOfMonth(fechaEmision)
      };
    }

    default: {
      // Default to current month
      return {
        inicio: startOfMonth(fechaEmision),
        fin: endOfMonth(fechaEmision)
      };
    }
  }
}

/**
 * Format date to YYYY-MM-DD for SQL
 */
export function formatDateForSQL(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse SQL date string to Date object
 */
export function parseSQLDate(dateString: string): Date {
  return new Date(dateString + 'T00:00:00.000Z');
}

/**
 * Calculate initial proxima_generacion when creating a template
 * If fecha_inicio is in the past, calculate the next occurrence from today
 *
 * @param frecuencia - Frequency type
 * @param fechaInicio - Template start date
 * @param tipoDiaGeneracion - Type of generation day
 * @param diaGeneracion - Day of month (only for DIA_ESPECIFICO)
 * @param intervaloDias - For PERSONALIZADO frequency
 * @returns Next valid generation date
 */
export function calcularProximaGeneracionInicial(
  frecuencia: 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL' | 'PERSONALIZADO',
  fechaInicio: Date,
  tipoDiaGeneracion: 'DIA_ESPECIFICO' | 'PRIMER_DIA_NATURAL' | 'PRIMER_DIA_LECTIVO' | 'ULTIMO_DIA_NATURAL' | 'ULTIMO_DIA_LECTIVO',
  diaGeneracion?: number,
  intervaloDias?: number
): Date {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // If fecha_inicio is in the future, use it as base
  if (fechaInicio >= hoy) {
    return calcularProximaGeneracion(frecuencia, fechaInicio, tipoDiaGeneracion, diaGeneracion, intervaloDias);
  }

  // If fecha_inicio is in the past, calculate next occurrence from today
  let proxima = new Date(fechaInicio);

  while (proxima < hoy) {
    proxima = calcularProximaGeneracion(frecuencia, proxima, tipoDiaGeneracion, diaGeneracion, intervaloDias);
  }

  return proxima;
}

/**
 * Check if a date is the last day of the month
 */
export function isLastDayOfMonth(date: Date): boolean {
  const daysInMonth = getDaysInMonth(date);
  return date.getDate() === daysInMonth;
}

/**
 * Check if a year is a leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Check if a date is a business day (Monday-Friday)
 */
export function isBusinessDay(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5; // 1=Monday, 5=Friday
}

/**
 * Get the first business day of a month
 * Returns the first Monday-Friday of the month
 */
export function getFirstBusinessDay(year: number, month: number): Date {
  let date = new Date(year, month, 1);

  // If the 1st is a weekend, move to next Monday
  while (!isBusinessDay(date)) {
    date = addDays(date, 1);
  }

  return date;
}

/**
 * Get the last business day of a month
 * Returns the last Monday-Friday of the month
 */
export function getLastBusinessDay(year: number, month: number): Date {
  let date = endOfMonth(new Date(year, month, 1));

  // If the last day is a weekend, move backward to previous Friday
  while (!isBusinessDay(date)) {
    date = addDays(date, -1);
  }

  return date;
}

/**
 * Get the generation day based on tipo_dia_generacion
 *
 * @param year - Year to calculate for
 * @param month - Month to calculate for (0-11)
 * @param tipoDia - Type of generation day
 * @param diaEspecifico - Specific day (1-31), only used when tipoDia = 'DIA_ESPECIFICO'
 * @returns The calculated date
 */
export function getGenerationDay(
  year: number,
  month: number,
  tipoDia: 'DIA_ESPECIFICO' | 'PRIMER_DIA_NATURAL' | 'PRIMER_DIA_LECTIVO' | 'ULTIMO_DIA_NATURAL' | 'ULTIMO_DIA_LECTIVO',
  diaEspecifico?: number
): Date {
  switch (tipoDia) {
    case 'DIA_ESPECIFICO':
      if (!diaEspecifico || diaEspecifico < 1 || diaEspecifico > 31) {
        throw new Error('diaEspecifico requerido y debe estar entre 1-31 para tipo DIA_ESPECIFICO');
      }
      // Use setDayOfMonth to handle month-end edge cases
      return setDayOfMonth(new Date(year, month, 1), diaEspecifico);

    case 'PRIMER_DIA_NATURAL':
      return new Date(year, month, 1);

    case 'PRIMER_DIA_LECTIVO':
      return getFirstBusinessDay(year, month);

    case 'ULTIMO_DIA_NATURAL':
      return endOfMonth(new Date(year, month, 1));

    case 'ULTIMO_DIA_LECTIVO':
      return getLastBusinessDay(year, month);

    default:
      throw new Error(`Tipo de día de generación no válido: ${tipoDia}`);
  }
}

/**
 * Generate all scheduled dates between start and end
 * Does NOT skip past dates (unlike calcularProximaGeneracionInicial)
 * Used for detecting missing invoices in recurring templates
 *
 * @param frecuencia - Frequency type
 * @param fechaInicio - Start date
 * @param fechaFin - End date (inclusive)
 * @param tipoDiaGeneracion - Type of generation day
 * @param diaGeneracion - Day of month (only for DIA_ESPECIFICO)
 * @param intervaloDias - For PERSONALIZADO frequency
 * @returns Array of all scheduled dates between start and end
 */
export function generateAllScheduledDates(
  frecuencia: 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL' | 'PERSONALIZADO',
  fechaInicio: Date,
  fechaFin: Date,
  tipoDiaGeneracion: 'DIA_ESPECIFICO' | 'PRIMER_DIA_NATURAL' | 'PRIMER_DIA_LECTIVO' | 'ULTIMO_DIA_NATURAL' | 'ULTIMO_DIA_LECTIVO',
  diaGeneracion?: number,
  intervaloDias?: number
): Date[] {
  const dates: Date[] = [];
  let current = new Date(fechaInicio);
  current.setHours(0, 0, 0, 0);

  const end = new Date(fechaFin);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    dates.push(new Date(current));

    // Calculate next date using existing calcularProximaGeneracion
    current = calcularProximaGeneracion(
      frecuencia,
      current,
      tipoDiaGeneracion,
      diaGeneracion,
      intervaloDias
    );
  }

  return dates;
}

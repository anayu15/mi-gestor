/**
 * Schedule Calculator Utility
 * Calculates dates for scheduled/recurring expenses and invoices
 */

// How often records are generated
export type Periodicidad = 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';

// Which day of the period to use
export type TipoDia =
  | 'ULTIMO_DIA_LABORAL'   // Last business day of the month
  | 'PRIMER_DIA_LABORAL'   // First business day of the month
  | 'ULTIMO_DIA'           // Last day of the month
  | 'PRIMER_DIA'           // First day of the month
  | 'DIA_ESPECIFICO';      // Specific day (e.g., 15th)

// Legacy support
export type Frecuencia = 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'PERSONALIZADO';

export interface ScheduleConfig {
  periodicidad: Periodicidad;
  tipo_dia: TipoDia;
  dia_especifico?: number; // 1-31, only used when tipo_dia is DIA_ESPECIFICO
  fecha_inicio: Date;
  fecha_fin?: Date | null; // If null, use end of targetEndYear or current year
  targetEndYear?: number; // If provided and fecha_fin is null, use end of this year instead of current year
}

export interface Programacion {
  id: string;
  periodicidad: Periodicidad;
  tipo_dia: TipoDia;
  dia_especifico?: number;
  fecha_inicio: Date;
  fecha_fin?: Date | null;
  ultimo_ano_generado?: number;
}

// Spanish holidays (fixed dates - would need to be expanded for full accuracy)
const HOLIDAYS_SPAIN: { month: number; day: number }[] = [
  { month: 0, day: 1 },   // Año Nuevo
  { month: 0, day: 6 },   // Reyes
  { month: 4, day: 1 },   // Día del Trabajo
  { month: 7, day: 15 },  // Asunción
  { month: 9, day: 12 },  // Fiesta Nacional
  { month: 10, day: 1 },  // Todos los Santos
  { month: 11, day: 6 },  // Constitución
  { month: 11, day: 8 },  // Inmaculada
  { month: 11, day: 25 }, // Navidad
];

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Check if a date is a Spanish national holiday
 */
function isHoliday(date: Date): boolean {
  const month = date.getMonth();
  const day = date.getDate();
  return HOLIDAYS_SPAIN.some(h => h.month === month && h.day === day);
}

/**
 * Check if a date is a business day (not weekend, not holiday)
 */
function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date);
}

/**
 * Get the last day of a month
 */
function getLastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

/**
 * Get the first day of a month
 */
function getFirstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

/**
 * Get the last business day of a month
 */
function getLastBusinessDayOfMonth(year: number, month: number): Date {
  let date = getLastDayOfMonth(year, month);
  while (!isBusinessDay(date)) {
    date = new Date(date.getTime() - 24 * 60 * 60 * 1000); // Go back one day
  }
  return date;
}

/**
 * Get the first business day of a month
 */
function getFirstBusinessDayOfMonth(year: number, month: number): Date {
  let date = getFirstDayOfMonth(year, month);
  while (!isBusinessDay(date)) {
    date = new Date(date.getTime() + 24 * 60 * 60 * 1000); // Go forward one day
  }
  return date;
}

/**
 * Get a specific day of a month, adjusting if the day doesn't exist
 * (e.g., day 31 in February becomes day 28/29)
 */
function getSpecificDayOfMonth(year: number, month: number, day: number): Date {
  const lastDay = getLastDayOfMonth(year, month).getDate();
  const actualDay = Math.min(day, lastDay);
  return new Date(year, month, actualDay);
}

/**
 * Get the target date for a given month based on tipo_dia
 */
function getTargetDateForMonth(
  year: number,
  month: number,
  tipoDia: TipoDia,
  diaEspecifico?: number
): Date {
  switch (tipoDia) {
    case 'ULTIMO_DIA_LABORAL':
      return getLastBusinessDayOfMonth(year, month);
    case 'PRIMER_DIA_LABORAL':
      return getFirstBusinessDayOfMonth(year, month);
    case 'ULTIMO_DIA':
      return getLastDayOfMonth(year, month);
    case 'PRIMER_DIA':
      return getFirstDayOfMonth(year, month);
    case 'DIA_ESPECIFICO':
      if (!diaEspecifico || diaEspecifico < 1 || diaEspecifico > 31) {
        throw new Error('dia_especifico debe ser un número entre 1 y 31');
      }
      return getSpecificDayOfMonth(year, month, diaEspecifico);
    default:
      throw new Error(`Tipo de día no reconocido: ${tipoDia}`);
  }
}

/**
 * Get the month increment based on periodicidad
 */
function getMonthIncrement(periodicidad: Periodicidad): number {
  switch (periodicidad) {
    case 'MENSUAL':
      return 1;
    case 'TRIMESTRAL':
      return 3;
    case 'SEMESTRAL':
      return 6;
    case 'ANUAL':
      return 12;
    default:
      return 1;
  }
}

/**
 * Get the end of current year
 */
function getEndOfCurrentYear(): Date {
  return new Date(new Date().getFullYear(), 11, 31);
}

/**
 * Calculate all scheduled dates based on configuration
 */
export function calculateScheduledDates(config: ScheduleConfig): Date[] {
  const dates: Date[] = [];
  const startDate = new Date(config.fecha_inicio);
  // If fecha_fin is provided, use it; otherwise use targetEndYear if provided, else current year
  const endDate = config.fecha_fin
    ? new Date(config.fecha_fin)
    : config.targetEndYear
      ? new Date(config.targetEndYear, 11, 31)
      : getEndOfCurrentYear();
  const monthIncrement = getMonthIncrement(config.periodicidad);

  // Start from the month of fecha_inicio
  let currentYear = startDate.getFullYear();
  let currentMonth = startDate.getMonth();

  while (true) {
    const targetDate = getTargetDateForMonth(
      currentYear,
      currentMonth,
      config.tipo_dia,
      config.dia_especifico
    );

    // Only add dates that are within the range
    if (targetDate >= startDate && targetDate <= endDate) {
      dates.push(new Date(targetDate));
    }

    // If we've passed the end date, stop
    if (targetDate > endDate) {
      break;
    }

    // Move to the next period
    currentMonth += monthIncrement;
    while (currentMonth >= 12) {
      currentMonth -= 12;
      currentYear++;
    }

    // Safety check: don't generate more than 120 records
    if (dates.length >= 120) {
      break;
    }
  }

  return dates;
}

/**
 * Calculate dates for extending a schedule to a new year
 */
export function calculateExtensionDates(
  programacion: Programacion,
  targetYear: number
): Date[] {
  const startOfYear = new Date(targetYear, 0, 1);
  const endOfYear = new Date(targetYear, 11, 31);

  // If programacion has a fecha_fin and it's before the target year, return empty
  if (programacion.fecha_fin && new Date(programacion.fecha_fin) < startOfYear) {
    return [];
  }

  // Calculate the effective end date for this year
  let effectiveEndDate = endOfYear;
  if (programacion.fecha_fin) {
    const fechaFin = new Date(programacion.fecha_fin);
    if (fechaFin < endOfYear) {
      effectiveEndDate = fechaFin;
    }
  }

  // Generate dates for the target year
  const config: ScheduleConfig = {
    periodicidad: programacion.periodicidad,
    tipo_dia: programacion.tipo_dia,
    dia_especifico: programacion.dia_especifico,
    fecha_inicio: startOfYear,
    fecha_fin: effectiveEndDate
  };

  return calculateScheduledDates(config);
}

/**
 * Get the number of records that would be generated for a schedule
 */
export function countScheduledDates(config: ScheduleConfig): number {
  return calculateScheduledDates(config).length;
}

/**
 * Get periodicidad label in Spanish
 */
export function getPeriodicidadLabel(periodicidad: Periodicidad): string {
  const labels: Record<Periodicidad, string> = {
    'MENSUAL': 'Mensual',
    'TRIMESTRAL': 'Trimestral',
    'SEMESTRAL': 'Semestral',
    'ANUAL': 'Anual'
  };
  return labels[periodicidad];
}

/**
 * Get tipo_dia label in Spanish
 */
export function getTipoDiaLabel(tipoDia: TipoDia, diaEspecifico?: number): string {
  switch (tipoDia) {
    case 'ULTIMO_DIA_LABORAL':
      return 'Último día laboral';
    case 'PRIMER_DIA_LABORAL':
      return 'Primer día laboral';
    case 'ULTIMO_DIA':
      return 'Último día';
    case 'PRIMER_DIA':
      return 'Primer día';
    case 'DIA_ESPECIFICO':
      return `Día ${diaEspecifico || '?'}`;
    default:
      return tipoDia;
  }
}

/**
 * Get full schedule description in Spanish
 */
export function getScheduleDescription(
  periodicidad: Periodicidad,
  tipoDia: TipoDia,
  diaEspecifico?: number
): string {
  const periodicidadDesc = {
    'MENSUAL': 'cada mes',
    'TRIMESTRAL': 'cada trimestre',
    'SEMESTRAL': 'cada semestre',
    'ANUAL': 'cada año'
  }[periodicidad];

  const tipoDiaDesc = getTipoDiaLabel(tipoDia, diaEspecifico).toLowerCase();

  return `${tipoDiaDesc} de ${periodicidadDesc}`;
}

// Legacy support functions
export function getFrequencyLabel(frecuencia: Frecuencia): string {
  const labels: Record<Frecuencia, string> = {
    'MENSUAL': 'Mensual',
    'TRIMESTRAL': 'Trimestral',
    'SEMESTRAL': 'Semestral',
    'ANUAL': 'Anual',
    'PERSONALIZADO': 'Personalizado'
  };
  return labels[frecuencia];
}

export function getFrequencyDescription(frecuencia: Frecuencia, intervaloDias?: number): string {
  switch (frecuencia) {
    case 'MENSUAL':
      return 'Cada mes';
    case 'TRIMESTRAL':
      return 'Cada 3 meses';
    case 'SEMESTRAL':
      return 'Cada 6 meses';
    case 'ANUAL':
      return 'Una vez al año';
    case 'PERSONALIZADO':
      return intervaloDias ? `Cada ${intervaloDias} días` : 'Personalizado';
  }
}

/**
 * Validate schedule configuration
 */
export function validateScheduleConfig(config: ScheduleConfig): { valid: boolean; error?: string } {
  if (!config.fecha_inicio) {
    return { valid: false, error: 'La fecha de inicio es requerida' };
  }

  if (config.fecha_fin && new Date(config.fecha_fin) < new Date(config.fecha_inicio)) {
    return { valid: false, error: 'La fecha de fin debe ser posterior a la fecha de inicio' };
  }

  if (config.tipo_dia === 'DIA_ESPECIFICO') {
    if (!config.dia_especifico || config.dia_especifico < 1 || config.dia_especifico > 31) {
      return { valid: false, error: 'El día específico debe ser un número entre 1 y 31' };
    }
  }

  // Check that we don't generate too many records (safety limit)
  const dateCount = countScheduledDates(config);
  if (dateCount > 120) {
    return { valid: false, error: `Se generarían demasiados registros (${dateCount}). Por favor, limita el rango de fechas.` };
  }

  if (dateCount === 0) {
    return { valid: false, error: 'No se generaría ningún registro con esta configuración' };
  }

  return { valid: true };
}

/**
 * Format a date to YYYY-MM-DD string using LOCAL time (not UTC)
 * This is critical for scheduled dates to avoid timezone shifts.
 *
 * Example: new Date(2024, 0, 31) in Spain (UTC+1) at midnight local
 * - toISOString() would give "2024-01-30T23:00:00.000Z" -> "2024-01-30" (WRONG!)
 * - formatDateLocal() gives "2024-01-31" (CORRECT!)
 */
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

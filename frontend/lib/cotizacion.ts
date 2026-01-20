/**
 * Utilidades para cálculos de cotización de autónomos 2026
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

export const TIPO_COTIZACION_TOTAL_2026 = 0.315; // 31.5%

/**
 * Obtener el tramo correspondiente según rendimientos netos mensuales
 */
export function obtenerTramoPorRendimientos(rendimientoNetoMensual: number): TramoCotizacion {
  for (const tramo of TRAMOS_COTIZACION_2026) {
    if (rendimientoNetoMensual >= tramo.rendimientosDesde && rendimientoNetoMensual <= tramo.rendimientosHasta) {
      return tramo;
    }
  }
  // Por defecto, retornar el último tramo (>6000€)
  return TRAMOS_COTIZACION_2026[14];
}

/**
 * Calcular cuota según base de cotización elegida
 */
export function calcularCuotaPorBase(baseCotizacion: number): number {
  return Math.round((baseCotizacion * TIPO_COTIZACION_TOTAL_2026) * 100) / 100;
}

/**
 * Formatear euros con 2 decimales
 */
export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

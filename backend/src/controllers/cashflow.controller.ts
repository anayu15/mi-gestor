import { Response, NextFunction } from 'express';
import { query } from '../config/database';
import { ApiResponse, AuthRequest } from '../types';
import { BadRequestError } from '../middleware/errorHandler';
import { obtenerPeriodoTrimestre } from '../utils/helpers';
import { calcularCuotaAutonomos } from '../utils/taxCalculations';

/**
 * Get daily cash flow projection
 * GET /api/cashflow/daily?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
export const getDailyCashFlow = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const startDate = req.query.start as string;
    const endDate = req.query.end as string;

    if (!startDate || !endDate) {
      throw BadRequestError('Se requieren parámetros start y end (formato YYYY-MM-DD)');
    }

    // Validate date format and parse dates early
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw BadRequestError('Fechas inválidas. Use formato YYYY-MM-DD');
    }

    // Use simple date strings for DATE column comparisons
    // No timezone conversion needed since fecha_emision and fecha_pago are DATE types

    // Get initial balance from dashboard balance_real
    const currentYear = new Date().getFullYear();

    // Get user preferences for SS calculation and fecha_alta_aeat
    const userResult = await query(
      `SELECT tiene_tarifa_plana_ss, base_cotizacion, fecha_alta_aeat FROM users WHERE id = $1`,
      [req.user.id]
    );
    const user = {
      tiene_tarifa_plana_ss: userResult.rows[0]?.tiene_tarifa_plana_ss ?? false,
      base_cotizacion: userResult.rows[0]?.base_cotizacion ? parseFloat(userResult.rows[0].base_cotizacion) : null,
      fecha_alta_aeat: userResult.rows[0]?.fecha_alta_aeat ? new Date(userResult.rows[0].fecha_alta_aeat) : null
    };

    // Get annual data to calculate average monthly income for SS calculation
    const anualesResult = await query(
      `SELECT
        COALESCE(SUM(base_imponible), 0) as ingresos_totales,
        COALESCE(SUM(CASE WHEN es_deducible THEN base_imponible ELSE 0 END), 0) as gastos_deducibles
      FROM (
        SELECT base_imponible, NULL as es_deducible FROM facturas_emitidas WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
        UNION ALL
        SELECT base_imponible, es_deducible FROM expenses WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
      ) combined`,
      [req.user.id, currentYear]
    );
    const ingresos_anuales = parseFloat(anualesResult.rows[0]?.ingresos_totales) || 0;
    const gastos_deducibles = parseFloat(anualesResult.rows[0]?.gastos_deducibles) || 0;
    const beneficio_anual = ingresos_anuales - gastos_deducibles;
    const rendimiento_neto_mensual = beneficio_anual / 12;

    // Calculate actual SS quota based on user configuration
    const cuotaSS = calcularCuotaAutonomos(
      rendimiento_neto_mensual,
      user.tiene_tarifa_plana_ss,
      user.base_cotizacion || undefined
    );

    // Get all invoices (ingresos)
    const invoicesResult = await query(
      `SELECT f.fecha_emision, f.fecha_pago, f.base_imponible, f.cuota_iva, f.cuota_irpf, f.estado, f.pagada,
              f.numero_factura, f.concepto, c.nombre as cliente_nombre,
              (f.base_imponible + COALESCE(f.cuota_iva, 0) - COALESCE(f.cuota_irpf, 0)) as total
       FROM facturas_emitidas f
       LEFT JOIN clientes c ON f.cliente_id = c.id
       WHERE f.user_id = $1
         AND (
           (f.pagada = false AND f.fecha_emision >= $2 AND f.fecha_emision <= $3)
           OR
           (f.pagada = true AND f.fecha_pago >= $2 AND f.fecha_pago <= $3)
         )
       ORDER BY COALESCE(f.fecha_pago, f.fecha_emision) ASC`,
      [req.user.id, startDate, endDate]
    );

    // Get all expenses (gastos)
    const expensesResult = await query(
      `SELECT fecha_emision, fecha_pago, base_imponible, cuota_iva, pagado,
              concepto, proveedor_nombre,
              (base_imponible + COALESCE(cuota_iva, 0)) as total
       FROM expenses
       WHERE user_id = $1
         AND (
           (pagado = false AND fecha_emision >= $2 AND fecha_emision <= $3)
           OR
           (pagado = true AND fecha_pago >= $2 AND fecha_pago <= $3)
         )
       ORDER BY COALESCE(fecha_pago, fecha_emision) ASC`,
      [req.user.id, startDate, endDate]
    );

    // Calculate quarterly tax obligations for the period
    // Only show obligations if fecha_alta_aeat is configured
    const taxObligations = [];

    // Get current year's quarterly data - only if fecha_alta_aeat is set
    if (user.fecha_alta_aeat) {
      for (let q = 1; q <= 4; q++) {
        const periodo = obtenerPeriodoTrimestre(q, currentYear);

        // Calculate end of this quarter to check against fecha_alta_aeat
        const quarterEndMonth = q * 3; // Q1=3, Q2=6, Q3=9, Q4=12
        const quarterEndDate = new Date(currentYear, quarterEndMonth, 0); // Last day of quarter

        // Skip if quarter ends before fecha_alta_aeat
        if (quarterEndDate < user.fecha_alta_aeat) {
          continue;
        }

        // Skip if quarter is before our date range
        // Q4 deadline is January 20 of the NEXT year
        let fechaLimite303: Date;
        if (q === 4) {
          fechaLimite303 = new Date(`${currentYear + 1}-01-20`);
        } else {
          const month = q === 1 ? '04' : q === 2 ? '07' : '10';
          fechaLimite303 = new Date(`${currentYear}-${month}-20`);
        }
        
        if (fechaLimite303 < start || fechaLimite303 > end) {
          continue;
        }

        // Get IVA for quarter
        const ivaRepResult = await query(
          'SELECT COALESCE(SUM(cuota_iva), 0) as total FROM facturas_emitidas WHERE user_id = $1 AND fecha_emision >= $2 AND fecha_emision <= $3',
          [req.user.id, periodo.inicio, periodo.fin]
        );
        const ivaSopResult = await query(
          'SELECT COALESCE(SUM(cuota_iva), 0) as total FROM expenses WHERE user_id = $1 AND es_deducible = true AND fecha_emision >= $2 AND fecha_emision <= $3',
          [req.user.id, periodo.inicio, periodo.fin]
        );

        const ivaRep = parseFloat(ivaRepResult.rows[0].total);
        const ivaSop = parseFloat(ivaSopResult.rows[0].total);
        const resultadoIVA = ivaRep - ivaSop;

        if (resultadoIVA > 0) {
          taxObligations.push({
            fecha: fechaLimite303.toISOString().split('T')[0],
            concepto: `Modelo 303 - ${q}T`,
            importe: -resultadoIVA,
          });
        }

        // Get IRPF for quarter
        const ingResult = await query(
          'SELECT COALESCE(SUM(base_imponible), 0) as total FROM facturas_emitidas WHERE user_id = $1 AND fecha_emision >= $2 AND fecha_emision <= $3',
          [req.user.id, periodo.inicio, periodo.fin]
        );
        const gastResult = await query(
          'SELECT COALESCE(SUM(base_imponible), 0) as total FROM expenses WHERE user_id = $1 AND es_deducible = true AND fecha_emision >= $2 AND fecha_emision <= $3',
          [req.user.id, periodo.inicio, periodo.fin]
        );

        const ingresos = parseFloat(ingResult.rows[0].total);
        const gastos = parseFloat(gastResult.rows[0].total);
        const rendimiento = ingresos - gastos;
        const pagoFraccionado = Math.max(0, Math.round((rendimiento * 0.20) * 100) / 100);

        if (pagoFraccionado > 0) {
          taxObligations.push({
            fecha: fechaLimite303.toISOString().split('T')[0],
            concepto: `Modelo 130 - ${q}T`,
            importe: -pagoFraccionado,
          });
        }
      }
    }

    // Add monthly SS payments (last working day of each month)
    // Only show payments if fecha_alta_aeat is configured AND the month ends after that date
    if (user.fecha_alta_aeat) {
      for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
        const year = d.getFullYear();
        const month = d.getMonth();
        const lastDay = new Date(year, month + 1, 0);

        // Skip if this month ends before the user's fecha_alta_aeat
        if (lastDay < user.fecha_alta_aeat) {
          continue;
        }

        if (lastDay >= start && lastDay <= end) {
          taxObligations.push({
            fecha: lastDay.toISOString().split('T')[0],
            concepto: 'Seguridad Social',
            importe: -cuotaSS,
          });
        }
      }
    }

    // Build daily cash flow
    const dailyFlow = [];
    let saldoAcumulado = 0; // We'll calculate from the start of the period

    // Create a map of all transactions by date
    const transactionsByDate: Record<string, any[]> = {};

    // Helper function to safely format date to YYYY-MM-DD string
    const formatDateToString = (dateValue: any): string | null => {
      if (!dateValue) return null;
      
      // If it's already a Date object
      if (dateValue instanceof Date) {
        if (isNaN(dateValue.getTime())) return null;
        return dateValue.toISOString().split('T')[0];
      }
      
      // If it's a string, try to parse it
      if (typeof dateValue === 'string') {
        // Already in YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
          return dateValue;
        }
        // ISO format with time
        if (dateValue.includes('T')) {
          return dateValue.split('T')[0];
        }
        // Try parsing as date
        const parsed = new Date(dateValue);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      }
      
      return null;
    };

    // Add invoices
    invoicesResult.rows.forEach((invoice: any) => {
      const isPagada = invoice.pagada === true || invoice.estado === 'PAGADA';
      // Use fecha_pago if paid, fecha_emision if pending
      const fechaRelevante = isPagada && invoice.fecha_pago ? invoice.fecha_pago : invoice.fecha_emision;
      const fecha = formatDateToString(fechaRelevante);
      
      // Skip entries with invalid dates
      if (!fecha) return;
      
      if (!transactionsByDate[fecha]) transactionsByDate[fecha] = [];
      // Build a meaningful concept string
      const conceptoParts = [];
      if (invoice.numero_factura) conceptoParts.push(invoice.numero_factura);
      if (invoice.cliente_nombre) conceptoParts.push(invoice.cliente_nombre);
      const conceptoDisplay = conceptoParts.length > 0 ? conceptoParts.join(' - ') : (invoice.concepto || 'Factura');
      transactionsByDate[fecha].push({
        tipo: 'ingreso',
        subtipo: isPagada ? 'real' : 'potencial',
        concepto: conceptoDisplay,
        importe: parseFloat(invoice.total),
        estado: invoice.estado,
        pagada: isPagada,
      });
    });

    // Add expenses
    expensesResult.rows.forEach((expense: any) => {
      const isPagado = expense.pagado === true;
      // Use fecha_pago if paid, fecha_emision if pending
      const fechaRelevante = isPagado && expense.fecha_pago ? expense.fecha_pago : expense.fecha_emision;
      const fecha = formatDateToString(fechaRelevante);
      
      // Skip entries with invalid dates
      if (!fecha) return;
      
      if (!transactionsByDate[fecha]) transactionsByDate[fecha] = [];
      // Build a meaningful concept string
      const conceptoDisplay = expense.concepto || expense.proveedor_nombre || 'Gasto';
      transactionsByDate[fecha].push({
        tipo: 'gasto',
        subtipo: isPagado ? 'real' : 'potencial',
        concepto: conceptoDisplay,
        importe: -parseFloat(expense.total),
        pagado: isPagado,
      });
    });

    // Add tax obligations
    taxObligations.forEach((tax) => {
      if (!transactionsByDate[tax.fecha]) transactionsByDate[tax.fecha] = [];
      transactionsByDate[tax.fecha].push({
        tipo: 'fiscal',
        concepto: tax.concepto,
        importe: tax.importe,
      });
    });

    // Generate daily entries
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const fecha = d.toISOString().split('T')[0];
      const transactions = transactionsByDate[fecha] || [];

      // Separate real vs potential incomes
      const ingresosReales = transactions
        .filter(t => t.tipo === 'ingreso' && t.subtipo === 'real')
        .reduce((sum, t) => sum + t.importe, 0);

      const ingresosPotenciales = transactions
        .filter(t => t.tipo === 'ingreso' && t.subtipo === 'potencial')
        .reduce((sum, t) => sum + t.importe, 0);

      const ingresos = ingresosReales + ingresosPotenciales;

      // Separate real vs potential expenses
      const gastosReales = transactions
        .filter(t => t.tipo === 'gasto' && t.subtipo === 'real')
        .reduce((sum, t) => sum + Math.abs(t.importe), 0);

      const gastosPotenciales = transactions
        .filter(t => t.tipo === 'gasto' && t.subtipo === 'potencial')
        .reduce((sum, t) => sum + Math.abs(t.importe), 0);

      const gastos = gastosReales + gastosPotenciales;

      const fiscal = transactions
        .filter(t => t.tipo === 'fiscal')
        .reduce((sum, t) => sum + Math.abs(t.importe), 0);

      // Calculate movement using ONLY real transactions for real balance
      const movimientoReal = ingresosReales - gastosReales - fiscal;
      const movimientoPotencial = ingresosPotenciales - gastosPotenciales;
      const movimiento = movimientoReal + movimientoPotencial;

      saldoAcumulado += movimiento;

      dailyFlow.push({
        fecha,
        ingresos,
        ingresos_reales: ingresosReales,
        ingresos_potenciales: ingresosPotenciales,
        gastos,
        gastos_reales: gastosReales,
        gastos_potenciales: gastosPotenciales,
        fiscal,
        movimiento,
        movimiento_real: movimientoReal,
        movimiento_potencial: movimientoPotencial,
        saldo: saldoAcumulado,
        saldo_real: saldoAcumulado - movimientoPotencial, // Solo con transacciones reales
        transacciones: transactions,
      });
    }

    const response: ApiResponse = {
      success: true,
      data: {
        periodo: {
          inicio: startDate,
          fin: endDate,
        },
        saldo_inicial: 0,
        flujo_diario: dailyFlow,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

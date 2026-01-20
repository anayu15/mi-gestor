import { Response, NextFunction } from 'express';
import { query } from '../config/database';
import { ApiResponse, AuthRequest } from '../types';
import { BadRequestError } from '../middleware/errorHandler';
import {
  calcularBalanceReal,
  calcularBrechaIRPF,
  calcularRiesgoTRADE,
  estimarTramoIRPF,
  calcularCuotaAutonomos,
} from '../utils/taxCalculations';
import {
  obtenerTrimestre,
  obtenerFechaLimiteModelo,
  obtenerUltimoDiaLaborable,
  obtenerRangoFechasPresentacion,
  obtenerRangoFechasRenta,
  obtenerRangoFechas390,
  obtenerRangoFechas180,
} from '../utils/helpers';

/**
 * Get complete dashboard summary
 * GET /api/dashboard/summary
 */
export const getDashboardSummary = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { year } = req.query;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

    // Get user info
    const userResult = await query(
      `SELECT es_trade, tiene_tarifa_plana_ss, base_cotizacion, tipo_irpf_actual, tipo_irpf_estimado FROM users WHERE id = $1`,
      [req.user.id]
    );
    const user = {
      ...userResult.rows[0],
      tipo_irpf_actual: userResult.rows[0].tipo_irpf_actual ? parseFloat(userResult.rows[0].tipo_irpf_actual) : 7,
      tipo_irpf_estimado: userResult.rows[0].tipo_irpf_estimado ? parseFloat(userResult.rows[0].tipo_irpf_estimado) : 21,
      tiene_tarifa_plana_ss: userResult.rows[0].tiene_tarifa_plana_ss ?? false,
      base_cotizacion: userResult.rows[0].base_cotizacion ? parseFloat(userResult.rows[0].base_cotizacion) : null
    };

    // Get annual totals
    const anualesResult = await query(
      `SELECT
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN base_imponible ELSE 0 END), 0) as ingresos_totales,
        COALESCE(SUM(CASE WHEN tipo = 'gasto' AND es_deducible = true THEN total_factura ELSE 0 END), 0) as gastos_totales,
        COALESCE(SUM(CASE WHEN tipo = 'gasto' AND es_deducible = true THEN base_imponible ELSE 0 END), 0) as gastos_deducibles,
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN cuota_iva ELSE 0 END), 0) as iva_repercutido,
        COALESCE(SUM(CASE WHEN tipo = 'gasto' AND es_deducible THEN cuota_iva ELSE 0 END), 0) as iva_soportado,
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN cuota_irpf ELSE 0 END), 0) as irpf_retenido
       FROM (
         SELECT base_imponible, 0 as total_factura, cuota_iva, cuota_irpf, 'ingreso' as tipo, true as es_deducible
         FROM facturas_emitidas
         WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
         UNION ALL
         SELECT base_imponible, total_factura, cuota_iva, 0 as cuota_irpf, 'gasto' as tipo, es_deducible
         FROM expenses
         WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
       ) combined`,
      [req.user.id, targetYear]
    );

    const anuales = anualesResult.rows[0];
    const ingresos_totales = parseFloat(anuales.ingresos_totales) || 0;
    const gastos_totales = -(parseFloat(anuales.gastos_totales) || 0); // Negative: money paid
    const gastos_deducibles = parseFloat(anuales.gastos_deducibles) || 0;
    const beneficio_neto = ingresos_totales - gastos_deducibles;

    // Calculate Social Security quota based on net income and flat rate
    const rendimiento_neto_mensual = beneficio_neto / 12;
    const cuota_ss_mensual = calcularCuotaAutonomos(rendimiento_neto_mensual, user.tiene_tarifa_plana_ss, user.base_cotizacion || undefined);

    const iva_repercutido = parseFloat(anuales.iva_repercutido) || 0;
    const iva_soportado = parseFloat(anuales.iva_soportado) || 0;
    const iva_a_pagar = -(iva_repercutido - iva_soportado); // Negative if paying, positive if receiving refund

    const irpf_retenido_7pct = parseFloat(anuales.irpf_retenido) || 0;
    const tipo_irpf_estimado = estimarTramoIRPF(beneficio_neto);
    const tipo_irpf_actual = parseFloat(user.tipo_irpf_actual) || 7;
    const irpf_brecha_raw = calcularBrechaIRPF(beneficio_neto, tipo_irpf_actual);
    const irpf_brecha = -irpf_brecha_raw; // Negative: money to pay

    // Get bank balance (from latest snapshot or manual entry)
    const bankResult = await query(
      'SELECT COALESCE(SUM(saldo_actual), 0) as saldo_total FROM bank_accounts WHERE user_id = $1 AND activa = true',
      [req.user.id]
    );
    const saldo_bancario = parseFloat(bankResult.rows[0].saldo_total) || 0;

    // Calculate real balance
    const seguridad_social_pendiente = -cuota_ss_mensual; // Negative: money to pay
    const balanceReal = calcularBalanceReal(
      saldo_bancario,
      iva_a_pagar < 0 ? -iva_a_pagar : 0, // Pass positive value to function
      irpf_brecha < 0 ? -irpf_brecha : 0, // Pass positive value to function
      cuota_ss_mensual // Pass positive value to function
    );

    // Get current quarter info
    const now = new Date();
    const trimestre = obtenerTrimestre(now);
    const fecha_limite = obtenerFechaLimiteModelo(trimestre, targetYear);
    const dias_restantes = Math.ceil((fecha_limite.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Get trimester totals
    const trimestreResult = await query(
      `SELECT
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN cuota_iva ELSE 0 END), 0) as iva_repercutido_trimestre,
        COALESCE(SUM(CASE WHEN tipo = 'gasto' AND es_deducible THEN cuota_iva ELSE 0 END), 0) as iva_soportado_trimestre
       FROM (
         SELECT cuota_iva, 'ingreso' as tipo, true as es_deducible
         FROM facturas_emitidas
         WHERE user_id = $1
           AND EXTRACT(YEAR FROM fecha_emision) = $2
           AND EXTRACT(QUARTER FROM fecha_emision) = $3
         UNION ALL
         SELECT cuota_iva, 'gasto' as tipo, es_deducible
         FROM expenses
         WHERE user_id = $1
           AND EXTRACT(YEAR FROM fecha_emision) = $2
           AND EXTRACT(QUARTER FROM fecha_emision) = $3
       ) combined`,
      [req.user.id, targetYear, trimestre]
    );

    const trimestre_data = trimestreResult.rows[0];
    const iva_trimestre = -((parseFloat(trimestre_data.iva_repercutido_trimestre) || 0) - (parseFloat(trimestre_data.iva_soportado_trimestre) || 0)); // Negative: money to pay
    const irpf_trimestre = -((beneficio_neto * 0.2) / 4); // Negative: money to pay

    // TRADE status (if applicable)
    let trade_status = null;
    if (user.es_trade) {
      // Get client billing distribution
      const clientsResult = await query(
        `SELECT
          c.id,
          c.nombre,
          COALESCE(SUM(i.base_imponible), 0) as facturado
         FROM clientes c
         LEFT JOIN facturas_emitidas i ON c.id = i.cliente_id
           AND EXTRACT(YEAR FROM i.fecha_emision) = $2
         WHERE c.user_id = $1 AND c.activo = true
         GROUP BY c.id, c.nombre
         ORDER BY facturado DESC`,
        [req.user.id, targetYear]
      );

      const clientes = clientsResult.rows;
      const total_facturado = clientes.reduce((sum, c) => sum + parseFloat(c.facturado), 0);
      const cliente_principal = clientes[0]; // Use the top client by billing
      const facturado_principal = cliente_principal ? parseFloat(cliente_principal.facturado) : 0;
      const porcentaje_dependencia = total_facturado > 0
        ? Math.round((facturado_principal / total_facturado) * 100 * 100) / 100
        : 0;

      // Check independence expenses for current month
      const month = now.getMonth() + 1;
      const independenceResult = await query(
        `SELECT
          COUNT(*) FILTER (WHERE concepto ILIKE '%alquiler%') as tiene_alquiler,
          COUNT(*) FILTER (WHERE concepto ILIKE '%electric%' OR concepto ILIKE '%luz%') as tiene_electricidad,
          COUNT(*) FILTER (WHERE concepto ILIKE '%internet%') as tiene_internet
         FROM expenses
         WHERE user_id = $1
           AND es_gasto_independencia = true
           AND EXTRACT(YEAR FROM fecha_emision) = $2
           AND EXTRACT(MONTH FROM fecha_emision) = $3`,
        [req.user.id, targetYear, month]
      );

      const indep = independenceResult.rows[0];

      // Get high-risk expenses count
      const riskResult = await query(
        `SELECT COUNT(*) as count
         FROM expenses
         WHERE user_id = $1
           AND nivel_riesgo = 'ALTO'
           AND EXTRACT(YEAR FROM fecha_emision) = $2`,
        [req.user.id, targetYear]
      );

      const gastos_alto_riesgo = parseInt(riskResult.rows[0].count) || 0;
      const tiene_gastos_independencia = (indep.tiene_alquiler || 0) > 0 && (indep.tiene_electricidad || 0) > 0 && (indep.tiene_internet || 0) > 0;

      const riesgo_trade = calcularRiesgoTRADE(
        porcentaje_dependencia,
        tiene_gastos_independencia,
        gastos_alto_riesgo
      );

      // Get active alerts
      const alertsResult = await query(
        `SELECT COUNT(*) as count
         FROM compliance_alerts
         WHERE user_id = $1 AND leida = false AND resuelta = false`,
        [req.user.id]
      );

      trade_status = {
        es_trade: true,
        cliente_principal: cliente_principal?.razon_social || 'Sin cliente',
        porcentaje_dependencia,
        nivel_riesgo: riesgo_trade.nivel,
        riesgo_score: riesgo_trade.score,
        alertas_activas: parseInt(alertsResult.rows[0].count) || 0,
        gastos_independencia_mes_actual: {
          alquiler: (indep.tiene_alquiler || 0) > 0,
          electricidad: (indep.tiene_electricidad || 0) > 0,
          internet: (indep.tiene_internet || 0) > 0,
        },
      };
    }

    // Get critical alerts
    const criticalAlertsResult = await query(
      `SELECT id, tipo, severidad, titulo, descripcion, recomendacion
       FROM compliance_alerts
       WHERE user_id = $1 AND leida = false
       ORDER BY
         CASE severidad
           WHEN 'CRITICAL' THEN 1
           WHEN 'WARNING' THEN 2
           ELSE 3
         END,
         fecha_alerta DESC
       LIMIT 5`,
      [req.user.id]
    );

    // Get pending invoices (money owed to me)
    const pendingInvoicesResult = await query(
      `SELECT
        i.id,
        i.numero_factura,
        i.fecha_emision,
        i.fecha_vencimiento,
        i.total_factura,
        c.nombre as cliente_nombre,
        c.id as cliente_id
       FROM facturas_emitidas i
       JOIN clientes c ON i.cliente_id = c.id
       WHERE i.user_id = $1
         AND i.estado = 'PENDIENTE'
       ORDER BY i.fecha_vencimiento ASC
       LIMIT 10`,
      [req.user.id]
    );

    // Get current month data
    const currentMonth = now.getMonth() + 1;
    const currentMonthResult = await query(
      `SELECT
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN base_imponible ELSE 0 END), 0) as ingresos_mes,
        COALESCE(SUM(CASE WHEN tipo = 'gasto' AND es_deducible = true THEN total_factura ELSE 0 END), 0) as gastos_mes,
        COUNT(CASE WHEN tipo = 'ingreso' THEN 1 END) as num_facturas_mes,
        COUNT(CASE WHEN tipo = 'gasto' THEN 1 END) as num_gastos_mes
       FROM (
         SELECT base_imponible, 0 as total_factura, 'ingreso' as tipo, true as es_deducible
         FROM facturas_emitidas
         WHERE user_id = $1
           AND EXTRACT(YEAR FROM fecha_emision) = $2
           AND EXTRACT(MONTH FROM fecha_emision) = $3
         UNION ALL
         SELECT base_imponible, total_factura, 'gasto' as tipo, es_deducible
         FROM expenses
         WHERE user_id = $1
           AND EXTRACT(YEAR FROM fecha_emision) = $2
           AND EXTRACT(MONTH FROM fecha_emision) = $3
       ) combined`,
      [req.user.id, targetYear, currentMonth]
    );

    const mes_actual = currentMonthResult.rows[0];
    const total_facturas_pendientes = parseFloat(pendingInvoicesResult.rows.reduce((sum, inv) => sum + parseFloat(inv.total_factura), 0).toFixed(2)) || 0;

    const response: ApiResponse = {
      success: true,
      data: {
        balance_real: {
          saldo_bancario: balanceReal.saldo_bancario,
          iva_pendiente_pagar: -balanceReal.iva_pendiente_pagar, // Negative: money to pay
          irpf_brecha: -balanceReal.irpf_brecha, // Negative: money to pay
          seguridad_social_pendiente: seguridad_social_pendiente,
          balance_real: balanceReal.balance_real,
          advertencia: balanceReal.diferencia > 0
            ? `Tu balance real es ${balanceReal.diferencia.toFixed(2)}€ menor que tu saldo bancario debido a obligaciones fiscales pendientes`
            : 'Tu balance está al día',
        },
        ano_actual: {
          ingresos_totales,
          gastos_totales,
          gastos_deducibles,
          beneficio_neto,
          iva_repercutido,
          iva_soportado,
          iva_a_pagar,
          irpf_retenido_7pct,
          irpf_estimado_21pct: beneficio_neto * (tipo_irpf_estimado / 100),
          tipo_irpf_estimado,
          irpf_brecha,
        },
        mes_actual: {
          ingresos: parseFloat(mes_actual.ingresos_mes) || 0,
          gastos: -(parseFloat(mes_actual.gastos_mes) || 0), // Negative
          beneficio: (parseFloat(mes_actual.ingresos_mes) || 0) - (parseFloat(mes_actual.gastos_mes) || 0),
          num_facturas: parseInt(mes_actual.num_facturas_mes) || 0,
          num_gastos: parseInt(mes_actual.num_gastos_mes) || 0,
          mes: currentMonth,
        },
        proximo_trimestre: {
          trimestre,
          fecha_limite: fecha_limite.toISOString().split('T')[0],
          dias_restantes,
          urgente: dias_restantes <= 7,
          iva_a_presentar: iva_trimestre,
          irpf_a_presentar: irpf_trimestre,
        },
        facturas_pendientes: {
          total: total_facturas_pendientes,
          cantidad: pendingInvoicesResult.rows.length,
          facturas: pendingInvoicesResult.rows.map(inv => ({
            id: inv.id,
            numero: inv.numero_factura,
            cliente: inv.cliente_nombre,
            cliente_id: inv.cliente_id,
            fecha_emision: inv.fecha_emision,
            fecha_vencimiento: inv.fecha_vencimiento,
            total: parseFloat(inv.total_factura),
            dias_vencimiento: Math.ceil((new Date(inv.fecha_vencimiento).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          })),
        },
        trade_status,
        alertas: criticalAlertsResult.rows,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get cash flow history
 * GET /api/dashboard/cash-flow-history
 *
 * TODO: Implement cash_flow_snapshots table in schema.sql to enable this feature
 * For now, returns empty array to prevent errors
 */
export const getCashFlowHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    // TODO: Create cash_flow_snapshots table with columns:
    // - id, user_id, fecha_snapshot, saldo_bancario,
    // - iva_pendiente, irpf_pendiente, ss_pendiente, balance_real

    const response: ApiResponse = {
      success: true,
      data: [],
      info: ['El historial de flujo de caja no está disponible. Use /api/cashflow/daily para ver el flujo de caja.'],
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get income vs expenses chart data
 * GET /api/dashboard/charts/ingresos-gastos
 */
export const getIngresosGastosChart = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { year } = req.query;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

    // Get monthly data
    const result = await query(
      `SELECT
        month,
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN base_imponible ELSE 0 END), 0) as ingresos,
        COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN base_imponible ELSE 0 END), 0) as gastos
       FROM (
         SELECT EXTRACT(MONTH FROM fecha_emision) as month, base_imponible, 'ingreso' as tipo
         FROM facturas_emitidas
         WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
         UNION ALL
         SELECT EXTRACT(MONTH FROM fecha_emision) as month, base_imponible, 'gasto' as tipo
         FROM expenses
         WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2 AND es_deducible = true
       ) combined
       GROUP BY month
       ORDER BY month`,
      [req.user.id, targetYear]
    );

    // Fill missing months with zeros
    const monthlyData: Record<number, any> = {};
    result.rows.forEach(row => {
      const month = parseInt(row.month);
      monthlyData[month] = {
        ingresos: parseFloat(row.ingresos),
        gastos: parseFloat(row.gastos),
      };
    });

    const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const ingresos: number[] = [];
    const gastos: number[] = [];
    const beneficio_neto: number[] = [];

    for (let i = 1; i <= 12; i++) {
      const data = monthlyData[i] || { ingresos: 0, gastos: 0 };
      ingresos.push(data.ingresos);
      gastos.push(data.gastos);
      beneficio_neto.push(data.ingresos - data.gastos);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        labels,
        ingresos,
        gastos,
        beneficio_neto,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get annual fiscal calendar with all obligations
 * GET /api/dashboard/fiscal-calendar
 */
export const getFiscalCalendar = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { year } = req.query;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

    // Calculate quarterly IVA, IRPF, and rental withholdings (Modelo 115) amounts
    const quarterlyData = [];
    for (let q = 1; q <= 4; q++) {
      const quarterResult = await query(
        `SELECT
          COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN cuota_iva ELSE 0 END), 0) as iva_repercutido,
          COALESCE(SUM(CASE WHEN tipo = 'gasto' AND es_deducible THEN cuota_iva ELSE 0 END), 0) as iva_soportado,
          COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN base_imponible ELSE 0 END), 0) as ingresos,
          COALESCE(SUM(CASE WHEN tipo = 'gasto' AND es_deducible THEN base_imponible ELSE 0 END), 0) as gastos
         FROM (
           SELECT cuota_iva, base_imponible, 'ingreso' as tipo, true as es_deducible
           FROM facturas_emitidas
           WHERE user_id = $1
             AND EXTRACT(YEAR FROM fecha_emision) = $2
             AND EXTRACT(QUARTER FROM fecha_emision) = $3
           UNION ALL
           SELECT cuota_iva, base_imponible, 'gasto' as tipo, es_deducible
           FROM expenses
           WHERE user_id = $1
             AND EXTRACT(YEAR FROM fecha_emision) = $2
             AND EXTRACT(QUARTER FROM fecha_emision) = $3
         ) combined`,
        [req.user.id, targetYear, q]
      );

      // Calculate rental withholdings (Modelo 115) - 19% of rental expenses
      const rentalResult = await query(
        `SELECT COALESCE(SUM(base_imponible), 0) as alquiler_total
         FROM expenses
         WHERE user_id = $1
           AND EXTRACT(YEAR FROM fecha_emision) = $2
           AND EXTRACT(QUARTER FROM fecha_emision) = $3
           AND (concepto ILIKE '%alquiler%' OR categoria ILIKE '%alquiler%')`,
        [req.user.id, targetYear, q]
      );

      const data = quarterResult.rows[0];
      const iva_repercutido = parseFloat(data.iva_repercutido) || 0;
      const iva_soportado = parseFloat(data.iva_soportado) || 0;
      const ingresos = parseFloat(data.ingresos) || 0;
      const gastos = parseFloat(data.gastos) || 0;
      const beneficio = ingresos - gastos;

      // Calculate IRPF payment (20% of quarterly benefit) - Negative: money to pay
      const irpf_pago = beneficio > 0 ? -(beneficio * 0.20) : 0;

      // Calculate rental withholding (19% of rental expenses) - Negative: money to pay
      const alquiler_base = parseFloat(rentalResult.rows[0].alquiler_total) || 0;
      const retencion_alquiler = alquiler_base > 0 ? -(alquiler_base * 0.19) : 0;

      if (alquiler_base > 0) {
        console.log(`🏠 Modelo 115 Q${q} - Alquiler: ${alquiler_base.toFixed(2)}€, Retención 19%: ${retencion_alquiler.toFixed(2)}€`);
      }

      quarterlyData.push({
        trimestre: q,
        iva_a_pagar: -(iva_repercutido - iva_soportado), // Negative: money to pay, Positive: refund
        irpf_pago_fraccionado: irpf_pago,
        retencion_alquiler_115: retencion_alquiler, // Negative: money to pay
        ingresos,
        gastos: -gastos, // Negative: money paid
        beneficio,
      });
    }

    // Calculate annual totals
    const totalIVA = quarterlyData.reduce((sum, q) => sum + q.iva_a_pagar, 0);
    const totalIRPF_fraccionado = quarterlyData.reduce((sum, q) => sum + q.irpf_pago_fraccionado, 0);
    const totalRetenciones115 = quarterlyData.reduce((sum, q) => sum + (q.retencion_alquiler_115 || 0), 0);
    const ingresos_anuales = quarterlyData.reduce((sum, q) => sum + q.ingresos, 0);
    const gastos_anuales = quarterlyData.reduce((sum, q) => sum + q.gastos, 0);
    const beneficio_anual = ingresos_anuales + gastos_anuales; // gastos are already negative

    // Get user info for RENTA calculation and model visibility
    const userInfoResult = await query(
      `SELECT es_trade, tiene_tarifa_plana_ss, base_cotizacion, mostrar_modelo_130, tipo_irpf_estimado,
              mostrar_modelo_303, mostrar_modelo_115, mostrar_modelo_180, mostrar_modelo_390,
              mostrar_modelo_349, mostrar_modelo_131, mostrar_modelo_111, mostrar_modelo_190,
              mostrar_modelo_123, mostrar_modelo_347, fecha_alta_aeat
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    // Extract user model preferences (default to true for backwards compatibility)
    const userPrefs = {
      mostrar_modelo_303: userInfoResult.rows[0]?.mostrar_modelo_303 ?? true,
      mostrar_modelo_130: userInfoResult.rows[0]?.mostrar_modelo_130 ?? true,
      mostrar_modelo_115: userInfoResult.rows[0]?.mostrar_modelo_115 ?? true,
      mostrar_modelo_180: userInfoResult.rows[0]?.mostrar_modelo_180 ?? true,
      mostrar_modelo_390: userInfoResult.rows[0]?.mostrar_modelo_390 ?? true,
      mostrar_modelo_349: userInfoResult.rows[0]?.mostrar_modelo_349 ?? false,
      mostrar_modelo_131: userInfoResult.rows[0]?.mostrar_modelo_131 ?? false,
      mostrar_modelo_111: userInfoResult.rows[0]?.mostrar_modelo_111 ?? false,
      mostrar_modelo_190: userInfoResult.rows[0]?.mostrar_modelo_190 ?? false,
      mostrar_modelo_123: userInfoResult.rows[0]?.mostrar_modelo_123 ?? false,
      mostrar_modelo_347: userInfoResult.rows[0]?.mostrar_modelo_347 ?? false,
    };

    // Get fecha de alta en AEAT for filtering obligations
    const fechaAltaAeat = userInfoResult.rows[0]?.fecha_alta_aeat
      ? new Date(userInfoResult.rows[0].fecha_alta_aeat)
      : null;

    // Helper function to check if an obligation should be shown based on fecha_alta_aeat
    // An obligation is shown if its period END DATE is after the fecha_alta_aeat
    // For quarterly models: the quarter must end after the alta date
    // For monthly models: the month must end after the alta date
    // If no fecha_alta_aeat is set, NO obligations are shown (user must configure it first)
    const isObligationAfterAlta = (fechaLimite: string, trimestre: number | null, mes: number | null, año: number): boolean => {
      if (!fechaAltaAeat) return false; // No alta date set, don't show any obligations

      // Determine the end of the period this obligation covers
      let periodEndDate: Date;

      if (mes !== null && mes !== undefined) {
        // Monthly obligation (e.g., Seguridad Social) - use end of that month
        periodEndDate = new Date(año, mes, 0); // Day 0 of next month = last day of this month
      } else if (trimestre !== null && trimestre !== undefined) {
        // Quarterly obligation - use end of that quarter
        const quarterEndMonth = trimestre * 3; // Q1=3, Q2=6, Q3=9, Q4=12
        periodEndDate = new Date(año, quarterEndMonth, 0); // Last day of quarter's last month
      } else {
        // Annual obligation - use end of year
        periodEndDate = new Date(año, 11, 31); // December 31
      }

      // The obligation is valid if the period ends after the alta date
      return periodEndDate >= fechaAltaAeat;
    };

    // Calculate IRPF retenciones for the year
    const retencionesResult = await query(
      `SELECT COALESCE(SUM(cuota_irpf), 0) as irpf_retenido
       FROM facturas_emitidas
       WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2`,
      [req.user.id, targetYear]
    );
    const irpf_retenido = parseFloat(retencionesResult.rows[0].irpf_retenido) || 0;

    // Estimate final IRPF using user's configured rate
    const tipo_irpf_usuario = userInfoResult.rows[0]?.tipo_irpf_estimado ? parseFloat(userInfoResult.rows[0].tipo_irpf_estimado) : 21;
    const mostrar_modelo_130 = userInfoResult.rows[0]?.mostrar_modelo_130 ?? true;
    const irpf_estimado = beneficio_anual * (tipo_irpf_usuario / 100);

    // Only include pagos fraccionados if user has Modelo 130 enabled
    const pagos_fraccionados_considerados = mostrar_modelo_130 ? totalIRPF_fraccionado : 0; // already negative

    // Calculate RENTA result: negative = a pagar, positive = a devolver
    // Formula: -(irpf_estimado - irpf_retenido - pagos_fraccionados)
    // where totalIRPF_fraccionado is negative (money paid), so we add it
    const irpf_brecha_cal = -(irpf_estimado - irpf_retenido + pagos_fraccionados_considerados);

    // Get user info for Social Security quota
    const userResult = await query(
      `SELECT es_trade, tiene_tarifa_plana_ss, base_cotizacion FROM users WHERE id = $1`,
      [req.user.id]
    );
    const user = {
      ...userResult.rows[0],
      tiene_tarifa_plana_ss: userResult.rows[0].tiene_tarifa_plana_ss ?? false,
      base_cotizacion: userResult.rows[0].base_cotizacion ? parseFloat(userResult.rows[0].base_cotizacion) : null
    };

    // Calculate Social Security quota based on annual net income
    const rendimiento_neto_mensual = beneficio_anual / 12;
    const cuota_ss_mensual = calcularCuotaAutonomos(rendimiento_neto_mensual, user.tiene_tarifa_plana_ss, user.base_cotizacion || undefined);
    console.log(`📊 Fiscal Calendar - User has tarifa plana: ${user.tiene_tarifa_plana_ss}, Base: ${user.base_cotizacion || 'auto'}, Net income/month: ${rendimiento_neto_mensual.toFixed(2)}€, SS quota: ${cuota_ss_mensual}€`);

    // Seguridad Social - Negative: money to pay
    const seguridad_social_mensual = -cuota_ss_mensual;
    const seguridad_social_anual = seguridad_social_mensual * 12;

    // Build calendar - All obligations for targetYear
    // Helper function to get date range for each model
    const rangoT1_303 = obtenerRangoFechasPresentacion(1, targetYear, '303');
    const rangoT2_303 = obtenerRangoFechasPresentacion(2, targetYear, '303');
    const rangoT3_303 = obtenerRangoFechasPresentacion(3, targetYear, '303');
    const rangoT4_303 = obtenerRangoFechasPresentacion(4, targetYear, '303');

    const rangoT1_130 = obtenerRangoFechasPresentacion(1, targetYear, '130');
    const rangoT2_130 = obtenerRangoFechasPresentacion(2, targetYear, '130');
    const rangoT3_130 = obtenerRangoFechasPresentacion(3, targetYear, '130');
    const rangoT4_130 = obtenerRangoFechasPresentacion(4, targetYear, '130');

    const rangoT1_115 = obtenerRangoFechasPresentacion(1, targetYear, '115');
    const rangoT2_115 = obtenerRangoFechasPresentacion(2, targetYear, '115');
    const rangoT3_115 = obtenerRangoFechasPresentacion(3, targetYear, '115');
    const rangoT4_115 = obtenerRangoFechasPresentacion(4, targetYear, '115');

    const rangoRenta = obtenerRangoFechasRenta(targetYear);
    const rango390 = obtenerRangoFechas390(targetYear);
    const rango180 = obtenerRangoFechas180(targetYear);

    // Build calendar conditionally based on user preferences
    const calendario: any[] = [];

    // Quarter names
    const quarterNames = ['1er', '2º', '3er', '4º'];
    const quarterRanges303 = [rangoT1_303, rangoT2_303, rangoT3_303, rangoT4_303];
    const quarterRanges130 = [rangoT1_130, rangoT2_130, rangoT3_130, rangoT4_130];
    const quarterRanges115 = [rangoT1_115, rangoT2_115, rangoT3_115, rangoT4_115];

    // Add quarterly models for each quarter
    for (let q = 0; q < 4; q++) {
      const trimestre = q + 1;
      const qName = quarterNames[q];

      // Modelo 303 - IVA (if enabled)
      if (userPrefs.mostrar_modelo_303) {
        calendario.push({
          modelo: '303',
          nombre: `IVA - ${qName} Trimestre ${targetYear}`,
          fecha_inicio: quarterRanges303[q].fecha_inicio,
          fecha_limite: quarterRanges303[q].fecha_limite,
          trimestre,
          año: targetYear,
          tipo: 'IVA',
          importe_estimado: quarterlyData[q]?.iva_a_pagar || 0,
        });
      }

      // Modelo 130 - IRPF Estimación Directa (if enabled and not using módulos)
      if (userPrefs.mostrar_modelo_130 && !userPrefs.mostrar_modelo_131) {
        calendario.push({
          modelo: '130',
          nombre: `IRPF Estimación Directa - ${qName} Trimestre ${targetYear}`,
          fecha_inicio: quarterRanges130[q].fecha_inicio,
          fecha_limite: quarterRanges130[q].fecha_limite,
          trimestre,
          año: targetYear,
          tipo: 'IRPF',
          importe_estimado: quarterlyData[q]?.irpf_pago_fraccionado || 0,
        });
      }

      // Modelo 131 - IRPF Estimación Objetiva/Módulos (if enabled)
      if (userPrefs.mostrar_modelo_131) {
        calendario.push({
          modelo: '131',
          nombre: `IRPF Módulos - ${qName} Trimestre ${targetYear}`,
          fecha_inicio: quarterRanges130[q].fecha_inicio, // Same dates as 130
          fecha_limite: quarterRanges130[q].fecha_limite,
          trimestre,
          año: targetYear,
          tipo: 'IRPF',
          importe_estimado: 0, // Módulos requires separate calculation
          descripcion: 'Pago fraccionado por estimación objetiva (módulos)',
        });
      }

      // Modelo 115 - Retenciones Alquileres (if enabled)
      if (userPrefs.mostrar_modelo_115) {
        calendario.push({
          modelo: '115',
          nombre: `Retenciones Alquileres - ${qName} Trimestre ${targetYear}`,
          fecha_inicio: quarterRanges115[q].fecha_inicio,
          fecha_limite: quarterRanges115[q].fecha_limite,
          trimestre,
          año: targetYear,
          tipo: 'RETENCIONES',
          importe_estimado: quarterlyData[q]?.retencion_alquiler_115 || 0,
          descripcion: '19% de retención sobre alquiler de local',
        });
      }

      // Modelo 111 - Retenciones Trabajadores/Profesionales (if enabled)
      if (userPrefs.mostrar_modelo_111) {
        calendario.push({
          modelo: '111',
          nombre: `Retenciones Trabajadores - ${qName} Trimestre ${targetYear}`,
          fecha_inicio: quarterRanges115[q].fecha_inicio, // Same dates as 115
          fecha_limite: quarterRanges115[q].fecha_limite,
          trimestre,
          año: targetYear,
          tipo: 'RETENCIONES',
          importe_estimado: 0, // Requires separate calculation
          descripcion: 'Retenciones a trabajadores y profesionales',
        });
      }

      // Modelo 123 - Retenciones Capital Mobiliario (if enabled)
      if (userPrefs.mostrar_modelo_123) {
        calendario.push({
          modelo: '123',
          nombre: `Retenciones Capital - ${qName} Trimestre ${targetYear}`,
          fecha_inicio: quarterRanges115[q].fecha_inicio, // Same dates as 115
          fecha_limite: quarterRanges115[q].fecha_limite,
          trimestre,
          año: targetYear,
          tipo: 'RETENCIONES',
          importe_estimado: 0, // Requires separate calculation
          descripcion: 'Retenciones sobre rendimientos de capital mobiliario',
        });
      }

      // Modelo 349 - Operaciones Intracomunitarias (if enabled)
      if (userPrefs.mostrar_modelo_349) {
        calendario.push({
          modelo: '349',
          nombre: `Operaciones UE - ${qName} Trimestre ${targetYear}`,
          fecha_inicio: quarterRanges303[q].fecha_inicio, // Same dates as 303
          fecha_limite: quarterRanges303[q].fecha_limite,
          trimestre,
          año: targetYear,
          tipo: 'INFORMATIVA',
          importe_estimado: 0, // Informative only
          descripcion: 'Declaración de operaciones intracomunitarias',
        });
      }
    }

    // Annual models (presented in January of targetYear+1)
    // Modelo 390 - Resumen Anual IVA (if 303 enabled)
    // Note: This is an INFORMATIVE model - no payment required, so importe_estimado = 0
    if (userPrefs.mostrar_modelo_390 || userPrefs.mostrar_modelo_303) {
      calendario.push({
        modelo: '390',
        nombre: 'Resumen Anual IVA ' + targetYear,
        fecha_inicio: rango390.fecha_inicio,
        fecha_limite: rango390.fecha_limite,
        trimestre: null,
        año: targetYear,
        tipo: 'IVA',
        importe_estimado: 0, // Informative model - no payment
        es_resumen: true,
        descripcion: 'Declaración informativa anual de IVA',
      });
    }

    // Modelo 180 - Resumen Anual Retenciones Alquileres (if 115 enabled)
    // Note: This is an INFORMATIVE model - no payment required, so importe_estimado = 0
    if (userPrefs.mostrar_modelo_180 || userPrefs.mostrar_modelo_115) {
      calendario.push({
        modelo: '180',
        nombre: 'Resumen Anual Retenciones Alquileres ' + targetYear,
        fecha_inicio: rango180.fecha_inicio,
        fecha_limite: rango180.fecha_limite,
        trimestre: null,
        año: targetYear,
        tipo: 'RETENCIONES',
        importe_estimado: 0, // Informative model - no payment
        es_resumen: true,
        descripcion: 'Declaración informativa anual de retenciones sobre alquileres',
      });
    }

    // Modelo 190 - Resumen Anual Retenciones Trabajadores (if 111 enabled)
    if (userPrefs.mostrar_modelo_190 || userPrefs.mostrar_modelo_111) {
      calendario.push({
        modelo: '190',
        nombre: 'Resumen Anual Retenciones Trabajadores ' + targetYear,
        fecha_inicio: rango180.fecha_inicio, // Same dates as 180
        fecha_limite: rango180.fecha_limite,
        trimestre: null,
        año: targetYear,
        tipo: 'RETENCIONES',
        importe_estimado: 0, // Requires separate calculation
        es_resumen: true,
        descripcion: 'Resumen anual de retenciones a trabajadores y profesionales',
      });
    }

    // Modelo 347 - Operaciones con terceros >3.005,06€ (if enabled)
    if (userPrefs.mostrar_modelo_347) {
      calendario.push({
        modelo: '347',
        nombre: 'Operaciones con Terceros ' + targetYear,
        fecha_inicio: `${targetYear + 1}-02-01`,
        fecha_limite: `${targetYear + 1}-02-28`,
        trimestre: null,
        año: targetYear,
        tipo: 'INFORMATIVA',
        importe_estimado: 0, // Informative only
        es_resumen: true,
        descripcion: 'Operaciones con terceros superiores a 3.005,06€',
      });
    }

    // Add RENTA for current year (presented in April-June of targetYear+1)
    calendario.push({
      modelo: 'RENTA',
      nombre: 'Declaración de la Renta ' + targetYear,
      fecha_inicio: rangoRenta.fecha_inicio,
      fecha_limite: rangoRenta.fecha_limite,
      trimestre: null,
      año: targetYear,
      tipo: 'IRPF',
      importe_estimado: irpf_brecha_cal,
      es_anual: true,
      descripcion: 'Declaración anual del IRPF',
    });

    // Add monthly Social Security payments (último día laborable del mes)
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    for (let month = 1; month <= 12; month++) {
      // Get last working day of the month
      const ultimoDiaLaborable = obtenerUltimoDiaLaborable(targetYear, month);
      const formatDate = (date: Date): string => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      (calendario as any[]).push({
        modelo: 'SEG-SOCIAL',
        nombre: `Seguridad Social - ${monthNames[month - 1]} ${targetYear}`,
        fecha_limite: formatDate(ultimoDiaLaborable),
        trimestre: month, // Pass month as trimestre for API consistency
        año: targetYear,
        tipo: 'SEGURIDAD_SOCIAL',
        importe_estimado: seguridad_social_mensual,
        mes: month,
        descripcion: 'Cuota mensual de autónomos (último día laborable)',
      });
    }

    // Sort calendar by date
    const calendarioOrdenado = calendario.sort((a, b) =>
      new Date(a.fecha_limite).getTime() - new Date(b.fecha_limite).getTime()
    );

    // Filter obligations based on fecha_alta_aeat
    const calendarioFiltrado = calendarioOrdenado.filter((obligacion: any) =>
      isObligationAfterAlta(obligacion.fecha_limite, obligacion.trimestre, obligacion.mes || null, obligacion.año)
    );

    // Get bank balance
    const bankBalanceResult = await query(
      'SELECT COALESCE(SUM(saldo_actual), 0) as saldo_total FROM bank_accounts WHERE user_id = $1 AND activa = true',
      [req.user.id]
    );
    const saldo_bancario_inicial = parseFloat(bankBalanceResult.rows[0].saldo_total) || 0;

    // Get pending invoices (money owed to me)
    const pendingInvoicesResult = await query(
      `SELECT COALESCE(SUM(total_factura), 0) as facturas_pendientes
       FROM facturas_emitidas
       WHERE user_id = $1 AND estado = 'PENDIENTE'`,
      [req.user.id]
    );
    const facturas_pendientes_cobro = parseFloat(pendingInvoicesResult.rows[0].facturas_pendientes) || 0;

    // Calculate cumulative balance for each payment
    let balance_acumulado = saldo_bancario_inicial;
    const total_obligaciones = totalIVA + totalIRPF_fraccionado + irpf_brecha_cal + seguridad_social_anual + totalRetenciones115;
    let total_pagado_acumulado = 0;

    const calendarioConBalance = (calendarioFiltrado as any[]).map((obligacion) => {
      const importe = obligacion.importe_estimado || 0;

      // Update cumulative values
      balance_acumulado += importe; // importe is negative for payments, positive for refunds
      total_pagado_acumulado += importe;

      const total_pendiente = total_obligaciones - total_pagado_acumulado;

      // Calculate the 3 values requested:
      const lo_que_debo = total_pendiente < 0 ? total_pendiente : 0; // Remaining fiscal obligations (negative)
      const lo_que_me_deben = facturas_pendientes_cobro; // Pending invoices to collect (positive)
      const balance = lo_que_debo + lo_que_me_deben; // Balance = what I owe + what I'm owed

      return {
        ...obligacion,
        balance_tras_pago: {
          lo_que_debo,
          lo_que_me_deben,
          balance,
        },
      };
    });

    const response: ApiResponse = {
      success: true,
      data: {
        año: targetYear,
        saldo_bancario_inicial,
        calendario: calendarioConBalance,
        resumen_anual: {
          total_iva_estimado: totalIVA,
          total_irpf_fraccionado: totalIRPF_fraccionado,
          irpf_brecha_estimada: irpf_brecha_cal,
          total_retenciones_alquiler_115: totalRetenciones115,
          seguridad_social_anual,
          total_obligaciones_fiscales: totalIVA + totalIRPF_fraccionado + irpf_brecha_cal + totalRetenciones115 + seguridad_social_anual,
          ingresos_anuales,
          gastos_anuales,
          beneficio_anual,
        },
        trimestres: quarterlyData,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get pre-filled tax model data
 * GET /api/dashboard/modelo-data/:modelo/:trimestre?/:year?
 */
export const getModeloData = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { modelo, trimestre, year } = req.params;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const targetTrimestre = trimestre ? parseInt(trimestre) : obtenerTrimestre(new Date());

    // Get user info
    const userResult = await query(
      `SELECT nombre_completo, nif, es_trade, mostrar_modelo_130, tipo_irpf_estimado FROM users WHERE id = $1`,
      [req.user.id]
    );
    const user = {
      ...userResult.rows[0],
      tipo_irpf_actual: 7, // Default value
      mostrar_modelo_130: userResult.rows[0]?.mostrar_modelo_130 ?? true,
      tipo_irpf_estimado: userResult.rows[0]?.tipo_irpf_estimado ? parseFloat(userResult.rows[0].tipo_irpf_estimado) : 21
    };

    // URLs oficiales AEAT
    const urlsAEAT: Record<string, { url: string; descripcion: string }> = {
      '303': {
        url: 'https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G414.shtml',
        descripcion: 'Modelo 303 - Autoliquidación IVA (Trimestral)',
      },
      '130': {
        url: 'https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G601.shtml',
        descripcion: 'Modelo 130 - Pago fraccionado IRPF Estimación Directa (Trimestral)',
      },
      '131': {
        url: 'https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G602.shtml',
        descripcion: 'Modelo 131 - Pago fraccionado IRPF Estimación Objetiva/Módulos (Trimestral)',
      },
      '115': {
        url: 'https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GH02.shtml',
        descripcion: 'Modelo 115 - Retenciones alquileres (Trimestral)',
      },
      '111': {
        url: 'https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GH01.shtml',
        descripcion: 'Modelo 111 - Retenciones trabajadores y profesionales (Trimestral)',
      },
      '123': {
        url: 'https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G107.shtml',
        descripcion: 'Modelo 123 - Retenciones capital mobiliario (Trimestral)',
      },
      '349': {
        url: 'https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G413.shtml',
        descripcion: 'Modelo 349 - Operaciones Intracomunitarias (Trimestral)',
      },
      '347': {
        url: 'https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G415.shtml',
        descripcion: 'Modelo 347 - Operaciones con terceros >3.005,06€ (Anual)',
      },
      '390': {
        url: 'https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G412.shtml',
        descripcion: 'Modelo 390 - Resumen anual IVA',
      },
      '180': {
        url: 'https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GH03.shtml',
        descripcion: 'Modelo 180 - Resumen anual de retenciones sobre alquileres',
      },
      '190': {
        url: 'https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GH04.shtml',
        descripcion: 'Modelo 190 - Resumen anual de retenciones trabajadores y profesionales',
      },
      'RENTA': {
        url: 'https://sede.agenciatributaria.gob.es',
        descripcion: 'Declaración de la Renta (Anual)',
      },
      'SEG-SOCIAL': {
        url: 'https://sede.seg-social.gob.es',
        descripcion: 'Cuota mensual de autónomos',
      },
    };

    let modeloInfo: any = {
      modelo,
      descripcion: urlsAEAT[modelo]?.descripcion || 'Modelo fiscal',
      url_presentacion: urlsAEAT[modelo]?.url || 'https://sede.agenciatributaria.gob.es',
      datos_identificativos: {
        nombre_completo: user.nombre_completo,
        nif: user.nif,
      },
    };

    // Get quarterly data for the specific trimester
    if (modelo === '303' || modelo === '130') {
      const trimestreStartMonth = (targetTrimestre - 1) * 3 + 1;
      const trimestreEndMonth = trimestreStartMonth + 2;

      // Get quarterly totals
      const trimestreResult = await query(
        `SELECT
          COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN base_imponible ELSE 0 END), 0) as ingresos,
          COALESCE(SUM(CASE WHEN tipo = 'gasto' AND es_deducible THEN base_imponible ELSE 0 END), 0) as gastos_deducibles,
          COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN cuota_iva ELSE 0 END), 0) as iva_repercutido,
          COALESCE(SUM(CASE WHEN tipo = 'gasto' AND es_deducible THEN cuota_iva ELSE 0 END), 0) as iva_soportado,
          COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN cuota_irpf ELSE 0 END), 0) as irpf_retenido
         FROM (
           SELECT base_imponible, cuota_iva, cuota_irpf, 'ingreso' as tipo, true as es_deducible
           FROM facturas_emitidas
           WHERE user_id = $1
             AND EXTRACT(YEAR FROM fecha_emision) = $2
             AND EXTRACT(MONTH FROM fecha_emision) BETWEEN $3 AND $4
           UNION ALL
           SELECT base_imponible, cuota_iva, 0 as cuota_irpf, 'gasto' as tipo, es_deducible
           FROM expenses
           WHERE user_id = $1
             AND EXTRACT(YEAR FROM fecha_emision) = $2
             AND EXTRACT(MONTH FROM fecha_emision) BETWEEN $3 AND $4
         ) combined`,
        [req.user.id, targetYear, trimestreStartMonth, trimestreEndMonth]
      );

      const trimestre = trimestreResult.rows[0];

      if (modelo === '303') {
        const iva_repercutido = parseFloat(trimestre.iva_repercutido) || 0;
        const iva_soportado = parseFloat(trimestre.iva_soportado) || 0;
        const iva_a_pagar = iva_repercutido - iva_soportado;

        modeloInfo.datos_modelo = {
          trimestre: targetTrimestre,
          ejercicio: targetYear,
          fecha_limite: obtenerFechaLimiteModelo(targetTrimestre, targetYear).toISOString().split('T')[0],
          casilla_03_iva_repercutido_base: parseFloat(trimestre.ingresos) || 0,
          casilla_04_iva_repercutido_cuota: iva_repercutido,
          casilla_08_iva_soportado_base: parseFloat(trimestre.gastos_deducibles) || 0,
          casilla_09_iva_soportado_cuota: iva_soportado,
          casilla_71_resultado: iva_a_pagar,
          tipo: iva_a_pagar > 0 ? 'A ingresar' : iva_a_pagar < 0 ? 'A devolver' : 'Sin actividad',
        };
      } else if (modelo === '130') {
        const ingresos = parseFloat(trimestre.ingresos) || 0;
        const gastos_deducibles = parseFloat(trimestre.gastos_deducibles) || 0;
        const rendimiento_neto = ingresos - gastos_deducibles;
        const pago_fraccionado = rendimiento_neto * 0.20;

        // Get acumulado del año hasta este trimestre
        const acumuladoResult = await query(
          `SELECT
            COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN base_imponible ELSE 0 END), 0) as ingresos_acum,
            COALESCE(SUM(CASE WHEN tipo = 'gasto' AND es_deducible THEN base_imponible ELSE 0 END), 0) as gastos_acum
           FROM (
             SELECT base_imponible, 'ingreso' as tipo, true as es_deducible
             FROM facturas_emitidas
             WHERE user_id = $1
               AND EXTRACT(YEAR FROM fecha_emision) = $2
               AND EXTRACT(MONTH FROM fecha_emision) BETWEEN 1 AND $3
             UNION ALL
             SELECT base_imponible, 'gasto' as tipo, es_deducible
             FROM expenses
             WHERE user_id = $1
               AND EXTRACT(YEAR FROM fecha_emision) = $2
               AND EXTRACT(MONTH FROM fecha_emision) BETWEEN 1 AND $3
           ) combined`,
          [req.user.id, targetYear, trimestreEndMonth]
        );

        const acumulado = acumuladoResult.rows[0];
        const ingresos_acum = parseFloat(acumulado.ingresos_acum) || 0;
        const gastos_acum = parseFloat(acumulado.gastos_acum) || 0;
        const rendimiento_acum = ingresos_acum - gastos_acum;
        const pago_total_acum = rendimiento_acum * 0.20;

        modeloInfo.datos_modelo = {
          trimestre: targetTrimestre,
          ejercicio: targetYear,
          fecha_limite: obtenerFechaLimiteModelo(targetTrimestre, targetYear).toISOString().split('T')[0],
          casilla_01_ingresos: ingresos,
          casilla_02_gastos: gastos_deducibles,
          casilla_03_rendimiento_neto: rendimiento_neto,
          casilla_04_20pct: pago_fraccionado,
          casilla_07_pagos_anteriores: targetTrimestre > 1 ? (pago_total_acum - pago_fraccionado) : 0,
          casilla_19_resultado: pago_fraccionado,
          ingresos_acumulados: ingresos_acum,
          gastos_acumulados: gastos_acum,
          rendimiento_acumulado: rendimiento_acum,
        };
      }
    } else if (modelo === '115') {
      // Modelo 115 - Retenciones de alquileres
      const trimestreStartMonth = (targetTrimestre - 1) * 3 + 1;
      const trimestreEndMonth = trimestreStartMonth + 2;

      // Get rental expenses for the quarter
      const rentalResult = await query(
        `SELECT
          COUNT(DISTINCT proveedor_nombre) as num_perceptores,
          COALESCE(SUM(base_imponible), 0) as base_alquiler_total
         FROM expenses
         WHERE user_id = $1
           AND EXTRACT(YEAR FROM fecha_emision) = $2
           AND EXTRACT(MONTH FROM fecha_emision) BETWEEN $3 AND $4
           AND (concepto ILIKE '%alquiler%' OR categoria ILIKE '%alquiler%' OR concepto ILIKE '%arrendamiento%')`,
        [req.user.id, targetYear, trimestreStartMonth, trimestreEndMonth]
      );

      const rental = rentalResult.rows[0];
      const num_perceptores = parseInt(rental.num_perceptores) || 0;
      const base_alquiler = parseFloat(rental.base_alquiler_total) || 0;
      const retencion = base_alquiler * 0.19;

      modeloInfo.datos_modelo = {
        trimestre: targetTrimestre,
        ejercicio: targetYear,
        fecha_limite: obtenerFechaLimiteModelo(targetTrimestre, targetYear).toISOString().split('T')[0],
        casilla_01_num_perceptores: num_perceptores,
        casilla_02_base_retenciones: base_alquiler,
        casilla_03_retenciones_ingresadas: retencion,
        informacion: base_alquiler > 0
          ? `Debes declarar el 19% de retención sobre el alquiler de locales pagado este trimestre (${num_perceptores} propietario${num_perceptores !== 1 ? 's' : ''}).`
          : 'No se encontraron gastos de alquiler en este trimestre.',
        nota: base_alquiler === 0
          ? 'Si no pagas alquiler de local para tu actividad, no tienes obligación de presentar este modelo.'
          : 'Recuerda que debes retener el 19% del alquiler y pagarlo directamente menos al propietario.',
      };
    } else if (modelo === '180') {
      // Get annual rental withholdings data
      const rentalResult = await query(
        `SELECT
          COALESCE(SUM(base_imponible), 0) as alquiler_total,
          COUNT(*) as num_operaciones
         FROM expenses
         WHERE user_id = $1
           AND EXTRACT(YEAR FROM fecha_emision) = $2
           AND (concepto ILIKE '%alquiler%' OR categoria ILIKE '%alquiler%')`,
        [req.user.id, targetYear]
      );

      const rental = rentalResult.rows[0];
      const alquiler_total = parseFloat(rental.alquiler_total) || 0;
      const retencion_total = alquiler_total * 0.19;

      modeloInfo.datos_modelo = {
        ejercicio: targetYear,
        fecha_limite: `${targetYear + 1}-01-31`,
        base_alquiler_total: alquiler_total,
        retencion_total_19pct: retencion_total,
        num_operaciones: parseInt(rental.num_operaciones) || 0,
        nota: 'Declaración informativa anual de retenciones sobre alquileres. Es un resumen de los Modelo 115 trimestrales.',
      };
    } else if (modelo === '390') {
      // Get annual IVA data
      const anualResult = await query(
        `SELECT
          COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN base_imponible ELSE 0 END), 0) as ingresos_totales,
          COALESCE(SUM(CASE WHEN tipo = 'gasto' AND es_deducible THEN base_imponible ELSE 0 END), 0) as gastos_totales,
          COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN cuota_iva ELSE 0 END), 0) as iva_repercutido,
          COALESCE(SUM(CASE WHEN tipo = 'gasto' AND es_deducible THEN cuota_iva ELSE 0 END), 0) as iva_soportado
         FROM (
           SELECT base_imponible, cuota_iva, 'ingreso' as tipo, true as es_deducible
           FROM facturas_emitidas
           WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
           UNION ALL
           SELECT base_imponible, cuota_iva, 'gasto' as tipo, es_deducible
           FROM expenses
           WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
         ) combined`,
        [req.user.id, targetYear]
      );

      const anual = anualResult.rows[0];
      const iva_repercutido = parseFloat(anual.iva_repercutido) || 0;
      const iva_soportado = parseFloat(anual.iva_soportado) || 0;
      const resultado_anual = iva_repercutido - iva_soportado;

      modeloInfo.datos_modelo = {
        ejercicio: targetYear,
        fecha_limite: `${targetYear + 1}-01-30`,
        total_base_imponible_ingresos: parseFloat(anual.ingresos_totales) || 0,
        total_cuota_iva_repercutido: iva_repercutido,
        total_base_imponible_gastos: parseFloat(anual.gastos_totales) || 0,
        total_cuota_iva_soportado: iva_soportado,
        resultado_anual,
        nota: 'Resumen informativo del IVA del año completo. No implica pago adicional.',
      };
    } else if (modelo === 'RENTA') {
      // Get annual IRPF data
      const anualResult = await query(
        `SELECT
          COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN base_imponible ELSE 0 END), 0) as ingresos_totales,
          COALESCE(SUM(CASE WHEN tipo = 'gasto' AND es_deducible THEN base_imponible ELSE 0 END), 0) as gastos_deducibles,
          COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN cuota_irpf ELSE 0 END), 0) as irpf_retenido
         FROM (
           SELECT base_imponible, cuota_irpf, 'ingreso' as tipo, true as es_deducible
           FROM facturas_emitidas
           WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
           UNION ALL
           SELECT base_imponible, 0 as cuota_irpf, 'gasto' as tipo, es_deducible
           FROM expenses
           WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
         ) combined`,
        [req.user.id, targetYear]
      );

      const anual = anualResult.rows[0];
      const ingresos = parseFloat(anual.ingresos_totales) || 0;
      const gastos = parseFloat(anual.gastos_deducibles) || 0;
      const beneficio_neto = ingresos - gastos;
      const tipo_irpf = user.tipo_irpf_estimado || 21;
      const irpf_estimado = beneficio_neto * (tipo_irpf / 100);
      const irpf_retenido = parseFloat(anual.irpf_retenido) || 0;

      // Only calculate fractional payments if user has Modelo 130 enabled
      const irpf_pagos_fraccionados = user.mostrar_modelo_130 ? (beneficio_neto * 0.20) : 0;
      // Negate result: negative = a pagar, positive = a devolver
      const resultado = -(irpf_estimado - irpf_retenido - irpf_pagos_fraccionados);

      modeloInfo.datos_modelo = {
        ejercicio: targetYear,
        fecha_limite: `${targetYear + 1}-06-30`,
        ingresos_anuales: ingresos,
        gastos_deducibles: gastos,
        rendimiento_neto: beneficio_neto,
        tipo_irpf_estimado: tipo_irpf,
        irpf_estimado,
        menos_retenciones: irpf_retenido,
        menos_pagos_fraccionados: irpf_pagos_fraccionados,
        resultado_provisional: resultado,
        tipo: resultado < 0 ? 'A pagar' : resultado > 0 ? 'A devolver' : 'Neutro',
        nota: user.mostrar_modelo_130
          ? 'Estos son valores estimados. Incluye los pagos fraccionados del Modelo 130. La declaración definitiva puede variar según deducciones personales.'
          : 'Estos son valores estimados. No incluye pagos fraccionados del Modelo 130 (no habilitado). La declaración definitiva puede variar según deducciones personales.',
      };
    } else if (modelo === 'SEG-SOCIAL') {
      // Get user SS configuration
      const userSSResult = await query(
        `SELECT tiene_tarifa_plana_ss, base_cotizacion FROM users WHERE id = $1`,
        [req.user.id]
      );
      const userSS = {
        tiene_tarifa_plana_ss: userSSResult.rows[0]?.tiene_tarifa_plana_ss ?? false,
        base_cotizacion: userSSResult.rows[0]?.base_cotizacion ? parseFloat(userSSResult.rows[0].base_cotizacion) : null
      };

      // Get annual data to calculate average monthly income
      const anualesResult = await query(
        `SELECT
          COALESCE(SUM(base_imponible), 0) as ingresos_totales,
          COALESCE(SUM(CASE WHEN es_deducible THEN base_imponible ELSE 0 END), 0) as gastos_deducibles
        FROM (
          SELECT base_imponible, NULL as es_deducible FROM facturas_emitidas WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
          UNION ALL
          SELECT base_imponible, es_deducible FROM expenses WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
        ) combined`,
        [req.user.id, targetYear]
      );
      const ingresos_anuales = parseFloat(anualesResult.rows[0]?.ingresos_totales) || 0;
      const gastos_deducibles = parseFloat(anualesResult.rows[0]?.gastos_deducibles) || 0;
      const beneficio_anual = ingresos_anuales - gastos_deducibles;
      const rendimiento_neto_mensual = beneficio_anual / 12;

      // Calculate SS quota
      const cuotaSS = calcularCuotaAutonomos(
        rendimiento_neto_mensual,
        userSS.tiene_tarifa_plana_ss,
        userSS.base_cotizacion || undefined
      );

      // Get the specific month if provided (from trimestre parameter)
      const mes = trimestre ? parseInt(trimestre as any) : new Date().getMonth() + 1;
      const ultimoDiaLaborable = obtenerUltimoDiaLaborable(targetYear, mes);
      const formatDate = (date: Date): string => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      modeloInfo.datos_modelo = {
        mes,
        ejercicio: targetYear,
        fecha_limite: formatDate(ultimoDiaLaborable),
        cuota_total: cuotaSS,
        tiene_tarifa_plana: userSS.tiene_tarifa_plana_ss,
        base_cotizacion: userSS.base_cotizacion || 950.98,
        bonificacion_tarifa_plana: userSS.tiene_tarifa_plana_ss ? 80 : 0,
        mei_09pct: userSS.tiene_tarifa_plana_ss ? ((userSS.base_cotizacion || 950.98) * 0.009) : 0,
        cuota_sin_tarifa_plana: userSS.tiene_tarifa_plana_ss ? 0 : cuotaSS,
        rendimiento_neto_mensual,
        descripcion: userSS.tiene_tarifa_plana_ss
          ? `Tarifa plana: 80€ bonificación + ${((userSS.base_cotizacion || 950.98) * 0.009).toFixed(2)}€ MEI (0,9% sobre base ${userSS.base_cotizacion || 950.98}€)`
          : `Sistema de cotización por ingresos reales (rendimiento mensual: ${rendimiento_neto_mensual.toFixed(2)}€)`,
        nota: 'La cuota se carga el último día laborable del mes.',
      };
    }

    const response: ApiResponse = {
      success: true,
      data: modeloInfo,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

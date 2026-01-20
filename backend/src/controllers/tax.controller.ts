import { Response, NextFunction } from 'express';
import { query } from '../config/database';
import { ApiResponse, AuthRequest } from '../types';
import { BadRequestError } from '../middleware/errorHandler';
import { 
  calcularModelo303, 
  calcularModelo130,
  calcularModelo130Acumulado 
} from '../utils/taxCalculations';
import { 
  generarCasillasModelo303, 
  generarCasillasModelo303Completo,
  generarCasillasModelo130,
  generarCasillasModelo130Acumulado,
  generarCasillasModelo115,
  obtenerPeriodoTrimestre 
} from '../utils/helpers';

/**
 * Calculate Modelo 303 (IVA trimestral)
 * GET /api/tax/modelo-303/:year/:trimestre
 * 
 * Basado en OCA/l10n-spain y AEAT 2026
 * Incluye desglose por tipos de IVA (4%, 10%, 21%)
 */
export const getModelo303 = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { year, trimestre } = req.params;
    const targetYear = parseInt(year);
    const targetTrimestre = parseInt(trimestre);

    if (targetTrimestre < 1 || targetTrimestre > 4) {
      throw BadRequestError('Trimestre debe estar entre 1 y 4');
    }

    const periodo = obtenerPeriodoTrimestre(targetTrimestre, targetYear);

    // Get IVA repercutido desglosado por tipo (facturas emitidas)
    const ivaRepercutidoPorTipoResult = await query(
      `SELECT
        tipo_iva,
        COALESCE(SUM(base_imponible), 0) as base_total,
        COALESCE(SUM(cuota_iva), 0) as iva_total
       FROM facturas_emitidas
       WHERE user_id = $1
         AND fecha_emision >= $2
         AND fecha_emision <= $3
       GROUP BY tipo_iva
       ORDER BY tipo_iva`,
      [req.user.id, periodo.inicio, periodo.fin]
    );

    // Get totales IVA repercutido
    const ivaRepercutidoTotalResult = await query(
      `SELECT
        COALESCE(SUM(base_imponible), 0) as base_total,
        COALESCE(SUM(cuota_iva), 0) as iva_total
       FROM facturas_emitidas
       WHERE user_id = $1
         AND fecha_emision >= $2
         AND fecha_emision <= $3`,
      [req.user.id, periodo.inicio, periodo.fin]
    );

    // Get IVA soportado desglosado por tipo (gastos deducibles)
    const ivaSoportadoPorTipoResult = await query(
      `SELECT
        tipo_iva,
        COALESCE(SUM(base_imponible), 0) as base_total,
        COALESCE(SUM(cuota_iva), 0) as iva_total
       FROM expenses
       WHERE user_id = $1
         AND es_deducible = true
         AND fecha_emision >= $2
         AND fecha_emision <= $3
       GROUP BY tipo_iva
       ORDER BY tipo_iva`,
      [req.user.id, periodo.inicio, periodo.fin]
    );

    // Get totales IVA soportado
    const ivaSoportadoTotalResult = await query(
      `SELECT
        COALESCE(SUM(base_imponible), 0) as base_total,
        COALESCE(SUM(cuota_iva), 0) as iva_total
       FROM expenses
       WHERE user_id = $1
         AND es_deducible = true
         AND fecha_emision >= $2
         AND fecha_emision <= $3`,
      [req.user.id, periodo.inicio, periodo.fin]
    );

    // Parsear desglose por tipo IVA repercutido
    const desgloseTipoRepercutido = {
      base_4: 0, cuota_4: 0,
      base_10: 0, cuota_10: 0,
      base_21: 0, cuota_21: 0,
    };
    
    for (const row of ivaRepercutidoPorTipoResult.rows) {
      const tipoIva = parseFloat(row.tipo_iva);
      const base = parseFloat(row.base_total);
      const cuota = parseFloat(row.iva_total);
      
      if (tipoIva === 4) {
        desgloseTipoRepercutido.base_4 = base;
        desgloseTipoRepercutido.cuota_4 = cuota;
      } else if (tipoIva === 10) {
        desgloseTipoRepercutido.base_10 = base;
        desgloseTipoRepercutido.cuota_10 = cuota;
      } else if (tipoIva === 21) {
        desgloseTipoRepercutido.base_21 = base;
        desgloseTipoRepercutido.cuota_21 = cuota;
      }
    }

    // Parsear desglose por tipo IVA soportado
    const desgloseTipoSoportado = {
      base_4: 0, cuota_4: 0,
      base_10: 0, cuota_10: 0,
      base_21: 0, cuota_21: 0,
    };
    
    for (const row of ivaSoportadoPorTipoResult.rows) {
      const tipoIva = parseFloat(row.tipo_iva);
      const base = parseFloat(row.base_total);
      const cuota = parseFloat(row.iva_total);
      
      if (tipoIva === 4) {
        desgloseTipoSoportado.base_4 = base;
        desgloseTipoSoportado.cuota_4 = cuota;
      } else if (tipoIva === 10) {
        desgloseTipoSoportado.base_10 = base;
        desgloseTipoSoportado.cuota_10 = cuota;
      } else if (tipoIva === 21) {
        desgloseTipoSoportado.base_21 = base;
        desgloseTipoSoportado.cuota_21 = cuota;
      }
    }

    const baseRepercutida = parseFloat(ivaRepercutidoTotalResult.rows[0].base_total);
    const ivaRepercutido = parseFloat(ivaRepercutidoTotalResult.rows[0].iva_total);
    const baseSoportada = parseFloat(ivaSoportadoTotalResult.rows[0].base_total);
    const ivaSoportado = parseFloat(ivaSoportadoTotalResult.rows[0].iva_total);

    // Calculate Modelo 303
    const resultado = calcularModelo303(ivaRepercutido, ivaSoportado);

    // Generate casillas AEAT con desglose completo
    const casillasCompletas = generarCasillasModelo303Completo(
      desgloseTipoRepercutido,
      baseSoportada,
      ivaSoportado
    );

    // Get fecha límite
    const fechasLimite: Record<number, string> = {
      1: `${targetYear}-04-20`,
      2: `${targetYear}-07-20`,
      3: `${targetYear}-10-20`,
      4: `${targetYear + 1}-01-30`, // 4T tiene plazo hasta 30 de enero
    };

    // Generar instrucciones según desglose
    const instrucciones = [
      'Accede a la Sede Electrónica de AEAT',
      'Modelo 303 > Declaración trimestral IVA',
    ];

    // Añadir casillas por tipo IVA
    if (desgloseTipoRepercutido.base_4 > 0) {
      instrucciones.push(`Casilla 01: Base IVA 4% → ${desgloseTipoRepercutido.base_4.toFixed(2)}€`);
      instrucciones.push(`Casilla 03: Cuota IVA 4% → ${desgloseTipoRepercutido.cuota_4.toFixed(2)}€`);
    }
    if (desgloseTipoRepercutido.base_10 > 0) {
      instrucciones.push(`Casilla 04: Base IVA 10% → ${desgloseTipoRepercutido.base_10.toFixed(2)}€`);
      instrucciones.push(`Casilla 06: Cuota IVA 10% → ${desgloseTipoRepercutido.cuota_10.toFixed(2)}€`);
    }
    if (desgloseTipoRepercutido.base_21 > 0) {
      instrucciones.push(`Casilla 07: Base IVA 21% → ${desgloseTipoRepercutido.base_21.toFixed(2)}€`);
      instrucciones.push(`Casilla 09: Cuota IVA 21% → ${desgloseTipoRepercutido.cuota_21.toFixed(2)}€`);
    }
    
    instrucciones.push(`Casilla 27: Total IVA devengado → ${ivaRepercutido.toFixed(2)}€`);
    instrucciones.push(`Casilla 28: Base IVA soportado → ${baseSoportada.toFixed(2)}€`);
    instrucciones.push(`Casilla 29: Cuota IVA deducible → ${ivaSoportado.toFixed(2)}€`);
    instrucciones.push(`Casilla 45: Total IVA deducible → ${ivaSoportado.toFixed(2)}€`);
    instrucciones.push(`Casilla 46: Resultado régimen general → ${resultado.resultado.toFixed(2)}€`);
    instrucciones.push(`Casilla 69: Resultado final (${resultado.accion}) → ${Math.abs(resultado.resultado).toFixed(2)}€`);

    const response: ApiResponse = {
      success: true,
      data: {
        modelo: '303',
        trimestre: targetTrimestre,
        ano: targetYear,
        periodo: `${targetTrimestre}T ${targetYear} (${periodo.inicio.toLocaleDateString('es-ES')} - ${periodo.fin.toLocaleDateString('es-ES')})`,
        fecha_limite_presentacion: fechasLimite[targetTrimestre],

        // Desglose por tipo IVA (nuevo)
        desglose_iva_repercutido: {
          tipo_4: { base: desgloseTipoRepercutido.base_4, cuota: desgloseTipoRepercutido.cuota_4 },
          tipo_10: { base: desgloseTipoRepercutido.base_10, cuota: desgloseTipoRepercutido.cuota_10 },
          tipo_21: { base: desgloseTipoRepercutido.base_21, cuota: desgloseTipoRepercutido.cuota_21 },
        },
        desglose_iva_soportado: {
          tipo_4: { base: desgloseTipoSoportado.base_4, cuota: desgloseTipoSoportado.cuota_4 },
          tipo_10: { base: desgloseTipoSoportado.base_10, cuota: desgloseTipoSoportado.cuota_10 },
          tipo_21: { base: desgloseTipoSoportado.base_21, cuota: desgloseTipoSoportado.cuota_21 },
        },

        // Totales
        base_imponible_total: baseRepercutida,
        iva_repercutido: resultado.iva_repercutido,
        iva_soportado: resultado.iva_soportado,
        resultado_iva: resultado.resultado,
        accion: resultado.accion,

        casillas_aeat: casillasCompletas,

        instrucciones,

        fuente: 'Basado en OCA/l10n-spain (l10n_es_aeat_mod303) y normativa AEAT 2026',
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate Modelo 130 (IRPF trimestral)
 * GET /api/tax/modelo-130/:year/:trimestre
 * 
 * IMPORTANTE: Según normativa AEAT y OCA/l10n-spain, los datos son ACUMULADOS
 * desde el 1 de enero hasta el final del trimestre declarado.
 * 
 * Fórmula oficial:
 * Casilla 01: Ingresos íntegros ACUMULADOS desde enero
 * Casilla 02: Gastos deducibles ACUMULADOS
 * Casilla 03: Rendimiento neto = 01 - 02
 * Casilla 04: 20% del rendimiento neto positivo
 * Casilla 05: Pagos fraccionados ANTERIORES (solo positivos)
 * Casilla 06: Retenciones ACUMULADAS
 * Casilla 07: Resultado = 04 - 05 - 06
 */
export const getModelo130 = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { year, trimestre } = req.params;
    const targetYear = parseInt(year);
    const targetTrimestre = parseInt(trimestre);

    if (targetTrimestre < 1 || targetTrimestre > 4) {
      throw BadRequestError('Trimestre debe estar entre 1 y 4');
    }

    // Periodo ACUMULADO: desde 1 de enero hasta fin del trimestre
    const inicioAno = new Date(targetYear, 0, 1); // 1 de enero
    const finTrimestre = obtenerPeriodoTrimestre(targetTrimestre, targetYear).fin;

    // Get ingresos ACUMULADOS desde enero
    const ingresosAcumuladosResult = await query(
      `SELECT COALESCE(SUM(base_imponible), 0) as total
       FROM facturas_emitidas
       WHERE user_id = $1
         AND fecha_emision >= $2
         AND fecha_emision <= $3`,
      [req.user.id, inicioAno, finTrimestre]
    );

    // Get gastos deducibles ACUMULADOS desde enero
    const gastosAcumuladosResult = await query(
      `SELECT COALESCE(SUM(base_imponible), 0) as total
       FROM expenses
       WHERE user_id = $1
         AND es_deducible = true
         AND fecha_emision >= $2
         AND fecha_emision <= $3`,
      [req.user.id, inicioAno, finTrimestre]
    );

    // Get retenciones ACUMULADAS desde enero
    const retencionesAcumuladasResult = await query(
      `SELECT COALESCE(SUM(cuota_irpf), 0) as total
       FROM facturas_emitidas
       WHERE user_id = $1
         AND fecha_emision >= $2
         AND fecha_emision <= $3`,
      [req.user.id, inicioAno, finTrimestre]
    );

    // Calcular pagos anteriores (suma de resultados positivos de trimestres anteriores)
    let pagosAnteriores = 0;
    if (targetTrimestre > 1) {
      // Para cada trimestre anterior, calcular el resultado y sumar solo los positivos
      for (let t = 1; t < targetTrimestre; t++) {
        const periodoAnterior = obtenerPeriodoTrimestre(t, targetYear);
        const finAnterior = periodoAnterior.fin;
        
        // Ingresos acumulados hasta ese trimestre
        const ingAnt = await query(
          `SELECT COALESCE(SUM(base_imponible), 0) as total
           FROM facturas_emitidas
           WHERE user_id = $1
             AND fecha_emision >= $2
             AND fecha_emision <= $3`,
          [req.user.id, inicioAno, finAnterior]
        );
        
        // Gastos acumulados hasta ese trimestre
        const gasAnt = await query(
          `SELECT COALESCE(SUM(base_imponible), 0) as total
           FROM expenses
           WHERE user_id = $1
             AND es_deducible = true
             AND fecha_emision >= $2
             AND fecha_emision <= $3`,
          [req.user.id, inicioAno, finAnterior]
        );
        
        // Retenciones acumuladas hasta ese trimestre
        const retAnt = await query(
          `SELECT COALESCE(SUM(cuota_irpf), 0) as total
           FROM facturas_emitidas
           WHERE user_id = $1
             AND fecha_emision >= $2
             AND fecha_emision <= $3`,
          [req.user.id, inicioAno, finAnterior]
        );
        
        const ingAnterior = parseFloat(ingAnt.rows[0].total);
        const gasAnterior = parseFloat(gasAnt.rows[0].total);
        const retAnterior = parseFloat(retAnt.rows[0].total);
        
        // Calcular rendimiento neto acumulado hasta ese trimestre
        const rendNeto = ingAnterior - gasAnterior;
        const pago20 = rendNeto > 0 ? rendNeto * 0.2 : 0;
        
        // Pagos anteriores a ese trimestre (recursivo simplificado)
        // Para T1, pagos anteriores = 0
        // Para T2, pagos anteriores = resultado positivo de T1
        // etc.
        let pagosHastaEseTrimestre = 0;
        if (t > 1) {
          // Simplificación: usar los pagos calculados hasta ahora
          pagosHastaEseTrimestre = pagosAnteriores;
        }
        
        const resultadoTrimestre = pago20 - pagosHastaEseTrimestre - retAnterior;
        
        // Solo sumar si es positivo (según AEAT)
        if (resultadoTrimestre > 0) {
          pagosAnteriores += resultadoTrimestre;
        }
      }
    }

    const ingresosAcumulados = parseFloat(ingresosAcumuladosResult.rows[0].total);
    const gastosAcumulados = parseFloat(gastosAcumuladosResult.rows[0].total);
    const retencionesAcumuladas = parseFloat(retencionesAcumuladasResult.rows[0].total);

    // Calculate Modelo 130 con datos acumulados
    const resultado = calcularModelo130Acumulado(
      ingresosAcumulados,
      gastosAcumulados,
      retencionesAcumuladas,
      pagosAnteriores,
      targetTrimestre,
      targetYear
    );

    // Generate casillas AEAT oficiales (acumulado)
    const casillasOficiales = generarCasillasModelo130Acumulado(
      ingresosAcumulados,
      gastosAcumulados,
      pagosAnteriores,
      retencionesAcumuladas
    );

    // Get fecha límite
    const fechasLimite: Record<number, string> = {
      1: `${targetYear}-04-20`,
      2: `${targetYear}-07-20`,
      3: `${targetYear}-10-20`,
      4: `${targetYear + 1}-01-30`, // 4T tiene plazo hasta 30 de enero
    };

    // Calcular datos del trimestre actual (para referencia)
    const periodoActual = obtenerPeriodoTrimestre(targetTrimestre, targetYear);
    const inicioPeriodo = targetTrimestre === 1 ? inicioAno : obtenerPeriodoTrimestre(targetTrimestre - 1, targetYear).fin;
    
    const ingresosTrimestre = await query(
      `SELECT COALESCE(SUM(base_imponible), 0) as total
       FROM facturas_emitidas
       WHERE user_id = $1
         AND fecha_emision > $2
         AND fecha_emision <= $3`,
      [req.user.id, targetTrimestre === 1 ? new Date(targetYear - 1, 11, 31) : inicioPeriodo, finTrimestre]
    );
    
    const gastosTrimestre = await query(
      `SELECT COALESCE(SUM(base_imponible), 0) as total
       FROM expenses
       WHERE user_id = $1
         AND es_deducible = true
         AND fecha_emision > $2
         AND fecha_emision <= $3`,
      [req.user.id, targetTrimestre === 1 ? new Date(targetYear - 1, 11, 31) : inicioPeriodo, finTrimestre]
    );

    const response: ApiResponse = {
      success: true,
      data: {
        modelo: '130',
        trimestre: targetTrimestre,
        ano: targetYear,
        periodo: `${targetTrimestre}T ${targetYear} (${periodoActual.inicio.toLocaleDateString('es-ES')} - ${periodoActual.fin.toLocaleDateString('es-ES')})`,

        // Datos ACUMULADOS (lo que va al modelo oficial)
        datos_acumulados: {
          desde: inicioAno.toLocaleDateString('es-ES'),
          hasta: finTrimestre.toLocaleDateString('es-ES'),
          ingresos: resultado.casilla_01_ingresos_acumulados,
          gastos: resultado.casilla_02_gastos_acumulados,
          rendimiento_neto: resultado.casilla_03_rendimiento_neto,
          pago_20_pct: resultado.casilla_04_pago_20_pct,
          pagos_anteriores: resultado.casilla_05_pagos_anteriores,
          retenciones: resultado.casilla_06_retenciones_acumuladas,
        },

        // Datos del trimestre actual (informativo)
        datos_trimestre_actual: {
          ingresos: parseFloat(ingresosTrimestre.rows[0].total),
          gastos: parseFloat(gastosTrimestre.rows[0].total),
        },

        // Compatibilidad hacia atrás
        ingresos_computables: resultado.casilla_01_ingresos_acumulados,
        gastos_deducibles: resultado.casilla_02_gastos_acumulados,
        rendimiento_neto: resultado.casilla_03_rendimiento_neto,
        pago_fraccionado_20pct: resultado.casilla_04_pago_20_pct,
        pagos_anteriores: resultado.casilla_05_pagos_anteriores,
        retenciones_practicadas: resultado.casilla_06_retenciones_acumuladas,
        resultado: resultado.casilla_07_resultado,
        accion: resultado.accion,

        casillas_aeat: casillasOficiales,

        fecha_limite_presentacion: fechasLimite[targetTrimestre],

        nota: 'Los datos son ACUMULADOS desde el 1 de enero según normativa AEAT. El 20% se aplica sobre el rendimiento neto acumulado, restando pagos anteriores y retenciones.',

        instrucciones: [
          'Accede a la Sede Electrónica de AEAT',
          'Modelo 130 > Pago fraccionado IRPF (Estimación directa)',
          `Casilla 01: Ingresos íntegros ACUMULADOS → ${resultado.casilla_01_ingresos_acumulados.toFixed(2)}€`,
          `Casilla 02: Gastos deducibles ACUMULADOS → ${resultado.casilla_02_gastos_acumulados.toFixed(2)}€`,
          `Casilla 03: Rendimiento neto (01 - 02) → ${resultado.casilla_03_rendimiento_neto.toFixed(2)}€`,
          `Casilla 04: 20% del rendimiento neto → ${resultado.casilla_04_pago_20_pct.toFixed(2)}€`,
          `Casilla 05: Pagos fraccionados anteriores → ${resultado.casilla_05_pagos_anteriores.toFixed(2)}€`,
          `Casilla 06: Retenciones acumuladas → ${resultado.casilla_06_retenciones_acumuladas.toFixed(2)}€`,
          `Casilla 07: Resultado (${resultado.accion}) → ${resultado.casilla_07_resultado.toFixed(2)}€`,
        ],

        fuente: 'Basado en OCA/l10n-spain (l10n_es_aeat_mod130) y normativa AEAT 2026',
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate Modelo 115 (Retenciones de alquileres trimestrales)
 * GET /api/tax/modelo-115/:year/:trimestre
 * 
 * Basado en OCA/l10n-spain (l10n_es_aeat_mod115)
 * 
 * Casillas oficiales:
 * Casilla 01: Número de perceptores (propietarios)
 * Casilla 02: Base de las retenciones (suma alquileres sin IVA)
 * Casilla 03: Retenciones (base × 19%)
 * Casilla 04: A deducir (declaración complementaria)
 * Casilla 05: Resultado a ingresar
 */
export const getModelo115 = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { year, trimestre } = req.params;
    const targetYear = parseInt(year);
    const targetTrimestre = parseInt(trimestre);

    if (targetTrimestre < 1 || targetTrimestre > 4) {
      throw BadRequestError('Trimestre debe estar entre 1 y 4');
    }

    const periodo = obtenerPeriodoTrimestre(targetTrimestre, targetYear);

    // Get rental expenses for the quarter con desglose por proveedor
    const alquileresResult = await query(
      `SELECT
        proveedor_nombre,
        proveedor_cif,
        COALESCE(SUM(base_imponible), 0) as base_total,
        COUNT(*) as num_pagos
       FROM expenses
       WHERE user_id = $1
         AND es_deducible = true
         AND (
           LOWER(descripcion) LIKE '%alquiler%'
           OR LOWER(descripcion) LIKE '%arrendamiento%'
           OR LOWER(descripcion) LIKE '%renta%'
           OR LOWER(categoria) = 'alquiler'
         )
         AND fecha_emision >= $2
         AND fecha_emision <= $3
       GROUP BY proveedor_nombre, proveedor_cif`,
      [req.user.id, periodo.inicio, periodo.fin]
    );

    // Get total
    const alquilerTotalResult = await query(
      `SELECT
        COALESCE(SUM(base_imponible), 0) as base_total,
        COUNT(DISTINCT proveedor_cif) as num_perceptores
       FROM expenses
       WHERE user_id = $1
         AND es_deducible = true
         AND (
           LOWER(descripcion) LIKE '%alquiler%'
           OR LOWER(descripcion) LIKE '%arrendamiento%'
           OR LOWER(descripcion) LIKE '%renta%'
           OR LOWER(categoria) = 'alquiler'
         )
         AND fecha_emision >= $2
         AND fecha_emision <= $3`,
      [req.user.id, periodo.inicio, periodo.fin]
    );

    const baseAlquiler = parseFloat(alquilerTotalResult.rows[0].base_total);
    const numPerceptores = parseInt(alquilerTotalResult.rows[0].num_perceptores) || (baseAlquiler > 0 ? 1 : 0);
    const retencion19 = Math.round((baseAlquiler * 0.19) * 100) / 100; // 19% de retención

    // Desglose por perceptor
    const perceptores = alquileresResult.rows.map(row => ({
      nombre: row.proveedor_nombre || 'Sin nombre',
      nif: row.proveedor_cif || 'Sin NIF',
      base_alquiler: parseFloat(row.base_total),
      retencion: Math.round(parseFloat(row.base_total) * 0.19 * 100) / 100,
      num_pagos: parseInt(row.num_pagos),
    }));

    // Determinar acción
    let accion = 'SIN ACTIVIDAD';
    if (retencion19 > 0) {
      accion = 'A INGRESAR';
    }

    // Generar casillas AEAT para Modelo 115
    const casillas = generarCasillasModelo115(numPerceptores, baseAlquiler, 0);

    // Get fecha límite
    const fechasLimite: Record<number, string> = {
      1: `${targetYear}-04-20`,
      2: `${targetYear}-07-20`,
      3: `${targetYear}-10-20`,
      4: `${targetYear + 1}-01-20`,
    };

    const response: ApiResponse = {
      success: true,
      data: {
        modelo: '115',
        trimestre: targetTrimestre,
        ano: targetYear,
        periodo: `${targetTrimestre}T ${targetYear} (${periodo.inicio.toLocaleDateString('es-ES')} - ${periodo.fin.toLocaleDateString('es-ES')})`,
        fecha_limite_presentacion: fechasLimite[targetTrimestre],

        // Desglose por perceptor
        num_perceptores: numPerceptores,
        perceptores: perceptores,

        // Totales
        base_alquiler: baseAlquiler,
        retencion_19pct: retencion19,
        resultado: retencion19,
        accion: accion,

        casillas_aeat: casillas,

        nota: 'El Modelo 115 declara las retenciones del 19% practicadas sobre los alquileres de locales para uso profesional. Los datos de cada perceptor (arrendador) deben incluirse en la declaración.',

        instrucciones: [
          'Accede a la Sede Electrónica de AEAT',
          'Modelo 115 > Retenciones e ingresos a cuenta sobre arrendamientos',
          `Casilla 01: Número de perceptores → ${numPerceptores}`,
          `Casilla 02: Base de las retenciones → ${baseAlquiler.toFixed(2)}€`,
          `Casilla 03: Retenciones (19%) → ${retencion19.toFixed(2)}€`,
          `Casilla 04: A deducir (complementaria) → 0,00€`,
          `Casilla 05: Resultado a ingresar → ${retencion19.toFixed(2)}€`,
        ],

        fuente: 'Basado en OCA/l10n-spain (l10n_es_aeat_mod115) y normativa AEAT 2026',
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate Modelo 180 (Resumen anual de retenciones sobre alquileres)
 * GET /api/tax/modelo-180/:year
 */
export const getModelo180 = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { year } = req.params;
    const targetYear = parseInt(year);

    // Get rental expenses for the entire year
    const alquilerResult = await query(
      `SELECT
        COALESCE(SUM(base_imponible), 0) as base_total,
        COUNT(*) as num_operaciones
       FROM expenses
       WHERE user_id = $1
         AND es_deducible = true
         AND (
           LOWER(descripcion) LIKE '%alquiler%'
           OR LOWER(descripcion) LIKE '%arrendamiento%'
           OR LOWER(descripcion) LIKE '%renta%'
           OR LOWER(categoria) = 'alquiler'
         )
         AND EXTRACT(YEAR FROM fecha_emision) = $2`,
      [req.user.id, targetYear]
    );

    const baseAnualAlquiler = parseFloat(alquilerResult.rows[0].base_total);
    const numOperaciones = parseInt(alquilerResult.rows[0].num_operaciones);
    const retencionAnual19 = Math.round((baseAnualAlquiler * 0.19) * 100) / 100; // 19% de retención

    // Determinar acción
    let accion = 'SIN ACTIVIDAD';
    if (retencionAnual19 > 0) {
      accion = 'INFORMATIVO';
    }

    // Get quarterly breakdown
    const trimestres = [];
    for (let t = 1; t <= 4; t++) {
      const periodo = obtenerPeriodoTrimestre(t, targetYear);
      const trimestreResult = await query(
        `SELECT COALESCE(SUM(base_imponible), 0) as base_total
         FROM expenses
         WHERE user_id = $1
           AND es_deducible = true
           AND (
             LOWER(descripcion) LIKE '%alquiler%'
             OR LOWER(descripcion) LIKE '%arrendamiento%'
             OR LOWER(descripcion) LIKE '%renta%'
             OR LOWER(categoria) = 'alquiler'
           )
           AND fecha_emision >= $2
           AND fecha_emision <= $3`,
        [req.user.id, periodo.inicio, periodo.fin]
      );

      const baseTrimestre = parseFloat(trimestreResult.rows[0].base_total);
      const retencionTrimestre = Math.round((baseTrimestre * 0.19) * 100) / 100;

      trimestres.push({
        trimestre: t,
        base_alquiler: baseTrimestre,
        retencion: retencionTrimestre,
      });
    }

    const response: ApiResponse = {
      success: true,
      data: {
        modelo: '180',
        ano: targetYear,
        fecha_limite_presentacion: `${targetYear + 1}-01-31`,

        resumen_anual: {
          base_alquiler_total: baseAnualAlquiler,
          retencion_total_19pct: retencionAnual19,
          num_operaciones: numOperaciones,
        },

        desglose_trimestral: trimestres,

        accion: accion,

        nota: 'El Modelo 180 es una declaración informativa anual que resume todas las retenciones practicadas sobre arrendamientos de locales durante el año. Es un resumen de los Modelo 115 trimestrales.',

        instrucciones: [
          'Accede a la Sede Electrónica de AEAT',
          'Modelo 180 > Resumen anual de retenciones',
          'Presenta antes del 31 de enero del año siguiente',
          `Total de retenciones del año → ${retencionAnual19.toFixed(2)}€`,
          'Debes incluir los datos del arrendador (nombre, NIF, dirección)',
          'Este modelo es meramente informativo, las retenciones ya se pagaron trimestralmente con el Modelo 115',
        ],
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate Modelo 390 (Resumen anual de IVA)
 * GET /api/tax/modelo-390/:year
 */
export const getModelo390 = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { year } = req.params;
    const targetYear = parseInt(year);

    // Get annual IVA totals
    const ivaRepercutidoResult = await query(
      `SELECT
        COALESCE(SUM(base_imponible), 0) as base_total,
        COALESCE(SUM(cuota_iva), 0) as iva_total
       FROM facturas_emitidas
       WHERE user_id = $1
         AND EXTRACT(YEAR FROM fecha_emision) = $2`,
      [req.user.id, targetYear]
    );

    const ivaSoportadoResult = await query(
      `SELECT
        COALESCE(SUM(base_imponible), 0) as base_total,
        COALESCE(SUM(cuota_iva), 0) as iva_total
       FROM expenses
       WHERE user_id = $1
         AND es_deducible = true
         AND EXTRACT(YEAR FROM fecha_emision) = $2`,
      [req.user.id, targetYear]
    );

    const baseRepercutidaAnual = parseFloat(ivaRepercutidoResult.rows[0].base_total);
    const ivaRepercutidoAnual = parseFloat(ivaRepercutidoResult.rows[0].iva_total);
    const baseSoportadaAnual = parseFloat(ivaSoportadoResult.rows[0].base_total);
    const ivaSoportadoAnual = parseFloat(ivaSoportadoResult.rows[0].iva_total);

    const resultadoAnual = Math.round((ivaRepercutidoAnual - ivaSoportadoAnual) * 100) / 100;

    // Get quarterly breakdown
    const trimestres = [];
    for (let t = 1; t <= 4; t++) {
      const periodo = obtenerPeriodoTrimestre(t, targetYear);

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
      const resultado303 = calcularModelo303(ivaRep, ivaSop);

      trimestres.push({
        trimestre: t,
        iva_repercutido: resultado303.iva_repercutido,
        iva_soportado: resultado303.iva_soportado,
        resultado: resultado303.resultado,
      });
    }

    // Determinar acción
    let accion = 'INFORMATIVO';
    if (resultadoAnual > 0) {
      accion = 'INFORMATIVO - Ya pagado trimestralmente';
    } else if (resultadoAnual < 0) {
      accion = 'INFORMATIVO - Compensaciones ya aplicadas';
    }

    const response: ApiResponse = {
      success: true,
      data: {
        modelo: '390',
        ano: targetYear,
        fecha_limite_presentacion: `${targetYear + 1}-01-30`,

        resumen_anual: {
          base_imponible_total: baseRepercutidaAnual,
          iva_repercutido_total: ivaRepercutidoAnual,
          iva_soportado_total: ivaSoportadoAnual,
          resultado_total: resultadoAnual,
        },

        desglose_trimestral: trimestres,

        accion: accion,

        nota: 'El Modelo 390 es una declaración informativa anual que resume todas las operaciones de IVA del año. Es un resumen de los Modelo 303 trimestrales y debe coincidir con la suma de estos.',

        instrucciones: [
          'Accede a la Sede Electrónica de AEAT',
          'Modelo 390 > Declaración resumen anual del IVA',
          'Presenta antes del 30 de enero del año siguiente',
          `IVA Repercutido anual → ${ivaRepercutidoAnual.toFixed(2)}€`,
          `IVA Soportado anual → ${ivaSoportadoAnual.toFixed(2)}€`,
          `Resultado anual → ${resultadoAnual.toFixed(2)}€`,
          'Este modelo es informativo, los pagos ya se realizaron trimestralmente con el Modelo 303',
          'Verifica que la suma de los 4 trimestres coincida con el total anual',
        ],
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get summary of all models for a year
 * GET /api/tax/summary/:year
 */
export const getTaxSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { year } = req.params;
    const targetYear = parseInt(year);

    // Calculate for all 4 quarters
    const modelos303 = [];
    const modelos130 = [];

    for (let trimestre = 1; trimestre <= 4; trimestre++) {
      const periodo = obtenerPeriodoTrimestre(trimestre, targetYear);

      // Modelo 303
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
      const resultado303 = calcularModelo303(ivaRep, ivaSop);

      modelos303.push({
        trimestre,
        iva_repercutido: resultado303.iva_repercutido,
        iva_soportado: resultado303.iva_soportado,
        resultado: resultado303.resultado,
        accion: resultado303.accion,
      });

      // Modelo 130
      const ingResult = await query(
        'SELECT COALESCE(SUM(base_imponible), 0) as total FROM facturas_emitidas WHERE user_id = $1 AND fecha_emision >= $2 AND fecha_emision <= $3',
        [req.user.id, periodo.inicio, periodo.fin]
      );
      const gastResult = await query(
        'SELECT COALESCE(SUM(base_imponible), 0) as total FROM expenses WHERE user_id = $1 AND es_deducible = true AND fecha_emision >= $2 AND fecha_emision <= $3',
        [req.user.id, periodo.inicio, periodo.fin]
      );
      const retResult = await query(
        'SELECT COALESCE(SUM(cuota_irpf), 0) as total FROM facturas_emitidas WHERE user_id = $1 AND fecha_emision >= $2 AND fecha_emision <= $3',
        [req.user.id, periodo.inicio, periodo.fin]
      );

      const ing = parseFloat(ingResult.rows[0].total);
      const gast = parseFloat(gastResult.rows[0].total);
      const ret = parseFloat(retResult.rows[0].total);
      const resultado130 = calcularModelo130(ing, gast, ret);

      modelos130.push({
        trimestre,
        ingresos: resultado130.ingresos_computables,
        gastos: resultado130.gastos_deducibles,
        rendimiento_neto: resultado130.rendimiento_neto,
        pago_fraccionado: resultado130.pago_fraccionado,
        resultado: resultado130.resultado,
        accion: resultado130.accion,
      });
    }

    const response: ApiResponse = {
      success: true,
      data: {
        ano: targetYear,
        modelos_303: modelos303,
        modelos_130: modelos130,
        totales: {
          iva_total_anual: modelos303.reduce((sum, m) => sum + m.resultado, 0),
          irpf_total_anual: modelos130.reduce((sum, m) => sum + m.resultado, 0),
        },
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

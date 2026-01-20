import { Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { query, getClient } from '../config/database';
import { ApiResponse, AuthRequest, Expense } from '../types';
import { BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import config from '../config';
import {
  calcularCuotaIVA,
  calcularCuotaIRPF,
  calcularTotalGasto,
  validarCIFoNIF,
} from '../utils/taxCalculations';
import {
  detectarCategoriaGasto,
  esGastoIndependencia,
  calcularNivelRiesgoGasto,
} from '../utils/helpers';
import { extractInvoiceData } from '../services/visionOCR.service';
import type { ScheduleConfig, Periodicidad, TipoDia, Programacion } from '../utils/schedule-calculator';
import { calculateScheduledDates, validateScheduleConfig, calculateExtensionDates, formatDateLocal } from '../utils/schedule-calculator';

/**
 * Get all expenses for authenticated user
 * GET /api/expenses
 */
export const getExpenses = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const {
      fecha_desde,
      fecha_hasta,
      categoria,
      es_deducible,
      nivel_riesgo,
      pagado,
      page = '1',
      limit = '50',
    } = req.query;

    let whereConditions = ['user_id = $1'];
    const params: any[] = [req.user.id];
    let paramIndex = 2;

    if (fecha_desde) {
      whereConditions.push(`fecha_emision >= $${paramIndex}`);
      params.push(fecha_desde);
      paramIndex++;
    }

    if (fecha_hasta) {
      whereConditions.push(`fecha_emision <= $${paramIndex}`);
      params.push(fecha_hasta);
      paramIndex++;
    }

    if (categoria) {
      whereConditions.push(`categoria = $${paramIndex}`);
      params.push(categoria);
      paramIndex++;
    }

    if (es_deducible !== undefined) {
      whereConditions.push(`es_deducible = $${paramIndex}`);
      params.push(es_deducible === 'true');
      paramIndex++;
    }

    if (nivel_riesgo) {
      whereConditions.push(`nivel_riesgo = $${paramIndex}`);
      params.push(nivel_riesgo);
      paramIndex++;
    }

    if (pagado !== undefined) {
      whereConditions.push(`pagado = $${paramIndex}`);
      params.push(pagado === 'true');
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get expenses
    const result = await query(
      `SELECT * FROM expenses
       WHERE ${whereClause}
       ORDER BY fecha_emision DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), (parseInt(page as string) - 1) * parseInt(limit as string)]
    );

    // Get totals
    const totalsResult = await query(
      `SELECT
        COUNT(*) as total_count,
        SUM(base_imponible) as suma_base_imponible,
        SUM(cuota_iva) FILTER (WHERE es_deducible = true) as suma_iva_deducible
       FROM expenses
       WHERE ${whereClause}`,
      params
    );

    const response: ApiResponse = {
      success: true,
      data: result.rows,
      meta: {
        total: parseInt(totalsResult.rows[0].total_count) || 0,
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 50,
        suma_base_imponible: parseFloat(totalsResult.rows[0].suma_base_imponible || '0') || 0,
        suma_iva_deducible: parseFloat(totalsResult.rows[0].suma_iva_deducible || '0') || 0,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single expense
 * GET /api/expenses/:id
 */
export const getExpense = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    const result = await query(
      'SELECT * FROM expenses WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('Gasto no encontrado');
    }

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Extract invoice data from uploaded image using Vision API
 * POST /api/expenses/extract-from-invoice
 */
export const extractFromInvoice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    // Check if file was uploaded
    if (!req.file) {
      throw BadRequestError('No se ha subido ningún archivo');
    }

    const filePath = req.file.path;
    const fileName = req.file.filename;
    const fileType = req.file.mimetype;

    console.log(`Processing invoice OCR for user ${req.user.id}: ${fileName}`);

    // Extract data using Vision API
    const ocrResult = await extractInvoiceData(filePath);

    // Calculate cuota_iva and cuota_irpf if missing
    if (ocrResult.data.base_imponible && ocrResult.data.tipo_iva !== undefined) {
      if (!ocrResult.data.cuota_iva) {
        ocrResult.data.cuota_iva = calcularCuotaIVA(
          ocrResult.data.base_imponible,
          ocrResult.data.tipo_iva
        );
      }
    }

    if (ocrResult.data.base_imponible && ocrResult.data.tipo_irpf !== undefined) {
      if (!ocrResult.data.cuota_irpf) {
        ocrResult.data.cuota_irpf = calcularCuotaIRPF(
          ocrResult.data.base_imponible,
          ocrResult.data.tipo_irpf
        );
      }
    }

    // Generate relative file URL
    const relativeFileUrl = `/uploads/documents/${req.user.id}/${new Date().getFullYear()}/${fileName}`;

    const response: ApiResponse = {
      success: true,
      data: {
        extracted: ocrResult.data,
        confidence: ocrResult.confidence,
        requiresReview: ocrResult.requiresReview,
        archivo_url: relativeFileUrl,
        archivo_nombre: req.file.originalname,
        archivo_tipo: fileType,
      },
      warnings: ocrResult.requiresReview
        ? ['Los datos extraídos requieren revisión. Por favor, verifica la información antes de guardar.']
        : [],
      info: [
        `Confianza de extracción: ${ocrResult.confidence}%`,
        'Revisa los datos extraídos antes de guardar el gasto',
      ],
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Create expense manually
 * POST /api/expenses
 */
export const createExpense = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const {
      concepto,
      descripcion,
      categoria,
      fecha_emision,
      numero_factura,
      proveedor_nombre,
      proveedor_cif,
      base_imponible,
      tipo_iva = 21.0,
      tipo_irpf = 0.0,
      porcentaje_deducible = 100.0,
      es_deducible = true,
      // OCR metadata
      ocr_procesado = false,
      ocr_confianza,
      ocr_datos_extraidos,
      archivo_url,
      archivo_nombre,
      archivo_tipo,
    } = req.body;

    // Validate NIF/CIF if provided
    if (proveedor_cif && !validarCIFoNIF(proveedor_cif)) {
      throw BadRequestError('NIF/CIF del proveedor inválido');
    }

    // Auto-detect category if not provided
    const categoriaFinal = categoria || detectarCategoriaGasto(concepto);

    // Calculate amounts
    const cuota_iva = calcularCuotaIVA(base_imponible, tipo_iva);
    const cuota_irpf = tipo_irpf > 0 ? calcularCuotaIRPF(base_imponible, tipo_irpf) : 0;
    const total_factura = calcularTotalGasto(base_imponible, cuota_iva, cuota_irpf);

    // Detect if it's an independence expense (TRADE requirement)
    const es_gasto_independencia_detected = esGastoIndependencia(categoriaFinal, concepto);

    // Calculate risk level
    const nivel_riesgo = calcularNivelRiesgoGasto(
      categoriaFinal,
      new Date(fecha_emision),
      base_imponible
    );

    // Insert expense
    const result = await query(
      `INSERT INTO expenses (
        user_id, concepto, descripcion, categoria, fecha_emision, numero_factura,
        proveedor_nombre, proveedor_cif, base_imponible, tipo_iva, cuota_iva,
        tipo_irpf, cuota_irpf, total_factura, porcentaje_deducible, es_deducible,
        es_gasto_independencia, nivel_riesgo,
        ocr_procesado, ocr_confianza, ocr_datos_extraidos, archivo_url, archivo_nombre, archivo_tipo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING *`,
      [
        req.user.id,
        concepto,
        descripcion || null,
        categoriaFinal,
        fecha_emision,
        numero_factura || null,
        proveedor_nombre,
        proveedor_cif || null,
        base_imponible,
        tipo_iva,
        cuota_iva,
        tipo_irpf,
        cuota_irpf,
        total_factura,
        porcentaje_deducible,
        es_deducible,
        es_gasto_independencia_detected,
        nivel_riesgo,
        // OCR metadata
        ocr_procesado,
        ocr_confianza || null,
        ocr_datos_extraidos ? JSON.stringify(ocr_datos_extraidos) : null,
        archivo_url || null,
        archivo_nombre || null,
        archivo_tipo || null,
      ]
    );

    const expense = result.rows[0];

    // Generate alerts if needed
    const alerts = [];

    if (es_gasto_independencia_detected) {
      alerts.push({
        tipo: 'success',
        mensaje: 'Gasto de independencia registrado (importante para TRADE)',
      });
    }

    if (nivel_riesgo === 'ALTO') {
      alerts.push({
        tipo: 'warning',
        mensaje: 'Este gasto tiene nivel de riesgo ALTO. Asegúrate de tener justificación adecuada.',
      });
    }

    const response: ApiResponse = {
      success: true,
      data: expense,
      alerts,
      info: [
        `IVA deducible: ${cuota_iva.toFixed(2)}€`,
        ...(cuota_irpf > 0 ? [`IRPF recuperable: ${cuota_irpf.toFixed(2)}€`] : []),
      ],
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Update expense
 * PATCH /api/expenses/:id
 */
export const updateExpense = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    // Check if expense exists
    const existing = await query(
      'SELECT id FROM expenses WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (existing.rows.length === 0) {
      throw NotFoundError('Gasto no encontrado');
    }

    const {
      concepto,
      descripcion,
      categoria,
      fecha_emision,
      numero_factura,
      proveedor_nombre,
      proveedor_cif,
      base_imponible,
      tipo_iva,
      tipo_irpf,
      porcentaje_deducible,
      es_deducible,
      pagado,
      fecha_pago,
      ocr_procesado,
      ocr_confianza,
      ocr_datos_extraidos,
      archivo_url,
      archivo_nombre,
      archivo_tipo,
    } = req.body;

    // Build update query dynamically
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Calculate financial values if base or rates are being updated
    let cuota_iva: number | undefined;
    let cuota_irpf: number | undefined;
    let total_factura: number | undefined;

    if (base_imponible !== undefined || tipo_iva !== undefined || tipo_irpf !== undefined) {
      // Get current values if we need them for calculation
      const currentExpense = await query(
        'SELECT base_imponible, tipo_iva, tipo_irpf FROM expenses WHERE id = $1',
        [id]
      );
      const currentData = currentExpense.rows[0];

      const finalBase = base_imponible !== undefined ? parseFloat(base_imponible) : parseFloat(currentData.base_imponible);
      const finalTipoIva = tipo_iva !== undefined ? parseFloat(tipo_iva) : parseFloat(currentData.tipo_iva);
      const finalTipoIrpf = tipo_irpf !== undefined ? parseFloat(tipo_irpf) : parseFloat(currentData.tipo_irpf);

      // Recalculate
      cuota_iva = calcularCuotaIVA(finalBase, finalTipoIva);
      cuota_irpf = finalTipoIrpf > 0 ? calcularCuotaIRPF(finalBase, finalTipoIrpf) : 0;
      total_factura = calcularTotalGasto(finalBase, cuota_iva, cuota_irpf);
    }

    if (concepto !== undefined) {
      updates.push(`concepto = $${paramIndex++}`);
      params.push(concepto);
    }
    if (descripcion !== undefined) {
      updates.push(`descripcion = $${paramIndex++}`);
      params.push(descripcion);
    }
    if (categoria !== undefined) {
      updates.push(`categoria = $${paramIndex++}`);
      params.push(categoria);
    }
    if (fecha_emision !== undefined) {
      updates.push(`fecha_emision = $${paramIndex++}`);
      params.push(fecha_emision || null);
    }
    if (numero_factura !== undefined) {
      updates.push(`numero_factura = $${paramIndex++}`);
      params.push(numero_factura);
    }
    if (proveedor_nombre !== undefined) {
      updates.push(`proveedor_nombre = $${paramIndex++}`);
      params.push(proveedor_nombre);
    }
    if (proveedor_cif !== undefined) {
      updates.push(`proveedor_cif = $${paramIndex++}`);
      params.push(proveedor_cif);
    }
    if (base_imponible !== undefined) {
      updates.push(`base_imponible = $${paramIndex++}`);
      params.push(parseFloat(base_imponible));
    }
    if (tipo_iva !== undefined) {
      updates.push(`tipo_iva = $${paramIndex++}`);
      params.push(parseFloat(tipo_iva));
    }
    if (tipo_irpf !== undefined) {
      updates.push(`tipo_irpf = $${paramIndex++}`);
      params.push(parseFloat(tipo_irpf));
    }
    if (cuota_iva !== undefined) {
      updates.push(`cuota_iva = $${paramIndex++}`);
      params.push(cuota_iva);
    }
    if (cuota_irpf !== undefined) {
      updates.push(`cuota_irpf = $${paramIndex++}`);
      params.push(cuota_irpf);
    }
    if (total_factura !== undefined) {
      updates.push(`total_factura = $${paramIndex++}`);
      params.push(total_factura);
    }
    if (porcentaje_deducible !== undefined) {
      updates.push(`porcentaje_deducible = $${paramIndex++}`);
      params.push(parseFloat(porcentaje_deducible));
    }
    if (es_deducible !== undefined) {
      updates.push(`es_deducible = $${paramIndex++}`);
      params.push(es_deducible);
    }
    if (pagado !== undefined) {
      updates.push(`pagado = $${paramIndex++}`);
      params.push(pagado);
    }
    if (fecha_pago !== undefined) {
      updates.push(`fecha_pago = $${paramIndex++}`);
      params.push(fecha_pago || null);
    }
    // OCR and file metadata fields
    if (ocr_procesado !== undefined) {
      updates.push(`ocr_procesado = $${paramIndex++}`);
      params.push(ocr_procesado);
    }
    if (ocr_confianza !== undefined) {
      updates.push(`ocr_confianza = $${paramIndex++}`);
      params.push(ocr_confianza);
    }
    if (ocr_datos_extraidos !== undefined) {
      updates.push(`ocr_datos_extraidos = $${paramIndex++}`);
      params.push(ocr_datos_extraidos ? JSON.stringify(ocr_datos_extraidos) : null);
    }
    if (archivo_url !== undefined) {
      updates.push(`archivo_url = $${paramIndex++}`);
      params.push(archivo_url);
    }
    if (archivo_nombre !== undefined) {
      updates.push(`archivo_nombre = $${paramIndex++}`);
      params.push(archivo_nombre);
    }
    if (archivo_tipo !== undefined) {
      updates.push(`archivo_tipo = $${paramIndex++}`);
      params.push(archivo_tipo);
    }

    if (updates.length === 0) {
      throw BadRequestError('No hay campos para actualizar');
    }

    params.push(id, req.user.id);

    const result = await query(
      `UPDATE expenses SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING *`,
      params
    );

    const updatedExpense = result.rows[0];

    // Build info messages similar to createExpense
    const infoMessages: string[] = [];
    if (updatedExpense.cuota_iva && updatedExpense.es_deducible) {
      infoMessages.push(`IVA deducible: ${parseFloat(updatedExpense.cuota_iva).toFixed(2)}€`);
    }
    if (updatedExpense.cuota_irpf && parseFloat(updatedExpense.cuota_irpf) > 0) {
      infoMessages.push(`IRPF recuperable: ${parseFloat(updatedExpense.cuota_irpf).toFixed(2)}€`);
    }

    const response: ApiResponse = {
      success: true,
      data: updatedExpense,
      alerts: [],
      info: infoMessages,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete expense
 * DELETE /api/expenses/:id
 */
export const deleteExpense = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    const result = await query(
      'DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('Gasto no encontrado');
    }

    const response: ApiResponse = {
      success: true,
      data: { id: result.rows[0].id },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Check independence expenses for a given month (TRADE requirement)
 * GET /api/expenses/independence-check/:year/:month
 */
export const checkIndependenceExpenses = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { year, month } = req.params;

    const requiredExpenses = ['Alquiler', 'Suministros'];

    // Get independence expenses for the month
    const result = await query(
      `SELECT categoria, concepto, base_imponible, proveedor_nombre
       FROM expenses
       WHERE user_id = $1
         AND es_gasto_independencia = true
         AND EXTRACT(YEAR FROM fecha_emision) = $2
         AND EXTRACT(MONTH FROM fecha_emision) = $3`,
      [req.user.id, year, month]
    );

    const expensesRegistrados: any = {
      Alquiler: result.rows.find((e) => e.categoria === 'Alquiler'),
      Electricidad: result.rows.find((e) => e.concepto.toLowerCase().includes('electric')),
      Internet: result.rows.find((e) => e.concepto.toLowerCase().includes('internet')),
    };

    const gastosRegistrados = [
      {
        tipo: 'Alquiler',
        presente: !!expensesRegistrados.Alquiler,
        importe: expensesRegistrados.Alquiler?.base_imponible || 0,
        a_nombre_propio: true,
        warning: !expensesRegistrados.Alquiler ? 'Falta factura de alquiler' : null,
      },
      {
        tipo: 'Electricidad',
        presente: !!expensesRegistrados.Electricidad,
        importe: expensesRegistrados.Electricidad?.base_imponible || 0,
        a_nombre_propio: true,
        warning: !expensesRegistrados.Electricidad ? 'Falta factura de electricidad' : null,
      },
      {
        tipo: 'Internet',
        presente: !!expensesRegistrados.Internet,
        importe: expensesRegistrados.Internet?.base_imponible || 0,
        a_nombre_propio: true,
        warning: !expensesRegistrados.Internet ? 'Falta factura de internet' : null,
      },
    ];

    const cumpleRequisitos = gastosRegistrados.every((g) => g.presente);

    const alertasGeneradas = gastosRegistrados
      .filter((g) => !g.presente)
      .map((g) => ({
        severidad: 'WARNING',
        mensaje: `Falta registrar ${g.tipo} de ${month}/${year} a tu nombre`,
      }));

    const response: ApiResponse = {
      success: true,
      data: {
        mes: parseInt(month),
        ano: parseInt(year),
        gastos_independencia_requeridos: ['Alquiler local', 'Electricidad', 'Internet'],
        gastos_registrados: gastosRegistrados,
        cumple_requisitos: cumpleRequisitos,
        alertas_generadas: alertasGeneradas,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Mark expense as paid
 * PATCH /api/expenses/:id/mark-paid
 */
export const markExpensePaid = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;
    const { fecha_pago } = req.body;

    const result = await query(
      `UPDATE expenses
       SET pagado = true,
           fecha_pago = $1,
           programacion_id = NULL
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [fecha_pago || new Date().toISOString().split('T')[0], id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('Gasto no encontrado');
    }

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
      info: ['Gasto marcado como pagado'],
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * View expense attached file
 * GET /api/expenses/:id/file
 */
export const viewExpenseFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    // Get expense with file info
    const result = await query(
      'SELECT archivo_url, archivo_nombre, archivo_tipo FROM expenses WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('Gasto no encontrado');
    }

    const expense = result.rows[0];

    if (!expense.archivo_url) {
      throw NotFoundError('Este gasto no tiene archivo adjunto');
    }

    // Build absolute path from relative URL
    // archivo_url is like: /uploads/documents/1/2026/filename.pdf
    // We need to convert it to an absolute path
    const relativePath = expense.archivo_url.replace(/^\/uploads\//, '');
    const absolutePath = path.resolve(config.upload.dir, relativePath);

    // Security check - prevent path traversal
    const uploadDir = path.resolve(config.upload.dir);
    if (!absolutePath.startsWith(uploadDir)) {
      throw ForbiddenError('Acceso denegado');
    }

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      throw NotFoundError('Archivo no encontrado en el sistema');
    }

    // Determine content type
    const mimeType = expense.archivo_tipo || 'application/octet-stream';

    // Set headers for inline viewing
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${expense.archivo_nombre || 'archivo'}"`);

    // Stream the file
    const fileStream = fs.createReadStream(absolutePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Create multiple scheduled expenses
 * POST /api/expenses/create-scheduled
 */
export const createScheduledExpenses = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const {
      // Schedule configuration
      periodicidad,
      tipo_dia,
      dia_especifico,
      fecha_inicio,
      fecha_fin,
      nombre,
      target_end_year, // From frontend - max year in dropdown
      // Expense template data
      concepto,
      descripcion,
      categoria,
      proveedor_nombre,
      proveedor_cif,
      base_imponible,
      tipo_iva = 21.0,
      tipo_irpf = 0.0,
      porcentaje_deducible = 100.0,
      es_deducible = true,
      // Contract fields (optional)
      contrato_document_id,
      contrato_datos_extraidos,
      contrato_confianza,
    } = req.body;

    // Validate required fields
    if (!periodicidad || !tipo_dia || !fecha_inicio || !concepto || !proveedor_nombre || !base_imponible) {
      throw BadRequestError('Faltan campos requeridos: periodicidad, tipo_dia, fecha_inicio, concepto, proveedor_nombre, base_imponible');
    }

    // Validate NIF/CIF if provided
    if (proveedor_cif && !validarCIFoNIF(proveedor_cif)) {
      throw BadRequestError('NIF/CIF del proveedor inválido');
    }

    // If no fecha_fin, use target_end_year from frontend (years in dropdown) or fall back to database query
    let targetEndYear: number | undefined;
    if (!fecha_fin) {
      if (target_end_year) {
        // Use the year passed from frontend (from dropdown/localStorage)
        targetEndYear = parseInt(target_end_year);
      } else {
        // Fallback: query database for latest year
        const latestYearResult = await query(
          `SELECT GREATEST(
            COALESCE((SELECT MAX(EXTRACT(YEAR FROM fecha_emision)) FROM facturas_emitidas WHERE user_id = $1), EXTRACT(YEAR FROM CURRENT_DATE)),
            COALESCE((SELECT MAX(EXTRACT(YEAR FROM fecha_emision)) FROM expenses WHERE user_id = $1), EXTRACT(YEAR FROM CURRENT_DATE)),
            EXTRACT(YEAR FROM CURRENT_DATE)
          ) as latest_year`,
          [req.user.id]
        );
        targetEndYear = parseInt(latestYearResult.rows[0].latest_year);
      }
    }

    const scheduleConfig: ScheduleConfig = {
      periodicidad: periodicidad as Periodicidad,
      tipo_dia: tipo_dia as TipoDia,
      dia_especifico: dia_especifico ? parseInt(dia_especifico) : undefined,
      fecha_inicio: new Date(fecha_inicio),
      fecha_fin: fecha_fin ? new Date(fecha_fin) : null,
      targetEndYear
    };

    // Validate schedule configuration
    const validation = validateScheduleConfig(scheduleConfig);
    if (!validation.valid) {
      throw BadRequestError(validation.error || 'Configuración de programación inválida');
    }

    // Calculate all dates
    const dates = calculateScheduledDates(scheduleConfig);

    if (dates.length === 0) {
      throw BadRequestError('No se generaría ningún gasto con esta configuración');
    }

    // Auto-detect category if not provided
    const categoriaFinal = categoria || detectarCategoriaGasto(concepto);

    // Create programacion record
    const programacionResult = await query(
      `INSERT INTO programaciones (user_id, tipo, nombre, periodicidad, tipo_dia, dia_especifico, fecha_inicio, fecha_fin, datos_base, total_generados, ultimo_ano_generado, contrato_document_id, contrato_datos_extraidos, contrato_confianza)
       VALUES ($1, 'GASTO', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        req.user.id,
        nombre || `Programación ${concepto.substring(0, 50)}`,
        periodicidad,
        tipo_dia,
        dia_especifico || null,
        fecha_inicio,
        fecha_fin || null,
        JSON.stringify({ concepto, descripcion, categoria: categoriaFinal, proveedor_nombre, proveedor_cif, base_imponible, tipo_iva, tipo_irpf, porcentaje_deducible, es_deducible }),
        dates.length,
        dates[dates.length - 1].getFullYear(),
        contrato_document_id || null,
        contrato_datos_extraidos ? JSON.stringify(contrato_datos_extraidos) : null,
        contrato_confianza || null
      ]
    );

    const programacionId = programacionResult.rows[0].id;

    // Calculate amounts
    const cuota_iva = calcularCuotaIVA(base_imponible, tipo_iva);
    const cuota_irpf = tipo_irpf > 0 ? calcularCuotaIRPF(base_imponible, tipo_irpf) : 0;
    const total_factura = calcularTotalGasto(base_imponible, cuota_iva, cuota_irpf);

    // Detect if it's an independence expense (TRADE requirement)
    const es_gasto_independencia_detected = esGastoIndependencia(categoriaFinal, concepto);

    // Generate expenses for each date
    const createdExpenses: any[] = [];
    const errors: string[] = [];

    for (const date of dates) {
      try {
        const fecha_emision = formatDateLocal(date);

        // Calculate risk level for this specific date
        const nivel_riesgo = calcularNivelRiesgoGasto(categoriaFinal, date, base_imponible);

        // Insert expense
        const result = await query(
          `INSERT INTO expenses (
            user_id, concepto, descripcion, categoria, fecha_emision,
            proveedor_nombre, proveedor_cif, base_imponible, tipo_iva, cuota_iva,
            tipo_irpf, cuota_irpf, total_factura, porcentaje_deducible, es_deducible,
            es_gasto_independencia, nivel_riesgo, programacion_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          RETURNING *`,
          [
            req.user.id,
            concepto,
            descripcion || null,
            categoriaFinal,
            fecha_emision,
            proveedor_nombre,
            proveedor_cif || null,
            base_imponible,
            tipo_iva,
            cuota_iva,
            tipo_irpf,
            cuota_irpf,
            total_factura,
            porcentaje_deducible,
            es_deducible,
            es_gasto_independencia_detected,
            nivel_riesgo,
            programacionId
          ]
        );

        createdExpenses.push(result.rows[0]);
      } catch (err: any) {
        errors.push(`Error generando gasto para ${formatDateLocal(date)}: ${err.message}`);
      }
    }

    const response: ApiResponse = {
      success: true,
      data: {
        programacion_id: programacionId,
        total_created: createdExpenses.length,
        expenses: createdExpenses
      },
      info: [
        `Se han generado ${createdExpenses.length} gastos programados`,
        `IVA deducible total: ${(cuota_iva * createdExpenses.length).toFixed(2)}€`
      ],
      ...(errors.length > 0 && { warning: errors })
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Extend scheduled expenses to a new year
 * POST /api/expenses/extend-year/:year
 */
export const extendYearExpenses = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { year } = req.params;
    const targetYear = parseInt(year);

    if (isNaN(targetYear) || targetYear < 2020 || targetYear > 2100) {
      throw BadRequestError('Año inválido');
    }

    // Get all active programaciones for this user of type GASTO
    const programacionesResult = await query(
      `SELECT * FROM programaciones
       WHERE user_id = $1 AND tipo = 'GASTO'
       AND (fecha_fin IS NULL OR EXTRACT(YEAR FROM fecha_fin) >= $2)
       AND (ultimo_ano_generado IS NULL OR ultimo_ano_generado < $2)`,
      [req.user.id, targetYear]
    );

    if (programacionesResult.rows.length === 0) {
      return res.json({
        success: true,
        data: { total_created: 0, message: 'No hay programaciones de gastos pendientes de extender' }
      });
    }

    let totalCreated = 0;
    const createdByProgramacion: any[] = [];

    for (const prog of programacionesResult.rows) {
      const programacion: Programacion = {
        id: prog.id,
        periodicidad: prog.periodicidad,
        tipo_dia: prog.tipo_dia,
        dia_especifico: prog.dia_especifico,
        fecha_inicio: new Date(prog.fecha_inicio),
        fecha_fin: prog.fecha_fin ? new Date(prog.fecha_fin) : null,
        ultimo_ano_generado: prog.ultimo_ano_generado
      };

      const dates = calculateExtensionDates(programacion, targetYear);

      if (dates.length === 0) continue;

      const datosBase = prog.datos_base;
      const {
        concepto,
        descripcion,
        categoria,
        proveedor_nombre,
        proveedor_cif,
        base_imponible,
        tipo_iva = 21.0,
        tipo_irpf = 0.0,
        porcentaje_deducible = 100.0,
        es_deducible = true
      } = datosBase;

      // Calculate amounts
      const cuota_iva = calcularCuotaIVA(base_imponible, tipo_iva);
      const cuota_irpf = tipo_irpf > 0 ? calcularCuotaIRPF(base_imponible, tipo_irpf) : 0;
      const total_factura = calcularTotalGasto(base_imponible, cuota_iva, cuota_irpf);
      const es_gasto_independencia_detected = esGastoIndependencia(categoria, concepto);

      let createdForThisProg = 0;

      for (const date of dates) {
        const fecha_emision = formatDateLocal(date);
        const nivel_riesgo = calcularNivelRiesgoGasto(categoria, date, base_imponible);

        await query(
          `INSERT INTO expenses (
            user_id, concepto, descripcion, categoria, fecha_emision,
            proveedor_nombre, proveedor_cif, base_imponible, tipo_iva, cuota_iva,
            tipo_irpf, cuota_irpf, total_factura, porcentaje_deducible, es_deducible,
            es_gasto_independencia, nivel_riesgo, programacion_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
          [
            req.user.id,
            concepto,
            descripcion || null,
            categoria,
            fecha_emision,
            proveedor_nombre,
            proveedor_cif || null,
            base_imponible,
            tipo_iva,
            cuota_iva,
            tipo_irpf,
            cuota_irpf,
            total_factura,
            porcentaje_deducible,
            es_deducible,
            es_gasto_independencia_detected,
            nivel_riesgo,
            prog.id
          ]
        );

        createdForThisProg++;
        totalCreated++;
      }

      // Update programacion with new count and last year
      await query(
        `UPDATE programaciones SET
          total_generados = total_generados + $1,
          ultimo_ano_generado = $2,
          updated_at = NOW()
         WHERE id = $3`,
        [createdForThisProg, targetYear, prog.id]
      );

      createdByProgramacion.push({
        programacion_id: prog.id,
        nombre: prog.nombre,
        created: createdForThisProg
      });
    }

    const response: ApiResponse = {
      success: true,
      data: {
        year: targetYear,
        total_created: totalCreated,
        by_programacion: createdByProgramacion
      },
      info: [`Se han generado ${totalCreated} gastos para el año ${targetYear}`]
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get programacion info for an expense (to check if it belongs to a series)
 * GET /api/expenses/:id/programacion
 */
export const getExpenseProgramacion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    const result = await query(
      `SELECT
        e.programacion_id,
        p.nombre as programacion_nombre,
        p.frecuencia,
        (SELECT COUNT(*) FROM expenses WHERE programacion_id = e.programacion_id) as total_en_serie
       FROM expenses e
       LEFT JOIN programaciones p ON e.programacion_id = p.id
       WHERE e.id = $1 AND e.user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('Gasto no encontrado');
    }

    const data = result.rows[0];

    res.json({
      success: true,
      data: {
        programacion_id: data.programacion_id,
        programacion_nombre: data.programacion_nombre,
        frecuencia: data.frecuencia,
        total_en_serie: data.programacion_id ? parseInt(data.total_en_serie) : 0,
        pertenece_a_serie: !!data.programacion_id
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete expense with option to delete all in series
 * DELETE /api/expenses/:id/with-series
 */
export const deleteExpenseWithSeries = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;
    const { deleteAll } = req.query;
    const shouldDeleteAll = deleteAll === 'true';

    // Get expense and check if it belongs to a series
    const check = await query(
      'SELECT id, programacion_id, concepto FROM expenses WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (check.rows.length === 0) {
      throw NotFoundError('Gasto no encontrado');
    }

    const expense = check.rows[0];

    if (shouldDeleteAll && expense.programacion_id) {
      // Delete all expenses in the series
      const deleteResult = await query(
        `DELETE FROM expenses
         WHERE programacion_id = $1 AND user_id = $2
         RETURNING id, concepto`,
        [expense.programacion_id, req.user.id]
      );

      // Also delete the programacion if all expenses are deleted
      const remainingCount = await query(
        'SELECT COUNT(*) as count FROM expenses WHERE programacion_id = $1',
        [expense.programacion_id]
      );

      if (parseInt(remainingCount.rows[0].count) === 0) {
        await query('DELETE FROM programaciones WHERE id = $1', [expense.programacion_id]);
      }

      res.json({
        success: true,
        data: {
          deleted_count: deleteResult.rowCount,
          deleted_expenses: deleteResult.rows
        },
        info: [`Se han eliminado ${deleteResult.rowCount} gastos de la serie`]
      });
    } else {
      // Delete only this expense
      await query(
        'DELETE FROM expenses WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );

      res.json({
        success: true,
        data: { id, concepto: expense.concepto },
        info: [`Gasto "${expense.concepto}" eliminado`]
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Update expense with option to apply to all in series
 * PATCH /api/expenses/:id/with-series
 */
export const updateExpenseWithSeries = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;
    const { apply_to_all, ...updateData } = req.body;

    // Get expense and check if it belongs to a series
    const check = await query(
      'SELECT id, programacion_id FROM expenses WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (check.rows.length === 0) {
      throw NotFoundError('Gasto no encontrado');
    }

    const expense = check.rows[0];

    if (apply_to_all && expense.programacion_id) {
      // When updating all expenses in a series, file attachments are not allowed
      // (files are specific to individual expense instances)
      if (updateData.archivo_url !== undefined || updateData.archivo_nombre !== undefined || updateData.archivo_tipo !== undefined) {
        throw BadRequestError('No se pueden adjuntar archivos al editar toda la serie. Los archivos son específicos de gastos individuales.');
      }

      // Update all expenses in the series
      const allowedBulkFields = ['concepto', 'descripcion', 'proveedor_nombre', 'proveedor_cif', 'base_imponible', 'tipo_iva', 'tipo_irpf', 'categoria'];
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      for (const field of allowedBulkFields) {
        if (updateData[field] !== undefined) {
          updates.push(`${field} = $${paramIndex++}`);
          params.push(updateData[field]);
        }
      }

      if (updates.length === 0) {
        throw BadRequestError('No hay campos para actualizar en lote');
      }

      // Recalculate financial fields if needed
      if (updateData.base_imponible !== undefined || updateData.tipo_iva !== undefined || updateData.tipo_irpf !== undefined) {
        const currentData = await query(
          'SELECT base_imponible, tipo_iva, tipo_irpf FROM expenses WHERE id = $1',
          [id]
        );
        const current = currentData.rows[0];

        const finalBase = updateData.base_imponible !== undefined ? parseFloat(updateData.base_imponible) : parseFloat(current.base_imponible);
        const finalTipoIva = updateData.tipo_iva !== undefined ? parseFloat(updateData.tipo_iva) : parseFloat(current.tipo_iva);
        const finalTipoIrpf = updateData.tipo_irpf !== undefined ? parseFloat(updateData.tipo_irpf) : parseFloat(current.tipo_irpf);

        const cuota_iva = calcularCuotaIVA(finalBase, finalTipoIva);
        const cuota_irpf = finalTipoIrpf > 0 ? calcularCuotaIRPF(finalBase, finalTipoIrpf) : 0;
        const total_factura = calcularTotalGasto(finalBase, cuota_iva, cuota_irpf);

        updates.push(`cuota_iva = $${paramIndex++}`);
        params.push(cuota_iva);
        updates.push(`cuota_irpf = $${paramIndex++}`);
        params.push(cuota_irpf);
        updates.push(`total_factura = $${paramIndex++}`);
        params.push(total_factura);
      }

      params.push(expense.programacion_id);
      params.push(req.user.id);

      const updateResult = await query(
        `UPDATE expenses SET ${updates.join(', ')}, updated_at = NOW()
         WHERE programacion_id = $${paramIndex++} AND user_id = $${paramIndex}
         RETURNING id, concepto`,
        params
      );

      // Update programacion datos_base too
      const newDatosBase = { ...updateData };
      await query(
        `UPDATE programaciones
         SET datos_base = datos_base || $1::jsonb, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(newDatosBase), expense.programacion_id]
      );

      res.json({
        success: true,
        data: {
          updated_count: updateResult.rowCount,
          updated_expenses: updateResult.rows
        },
        info: [`Se han actualizado ${updateResult.rowCount} gastos de la serie`]
      });
    } else {
      // Just update this one expense
      const {
        concepto,
        descripcion,
        proveedor_nombre,
        proveedor_cif,
        base_imponible,
        tipo_iva,
        tipo_irpf,
        categoria,
        pagado,
        fecha_pago,
        ocr_procesado,
        ocr_confianza,
        ocr_datos_extraidos,
        archivo_url,
        archivo_nombre,
        archivo_tipo
      } = updateData;

      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // If the expense belongs to a series and user chose "Solo esta factura",
      // remove it from the series so future bulk updates won't affect it
      if (expense.programacion_id) {
        updates.push(`programacion_id = NULL`);
      }

      if (concepto !== undefined) {
        updates.push(`concepto = $${paramIndex++}`);
        params.push(concepto);
      }
      if (descripcion !== undefined) {
        updates.push(`descripcion = $${paramIndex++}`);
        params.push(descripcion);
      }
      if (proveedor_nombre !== undefined) {
        updates.push(`proveedor_nombre = $${paramIndex++}`);
        params.push(proveedor_nombre);
      }
      if (proveedor_cif !== undefined) {
        updates.push(`proveedor_cif = $${paramIndex++}`);
        params.push(proveedor_cif);
      }
      if (base_imponible !== undefined) {
        updates.push(`base_imponible = $${paramIndex++}`);
        params.push(parseFloat(base_imponible));
      }
      if (tipo_iva !== undefined) {
        updates.push(`tipo_iva = $${paramIndex++}`);
        params.push(parseFloat(tipo_iva));
      }
      if (tipo_irpf !== undefined) {
        updates.push(`tipo_irpf = $${paramIndex++}`);
        params.push(parseFloat(tipo_irpf));
      }
      if (categoria !== undefined) {
        updates.push(`categoria = $${paramIndex++}`);
        params.push(categoria);
      }
      if (pagado !== undefined) {
        updates.push(`pagado = $${paramIndex++}`);
        params.push(pagado);
      }
      if (fecha_pago !== undefined) {
        updates.push(`fecha_pago = $${paramIndex++}`);
        params.push(fecha_pago || null);
      }
      // OCR and file metadata fields
      if (ocr_procesado !== undefined) {
        updates.push(`ocr_procesado = $${paramIndex++}`);
        params.push(ocr_procesado);
      }
      if (ocr_confianza !== undefined) {
        updates.push(`ocr_confianza = $${paramIndex++}`);
        params.push(ocr_confianza);
      }
      if (ocr_datos_extraidos !== undefined) {
        updates.push(`ocr_datos_extraidos = $${paramIndex++}`);
        params.push(ocr_datos_extraidos ? JSON.stringify(ocr_datos_extraidos) : null);
      }
      if (archivo_url !== undefined) {
        updates.push(`archivo_url = $${paramIndex++}`);
        params.push(archivo_url);
      }
      if (archivo_nombre !== undefined) {
        updates.push(`archivo_nombre = $${paramIndex++}`);
        params.push(archivo_nombre);
      }
      if (archivo_tipo !== undefined) {
        updates.push(`archivo_tipo = $${paramIndex++}`);
        params.push(archivo_tipo);
      }

      // Recalculate if needed
      if (base_imponible !== undefined || tipo_iva !== undefined || tipo_irpf !== undefined) {
        const currentData = await query(
          'SELECT base_imponible, tipo_iva, tipo_irpf FROM expenses WHERE id = $1',
          [id]
        );
        const current = currentData.rows[0];

        const finalBase = base_imponible !== undefined ? parseFloat(base_imponible) : parseFloat(current.base_imponible);
        const finalTipoIva = tipo_iva !== undefined ? parseFloat(tipo_iva) : parseFloat(current.tipo_iva);
        const finalTipoIrpf = tipo_irpf !== undefined ? parseFloat(tipo_irpf) : parseFloat(current.tipo_irpf);

        const cuota_iva = calcularCuotaIVA(finalBase, finalTipoIva);
        const cuota_irpf = finalTipoIrpf > 0 ? calcularCuotaIRPF(finalBase, finalTipoIrpf) : 0;
        const total_factura = calcularTotalGasto(finalBase, cuota_iva, cuota_irpf);

        updates.push(`cuota_iva = $${paramIndex++}`);
        params.push(cuota_iva);
        updates.push(`cuota_irpf = $${paramIndex++}`);
        params.push(cuota_irpf);
        updates.push(`total_factura = $${paramIndex++}`);
        params.push(total_factura);
      }

      if (updates.length === 0) {
        throw BadRequestError('No hay campos para actualizar');
      }

      params.push(id, req.user.id);

      const result = await query(
        `UPDATE expenses SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
         RETURNING *`,
        params
      );

      res.json({
        success: true,
        data: result.rows[0],
        info: ['Gasto actualizado correctamente']
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Delete all expenses for a specific year
 * DELETE /api/expenses/by-year/:year
 */
export const deleteByYear = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await getClient();

  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { year } = req.params;
    const targetYear = parseInt(year);

    if (isNaN(targetYear) || targetYear < 2020 || targetYear > 2100) {
      throw BadRequestError('Año inválido');
    }

    await client.query('BEGIN');

    // Get count before deletion
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM expenses
       WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2`,
      [req.user.id, targetYear]
    );
    const totalToDelete = parseInt(countResult.rows[0].count);

    if (totalToDelete === 0) {
      await client.query('COMMIT');
      return res.json({
        success: true,
        data: { total_deleted: 0, message: `No hay gastos para eliminar en ${targetYear}` }
      });
    }

    // Get programacion IDs that will be affected
    const programacionIds = await client.query(
      `SELECT DISTINCT programacion_id FROM expenses
       WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
       AND programacion_id IS NOT NULL`,
      [req.user.id, targetYear]
    );

    // Delete expenses for the year
    const deleteResult = await client.query(
      `DELETE FROM expenses
       WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
       RETURNING id`,
      [req.user.id, targetYear]
    );

    const totalDeleted = deleteResult.rowCount || 0;

    // Update programaciones - decrement total_generados and adjust ultimo_ano_generado
    for (const row of programacionIds.rows) {
      if (row.programacion_id) {
        const deletedForProg = await client.query(
          `SELECT COUNT(*) as remaining FROM expenses WHERE programacion_id = $1`,
          [row.programacion_id]
        );

        const remaining = parseInt(deletedForProg.rows[0].remaining);

        if (remaining === 0) {
          // No expenses left, reset programacion
          await client.query(
            `UPDATE programaciones SET
              total_generados = 0,
              ultimo_ano_generado = NULL,
              updated_at = NOW()
             WHERE id = $1`,
            [row.programacion_id]
          );
        } else {
          // Find the max year of remaining expenses
          const maxYear = await client.query(
            `SELECT MAX(EXTRACT(YEAR FROM fecha_emision)) as max_year
             FROM expenses WHERE programacion_id = $1`,
            [row.programacion_id]
          );

          await client.query(
            `UPDATE programaciones SET
              total_generados = $1,
              ultimo_ano_generado = $2,
              updated_at = NOW()
             WHERE id = $3`,
            [remaining, maxYear.rows[0].max_year, row.programacion_id]
          );
        }
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        year: targetYear,
        total_deleted: totalDeleted
      },
      info: [`Se han eliminado ${totalDeleted} gastos del año ${targetYear}`]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

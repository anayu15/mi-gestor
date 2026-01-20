import { Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import { query } from '../config/database';
import { AuthRequest, ExtractedContractData } from '../types';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { extractContractData } from '../services/visionOCR.service';
import config from '../config';
import {
  calculateScheduledDates,
  validateScheduleConfig,
  ScheduleConfig,
  Periodicidad,
  TipoDia,
  getPeriodicidadLabel,
  getTipoDiaLabel,
  getScheduleDescription,
  formatDateLocal,
  // Legacy support
  Frecuencia,
  getFrequencyLabel,
  getFrequencyDescription
} from '../utils/schedule-calculator';

/**
 * List all programaciones for authenticated user
 * GET /api/programaciones
 */
export const getProgramaciones = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { tipo } = req.query;

    let whereConditions = ['p.user_id = $1'];
    const params: any[] = [req.user.id];
    let paramIndex = 2;

    if (tipo && (tipo === 'INGRESO' || tipo === 'GASTO')) {
      whereConditions.push(`p.tipo = $${paramIndex}`);
      params.push(tipo);
      paramIndex++;
    }

    const result = await query(
      `SELECT
        p.*,
        (SELECT COUNT(*) FROM facturas_emitidas WHERE programacion_id = p.id) as total_ingresos,
        (SELECT COUNT(*) FROM expenses WHERE programacion_id = p.id) as total_gastos
       FROM programaciones p
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY p.created_at DESC`,
      params
    );

    // Add labels to each programacion
    const programaciones = result.rows.map((p: any) => ({
      ...p,
      frecuencia_label: getFrequencyLabel(p.frecuencia),
      frecuencia_descripcion: getFrequencyDescription(p.frecuencia, p.intervalo_dias)
    }));

    res.json({
      success: true,
      data: programaciones
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single programacion with linked records count
 * GET /api/programaciones/:id
 */
export const getProgramacion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    const result = await query(
      `SELECT
        p.*,
        (SELECT COUNT(*) FROM facturas_emitidas WHERE programacion_id = p.id) as total_ingresos,
        (SELECT COUNT(*) FROM expenses WHERE programacion_id = p.id) as total_gastos
       FROM programaciones p
       WHERE p.id = $1 AND p.user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('Programación no encontrada');
    }

    const programacion = {
      ...result.rows[0],
      frecuencia_label: getFrequencyLabel(result.rows[0].frecuencia),
      frecuencia_descripcion: getFrequencyDescription(result.rows[0].frecuencia, result.rows[0].intervalo_dias)
    };

    res.json({
      success: true,
      data: programacion
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Preview dates that would be generated for a schedule
 * POST /api/programaciones/preview
 */
export const previewScheduledDates = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { periodicidad, tipo_dia, dia_especifico, fecha_inicio, fecha_fin } = req.body;

    if (!periodicidad || !tipo_dia || !fecha_inicio) {
      throw BadRequestError('periodicidad, tipo_dia y fecha_inicio son requeridos');
    }

    const config: ScheduleConfig = {
      periodicidad: periodicidad as Periodicidad,
      tipo_dia: tipo_dia as TipoDia,
      dia_especifico: dia_especifico ? parseInt(dia_especifico) : undefined,
      fecha_inicio: new Date(fecha_inicio),
      fecha_fin: fecha_fin ? new Date(fecha_fin) : null
    };

    // Validate configuration
    const validation = validateScheduleConfig(config);
    if (!validation.valid) {
      throw BadRequestError(validation.error || 'Configuración inválida');
    }

    const dates = calculateScheduledDates(config);

    res.json({
      success: true,
      data: {
        total: dates.length,
        dates: dates.map(d => formatDateLocal(d)),
        periodicidad_label: getPeriodicidadLabel(periodicidad),
        tipo_dia_label: getTipoDiaLabel(tipo_dia, dia_especifico),
        descripcion: getScheduleDescription(periodicidad, tipo_dia, dia_especifico)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete programacion (optionally with all records)
 * DELETE /api/programaciones/:id
 */
export const deleteProgramacion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;
    const { deleteRecords } = req.query;
    const shouldDeleteRecords = deleteRecords === 'true';

    // First check that the programacion exists and belongs to user
    const checkResult = await query(
      `SELECT p.*, p.tipo FROM programaciones p WHERE p.id = $1 AND p.user_id = $2`,
      [id, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      throw NotFoundError('Programación no encontrada');
    }

    const programacion = checkResult.rows[0];
    let deletedIngresos = 0;
    let deletedGastos = 0;

    if (shouldDeleteRecords) {
      // Delete all linked records first
      // Note: user_id filter removed since we already verified programacion ownership above
      if (programacion.tipo === 'INGRESO') {
        const deleteResult = await query(
          `DELETE FROM facturas_emitidas WHERE programacion_id = $1 RETURNING id`,
          [id]
        );
        deletedIngresos = deleteResult.rowCount || 0;
      } else {
        const deleteResult = await query(
          `DELETE FROM expenses WHERE programacion_id = $1 RETURNING id`,
          [id]
        );
        deletedGastos = deleteResult.rowCount || 0;
      }
    }

    // Delete the programacion
    await query(
      `DELETE FROM programaciones WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    res.json({
      success: true,
      message: 'Programación eliminada correctamente',
      data: {
        deletedIngresos,
        deletedGastos,
        recordsKept: !shouldDeleteRecords
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get count of linked records for a programacion
 * GET /api/programaciones/:id/count
 */
export const getLinkedRecordsCount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    // Check programacion exists
    const checkResult = await query(
      `SELECT tipo FROM programaciones WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      throw NotFoundError('Programación no encontrada');
    }

    const tipo = checkResult.rows[0].tipo;
    let count = 0;

    if (tipo === 'INGRESO') {
      const result = await query(
        `SELECT COUNT(*) as count FROM facturas_emitidas WHERE programacion_id = $1`,
        [id]
      );
      count = parseInt(result.rows[0].count);
    } else {
      const result = await query(
        `SELECT COUNT(*) as count FROM expenses WHERE programacion_id = $1`,
        [id]
      );
      count = parseInt(result.rows[0].count);
    }

    res.json({
      success: true,
      data: { count, tipo }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Extract data from contract file using OCR
 * POST /api/programaciones/extract-from-contract
 */
export const extractFromContract = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const file = (req as any).file;
    if (!file) {
      throw BadRequestError('No se ha proporcionado ningún archivo');
    }

    console.log(`Processing contract for user ${req.user.id}: ${file.originalname}`);

    // Extract data using OCR
    const ocrResult = await extractContractData(file.path);

    // Generate a unique filename for storage
    const year = new Date().getFullYear();
    const randomHash = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    const storageName = `contract_${randomHash}_${timestamp}${ext}`;

    // Create destination directory if it doesn't exist
    const fs = require('fs');
    const destDir = path.join(config.upload.dir, 'documents', req.user.id.toString(), year.toString());
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Move file from temp to permanent storage
    const destPath = path.join(destDir, storageName);
    fs.copyFileSync(file.path, destPath);

    // Clean up temp file
    try {
      fs.unlinkSync(file.path);
    } catch (e) {
      console.warn('Could not delete temp file:', file.path);
    }

    // Construct relative file URL
    const relativeFileUrl = `/uploads/documents/${req.user.id}/${year}/${storageName}`;

    // Get MIME type
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };
    const fileType = mimeTypes[ext] || 'application/octet-stream';

    console.log(`Contract saved to: ${destPath}`);

    res.json({
      success: true,
      data: {
        extracted: ocrResult.data,
        confidence: ocrResult.confidence,
        requiresReview: ocrResult.requiresReview,
        archivo_url: relativeFileUrl,
        archivo_nombre: file.originalname,
        archivo_tipo: fileType,
        archivo_tamanio: file.size
      }
    });
  } catch (error: any) {
    console.error('Contract extraction error:', error);
    next(error);
  }
};

/**
 * Get contract document for a programacion
 * GET /api/programaciones/:id/contrato
 */
export const getProgramacionContrato = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    // Get programacion with contract info
    const result = await query(
      `SELECT
        p.id,
        p.contrato_document_id,
        p.contrato_datos_extraidos,
        p.contrato_confianza,
        d.id as document_id,
        d.nombre as document_nombre,
        d.archivo_nombre_original,
        d.archivo_ruta,
        d.archivo_tipo_mime,
        d.archivo_tamanio_bytes,
        d.fecha_subida
       FROM programaciones p
       LEFT JOIN documents d ON p.contrato_document_id = d.id
       WHERE p.id = $1 AND p.user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('Programación no encontrada');
    }

    const programacion = result.rows[0];

    if (!programacion.contrato_document_id) {
      res.json({
        success: true,
        data: null,
        message: 'Esta programación no tiene contrato adjunto'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        document_id: programacion.document_id,
        nombre: programacion.document_nombre,
        archivo_nombre: programacion.archivo_nombre_original,
        archivo_url: programacion.archivo_ruta,
        archivo_tipo: programacion.archivo_tipo_mime,
        archivo_tamanio: programacion.archivo_tamanio_bytes,
        fecha_subida: programacion.fecha_subida,
        datos_extraidos: programacion.contrato_datos_extraidos,
        confianza: programacion.contrato_confianza
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * View contract file for a programacion
 * GET /api/programaciones/:id/contrato/file
 */
export const viewProgramacionContratoFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    // Get programacion with contract data
    const result = await query(
      `SELECT contrato_datos_extraidos FROM programaciones WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('Programación no encontrada');
    }

    const programacion = result.rows[0];
    const contratoData = programacion.contrato_datos_extraidos;

    if (!contratoData?.archivo_url) {
      throw NotFoundError('Esta programación no tiene contrato adjunto');
    }

    // Build absolute path from relative URL
    // archivo_url is like: /uploads/documents/1/2026/contract_xxx.pdf
    const relativePath = contratoData.archivo_url.replace(/^\/uploads\//, '');
    const absolutePath = path.resolve(config.upload.dir, relativePath);

    // Security check - prevent path traversal
    const uploadDir = path.resolve(config.upload.dir);
    if (!absolutePath.startsWith(uploadDir)) {
      throw BadRequestError('Acceso denegado');
    }

    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(absolutePath)) {
      throw NotFoundError('Archivo de contrato no encontrado en el sistema');
    }

    // Determine content type
    const mimeType = contratoData.archivo_tipo || 'application/pdf';

    // Set headers for inline viewing
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${contratoData.archivo_nombre || 'contrato'}"`);

    // Stream the file
    const fileStream = fs.createReadStream(absolutePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Regenerate series with new periodicity
 * POST /api/programaciones/:id/regenerate
 *
 * This endpoint:
 * 1. Deletes all existing items linked to the programacion
 * 2. Updates the programacion with new schedule configuration
 * 3. Generates new items based on the new periodicity
 * 4. Returns counts of deleted and created items
 */
export const regenerateSeries = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;
    const {
      periodicidad,
      tipo_dia,
      dia_especifico,
      fecha_inicio,
      fecha_fin,
      // Optional: updated item data for the series
      datos_base
    } = req.body;

    // Validate required fields
    if (!periodicidad || !tipo_dia || !fecha_inicio) {
      throw BadRequestError('periodicidad, tipo_dia y fecha_inicio son requeridos');
    }

    // Get existing programacion
    const progResult = await query(
      `SELECT * FROM programaciones WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (progResult.rows.length === 0) {
      throw NotFoundError('Programación no encontrada');
    }

    const programacion = progResult.rows[0];
    const tipo = programacion.tipo;

    // Validate schedule configuration
    const scheduleConfig: ScheduleConfig = {
      periodicidad: periodicidad as Periodicidad,
      tipo_dia: tipo_dia as TipoDia,
      dia_especifico: dia_especifico ? parseInt(dia_especifico) : undefined,
      fecha_inicio: new Date(fecha_inicio),
      fecha_fin: fecha_fin ? new Date(fecha_fin) : null
    };

    const validation = validateScheduleConfig(scheduleConfig);
    if (!validation.valid) {
      throw BadRequestError(validation.error || 'Configuración de programación inválida');
    }

    // Calculate new scheduled dates
    const scheduledDates = calculateScheduledDates(scheduleConfig);

    if (scheduledDates.length === 0) {
      throw BadRequestError('La configuración no genera ninguna fecha válida');
    }

    // Step 1: Delete all existing items with this programacion_id
    let deletedCount = 0;
    if (tipo === 'INGRESO') {
      const deleteResult = await query(
        `DELETE FROM facturas_emitidas WHERE programacion_id = $1 RETURNING id`,
        [id]
      );
      deletedCount = deleteResult.rowCount || 0;
    } else {
      const deleteResult = await query(
        `DELETE FROM expenses WHERE programacion_id = $1 RETURNING id`,
        [id]
      );
      deletedCount = deleteResult.rowCount || 0;
    }

    // Step 2: Update the programacion with new configuration
    const updatedDatosBase = datos_base || programacion.datos_base;

    await query(
      `UPDATE programaciones
       SET periodicidad = $1,
           tipo_dia = $2,
           dia_especifico = $3,
           fecha_inicio = $4,
           fecha_fin = $5,
           datos_base = $6,
           total_generados = 0,
           ultimo_ano_generado = NULL,
           updated_at = NOW()
       WHERE id = $7 AND user_id = $8`,
      [
        periodicidad,
        tipo_dia,
        dia_especifico || null,
        fecha_inicio,
        fecha_fin || null,
        JSON.stringify(updatedDatosBase),
        id,
        req.user.id
      ]
    );

    // Step 3: Generate new items based on the new schedule
    let createdCount = 0;
    const baseData = updatedDatosBase;

    if (tipo === 'INGRESO') {
      // Generate invoices
      for (const fecha of scheduledDates) {
        const fechaStr = formatDateLocal(fecha);

        await query(
          `INSERT INTO facturas_emitidas (
            user_id,
            cliente_id,
            numero_factura,
            fecha_emision,
            concepto,
            base_imponible,
            tipo_iva,
            cuota_iva,
            tipo_irpf,
            cuota_irpf,
            total_factura,
            estado,
            programacion_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            req.user.id,
            baseData.cliente_id,
            `PROG-${id.substring(0, 8)}-${createdCount + 1}`, // Temporary number
            fechaStr,
            baseData.concepto || 'Factura programada',
            baseData.base_imponible || 0,
            baseData.tipo_iva || 21,
            Math.round((baseData.base_imponible || 0) * (baseData.tipo_iva || 21) / 100 * 100) / 100,
            baseData.tipo_irpf || 7,
            Math.round((baseData.base_imponible || 0) * (baseData.tipo_irpf || 7) / 100 * 100) / 100,
            Math.round(((baseData.base_imponible || 0) * (1 + (baseData.tipo_iva || 21) / 100) * (1 - (baseData.tipo_irpf || 7) / 100)) * 100) / 100,
            baseData.estado || 'PENDIENTE',
            id
          ]
        );
        createdCount++;
      }
    } else {
      // Generate expenses
      for (const fecha of scheduledDates) {
        const fechaStr = formatDateLocal(fecha);

        await query(
          `INSERT INTO expenses (
            user_id,
            concepto,
            proveedor_nombre,
            proveedor_cif,
            fecha_emision,
            base_imponible,
            tipo_iva,
            cuota_iva,
            tipo_irpf,
            cuota_irpf,
            total_factura,
            categoria,
            pagado,
            programacion_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            req.user.id,
            baseData.concepto || 'Gasto programado',
            baseData.proveedor_nombre || '',
            baseData.proveedor_cif || '',
            fechaStr,
            baseData.base_imponible || 0,
            baseData.tipo_iva || 21,
            Math.round((baseData.base_imponible || 0) * (baseData.tipo_iva || 21) / 100 * 100) / 100,
            baseData.tipo_irpf || 0,
            Math.round((baseData.base_imponible || 0) * (baseData.tipo_irpf || 0) / 100 * 100) / 100,
            Math.round(((baseData.base_imponible || 0) * (1 + (baseData.tipo_iva || 21) / 100) - (baseData.base_imponible || 0) * (baseData.tipo_irpf || 0) / 100) * 100) / 100,
            baseData.categoria || 'Otros gastos',
            false,
            id
          ]
        );
        createdCount++;
      }
    }

    // Step 4: Update total_generados
    await query(
      `UPDATE programaciones
       SET total_generados = $1
       WHERE id = $2 AND user_id = $3`,
      [createdCount, id, req.user.id]
    );

    res.json({
      success: true,
      message: `Serie regenerada correctamente: ${deletedCount} ${tipo === 'INGRESO' ? 'facturas' : 'gastos'} eliminados, ${createdCount} nuevos creados`,
      data: {
        deleted_count: deletedCount,
        created_count: createdCount,
        programacion_id: id,
        new_dates: scheduledDates.map(d => formatDateLocal(d))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update programacion (currently only nombre field)
 * PATCH /api/programaciones/:id
 */
export const updateProgramacion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;
    const { nombre } = req.body;

    if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
      throw BadRequestError('El nombre es requerido');
    }

    // Verify ownership
    const existingResult = await query(
      'SELECT id FROM programaciones WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (existingResult.rows.length === 0) {
      throw NotFoundError('Programación no encontrada');
    }

    // Update nombre
    await query(
      'UPDATE programaciones SET nombre = $1 WHERE id = $2 AND user_id = $3',
      [nombre.trim(), id, req.user.id]
    );

    res.json({
      success: true,
      message: 'Nombre actualizado correctamente'
    });
  } catch (error) {
    next(error);
  }
};

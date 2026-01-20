import { Response, NextFunction } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../types';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import StorageService from '../services/storage.service';
import { analyzeAltaSS, AltaSSAnalysisResult } from '../services/altaSSAnalysis.service';

// ============================================================================
// UPLOAD AND ANALYZE ALTA SS - POST /api/fiscal/alta-ss/upload
// ============================================================================

/**
 * Sube y analiza un documento Alta en el RETA (Seguridad Social)
 * POST /api/fiscal/alta-ss/upload
 * Requiere: multipart/form-data con archivo
 */
export const uploadAndAnalyzeAltaSS = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');
    if (!req.file) throw BadRequestError('No se proporcionó ningún archivo');

    const userId = req.user.id;
    const file = req.file;

    console.log(`📤 Recibido Alta SS de usuario ${userId}: ${file.originalname}`);

    // Calcular hash del archivo
    const fileHash = await StorageService.calculateFileHash(file.path);

    // Obtener ruta relativa del archivo
    const relativePath = StorageService.getRelativePath(file.path);

    // Insertar documento en la tabla documents
    // Etiquetas: Fiscal (viene de sección fiscal) + SS (Seguridad Social)
    const documentResult = await query(
      `INSERT INTO documents (
        user_id, nombre, descripcion, categoria, tipo_documento,
        archivo_nombre_original, archivo_nombre_storage, archivo_ruta,
        archivo_tipo_mime, archivo_tamanio_bytes, archivo_hash_sha256,
        etiquetas
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        userId,
        `Alta SS (RETA) - ${new Date().toLocaleDateString('es-ES')}`,
        'Documento de alta en el Régimen Especial de Trabajadores Autónomos',
        'OTRO',
        'SS', // Seguridad Social document type
        file.originalname,
        file.filename,
        relativePath,
        file.mimetype,
        file.size,
        fileHash,
        ['Fiscal', 'SS'], // Tags: Fiscal section + Seguridad Social
      ]
    );

    const documentId = documentResult.rows[0].id;
    console.log(`📁 Documento creado con ID: ${documentId}`);

    // Analizar el documento con AI
    console.log('🔍 Iniciando análisis AI del Alta SS...');
    const analysisResult = await analyzeAltaSS(file.path);
    console.log(`✅ Análisis completado con ${analysisResult.confianza}% de confianza`);

    // Guardar análisis en la base de datos
    const analysisInsert = await query(
      `INSERT INTO alta_ss_analysis (
        user_id, document_id,
        nif, nombre_completo, numero_afiliacion,
        fecha_alta_reta, fecha_efectos,
        actividad_economica, cnae_codigo,
        base_cotizacion_elegida, base_minima_tramo, base_maxima_tramo,
        tramo_rendimientos,
        tiene_tarifa_plana, tipo_bonificacion,
        fecha_inicio_bonificacion, fecha_fin_bonificacion,
        cuota_bonificada,
        regimen, grupo_cotizacion,
        es_autonomo_societario, es_pluriactividad,
        recomienda_tarifa_plana, explicacion_tarifa_plana,
        base_cotizacion_recomendada, explicacion_base_cotizacion,
        ai_confianza, ai_raw_response, notas_extraccion
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
      ) RETURNING id`,
      [
        userId,
        documentId,
        analysisResult.datos_extraidos.nif,
        analysisResult.datos_extraidos.nombre_completo,
        analysisResult.datos_extraidos.numero_afiliacion,
        analysisResult.datos_extraidos.fecha_alta_reta,
        analysisResult.datos_extraidos.fecha_efectos,
        analysisResult.datos_extraidos.actividad_economica,
        analysisResult.datos_extraidos.cnae_codigo,
        analysisResult.datos_extraidos.base_cotizacion_elegida,
        analysisResult.datos_extraidos.base_minima_tramo,
        analysisResult.datos_extraidos.base_maxima_tramo,
        analysisResult.datos_extraidos.tramo_rendimientos,
        analysisResult.datos_extraidos.tiene_tarifa_plana ?? false,
        analysisResult.datos_extraidos.tipo_bonificacion,
        analysisResult.datos_extraidos.fecha_inicio_bonificacion,
        analysisResult.datos_extraidos.fecha_fin_bonificacion,
        analysisResult.datos_extraidos.cuota_bonificada,
        analysisResult.datos_extraidos.regimen,
        analysisResult.datos_extraidos.grupo_cotizacion,
        analysisResult.datos_extraidos.es_autonomo_societario ?? false,
        analysisResult.datos_extraidos.es_pluriactividad ?? false,
        analysisResult.recomendaciones.tarifa_plana.requerido,
        analysisResult.recomendaciones.tarifa_plana.explicacion,
        analysisResult.recomendaciones.base_cotizacion.valor_recomendado,
        analysisResult.recomendaciones.base_cotizacion.explicacion,
        analysisResult.confianza,
        analysisResult.raw_response,
        analysisResult.notas_extraccion,
      ]
    );

    const analysisId = analysisInsert.rows[0].id;

    // Actualizar referencia en usuario
    await query(
      `UPDATE users SET last_alta_ss_analysis_id = $1 WHERE id = $2`,
      [analysisId, userId]
    );

    console.log(`✅ Análisis guardado con ID: ${analysisId}`);

    res.status(201).json({
      success: true,
      message: 'Alta SS analizado correctamente',
      data: {
        analysis_id: analysisId,
        document_id: documentId,
        datos_extraidos: analysisResult.datos_extraidos,
        recomendaciones: analysisResult.recomendaciones,
        confianza: analysisResult.confianza,
        notas_extraccion: analysisResult.notas_extraccion,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// GET CURRENT ANALYSIS - GET /api/fiscal/alta-ss/analysis
// ============================================================================

/**
 * Obtiene el análisis más reciente del Alta SS del usuario
 * GET /api/fiscal/alta-ss/analysis
 */
export const getAltaSSAnalysis = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const userId = req.user.id;

    const result = await query(
      `SELECT
        a.*,
        d.archivo_nombre_original,
        d.archivo_ruta,
        d.created_at as documento_created_at
      FROM alta_ss_analysis a
      LEFT JOIN documents d ON a.document_id = d.id
      WHERE a.user_id = $1
      ORDER BY a.created_at DESC
      LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No se ha subido ningún documento de Alta SS aún',
      });
    }

    const analysis = result.rows[0];

    res.json({
      success: true,
      data: {
        id: analysis.id,
        document_id: analysis.document_id,
        archivo_nombre: analysis.archivo_nombre_original,
        created_at: analysis.created_at,
        datos_extraidos: {
          nif: analysis.nif,
          nombre_completo: analysis.nombre_completo,
          numero_afiliacion: analysis.numero_afiliacion,
          fecha_alta_reta: analysis.fecha_alta_reta,
          fecha_efectos: analysis.fecha_efectos,
          actividad_economica: analysis.actividad_economica,
          cnae_codigo: analysis.cnae_codigo,
          base_cotizacion_elegida: analysis.base_cotizacion_elegida ? parseFloat(analysis.base_cotizacion_elegida) : null,
          base_minima_tramo: analysis.base_minima_tramo ? parseFloat(analysis.base_minima_tramo) : null,
          base_maxima_tramo: analysis.base_maxima_tramo ? parseFloat(analysis.base_maxima_tramo) : null,
          tramo_rendimientos: analysis.tramo_rendimientos,
          tiene_tarifa_plana: analysis.tiene_tarifa_plana,
          tipo_bonificacion: analysis.tipo_bonificacion,
          fecha_inicio_bonificacion: analysis.fecha_inicio_bonificacion,
          fecha_fin_bonificacion: analysis.fecha_fin_bonificacion,
          cuota_bonificada: analysis.cuota_bonificada ? parseFloat(analysis.cuota_bonificada) : null,
          regimen: analysis.regimen,
          grupo_cotizacion: analysis.grupo_cotizacion,
          es_autonomo_societario: analysis.es_autonomo_societario,
          es_pluriactividad: analysis.es_pluriactividad,
        },
        recomendaciones: {
          tarifa_plana: {
            requerido: analysis.recomienda_tarifa_plana,
            explicacion: analysis.explicacion_tarifa_plana,
          },
          base_cotizacion: {
            valor_recomendado: analysis.base_cotizacion_recomendada ? parseFloat(analysis.base_cotizacion_recomendada) : null,
            explicacion: analysis.explicacion_base_cotizacion,
          },
        },
        confianza: analysis.ai_confianza ? parseFloat(analysis.ai_confianza) : null,
        notas_extraccion: analysis.notas_extraccion,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// GET HISTORY - GET /api/fiscal/alta-ss/history
// ============================================================================

/**
 * Obtiene el historial de todos los documentos Alta SS subidos
 * GET /api/fiscal/alta-ss/history
 */
export const getAltaSSHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const userId = req.user.id;

    const result = await query(
      `SELECT
        a.id,
        a.document_id,
        a.nif,
        a.nombre_completo,
        a.numero_afiliacion,
        a.fecha_alta_reta,
        a.tiene_tarifa_plana,
        a.base_cotizacion_elegida,
        a.ai_confianza,
        a.created_at,
        d.archivo_nombre_original
      FROM alta_ss_analysis a
      LEFT JOIN documents d ON a.document_id = d.id
      WHERE a.user_id = $1
      ORDER BY a.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        total: result.rows.length,
        items: result.rows.map(row => ({
          id: row.id,
          document_id: row.document_id,
          archivo_nombre: row.archivo_nombre_original,
          nif: row.nif,
          nombre_completo: row.nombre_completo,
          numero_afiliacion: row.numero_afiliacion,
          fecha_alta_reta: row.fecha_alta_reta,
          tiene_tarifa_plana: row.tiene_tarifa_plana,
          base_cotizacion_elegida: row.base_cotizacion_elegida ? parseFloat(row.base_cotizacion_elegida) : null,
          confianza: row.ai_confianza ? parseFloat(row.ai_confianza) : null,
          created_at: row.created_at,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// DELETE CURRENT ANALYSIS - DELETE /api/fiscal/alta-ss/analysis
// ============================================================================

/**
 * Elimina el análisis más reciente del usuario
 * DELETE /api/fiscal/alta-ss/analysis
 */
export const deleteCurrentAltaSSAnalysis = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const userId = req.user.id;

    // Get the most recent analysis
    const analysisResult = await query(
      `SELECT id, document_id FROM alta_ss_analysis WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (analysisResult.rows.length === 0) {
      throw NotFoundError('No hay análisis para eliminar');
    }

    const analysisId = analysisResult.rows[0].id;
    const documentId = analysisResult.rows[0].document_id;

    // Clear reference in users table
    await query(
      `UPDATE users SET last_alta_ss_analysis_id = NULL WHERE id = $1`,
      [userId]
    );

    // Delete the analysis
    await query(
      `DELETE FROM alta_ss_analysis WHERE id = $1`,
      [analysisId]
    );

    // Delete the associated document
    if (documentId) {
      await query(
        `DELETE FROM documents WHERE id = $1 AND user_id = $2`,
        [documentId, userId]
      );
    }

    res.json({
      success: true,
      message: 'Análisis eliminado correctamente',
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// DELETE SPECIFIC ANALYSIS - DELETE /api/fiscal/alta-ss/analysis/:id
// ============================================================================

/**
 * Elimina un análisis específico por ID
 * DELETE /api/fiscal/alta-ss/analysis/:id
 */
export const deleteAltaSSAnalysisById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const userId = req.user.id;
    const analysisId = parseInt(req.params.id);

    if (isNaN(analysisId)) {
      throw BadRequestError('ID de análisis inválido');
    }

    // Get the analysis to verify ownership and get document_id
    const analysisResult = await query(
      `SELECT id, document_id FROM alta_ss_analysis WHERE id = $1 AND user_id = $2`,
      [analysisId, userId]
    );

    if (analysisResult.rows.length === 0) {
      throw NotFoundError('Análisis no encontrado');
    }

    const documentId = analysisResult.rows[0].document_id;

    // Check if this is the current analysis referenced in users table
    const userResult = await query(
      `SELECT last_alta_ss_analysis_id FROM users WHERE id = $1`,
      [userId]
    );
    
    if (userResult.rows[0]?.last_alta_ss_analysis_id === analysisId) {
      // Clear reference in users table
      await query(
        `UPDATE users SET last_alta_ss_analysis_id = NULL WHERE id = $1`,
        [userId]
      );
    }

    // Delete the analysis
    await query(
      `DELETE FROM alta_ss_analysis WHERE id = $1`,
      [analysisId]
    );

    // Delete the associated document
    if (documentId) {
      await query(
        `DELETE FROM documents WHERE id = $1 AND user_id = $2`,
        [documentId, userId]
      );
    }

    res.json({
      success: true,
      message: 'Análisis eliminado correctamente',
    });
  } catch (error) {
    next(error);
  }
};

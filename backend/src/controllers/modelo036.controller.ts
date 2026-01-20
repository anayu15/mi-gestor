import { Response, NextFunction } from 'express';
import path from 'path';
import { query, getClient } from '../config/database';
import { AuthRequest } from '../types';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import StorageService from '../services/storage.service';
import { analyzeModelo036, Modelo036AnalysisResult, TipoDocumento036 } from '../services/modelo036Analysis.service';

// ============================================================================
// UPLOAD AND ANALYZE MODELO 036 - POST /api/fiscal/modelo-036/upload
// ============================================================================

/**
 * Sube y analiza un documento Modelo 036
 * POST /api/fiscal/modelo-036/upload
 * Requiere: multipart/form-data con archivo
 * 
 * Query params:
 * - tipo_documento: 'ALTA' | 'MODIFICACION' (default: 'ALTA')
 *   - ALTA: Complete new registration, invalidates previous documents
 *   - MODIFICACION: Partial modification, both documents remain valid
 */
export const uploadAndAnalyzeModelo036 = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');
    if (!req.file) throw BadRequestError('No se proporcionó ningún archivo');

    const userId = req.user.id;
    const file = req.file;
    
    // Get document type from query parameter (default to ALTA)
    const tipoDocumento = (req.query.tipo_documento as TipoDocumento036) || 'ALTA';
    if (tipoDocumento !== 'ALTA' && tipoDocumento !== 'MODIFICACION') {
      throw BadRequestError('Tipo de documento inválido. Debe ser ALTA o MODIFICACION');
    }

    console.log(`📤 Recibido Modelo 036 (${tipoDocumento}) de usuario ${userId}: ${file.originalname}`);

    // Calcular hash del archivo
    const fileHash = await StorageService.calculateFileHash(file.path);

    // Obtener ruta relativa del archivo
    const relativePath = StorageService.getRelativePath(file.path);

    // Insertar documento en la tabla documents
    // Etiquetas: Fiscal (viene de sección fiscal) + Hacienda (Agencia Tributaria)
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
        `Modelo 036 - ${new Date().toLocaleDateString('es-ES')}`,
        'Declaración censal de alta en Hacienda',
        'OTRO',
        'AEAT', // All AEAT documents use tipo_documento = 'AEAT'
        file.originalname,
        file.filename,
        relativePath,
        file.mimetype,
        file.size,
        fileHash,
        ['Fiscal', 'Hacienda'], // Tags: Fiscal section + Agencia Tributaria
      ]
    );

    const documentId = documentResult.rows[0].id;
    console.log(`📁 Documento creado con ID: ${documentId}`);

    // Analizar el documento con AI using the appropriate prompt for the document type
    console.log(`🔍 Iniciando análisis AI del Modelo 036 (${tipoDocumento})...`);
    const analysisResult = await analyzeModelo036(file.path, tipoDocumento);
    console.log(`✅ Análisis completado con ${analysisResult.confianza}% de confianza`);
    
    // For MODIFICACION, find the parent ALTA document
    let parentAnalysisId: number | null = null;
    if (tipoDocumento === 'MODIFICACION') {
      // Find the most recent active ALTA document for this user
      const parentResult = await query(
        `SELECT id FROM modelo_036_analysis 
         WHERE user_id = $1 AND tipo_documento_036 = 'ALTA' AND is_active = true
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      if (parentResult.rows.length > 0) {
        parentAnalysisId = parentResult.rows[0].id;
        console.log(`📎 Vinculando modificación al documento padre ID: ${parentAnalysisId}`);
      }
    }
    
    // For ALTA documents, deactivate previous ALTA documents (they are replaced)
    if (tipoDocumento === 'ALTA') {
      await query(
        `UPDATE modelo_036_analysis 
         SET is_active = false 
         WHERE user_id = $1 AND tipo_documento_036 = 'ALTA' AND is_active = true`,
        [userId]
      );
      console.log('📋 Documentos ALTA anteriores marcados como inactivos');
    }

    // Guardar análisis en la base de datos (including new columns for document type)
    const analysisInsert = await query(
      `INSERT INTO modelo_036_analysis (
        user_id, document_id,
        tipo_documento_036, parent_analysis_id, is_active, 
        campos_modificados, fecha_efectos,
        nif, nombre_razon_social, domicilio_fiscal,
        fecha_presentacion, fecha_alta_actividad,
        epigrafe_iae, epigrafe_iae_descripcion,
        regimen_iva, regimen_irpf,
        tiene_empleados, operaciones_intracomunitarias,
        local_alquilado, facturacion_estimada_anual, sii_obligatorio,
        recomienda_modelo_303, explicacion_modelo_303,
        recomienda_modelo_130, explicacion_modelo_130,
        recomienda_modelo_131, explicacion_modelo_131,
        recomienda_modelo_115, explicacion_modelo_115,
        recomienda_modelo_180, explicacion_modelo_180,
        recomienda_modelo_390, explicacion_modelo_390,
        recomienda_modelo_349, explicacion_modelo_349,
        recomienda_modelo_111, explicacion_modelo_111,
        recomienda_modelo_190, explicacion_modelo_190,
        recomienda_sii, explicacion_sii,
        recomienda_vies_roi, explicacion_vies_roi,
        ai_confianza, ai_raw_response, notas_extraccion
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46
      ) RETURNING id`,
      [
        userId,
        documentId,
        tipoDocumento,
        parentAnalysisId,
        true, // is_active - new documents are always active
        analysisResult.campos_modificados || null,
        analysisResult.fecha_efectos || null,
        analysisResult.datos_extraidos.nif,
        analysisResult.datos_extraidos.nombre_razon_social,
        analysisResult.datos_extraidos.domicilio_fiscal,
        analysisResult.datos_extraidos.fecha_presentacion,
        analysisResult.datos_extraidos.fecha_alta_actividad,
        analysisResult.datos_extraidos.epigrafe_iae,
        analysisResult.datos_extraidos.epigrafe_iae_descripcion,
        analysisResult.datos_extraidos.regimen_iva,
        analysisResult.datos_extraidos.regimen_irpf,
        analysisResult.datos_extraidos.tiene_empleados ?? false,
        analysisResult.datos_extraidos.operaciones_intracomunitarias ?? false,
        analysisResult.datos_extraidos.local_alquilado ?? false,
        analysisResult.datos_extraidos.facturacion_estimada_anual,
        analysisResult.datos_extraidos.sii_obligatorio ?? false,
        analysisResult.recomendaciones.modelo_303?.requerido ?? null,
        analysisResult.recomendaciones.modelo_303?.explicacion ?? null,
        analysisResult.recomendaciones.modelo_130?.requerido ?? null,
        analysisResult.recomendaciones.modelo_130?.explicacion ?? null,
        analysisResult.recomendaciones.modelo_131?.requerido ?? null,
        analysisResult.recomendaciones.modelo_131?.explicacion ?? null,
        analysisResult.recomendaciones.modelo_115?.requerido ?? null,
        analysisResult.recomendaciones.modelo_115?.explicacion ?? null,
        analysisResult.recomendaciones.modelo_180?.requerido ?? null,
        analysisResult.recomendaciones.modelo_180?.explicacion ?? null,
        analysisResult.recomendaciones.modelo_390?.requerido ?? null,
        analysisResult.recomendaciones.modelo_390?.explicacion ?? null,
        analysisResult.recomendaciones.modelo_349?.requerido ?? null,
        analysisResult.recomendaciones.modelo_349?.explicacion ?? null,
        analysisResult.recomendaciones.modelo_111?.requerido ?? null,
        analysisResult.recomendaciones.modelo_111?.explicacion ?? null,
        analysisResult.recomendaciones.modelo_190?.requerido ?? null,
        analysisResult.recomendaciones.modelo_190?.explicacion ?? null,
        analysisResult.recomendaciones.sii?.requerido ?? null,
        analysisResult.recomendaciones.sii?.explicacion ?? null,
        analysisResult.recomendaciones.vies_roi?.requerido ?? null,
        analysisResult.recomendaciones.vies_roi?.explicacion ?? null,
        analysisResult.confianza,
        analysisResult.raw_response,
        analysisResult.notas_extraccion,
      ]
    );

    const analysisId = analysisInsert.rows[0].id;

    // Build the update query dynamically based on AI recommendations
    // This ensures preferences are persisted in the database, not just in frontend state
    // For MODIFICACION documents, only apply non-null recommendations (partial updates)
    const rec = analysisResult.recomendaciones;
    const updateFields: string[] = ['last_modelo_036_analysis_id = $1'];
    const updateValues: any[] = [analysisId];
    let paramCounter = 2;

    // Add fecha_alta_aeat if extracted (only for ALTA documents)
    if (tipoDocumento === 'ALTA' && analysisResult.datos_extraidos.fecha_alta_actividad) {
      updateFields.push(`fecha_alta_aeat = $${paramCounter++}`);
      updateValues.push(analysisResult.datos_extraidos.fecha_alta_actividad);
      console.log(`📅 Fecha de alta AEAT: ${analysisResult.datos_extraidos.fecha_alta_actividad}`);
    }

    // Auto-apply AI recommendations to user preferences
    // For MODIFICACION: only apply non-null values (partial update)
    // For ALTA: apply all values (complete replacement)
    const shouldApply = (value: boolean | null | undefined): boolean => {
      if (tipoDocumento === 'MODIFICACION') {
        return value !== null && value !== undefined;
      }
      return value !== undefined;
    };

    if (shouldApply(rec.modelo_303?.requerido)) {
      updateFields.push(`mostrar_modelo_303 = $${paramCounter++}`);
      updateValues.push(rec.modelo_303!.requerido);
    }
    if (shouldApply(rec.modelo_390?.requerido)) {
      updateFields.push(`mostrar_modelo_390 = $${paramCounter++}`);
      updateValues.push(rec.modelo_390!.requerido);
    }
    if (shouldApply(rec.modelo_349?.requerido)) {
      updateFields.push(`mostrar_modelo_349 = $${paramCounter++}`);
      updateValues.push(rec.modelo_349!.requerido);
    }
    if (shouldApply(rec.sii?.requerido)) {
      updateFields.push(`mostrar_sii = $${paramCounter++}`);
      updateValues.push(rec.sii!.requerido);
    }
    if (shouldApply(rec.modelo_115?.requerido)) {
      updateFields.push(`mostrar_modelo_115 = $${paramCounter++}`);
      updateValues.push(rec.modelo_115!.requerido);
    }
    if (shouldApply(rec.modelo_180?.requerido)) {
      updateFields.push(`mostrar_modelo_180 = $${paramCounter++}`);
      updateValues.push(rec.modelo_180!.requerido);
    }
    if (shouldApply(rec.modelo_111?.requerido)) {
      updateFields.push(`mostrar_modelo_111 = $${paramCounter++}`);
      updateValues.push(rec.modelo_111!.requerido);
    }
    if (shouldApply(rec.modelo_190?.requerido)) {
      updateFields.push(`mostrar_modelo_190 = $${paramCounter++}`);
      updateValues.push(rec.modelo_190!.requerido);
    }
    if (shouldApply(rec.vies_roi?.requerido)) {
      updateFields.push(`mostrar_vies_roi = $${paramCounter++}`);
      updateValues.push(rec.vies_roi!.requerido);
    }

    // Handle 130/131 mutual exclusivity
    if (rec.modelo_130?.requerido === true && rec.modelo_131?.requerido === false) {
      updateFields.push(`mostrar_modelo_130 = $${paramCounter++}`);
      updateValues.push(true);
      updateFields.push(`mostrar_modelo_131 = $${paramCounter++}`);
      updateValues.push(false);
      updateFields.push(`usa_modulos = $${paramCounter++}`);
      updateValues.push(false);
    } else if (rec.modelo_131?.requerido === true && rec.modelo_130?.requerido === false) {
      updateFields.push(`mostrar_modelo_131 = $${paramCounter++}`);
      updateValues.push(true);
      updateFields.push(`mostrar_modelo_130 = $${paramCounter++}`);
      updateValues.push(false);
      updateFields.push(`usa_modulos = $${paramCounter++}`);
      updateValues.push(true);
    } else {
      // If no clear mutual exclusivity, apply individual values (only if they meet criteria)
      if (shouldApply(rec.modelo_130?.requerido)) {
        updateFields.push(`mostrar_modelo_130 = $${paramCounter++}`);
        updateValues.push(rec.modelo_130!.requerido);
      }
      if (shouldApply(rec.modelo_131?.requerido)) {
        updateFields.push(`mostrar_modelo_131 = $${paramCounter++}`);
        updateValues.push(rec.modelo_131!.requerido);
      }
    }

    // Add user ID as last parameter
    updateValues.push(userId);

    await query(
      `UPDATE users SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = $${paramCounter}`,
      updateValues
    );

    const updateType = tipoDocumento === 'MODIFICACION' ? 'parcialmente' : 'completamente';
    console.log(`✅ Análisis guardado con ID: ${analysisId}, preferencias actualizadas ${updateType}`);

    const messageByType = tipoDocumento === 'MODIFICACION' 
      ? 'Modificación del Modelo 036 analizada correctamente. Los cambios se han aplicado sobre el documento original.'
      : 'Modelo 036 de alta analizado correctamente';

    res.status(201).json({
      success: true,
      message: messageByType,
      data: {
        analysis_id: analysisId,
        document_id: documentId,
        tipo_documento: tipoDocumento,
        parent_analysis_id: parentAnalysisId,
        datos_extraidos: analysisResult.datos_extraidos,
        recomendaciones: analysisResult.recomendaciones,
        confianza: analysisResult.confianza,
        notas_extraccion: analysisResult.notas_extraccion,
        campos_modificados: analysisResult.campos_modificados,
        fecha_efectos: analysisResult.fecha_efectos,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// GET CURRENT ANALYSIS - GET /api/fiscal/modelo-036/analysis
// ============================================================================

/**
 * Obtiene el análisis más reciente del Modelo 036 del usuario
 * GET /api/fiscal/modelo-036/analysis
 */
export const getModelo036Analysis = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const userId = req.user.id;

    const result = await query(
      `SELECT
        m.*,
        d.archivo_nombre_original,
        d.archivo_ruta,
        d.created_at as documento_created_at
      FROM modelo_036_analysis m
      LEFT JOIN documents d ON m.document_id = d.id
      WHERE m.user_id = $1
      ORDER BY m.created_at DESC
      LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No se ha subido ningún Modelo 036 aún',
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
          nombre_razon_social: analysis.nombre_razon_social,
          domicilio_fiscal: analysis.domicilio_fiscal,
          fecha_presentacion: analysis.fecha_presentacion,
          fecha_alta_actividad: analysis.fecha_alta_actividad,
          epigrafe_iae: analysis.epigrafe_iae,
          epigrafe_iae_descripcion: analysis.epigrafe_iae_descripcion,
          regimen_iva: analysis.regimen_iva,
          regimen_irpf: analysis.regimen_irpf,
          tiene_empleados: analysis.tiene_empleados,
          operaciones_intracomunitarias: analysis.operaciones_intracomunitarias,
          local_alquilado: analysis.local_alquilado,
          facturacion_estimada_anual: analysis.facturacion_estimada_anual,
          sii_obligatorio: analysis.sii_obligatorio,
        },
        recomendaciones: {
          modelo_303: { requerido: analysis.recomienda_modelo_303, explicacion: analysis.explicacion_modelo_303 },
          modelo_130: { requerido: analysis.recomienda_modelo_130, explicacion: analysis.explicacion_modelo_130 },
          modelo_131: { requerido: analysis.recomienda_modelo_131, explicacion: analysis.explicacion_modelo_131 },
          modelo_115: { requerido: analysis.recomienda_modelo_115, explicacion: analysis.explicacion_modelo_115 },
          modelo_180: { requerido: analysis.recomienda_modelo_180, explicacion: analysis.explicacion_modelo_180 },
          modelo_390: { requerido: analysis.recomienda_modelo_390, explicacion: analysis.explicacion_modelo_390 },
          modelo_349: { requerido: analysis.recomienda_modelo_349, explicacion: analysis.explicacion_modelo_349 },
          modelo_111: { requerido: analysis.recomienda_modelo_111, explicacion: analysis.explicacion_modelo_111 },
          modelo_190: { requerido: analysis.recomienda_modelo_190, explicacion: analysis.explicacion_modelo_190 },
          sii: { requerido: analysis.recomienda_sii, explicacion: analysis.explicacion_sii },
          vies_roi: { requerido: analysis.recomienda_vies_roi, explicacion: analysis.explicacion_vies_roi },
        },
        confianza: analysis.ai_confianza,
        notas_extraccion: analysis.notas_extraccion,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// GET HISTORY - GET /api/fiscal/modelo-036/history
// ============================================================================

/**
 * Obtiene el historial de todos los Modelo 036 subidos
 * GET /api/fiscal/modelo-036/history
 */
export const getModelo036History = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const userId = req.user.id;

    const result = await query(
      `SELECT
        m.id,
        m.document_id,
        m.tipo_documento_036,
        m.parent_analysis_id,
        m.is_active,
        m.campos_modificados,
        m.fecha_efectos,
        m.nif,
        m.nombre_razon_social,
        m.fecha_presentacion,
        m.fecha_alta_actividad,
        m.epigrafe_iae,
        m.regimen_iva,
        m.regimen_irpf,
        m.ai_confianza,
        m.created_at,
        d.archivo_nombre_original
      FROM modelo_036_analysis m
      LEFT JOIN documents d ON m.document_id = d.id
      WHERE m.user_id = $1
      ORDER BY m.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        total: result.rows.length,
        items: result.rows.map(row => ({
          id: row.id,
          document_id: row.document_id,
          tipo_documento: row.tipo_documento_036 || 'ALTA',
          parent_analysis_id: row.parent_analysis_id,
          is_active: row.is_active ?? true,
          campos_modificados: row.campos_modificados,
          fecha_efectos: row.fecha_efectos,
          archivo_nombre: row.archivo_nombre_original,
          nif: row.nif,
          nombre_razon_social: row.nombre_razon_social,
          fecha_presentacion: row.fecha_presentacion,
          fecha_alta_actividad: row.fecha_alta_actividad,
          epigrafe_iae: row.epigrafe_iae,
          regimen_iva: row.regimen_iva,
          regimen_irpf: row.regimen_irpf,
          confianza: row.ai_confianza,
          created_at: row.created_at,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// GET MISMATCHES - GET /api/fiscal/modelo-036/mismatches
// ============================================================================

interface Mismatch {
  modelo: string;
  ai_recomienda: boolean;
  usuario_activo: boolean;
  explicacion: string;
}

/**
 * Compara las recomendaciones del AI con las preferencias actuales del usuario
 * GET /api/fiscal/modelo-036/mismatches
 */
export const getModelMismatches = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const userId = req.user.id;

    // Obtener preferencias del usuario y análisis más reciente
    const userPrefsResult = await query(
      `SELECT
        mostrar_modelo_303,
        mostrar_modelo_130,
        mostrar_modelo_131,
        mostrar_modelo_115,
        mostrar_modelo_180,
        mostrar_modelo_390,
        mostrar_modelo_349,
        mostrar_modelo_111,
        mostrar_modelo_190,
        mostrar_sii,
        mostrar_vies_roi
      FROM users WHERE id = $1`,
      [userId]
    );

    if (userPrefsResult.rows.length === 0) {
      throw NotFoundError('Usuario no encontrado');
    }

    const userPrefs = userPrefsResult.rows[0];

    // Obtener análisis más reciente
    const analysisResult = await query(
      `SELECT * FROM modelo_036_analysis
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (analysisResult.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          has_analysis: false,
          mismatches: [],
          message: 'No se ha subido ningún Modelo 036 para comparar',
        },
      });
    }

    const analysis = analysisResult.rows[0];

    // Comparar cada modelo
    const modelMappings = [
      { key: 'modelo_303', pref: 'mostrar_modelo_303', rec: 'recomienda_modelo_303', exp: 'explicacion_modelo_303', name: 'Modelo 303 (IVA Trimestral)' },
      { key: 'modelo_130', pref: 'mostrar_modelo_130', rec: 'recomienda_modelo_130', exp: 'explicacion_modelo_130', name: 'Modelo 130 (IRPF Trimestral)' },
      { key: 'modelo_131', pref: 'mostrar_modelo_131', rec: 'recomienda_modelo_131', exp: 'explicacion_modelo_131', name: 'Modelo 131 (Módulos)' },
      { key: 'modelo_115', pref: 'mostrar_modelo_115', rec: 'recomienda_modelo_115', exp: 'explicacion_modelo_115', name: 'Modelo 115 (Retenciones Alquiler)' },
      { key: 'modelo_180', pref: 'mostrar_modelo_180', rec: 'recomienda_modelo_180', exp: 'explicacion_modelo_180', name: 'Modelo 180 (Resumen Anual Alquiler)' },
      { key: 'modelo_390', pref: 'mostrar_modelo_390', rec: 'recomienda_modelo_390', exp: 'explicacion_modelo_390', name: 'Modelo 390 (Resumen Anual IVA)' },
      { key: 'modelo_349', pref: 'mostrar_modelo_349', rec: 'recomienda_modelo_349', exp: 'explicacion_modelo_349', name: 'Modelo 349 (Operaciones UE)' },
      { key: 'modelo_111', pref: 'mostrar_modelo_111', rec: 'recomienda_modelo_111', exp: 'explicacion_modelo_111', name: 'Modelo 111 (Retenciones Trabajadores)' },
      { key: 'modelo_190', pref: 'mostrar_modelo_190', rec: 'recomienda_modelo_190', exp: 'explicacion_modelo_190', name: 'Modelo 190 (Resumen Anual Retenciones)' },
      { key: 'sii', pref: 'mostrar_sii', rec: 'recomienda_sii', exp: 'explicacion_sii', name: 'SII (Suministro Inmediato)' },
      { key: 'vies_roi', pref: 'mostrar_vies_roi', rec: 'recomienda_vies_roi', exp: 'explicacion_vies_roi', name: 'VIES/ROI' },
    ];

    const mismatches: Mismatch[] = [];
    const recommendations: Record<string, { ai_recomienda: boolean; usuario_activo: boolean; explicacion: string; mismatch: boolean }> = {};

    for (const mapping of modelMappings) {
      const aiRecommends = analysis[mapping.rec] ?? false;
      const userEnabled = userPrefs[mapping.pref] ?? false;
      const explicacion = analysis[mapping.exp] || '';
      const hasMismatch = aiRecommends !== userEnabled;

      recommendations[mapping.key] = {
        ai_recomienda: aiRecommends,
        usuario_activo: userEnabled,
        explicacion,
        mismatch: hasMismatch,
      };

      if (hasMismatch) {
        mismatches.push({
          modelo: mapping.name,
          ai_recomienda: aiRecommends,
          usuario_activo: userEnabled,
          explicacion,
        });
      }
    }

    res.json({
      success: true,
      data: {
        has_analysis: true,
        analysis_id: analysis.id,
        analysis_date: analysis.created_at,
        confianza: analysis.ai_confianza,
        total_mismatches: mismatches.length,
        mismatches,
        recommendations,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// GET SPECIFIC ANALYSIS - GET /api/fiscal/modelo-036/analysis/:id
// ============================================================================

/**
 * Obtiene un análisis específico por ID
 * GET /api/fiscal/modelo-036/analysis/:id
 */
export const getModelo036AnalysisById = async (
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

    const result = await query(
      `SELECT
        m.*,
        d.archivo_nombre_original,
        d.archivo_ruta
      FROM modelo_036_analysis m
      LEFT JOIN documents d ON m.document_id = d.id
      WHERE m.id = $1 AND m.user_id = $2`,
      [analysisId, userId]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('Análisis no encontrado');
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
          nombre_razon_social: analysis.nombre_razon_social,
          domicilio_fiscal: analysis.domicilio_fiscal,
          fecha_presentacion: analysis.fecha_presentacion,
          fecha_alta_actividad: analysis.fecha_alta_actividad,
          epigrafe_iae: analysis.epigrafe_iae,
          epigrafe_iae_descripcion: analysis.epigrafe_iae_descripcion,
          regimen_iva: analysis.regimen_iva,
          regimen_irpf: analysis.regimen_irpf,
          tiene_empleados: analysis.tiene_empleados,
          operaciones_intracomunitarias: analysis.operaciones_intracomunitarias,
          local_alquilado: analysis.local_alquilado,
          facturacion_estimada_anual: analysis.facturacion_estimada_anual,
          sii_obligatorio: analysis.sii_obligatorio,
        },
        recomendaciones: {
          modelo_303: { requerido: analysis.recomienda_modelo_303, explicacion: analysis.explicacion_modelo_303 },
          modelo_130: { requerido: analysis.recomienda_modelo_130, explicacion: analysis.explicacion_modelo_130 },
          modelo_131: { requerido: analysis.recomienda_modelo_131, explicacion: analysis.explicacion_modelo_131 },
          modelo_115: { requerido: analysis.recomienda_modelo_115, explicacion: analysis.explicacion_modelo_115 },
          modelo_180: { requerido: analysis.recomienda_modelo_180, explicacion: analysis.explicacion_modelo_180 },
          modelo_390: { requerido: analysis.recomienda_modelo_390, explicacion: analysis.explicacion_modelo_390 },
          modelo_349: { requerido: analysis.recomienda_modelo_349, explicacion: analysis.explicacion_modelo_349 },
          modelo_111: { requerido: analysis.recomienda_modelo_111, explicacion: analysis.explicacion_modelo_111 },
          modelo_190: { requerido: analysis.recomienda_modelo_190, explicacion: analysis.explicacion_modelo_190 },
          sii: { requerido: analysis.recomienda_sii, explicacion: analysis.explicacion_sii },
          vies_roi: { requerido: analysis.recomienda_vies_roi, explicacion: analysis.explicacion_vies_roi },
        },
        confianza: analysis.ai_confianza,
        notas_extraccion: analysis.notas_extraccion,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// DELETE CURRENT ANALYSIS - DELETE /api/fiscal/modelo-036/analysis
// ============================================================================

/**
 * Elimina el análisis más reciente del usuario
 * DELETE /api/fiscal/modelo-036/analysis
 */
export const deleteCurrentModelo036Analysis = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const userId = req.user.id;

    // Get the most recent analysis
    const analysisResult = await query(
      `SELECT id, document_id FROM modelo_036_analysis WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (analysisResult.rows.length === 0) {
      throw NotFoundError('No hay análisis para eliminar');
    }

    const analysisId = analysisResult.rows[0].id;
    const documentId = analysisResult.rows[0].document_id;

    // Clear reference in users table
    await query(
      `UPDATE users SET last_modelo_036_analysis_id = NULL WHERE id = $1`,
      [userId]
    );

    // Delete the analysis
    await query(
      `DELETE FROM modelo_036_analysis WHERE id = $1`,
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
// DELETE SPECIFIC ANALYSIS - DELETE /api/fiscal/modelo-036/analysis/:id
// ============================================================================

/**
 * Elimina un análisis específico por ID
 * DELETE /api/fiscal/modelo-036/analysis/:id
 */
export const deleteModelo036AnalysisById = async (
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
      `SELECT id, document_id FROM modelo_036_analysis WHERE id = $1 AND user_id = $2`,
      [analysisId, userId]
    );

    if (analysisResult.rows.length === 0) {
      throw NotFoundError('Análisis no encontrado');
    }

    const documentId = analysisResult.rows[0].document_id;

    // Check if this is the current analysis referenced in users table
    const userResult = await query(
      `SELECT last_modelo_036_analysis_id FROM users WHERE id = $1`,
      [userId]
    );
    
    if (userResult.rows[0]?.last_modelo_036_analysis_id === analysisId) {
      // Clear reference in users table
      await query(
        `UPDATE users SET last_modelo_036_analysis_id = NULL WHERE id = $1`,
        [userId]
      );
    }

    // Delete the analysis
    await query(
      `DELETE FROM modelo_036_analysis WHERE id = $1`,
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

import { Response, NextFunction } from 'express';
import path from 'path';
import { query } from '../config/database';
import { AuthRequest } from '../types';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import StorageService from '../services/storage.service';
import fs from 'fs';
import config from '../config';

// ============================================================================
// UPLOAD FISCAL OBLIGATION DOCUMENT - POST /api/fiscal/obligations/:modelo/upload
// ============================================================================

/**
 * Sube un documento para una obligación fiscal
 * POST /api/fiscal/obligations/:modelo/upload
 * Requiere: multipart/form-data con archivo
 * Query params: trimestre (opcional), ano (requerido)
 */
export const uploadFiscalObligationDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');
    if (!req.file) throw BadRequestError('No se proporcionó ningún archivo');

    const userId = req.user.id;
    const file = req.file;
    const { modelo } = req.params;
    const { trimestre, ano } = req.query;

    if (!modelo) throw BadRequestError('El modelo es requerido');
    if (!ano) throw BadRequestError('El año es requerido');

    const trimestreNum = trimestre ? parseInt(trimestre as string) : null;
    const anoNum = parseInt(ano as string);

    if (isNaN(anoNum)) throw BadRequestError('Año inválido');
    if (trimestreNum !== null && (isNaN(trimestreNum) || trimestreNum < 1 || trimestreNum > 4)) {
      throw BadRequestError('Trimestre inválido');
    }

    console.log(`📤 Recibido documento fiscal de usuario ${userId}: ${file.originalname} para ${modelo} T${trimestreNum || 'Anual'} ${anoNum}`);

    // Calcular hash del archivo
    const fileHash = await StorageService.calculateFileHash(file.path);

    // Obtener ruta relativa del archivo
    const relativePath = StorageService.getRelativePath(file.path);

    // Generar nombre descriptivo para el documento
    const nombreDocumento = trimestreNum
      ? `Modelo ${modelo} - T${trimestreNum} ${anoNum}`
      : `Modelo ${modelo} - ${anoNum}`;

    // Check if there's already a document for this obligation
    const existingObligation = await query(
      `SELECT fod.id, fod.document_id 
       FROM fiscal_obligation_documents fod
       WHERE fod.user_id = $1 AND fod.modelo = $2 
         AND (fod.trimestre = $3 OR ($3 IS NULL AND fod.trimestre IS NULL))
         AND fod.ano = $4`,
      [userId, modelo, trimestreNum, anoNum]
    );

    let documentId: number;
    let obligationId: number;

    if (existingObligation.rows.length > 0) {
      // Update existing document - first delete old file
      const oldDocResult = await query(
        `SELECT archivo_ruta FROM documents WHERE id = $1`,
        [existingObligation.rows[0].document_id]
      );

      if (oldDocResult.rows[0]?.archivo_ruta) {
        const oldFilePath = path.join(config.upload.dir, oldDocResult.rows[0].archivo_ruta);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }

      // Update the document record
      await query(
        `UPDATE documents SET
          nombre = $1,
          archivo_nombre_original = $2,
          archivo_nombre_storage = $3,
          archivo_ruta = $4,
          archivo_tipo_mime = $5,
          archivo_tamanio_bytes = $6,
          archivo_hash_sha256 = $7,
          updated_at = NOW()
        WHERE id = $8`,
        [
          nombreDocumento,
          file.originalname,
          file.filename,
          relativePath,
          file.mimetype,
          file.size,
          fileHash,
          existingObligation.rows[0].document_id,
        ]
      );

      documentId = existingObligation.rows[0].document_id;
      obligationId = existingObligation.rows[0].id;

      // Update obligation timestamp
      await query(
        `UPDATE fiscal_obligation_documents SET updated_at = NOW() WHERE id = $1`,
        [obligationId]
      );

      console.log(`📁 Documento actualizado con ID: ${documentId}`);
    } else {
      // Insert new document - tipo_documento is AEAT for all fiscal documents
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
          nombreDocumento,
          `Documento presentado para ${nombreDocumento}`,
          'OTRO',
          'AEAT', // All fiscal documents are of type AEAT
          file.originalname,
          file.filename,
          relativePath,
          file.mimetype,
          file.size,
          fileHash,
          ['Fiscal', 'Hacienda'], // Tags: Fiscal section + Agencia Tributaria
        ]
      );

      documentId = documentResult.rows[0].id;
      console.log(`📁 Documento creado con ID: ${documentId}`);

      // Insert fiscal obligation document
      const obligationResult = await query(
        `INSERT INTO fiscal_obligation_documents (
          user_id, document_id, modelo, trimestre, ano
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id`,
        [userId, documentId, modelo, trimestreNum, anoNum]
      );

      obligationId = obligationResult.rows[0].id;
    }

    res.status(201).json({
      success: true,
      data: {
        id: obligationId,
        document_id: documentId,
        modelo,
        trimestre: trimestreNum,
        ano: anoNum,
        archivo_nombre: file.originalname,
      },
      message: 'Documento subido correctamente',
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// GET FISCAL OBLIGATION DOCUMENT - GET /api/fiscal/obligations/:modelo/document
// ============================================================================

/**
 * Obtiene el documento de una obligación fiscal
 * GET /api/fiscal/obligations/:modelo/document
 * Query params: trimestre (opcional), ano (requerido)
 */
export const getFiscalObligationDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const userId = req.user.id;
    const { modelo } = req.params;
    const { trimestre, ano } = req.query;

    if (!modelo) throw BadRequestError('El modelo es requerido');
    if (!ano) throw BadRequestError('El año es requerido');

    const trimestreNum = trimestre ? parseInt(trimestre as string) : null;
    const anoNum = parseInt(ano as string);

    const result = await query(
      `SELECT fod.*, d.nombre as documento_nombre, d.archivo_nombre_original, 
              d.archivo_tipo_mime, d.archivo_tamanio_bytes, d.created_at as documento_created_at
       FROM fiscal_obligation_documents fod
       JOIN documents d ON fod.document_id = d.id
       WHERE fod.user_id = $1 AND fod.modelo = $2 
         AND (fod.trimestre = $3 OR ($3 IS NULL AND fod.trimestre IS NULL))
         AND fod.ano = $4
         AND d.estado = 'ACTIVO'`,
      [userId, modelo, trimestreNum, anoNum]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No hay documento para esta obligación fiscal',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// VIEW FISCAL OBLIGATION DOCUMENT - GET /api/fiscal/obligations/:modelo/view
// ============================================================================

/**
 * Visualiza el documento de una obligación fiscal (devuelve el archivo)
 * GET /api/fiscal/obligations/:modelo/view
 * Query params: trimestre (opcional), ano (requerido)
 */
export const viewFiscalObligationDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const userId = req.user.id;
    const { modelo } = req.params;
    const { trimestre, ano } = req.query;

    if (!modelo) throw BadRequestError('El modelo es requerido');
    if (!ano) throw BadRequestError('El año es requerido');

    const trimestreNum = trimestre ? parseInt(trimestre as string) : null;
    const anoNum = parseInt(ano as string);

    const result = await query(
      `SELECT d.archivo_ruta, d.archivo_nombre_original, d.archivo_tipo_mime
       FROM fiscal_obligation_documents fod
       JOIN documents d ON fod.document_id = d.id
       WHERE fod.user_id = $1 AND fod.modelo = $2 
         AND (fod.trimestre = $3 OR ($3 IS NULL AND fod.trimestre IS NULL))
         AND fod.ano = $4
         AND d.estado = 'ACTIVO'`,
      [userId, modelo, trimestreNum, anoNum]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('No hay documento para esta obligación fiscal');
    }

    const doc = result.rows[0];
    const filePath = path.join(config.upload.dir, doc.archivo_ruta);

    if (!fs.existsSync(filePath)) {
      throw NotFoundError('El archivo no existe en el servidor');
    }

    res.setHeader('Content-Type', doc.archivo_tipo_mime);
    res.setHeader('Content-Disposition', `inline; filename="${doc.archivo_nombre_original}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// DOWNLOAD FISCAL OBLIGATION DOCUMENT - GET /api/fiscal/obligations/:modelo/download
// ============================================================================

/**
 * Descarga el documento de una obligación fiscal
 * GET /api/fiscal/obligations/:modelo/download
 * Query params: trimestre (opcional), ano (requerido)
 */
export const downloadFiscalObligationDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const userId = req.user.id;
    const { modelo } = req.params;
    const { trimestre, ano } = req.query;

    if (!modelo) throw BadRequestError('El modelo es requerido');
    if (!ano) throw BadRequestError('El año es requerido');

    const trimestreNum = trimestre ? parseInt(trimestre as string) : null;
    const anoNum = parseInt(ano as string);

    const result = await query(
      `SELECT d.archivo_ruta, d.archivo_nombre_original, d.archivo_tipo_mime
       FROM fiscal_obligation_documents fod
       JOIN documents d ON fod.document_id = d.id
       WHERE fod.user_id = $1 AND fod.modelo = $2 
         AND (fod.trimestre = $3 OR ($3 IS NULL AND fod.trimestre IS NULL))
         AND fod.ano = $4
         AND d.estado = 'ACTIVO'`,
      [userId, modelo, trimestreNum, anoNum]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('No hay documento para esta obligación fiscal');
    }

    const doc = result.rows[0];
    const filePath = path.join(config.upload.dir, doc.archivo_ruta);

    if (!fs.existsSync(filePath)) {
      throw NotFoundError('El archivo no existe en el servidor');
    }

    res.setHeader('Content-Type', doc.archivo_tipo_mime);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.archivo_nombre_original}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// DELETE FISCAL OBLIGATION DOCUMENT - DELETE /api/fiscal/obligations/:modelo/document
// ============================================================================

/**
 * Elimina el documento de una obligación fiscal
 * DELETE /api/fiscal/obligations/:modelo/document
 * Query params: trimestre (opcional), ano (requerido)
 */
export const deleteFiscalObligationDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const userId = req.user.id;
    const { modelo } = req.params;
    const { trimestre, ano } = req.query;

    if (!modelo) throw BadRequestError('El modelo es requerido');
    if (!ano) throw BadRequestError('El año es requerido');

    const trimestreNum = trimestre ? parseInt(trimestre as string) : null;
    const anoNum = parseInt(ano as string);

    // Get the obligation and document
    const result = await query(
      `SELECT fod.id, fod.document_id, d.archivo_ruta
       FROM fiscal_obligation_documents fod
       JOIN documents d ON fod.document_id = d.id
       WHERE fod.user_id = $1 AND fod.modelo = $2 
         AND (fod.trimestre = $3 OR ($3 IS NULL AND fod.trimestre IS NULL))
         AND fod.ano = $4`,
      [userId, modelo, trimestreNum, anoNum]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('No hay documento para esta obligación fiscal');
    }

    const { id: obligationId, document_id: documentId, archivo_ruta } = result.rows[0];

    // Delete the file from disk
    if (archivo_ruta) {
      const filePath = path.join(config.upload.dir, archivo_ruta);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete the obligation record
    await query(`DELETE FROM fiscal_obligation_documents WHERE id = $1`, [obligationId]);

    // Delete the document record
    await query(`DELETE FROM documents WHERE id = $1`, [documentId]);

    res.json({
      success: true,
      message: 'Documento eliminado correctamente',
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// GET ALL FISCAL OBLIGATION DOCUMENTS FOR YEAR - GET /api/fiscal/obligations/year/:ano
// ============================================================================

/**
 * Obtiene todos los documentos fiscales de un año
 * GET /api/fiscal/obligations/year/:ano
 */
export const getFiscalObligationDocumentsByYear = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const userId = req.user.id;
    const { ano } = req.params;

    if (!ano) throw BadRequestError('El año es requerido');
    const anoNum = parseInt(ano);

    if (isNaN(anoNum)) throw BadRequestError('Año inválido');

    const result = await query(
      `SELECT fod.*, d.nombre as documento_nombre, d.archivo_nombre_original, 
              d.archivo_tipo_mime, d.archivo_tamanio_bytes, d.created_at as documento_created_at
       FROM fiscal_obligation_documents fod
       JOIN documents d ON fod.document_id = d.id
       WHERE fod.user_id = $1 AND fod.ano = $2 AND d.estado = 'ACTIVO'
       ORDER BY fod.modelo, fod.trimestre`,
      [userId, anoNum]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
};

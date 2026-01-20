import { Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import { query, getClient } from '../config/database';
import {
  ApiResponse,
  AuthRequest,
  Document,
  CreateDocumentDTO,
  UpdateDocumentDTO,
  CreateShareDTO,
  CreateVersionDTO,
  DocumentListFilters,
  DocumentStats,
} from '../types';
import { BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import StorageService from '../services/storage.service';
import ShareTokenGenerator from '../utils/shareTokenGenerator';
import config from '../config';

// ============================================================================
// UPLOAD DOCUMENT - POST /api/documents
// ============================================================================

/**
 * Sube un nuevo documento
 * POST /api/documents
 * Requiere: multipart/form-data con archivo + campos del formulario
 */
export const uploadDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');
    if (!req.file) throw BadRequestError('No se proporcionó ningún archivo');

    const userId = req.user.id;
    const file = req.file;

    // Parsear datos del formulario
    let userEtiquetas: string[] = req.body.etiquetas ? JSON.parse(req.body.etiquetas) : [];
    
    const documentData: CreateDocumentDTO = {
      nombre: req.body.nombre || file.originalname,
      descripcion: req.body.descripcion,
      categoria: req.body.categoria,
      tipo_documento: req.body.tipo_documento,
      fecha_documento: req.body.fecha_documento,
      fecha_vencimiento: req.body.fecha_vencimiento,
      notas: req.body.notas,
      etiquetas: userEtiquetas,
    };

    // Validar categoría (simplified categories)
    const validCategories = ['FACTURA_GASTO', 'FACTURA_INGRESO', 'CONTRATO', 'OTRO'];
    if (!validCategories.includes(documentData.categoria)) {
      throw BadRequestError('Categoría de documento inválida');
    }

    // Asignar etiquetas automáticas basadas en la categoría
    const autoTags: string[] = [];
    const categoria = documentData.categoria;
    
    // Categorías de Alta
    if (categoria === 'ALTA_HACIENDA' || categoria === 'ALTA_SEGURIDAD_SOCIAL') {
      autoTags.push('Alta');
    }
    // Categorías de Contrato
    if (categoria === 'CONTRATO_TRADE' || categoria === 'CONTRATO_ALQUILER' || 
        categoria === 'CONTRATO_SUMINISTROS' || categoria === 'CONTRATO_CLIENTE' ||
        categoria === 'CONTRATO_VIVIENDA') {
      autoTags.push('Contrato');
    }
    // Documentos de identidad y certificados
    if (categoria === 'DOCUMENTO_IDENTIDAD' || categoria === 'CERTIFICADO_DIGITAL') {
      autoTags.push('Documentación');
    }
    // Otros tipos
    if (categoria === 'APROBACION_SEPE') {
      autoTags.push('SEPE');
    }
    if (categoria === 'DOCUMENTO_BANCARIO') {
      autoTags.push('Banco');
    }
    
    // Combinar etiquetas automáticas con las del usuario (sin duplicados)
    const allTags = [...new Set([...autoTags, ...userEtiquetas])];

    // Calcular hash del archivo
    const fileHash = await StorageService.calculateFileHash(file.path);

    // Verificar si ya existe un documento con el mismo hash para este usuario
    const duplicateCheck = await query(
      `SELECT id, nombre FROM documents
       WHERE user_id = $1 AND archivo_hash_sha256 = $2 AND estado != 'ELIMINADO'`,
      [userId, fileHash]
    );

    if (duplicateCheck.rows.length > 0) {
      // Eliminar el archivo subido
      StorageService.deleteFile(file.path);

      throw BadRequestError(
        `Ya existe un documento idéntico: "${duplicateCheck.rows[0].nombre}"`,
        { duplicate_id: duplicateCheck.rows[0].id }
      );
    }

    // Obtener ruta relativa del archivo
    const relativePath = StorageService.getRelativePath(file.path);

    // Insertar en base de datos
    const insertResult = await query(
      `INSERT INTO documents (
        user_id, nombre, descripcion, categoria, tipo_documento,
        archivo_nombre_original, archivo_nombre_storage, archivo_ruta,
        archivo_tipo_mime, archivo_tamanio_bytes, archivo_hash_sha256,
        fecha_documento, fecha_vencimiento, notas, etiquetas
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        userId,
        documentData.nombre,
        documentData.descripcion,
        documentData.categoria,
        documentData.tipo_documento,
        file.originalname,
        file.filename,
        relativePath,
        file.mimetype,
        file.size,
        fileHash,
        documentData.fecha_documento,
        documentData.fecha_vencimiento,
        documentData.notas,
        allTags, // Use combined auto + user tags
      ]
    );

    const document = insertResult.rows[0];

    const response: ApiResponse = {
      success: true,
      data: document,
      info: ['Documento subido correctamente'],
      warnings: [],
    };

    // Agregar warning si el documento vence pronto
    if (documentData.fecha_vencimiento) {
      const vencimiento = new Date(documentData.fecha_vencimiento);
      const ahora = new Date();
      const diasRestantes = Math.floor((vencimiento.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));

      if (diasRestantes <= 30 && diasRestantes > 0) {
        response.warnings?.push(`Este documento vence en ${diasRestantes} días. Se te recordará automáticamente.`);
      } else if (diasRestantes <= 0) {
        response.warnings?.push('¡Atención! Este documento ya está vencido.');
      }
    }

    res.status(201).json(response);
  } catch (error) {
    // Si hay error, eliminar el archivo subido
    if (req.file) {
      StorageService.deleteFile(req.file.path);
    }
    next(error);
  }
};

// ============================================================================
// GET DOCUMENTS - GET /api/documents
// ============================================================================

/**
 * Obtiene todos los documentos del usuario con filtros
 * GET /api/documents
 */
export const getDocuments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const filters: DocumentListFilters = {
      categoria: req.query.categoria as any,
      estado: (req.query.estado as any) || 'ACTIVO',
      fecha_desde: req.query.fecha_desde as string,
      fecha_hasta: req.query.fecha_hasta as string,
      search: req.query.search as string,
      vencimiento_proximo: req.query.vencimiento_proximo === 'true',
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
      sort: (req.query.sort as any) || 'fecha_subida',
      order: (req.query.order as any) || 'desc',
    };

    let whereConditions = ['user_id = $1', 'es_version_actual = true'];
    const params: any[] = [req.user.id];
    let paramIndex = 2;

    // Filtro por estado
    whereConditions.push(`estado = $${paramIndex}`);
    params.push(filters.estado);
    paramIndex++;

    // Filtro por categoría
    if (filters.categoria) {
      whereConditions.push(`categoria = $${paramIndex}`);
      params.push(filters.categoria);
      paramIndex++;
    }

    // Filtro por fecha de documento
    if (filters.fecha_desde) {
      whereConditions.push(`fecha_documento >= $${paramIndex}`);
      params.push(filters.fecha_desde);
      paramIndex++;
    }

    if (filters.fecha_hasta) {
      whereConditions.push(`fecha_documento <= $${paramIndex}`);
      params.push(filters.fecha_hasta);
      paramIndex++;
    }

    // Filtro de búsqueda por texto
    if (filters.search) {
      whereConditions.push(
        `(nombre ILIKE $${paramIndex} OR descripcion ILIKE $${paramIndex} OR $${paramIndex} = ANY(etiquetas))`
      );
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    // Filtro por vencimiento próximo
    if (filters.vencimiento_proximo) {
      whereConditions.push(
        `fecha_vencimiento IS NOT NULL AND fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'`
      );
    }

    const whereClause = whereConditions.join(' AND ');

    // Validar campo de ordenamiento
    const validSortFields = ['fecha_subida', 'fecha_vencimiento', 'nombre'];
    const sortField = validSortFields.includes(filters.sort!) ? filters.sort : 'fecha_subida';
    const sortOrder = filters.order === 'asc' ? 'ASC' : 'DESC';

    // Obtener documentos
    const documentsResult = await query(
      `SELECT * FROM documents
       WHERE ${whereClause}
       ORDER BY ${sortField} ${sortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, filters.limit, (filters.page! - 1) * filters.limit!]
    );

    // Obtener estadísticas
    const statsResult = await query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE fecha_vencimiento IS NOT NULL AND fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') as por_vencer,
        COUNT(*) FILTER (WHERE fecha_vencimiento IS NOT NULL AND fecha_vencimiento < CURRENT_DATE) as vencidos
       FROM documents
       WHERE ${whereConditions.slice(0, -1).join(' AND ')}`,
      params.slice(0, paramIndex - 2)
    );

    const response: ApiResponse = {
      success: true,
      data: documentsResult.rows,
      meta: {
        total: parseInt(statsResult.rows[0].total),
        por_vencer: parseInt(statsResult.rows[0].por_vencer),
        vencidos: parseInt(statsResult.rows[0].vencidos),
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(parseInt(statsResult.rows[0].total) / filters.limit!),
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// GET UNIFIED DOCUMENTS - GET /api/documents/unified
// ============================================================================

/**
 * Obtiene todos los documentos de todas las fuentes (unificado)
 * GET /api/documents/unified
 * Incluye: documentos standalone, facturas de gastos, facturas de ingresos
 */
export const getUnifiedDocuments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const tipo = req.query.tipo as string; // FACTURA_GASTO, FACTURA_INGRESO, CONTRATO, OTRO (legacy)
    const etiqueta = req.query.etiqueta as string; // New: filter by tag (Fiscal, Hacienda, SS, Facturas, Gasto, Ingreso, Contrato)
    const estadoIngreso = req.query.estado_ingreso as string; // PAGADA, PENDIENTE, VENCIDA, CANCELADA, or 'todos'

    // Build invoice estado filter condition
    const invoiceEstadoCondition = estadoIngreso && estadoIngreso !== 'todos'
      ? `AND estado = '${estadoIngreso}'`
      : '';

    // Build unified query using UNION ALL from all sources
    // Each source includes computed 'etiquetas' based on the document type
    let unifiedQuery = `
      WITH unified_docs AS (
        -- Standalone documents from documents table
        SELECT
          'document' as source_type,
          id::text as source_id,
          id as doc_id,
          user_id,
          nombre,
          categoria,
          archivo_nombre_original as nombre_archivo,
          archivo_ruta as ruta,
          archivo_tipo_mime as tipo_mime,
          archivo_tamanio_bytes as tamanio,
          fecha_documento,
          fecha_subida as created_at,
          NULL::integer as gasto_id,
          NULL::integer as factura_id,
          NULL::varchar as estado_ingreso,
          etiquetas
        FROM documents
        WHERE user_id = $1
          AND estado = 'ACTIVO'
          AND es_version_actual = true
          AND EXTRACT(YEAR FROM COALESCE(fecha_documento, fecha_subida)) = $2

        UNION ALL

        -- Bills attached to expenses
        SELECT
          'expense' as source_type,
          id::text as source_id,
          NULL as doc_id,
          user_id,
          concepto as nombre,
          'FACTURA_GASTO' as categoria,
          archivo_nombre as nombre_archivo,
          archivo_url as ruta,
          archivo_tipo as tipo_mime,
          0 as tamanio,
          fecha_emision as fecha_documento,
          created_at,
          id as gasto_id,
          NULL::integer as factura_id,
          NULL::varchar as estado_ingreso,
          ARRAY['Facturas', 'Gasto']::text[] as etiquetas
        FROM expenses
        WHERE user_id = $1
          AND archivo_url IS NOT NULL
          AND archivo_url != ''
          AND EXTRACT(YEAR FROM fecha_emision) = $2

        UNION ALL

        -- Auto-generated invoice PDFs
        SELECT
          'invoice' as source_type,
          id::text as source_id,
          NULL as doc_id,
          user_id,
          CONCAT('Factura ', numero_factura) as nombre,
          'FACTURA_INGRESO' as categoria,
          CONCAT('factura_', REPLACE(numero_factura, '/', '-'), '.pdf') as nombre_archivo,
          pdf_url as ruta,
          'application/pdf' as tipo_mime,
          0 as tamanio,
          fecha_emision as fecha_documento,
          created_at,
          NULL::integer as gasto_id,
          id as factura_id,
          estado as estado_ingreso,
          ARRAY['Facturas', 'Ingreso']::text[] as etiquetas
        FROM facturas_emitidas
        WHERE user_id = $1
          AND pdf_generado = true
          AND pdf_url IS NOT NULL
          AND EXTRACT(YEAR FROM fecha_emision) = $2
          ${invoiceEstadoCondition}

        UNION ALL

        -- Contracts from programaciones (tipo GASTO or INGRESO determines extra tag)
        SELECT
          'programacion' as source_type,
          id::text as source_id,
          NULL as doc_id,
          user_id,
          nombre,
          'CONTRATO' as categoria,
          contrato_datos_extraidos->>'archivo_nombre' as nombre_archivo,
          contrato_datos_extraidos->>'archivo_url' as ruta,
          COALESCE(contrato_datos_extraidos->>'archivo_tipo', 'application/pdf') as tipo_mime,
          COALESCE((contrato_datos_extraidos->>'archivo_tamanio')::integer, 0) as tamanio,
          (contrato_datos_extraidos->>'fecha_inicio')::date as fecha_documento,
          created_at,
          NULL::integer as gasto_id,
          NULL::integer as factura_id,
          NULL::varchar as estado_ingreso,
          CASE 
            WHEN tipo = 'GASTO' THEN ARRAY['Facturas', 'Gasto', 'Contrato']::text[]
            WHEN tipo = 'INGRESO' THEN ARRAY['Facturas', 'Ingreso', 'Contrato']::text[]
            ELSE ARRAY['Contrato']::text[]
          END as etiquetas
        FROM programaciones
        WHERE user_id = $1
          AND contrato_datos_extraidos IS NOT NULL
          AND contrato_datos_extraidos->>'archivo_url' IS NOT NULL
          AND EXTRACT(YEAR FROM (contrato_datos_extraidos->>'fecha_inicio')::date) = $2
      )
      SELECT * FROM unified_docs
    `;

    const params: any[] = [req.user.id, year];
    let paramIndex = 3;
    const whereConditions: string[] = [];

    // Filter by etiqueta (new tag-based filtering)
    if (etiqueta && etiqueta !== 'todos') {
      whereConditions.push(`$${paramIndex} = ANY(etiquetas)`);
      params.push(etiqueta);
      paramIndex++;
    }
    
    // Filter by tipo (legacy categoria-based filtering) - for backwards compatibility
    if (tipo && tipo !== 'todos' && !etiqueta) {
      whereConditions.push(`categoria = $${paramIndex}`);
      params.push(tipo);
      paramIndex++;
    }

    if (whereConditions.length > 0) {
      unifiedQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    unifiedQuery += ` ORDER BY fecha_documento DESC NULLS LAST, created_at DESC`;

    const documentsResult = await query(unifiedQuery, params);

    // Get stats by etiquetas (tag-based counts)
    const statsQuery = `
      WITH unified_with_tags AS (
        -- Standalone documents
        SELECT etiquetas
        FROM documents
        WHERE user_id = $1 AND estado = 'ACTIVO' AND es_version_actual = true
          AND EXTRACT(YEAR FROM COALESCE(fecha_documento, fecha_subida)) = $2

        UNION ALL

        -- Expenses
        SELECT ARRAY['Facturas', 'Gasto']::text[] as etiquetas
        FROM expenses
        WHERE user_id = $1 AND archivo_url IS NOT NULL AND archivo_url != ''
          AND EXTRACT(YEAR FROM fecha_emision) = $2

        UNION ALL

        -- Invoices
        SELECT ARRAY['Facturas', 'Ingreso']::text[] as etiquetas
        FROM facturas_emitidas
        WHERE user_id = $1 AND pdf_generado = true AND pdf_url IS NOT NULL
          AND EXTRACT(YEAR FROM fecha_emision) = $2
          ${invoiceEstadoCondition}

        UNION ALL

        -- Programaciones (contracts)
        SELECT CASE 
          WHEN tipo = 'GASTO' THEN ARRAY['Facturas', 'Gasto', 'Contrato']::text[]
          WHEN tipo = 'INGRESO' THEN ARRAY['Facturas', 'Ingreso', 'Contrato']::text[]
          ELSE ARRAY['Contrato']::text[]
        END as etiquetas
        FROM programaciones
        WHERE user_id = $1 AND contrato_datos_extraidos IS NOT NULL
          AND contrato_datos_extraidos->>'archivo_url' IS NOT NULL
          AND EXTRACT(YEAR FROM (contrato_datos_extraidos->>'fecha_inicio')::date) = $2
      )
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE 'Fiscal' = ANY(etiquetas)) as fiscal,
        COUNT(*) FILTER (WHERE 'Hacienda' = ANY(etiquetas)) as hacienda,
        COUNT(*) FILTER (WHERE 'SS' = ANY(etiquetas)) as ss,
        COUNT(*) FILTER (WHERE 'Facturas' = ANY(etiquetas)) as facturas,
        COUNT(*) FILTER (WHERE 'Gasto' = ANY(etiquetas)) as gastos,
        COUNT(*) FILTER (WHERE 'Ingreso' = ANY(etiquetas)) as ingresos,
        COUNT(*) FILTER (WHERE 'Contrato' = ANY(etiquetas)) as contratos
      FROM unified_with_tags
    `;

    const statsResult = await query(statsQuery, [req.user.id, year]);

    // Get available years
    const yearsQuery = `
      SELECT DISTINCT year FROM (
        SELECT EXTRACT(YEAR FROM COALESCE(fecha_documento, fecha_subida))::integer as year
        FROM documents WHERE user_id = $1 AND estado = 'ACTIVO'

        UNION

        SELECT EXTRACT(YEAR FROM fecha_emision)::integer as year
        FROM expenses WHERE user_id = $1 AND archivo_url IS NOT NULL

        UNION

        SELECT EXTRACT(YEAR FROM fecha_emision)::integer as year
        FROM facturas_emitidas WHERE user_id = $1 AND pdf_generado = true

        UNION

        SELECT EXTRACT(YEAR FROM (contrato_datos_extraidos->>'fecha_inicio')::date)::integer as year
        FROM programaciones WHERE user_id = $1
          AND contrato_datos_extraidos IS NOT NULL
          AND contrato_datos_extraidos->>'archivo_url' IS NOT NULL
      ) years
      WHERE year IS NOT NULL
      ORDER BY year DESC
    `;

    const yearsResult = await query(yearsQuery, [req.user.id]);

    const response: ApiResponse = {
      success: true,
      data: documentsResult.rows,
      meta: {
        year,
        available_years: yearsResult.rows.map(r => r.year),
        stats: {
          total: parseInt(statsResult.rows[0].total) || 0,
          fiscal: parseInt(statsResult.rows[0].fiscal) || 0,
          hacienda: parseInt(statsResult.rows[0].hacienda) || 0,
          ss: parseInt(statsResult.rows[0].ss) || 0,
          facturas: parseInt(statsResult.rows[0].facturas) || 0,
          gastos: parseInt(statsResult.rows[0].gastos) || 0,
          ingresos: parseInt(statsResult.rows[0].ingresos) || 0,
          contratos: parseInt(statsResult.rows[0].contratos) || 0,
        },
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// VIEW UNIFIED DOCUMENT - GET /api/documents/view/:sourceType/:id
// ============================================================================

/**
 * Visualiza un documento desde cualquier fuente
 * GET /api/documents/view/:sourceType/:id
 */
export const viewUnifiedDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { sourceType, id } = req.params;

    let filePath: string;
    let fileName: string;
    let mimeType: string;

    if (sourceType === 'expense') {
      // Get expense file
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

      const relativePath = expense.archivo_url.replace(/^\/uploads\//, '');
      filePath = path.resolve(config.upload.dir, relativePath);
      fileName = expense.archivo_nombre || 'documento';
      mimeType = expense.archivo_tipo || 'application/octet-stream';

    } else if (sourceType === 'invoice') {
      // Get invoice PDF
      const result = await query(
        'SELECT pdf_url, numero_factura FROM facturas_emitidas WHERE id = $1 AND user_id = $2 AND pdf_generado = true',
        [id, req.user.id]
      );

      if (result.rows.length === 0) {
        throw NotFoundError('Factura no encontrada o PDF no disponible');
      }

      const invoice = result.rows[0];
      filePath = path.join(config.upload.dir, invoice.pdf_url);
      fileName = `factura_${invoice.numero_factura.replace(/\//g, '-')}.pdf`;
      mimeType = 'application/pdf';

    } else if (sourceType === 'document') {
      // Get standalone document
      const result = await query(
        'SELECT archivo_ruta, archivo_nombre_original, archivo_tipo_mime FROM documents WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );

      if (result.rows.length === 0) {
        throw NotFoundError('Documento no encontrado');
      }

      const document = result.rows[0];
      filePath = StorageService.getAbsolutePath(document.archivo_ruta);
      fileName = document.archivo_nombre_original;
      mimeType = document.archivo_tipo_mime;

    } else if (sourceType === 'programacion') {
      // Get contract from programacion
      const result = await query(
        `SELECT contrato_datos_extraidos, nombre FROM programaciones WHERE id = $1 AND user_id = $2`,
        [id, req.user.id]
      );

      if (result.rows.length === 0) {
        throw NotFoundError('Programacion no encontrada');
      }

      const programacion = result.rows[0];
      const contratoData = programacion.contrato_datos_extraidos;

      if (!contratoData || !contratoData.archivo_url) {
        throw NotFoundError('Esta programacion no tiene contrato adjunto');
      }

      const relativePath = contratoData.archivo_url.replace(/^\/uploads\//, '');
      filePath = path.resolve(config.upload.dir, relativePath);
      fileName = contratoData.archivo_nombre || `contrato_${programacion.nombre}.pdf`;
      mimeType = contratoData.archivo_tipo || 'application/pdf';

    } else {
      throw BadRequestError('Tipo de fuente inválido');
    }

    // Verify file exists
    if (!StorageService.fileExists(filePath)) {
      throw NotFoundError('Archivo no encontrado en el servidor');
    }

    // Set headers for inline viewing
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);

    // Send file
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error al servir archivo:', err);
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// DOWNLOAD UNIFIED DOCUMENT - GET /api/documents/download/:sourceType/:id
// ============================================================================

/**
 * Descarga un documento desde cualquier fuente
 * GET /api/documents/download/:sourceType/:id
 */
export const downloadUnifiedDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { sourceType, id } = req.params;

    let filePath: string;
    let fileName: string;

    if (sourceType === 'expense') {
      const result = await query(
        'SELECT archivo_url, archivo_nombre FROM expenses WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );

      if (result.rows.length === 0) {
        throw NotFoundError('Gasto no encontrado');
      }

      const expense = result.rows[0];
      if (!expense.archivo_url) {
        throw NotFoundError('Este gasto no tiene archivo adjunto');
      }

      const relativePath = expense.archivo_url.replace(/^\/uploads\//, '');
      filePath = path.resolve(config.upload.dir, relativePath);
      fileName = expense.archivo_nombre || 'documento';

    } else if (sourceType === 'invoice') {
      const result = await query(
        'SELECT pdf_url, numero_factura FROM facturas_emitidas WHERE id = $1 AND user_id = $2 AND pdf_generado = true',
        [id, req.user.id]
      );

      if (result.rows.length === 0) {
        throw NotFoundError('Factura no encontrada o PDF no disponible');
      }

      const invoice = result.rows[0];
      filePath = path.join(config.upload.dir, invoice.pdf_url);
      fileName = `factura_${invoice.numero_factura.replace(/\//g, '-')}.pdf`;

    } else if (sourceType === 'document') {
      const result = await query(
        'SELECT archivo_ruta, archivo_nombre_original FROM documents WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );

      if (result.rows.length === 0) {
        throw NotFoundError('Documento no encontrado');
      }

      const document = result.rows[0];
      filePath = StorageService.getAbsolutePath(document.archivo_ruta);
      fileName = document.archivo_nombre_original;

    } else if (sourceType === 'programacion') {
      // Get contract from programacion
      const result = await query(
        `SELECT contrato_datos_extraidos, nombre FROM programaciones WHERE id = $1 AND user_id = $2`,
        [id, req.user.id]
      );

      if (result.rows.length === 0) {
        throw NotFoundError('Programacion no encontrada');
      }

      const programacion = result.rows[0];
      const contratoData = programacion.contrato_datos_extraidos;

      if (!contratoData || !contratoData.archivo_url) {
        throw NotFoundError('Esta programacion no tiene contrato adjunto');
      }

      const relativePath = contratoData.archivo_url.replace(/^\/uploads\//, '');
      filePath = path.resolve(config.upload.dir, relativePath);
      fileName = contratoData.archivo_nombre || `contrato_${programacion.nombre}.pdf`;

    } else {
      throw BadRequestError('Tipo de fuente inválido');
    }

    // Verify file exists
    if (!StorageService.fileExists(filePath)) {
      throw NotFoundError('Archivo no encontrado en el servidor');
    }

    // Download file
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error al descargar archivo:', err);
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// DELETE UNIFIED DOCUMENT - DELETE /api/documents/unified/:sourceType/:id
// ============================================================================

/**
 * Elimina un documento desde cualquier fuente
 * DELETE /api/documents/unified/:sourceType/:id
 * 
 * Para expense: Elimina el archivo adjunto del gasto (no el gasto en sí)
 * Para document: Soft delete del documento standalone
 * Para programacion: Elimina el contrato adjunto (no la programación)
 * Para invoice: No permitido (los PDFs son parte integral de las facturas)
 */
export const deleteUnifiedDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { sourceType, id } = req.params;

    if (sourceType === 'expense') {
      // Get expense file info
      const result = await query(
        'SELECT archivo_url, archivo_nombre FROM expenses WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );

      if (result.rows.length === 0) {
        throw NotFoundError('Gasto no encontrado');
      }

      const expense = result.rows[0];
      if (!expense.archivo_url) {
        throw NotFoundError('Este gasto no tiene archivo adjunto');
      }

      // Delete the physical file
      const relativePath = expense.archivo_url.replace(/^\/uploads\//, '');
      const absolutePath = path.resolve(config.upload.dir, relativePath);
      
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }

      // Clear file fields from expense
      await query(
        `UPDATE expenses SET archivo_url = NULL, archivo_nombre = NULL, archivo_tipo = NULL WHERE id = $1`,
        [id]
      );

      res.json({
        success: true,
        message: 'Documento del gasto eliminado correctamente',
      });

    } else if (sourceType === 'invoice') {
      // Invoices PDFs cannot be deleted separately - they are part of the invoice
      throw BadRequestError('Los PDFs de facturas no se pueden eliminar por separado. Elimina la factura completa desde Facturas.');

    } else if (sourceType === 'document') {
      // Soft delete standalone document
      const result = await query(
        `SELECT * FROM documents WHERE id = $1 AND user_id = $2`,
        [id, req.user.id]
      );

      if (result.rows.length === 0) {
        throw NotFoundError('Documento no encontrado');
      }

      // Soft delete
      await query(
        `UPDATE documents SET estado = 'ELIMINADO' WHERE id = $1`,
        [id]
      );

      res.json({
        success: true,
        message: 'Documento eliminado correctamente',
      });

    } else if (sourceType === 'programacion') {
      // Get contract info from programacion
      const result = await query(
        `SELECT contrato_document_id, contrato_datos_extraidos FROM programaciones WHERE id = $1 AND user_id = $2`,
        [id, req.user.id]
      );

      if (result.rows.length === 0) {
        throw NotFoundError('Programación no encontrada');
      }

      const programacion = result.rows[0];
      const contratoData = programacion.contrato_datos_extraidos;

      if (!contratoData && !programacion.contrato_document_id) {
        throw NotFoundError('Esta programación no tiene contrato adjunto');
      }

      // Delete physical file if exists
      if (contratoData?.archivo_url) {
        const relativePath = contratoData.archivo_url.replace(/^\/uploads\//, '');
        const absolutePath = path.resolve(config.upload.dir, relativePath);
        
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      }

      // If there's a linked document in documents table, soft delete it
      if (programacion.contrato_document_id) {
        await query(
          `UPDATE documents SET estado = 'ELIMINADO' WHERE id = $1`,
          [programacion.contrato_document_id]
        );
      }

      // Clear contract fields from programacion
      await query(
        `UPDATE programaciones SET contrato_document_id = NULL, contrato_datos_extraidos = NULL, contrato_confianza = NULL WHERE id = $1`,
        [id]
      );

      res.json({
        success: true,
        message: 'Contrato de la programación eliminado correctamente',
      });

    } else {
      throw BadRequestError('Tipo de fuente inválido');
    }
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// GET DOCUMENT - GET /api/documents/:id
// ============================================================================

/**
 * Obtiene un documento específico con sus versiones
 * GET /api/documents/:id
 */
export const getDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const documentId = req.params.id;

    // Obtener documento
    const documentResult = await query(
      `SELECT * FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, req.user.id]
    );

    if (documentResult.rows.length === 0) {
      throw NotFoundError('Documento no encontrado');
    }

    const document = documentResult.rows[0];

    // Obtener versiones
    const versionsResult = await query(
      `SELECT * FROM document_versions
       WHERE document_id = $1
       ORDER BY version_number DESC`,
      [documentId]
    );

    const response: ApiResponse = {
      success: true,
      data: {
        ...document,
        versiones: versionsResult.rows,
        version_count: versionsResult.rows.length,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// DOWNLOAD DOCUMENT - GET /api/documents/:id/download
// ============================================================================

/**
 * Descarga un documento
 * GET /api/documents/:id/download
 */
export const downloadDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const documentId = req.params.id;

    // Obtener documento
    const documentResult = await query(
      `SELECT * FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, req.user.id]
    );

    if (documentResult.rows.length === 0) {
      throw NotFoundError('Documento no encontrado');
    }

    const document = documentResult.rows[0];

    // Construir ruta absoluta
    const filePath = StorageService.getAbsolutePath(document.archivo_ruta);

    // Verificar seguridad (path traversal)
    if (!StorageService.isPathSafe(document.archivo_ruta)) {
      throw ForbiddenError('Acceso denegado');
    }

    // Verificar que el archivo existe
    if (!StorageService.fileExists(filePath)) {
      throw NotFoundError('Archivo no encontrado en el servidor');
    }

    // Descargar archivo
    res.download(filePath, document.archivo_nombre_original, (err) => {
      if (err) {
        console.error('Error al descargar archivo:', err);
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// VIEW DOCUMENT - GET /api/documents/:id/view
// ============================================================================

/**
 * Visualiza un documento (para mostrar en navegador en lugar de descargar)
 * GET /api/documents/:id/view
 */
export const viewDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const documentId = req.params.id;

    // Obtener documento
    const documentResult = await query(
      `SELECT * FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, req.user.id]
    );

    if (documentResult.rows.length === 0) {
      throw NotFoundError('Documento no encontrado');
    }

    const document = documentResult.rows[0];

    // Construir ruta absoluta
    const filePath = StorageService.getAbsolutePath(document.archivo_ruta);

    // Verificar seguridad (path traversal)
    if (!StorageService.isPathSafe(document.archivo_ruta)) {
      throw ForbiddenError('Acceso denegado');
    }

    // Verificar que el archivo existe
    if (!StorageService.fileExists(filePath)) {
      throw NotFoundError('Archivo no encontrado en el servidor');
    }

    // Configurar headers para visualización en navegador
    res.setHeader('Content-Type', document.archivo_tipo_mime);
    res.setHeader('Content-Disposition', `inline; filename="${document.archivo_nombre_original}"`);

    // Servir archivo
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error al servir archivo:', err);
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// UPDATE DOCUMENT - PATCH /api/documents/:id
// ============================================================================

/**
 * Actualiza los metadatos de un documento
 * PATCH /api/documents/:id
 */
export const updateDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const documentId = req.params.id;
    const updates: UpdateDocumentDTO = req.body;

    // Verificar que el documento existe y pertenece al usuario
    const documentResult = await query(
      `SELECT * FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, req.user.id]
    );

    if (documentResult.rows.length === 0) {
      throw NotFoundError('Documento no encontrado');
    }

    // Construir query de actualización dinámica
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.nombre !== undefined) {
      updateFields.push(`nombre = $${paramIndex}`);
      params.push(updates.nombre);
      paramIndex++;
    }

    if (updates.descripcion !== undefined) {
      updateFields.push(`descripcion = $${paramIndex}`);
      params.push(updates.descripcion);
      paramIndex++;
    }

    if (updates.categoria !== undefined) {
      updateFields.push(`categoria = $${paramIndex}`);
      params.push(updates.categoria);
      paramIndex++;
    }

    if (updates.tipo_documento !== undefined) {
      updateFields.push(`tipo_documento = $${paramIndex}`);
      params.push(updates.tipo_documento);
      paramIndex++;
    }

    if (updates.fecha_documento !== undefined) {
      updateFields.push(`fecha_documento = $${paramIndex}`);
      params.push(updates.fecha_documento || null);
      paramIndex++;
    }

    if (updates.fecha_vencimiento !== undefined) {
      updateFields.push(`fecha_vencimiento = $${paramIndex}`);
      params.push(updates.fecha_vencimiento || null);
      paramIndex++;
    }

    if (updates.notas !== undefined) {
      updateFields.push(`notas = $${paramIndex}`);
      params.push(updates.notas);
      paramIndex++;
    }

    if (updates.etiquetas !== undefined) {
      updateFields.push(`etiquetas = $${paramIndex}`);
      params.push(updates.etiquetas);
      paramIndex++;
    }

    if (updates.estado !== undefined) {
      updateFields.push(`estado = $${paramIndex}`);
      params.push(updates.estado);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      throw BadRequestError('No se proporcionaron campos para actualizar');
    }

    // Ejecutar actualización
    params.push(documentId, req.user.id);
    const updateResult = await query(
      `UPDATE documents
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      params
    );

    const response: ApiResponse = {
      success: true,
      data: updateResult.rows[0],
      info: ['Documento actualizado correctamente'],
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// DELETE DOCUMENT - DELETE /api/documents/:id
// ============================================================================

/**
 * Elimina un documento (soft delete)
 * DELETE /api/documents/:id
 */
export const deleteDocument = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const documentId = req.params.id;
    const hardDelete = req.query.hard === 'true'; // Para eliminar físicamente

    // Verificar que el documento existe y pertenece al usuario
    const documentResult = await query(
      `SELECT * FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, req.user.id]
    );

    if (documentResult.rows.length === 0) {
      throw NotFoundError('Documento no encontrado');
    }

    const document = documentResult.rows[0];

    if (hardDelete) {
      // Eliminación física
      const client = await getClient();

      try {
        await client.query('BEGIN');

        // Eliminar de base de datos (CASCADE eliminará versiones, shares, logs)
        await client.query('DELETE FROM documents WHERE id = $1', [documentId]);

        // Eliminar archivo físico
        const filePath = StorageService.getAbsolutePath(document.archivo_ruta);
        StorageService.deleteFile(filePath);

        // Eliminar versiones físicas
        const versionsResult = await client.query(
          'SELECT archivo_ruta FROM document_versions WHERE document_id = $1',
          [documentId]
        );

        for (const version of versionsResult.rows) {
          const versionPath = StorageService.getAbsolutePath(version.archivo_ruta);
          StorageService.deleteFile(versionPath);
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      res.json({
        success: true,
        info: ['Documento eliminado permanentemente'],
      });
    } else {
      // Soft delete
      await query(
        `UPDATE documents SET estado = 'ELIMINADO' WHERE id = $1`,
        [documentId]
      );

      res.json({
        success: true,
        info: ['Documento marcado como eliminado. Puedes restaurarlo desde la papelera.'],
      });
    }
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// UPLOAD VERSION - POST /api/documents/:id/versions
// ============================================================================

/**
 * Sube una nueva versión de un documento existente
 * POST /api/documents/:id/versions
 */
export const uploadVersion = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');
    if (!req.file) throw BadRequestError('No se proporcionó ningún archivo');

    const documentId = req.params.id;
    const userId = req.user.id;
    const file = req.file;

    const versionData: CreateVersionDTO = {
      motivo_cambio: req.body.motivo_cambio,
      descripcion: req.body.descripcion,
      fecha_documento: req.body.fecha_documento,
    };

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Obtener documento actual
      const documentResult = await client.query(
        `SELECT * FROM documents WHERE id = $1 AND user_id = $2`,
        [documentId, userId]
      );

      if (documentResult.rows.length === 0) {
        throw NotFoundError('Documento no encontrado');
      }

      const currentDocument = documentResult.rows[0];

      // Calcular hash del nuevo archivo
      const fileHash = await StorageService.calculateFileHash(file.path);

      // Crear registro de versión anterior
      await client.query(
        `INSERT INTO document_versions (
          document_id, version_number, archivo_nombre_storage, archivo_ruta,
          archivo_tamanio_bytes, archivo_hash_sha256, nombre, descripcion,
          fecha_documento, creado_por_user_id, motivo_cambio
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          documentId,
          currentDocument.version,
          currentDocument.archivo_nombre_storage,
          currentDocument.archivo_ruta,
          currentDocument.archivo_tamanio_bytes,
          currentDocument.archivo_hash_sha256,
          currentDocument.nombre,
          currentDocument.descripcion,
          currentDocument.fecha_documento,
          userId,
          versionData.motivo_cambio,
        ]
      );

      // Mover archivo antiguo a carpeta versions
      StorageService.moveToVersionsFolder(
        userId,
        currentDocument.archivo_nombre_storage,
        currentDocument.version
      );

      // Obtener ruta relativa del nuevo archivo
      const relativePath = StorageService.getRelativePath(file.path);

      // Actualizar documento con nueva versión
      const updateResult = await client.query(
        `UPDATE documents SET
          archivo_nombre_original = $1,
          archivo_nombre_storage = $2,
          archivo_ruta = $3,
          archivo_tipo_mime = $4,
          archivo_tamanio_bytes = $5,
          archivo_hash_sha256 = $6,
          version = version + 1,
          descripcion = COALESCE($7, descripcion),
          fecha_documento = COALESCE($8, fecha_documento)
        WHERE id = $9
        RETURNING *`,
        [
          file.originalname,
          file.filename,
          relativePath,
          file.mimetype,
          file.size,
          fileHash,
          versionData.descripcion,
          versionData.fecha_documento,
          documentId,
        ]
      );

      await client.query('COMMIT');

      const response: ApiResponse = {
        success: true,
        data: updateResult.rows[0],
        info: [`Nueva versión ${updateResult.rows[0].version} subida correctamente`],
      };

      res.json(response);
    } catch (error) {
      await client.query('ROLLBACK');
      // Eliminar archivo subido en caso de error
      if (file) {
        StorageService.deleteFile(file.path);
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// GET VERSIONS - GET /api/documents/:id/versions
// ============================================================================

/**
 * Obtiene el historial de versiones de un documento
 * GET /api/documents/:id/versions
 */
export const getVersions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const documentId = req.params.id;

    // Verificar ownership
    const documentResult = await query(
      `SELECT id FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, req.user.id]
    );

    if (documentResult.rows.length === 0) {
      throw NotFoundError('Documento no encontrado');
    }

    // Obtener versiones
    const versionsResult = await query(
      `SELECT * FROM document_versions
       WHERE document_id = $1
       ORDER BY version_number DESC`,
      [documentId]
    );

    const response: ApiResponse = {
      success: true,
      data: versionsResult.rows,
      meta: {
        total: versionsResult.rows.length,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// CREATE SHARE - POST /api/documents/:id/share
// ============================================================================

/**
 * Crea un enlace compartido para un documento
 * POST /api/documents/:id/share
 */
export const createShare = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const documentId = req.params.id;
    const shareData: CreateShareDTO = req.body;

    // Verificar que el documento existe y pertenece al usuario
    const documentResult = await query(
      `SELECT * FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, req.user.id]
    );

    if (documentResult.rows.length === 0) {
      throw NotFoundError('Documento no encontrado');
    }

    // Generar token único
    const token = ShareTokenGenerator.generate();

    // Calcular fecha de expiración
    const duracionHoras = shareData.duracion_horas || 72; // Default: 3 días
    const fechaExpiracion = new Date();
    fechaExpiracion.setHours(fechaExpiracion.getHours() + duracionHoras);

    // Hashear contraseña si se proporciona
    let passwordHash = null;
    if (shareData.requiere_password && shareData.password) {
      passwordHash = await bcrypt.hash(shareData.password, 10);
    }

    // Crear share
    const shareResult = await query(
      `INSERT INTO document_shares (
        document_id, user_id, token, fecha_expiracion,
        requiere_password, password_hash, max_accesos,
        nombre_destinatario, email_destinatario, notas
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        documentId,
        req.user.id,
        token,
        fechaExpiracion,
        shareData.requiere_password || false,
        passwordHash,
        shareData.max_accesos,
        shareData.nombre_destinatario,
        shareData.email_destinatario,
        shareData.notas,
      ]
    );

    const share = shareResult.rows[0];

    // Construir URL completa
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const shareUrl = `${frontendUrl}/shared/${token}`;

    const response: ApiResponse = {
      success: true,
      data: {
        ...share,
        url: shareUrl,
      },
      info: ['Enlace compartido creado correctamente'],
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// GET SHARES - GET /api/documents/:id/shares
// ============================================================================

/**
 * Obtiene todos los enlaces compartidos activos de un documento
 * GET /api/documents/:id/shares
 */
export const getShares = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const documentId = req.params.id;

    // Verificar ownership
    const documentResult = await query(
      `SELECT id FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, req.user.id]
    );

    if (documentResult.rows.length === 0) {
      throw NotFoundError('Documento no encontrado');
    }

    // Obtener shares
    const sharesResult = await query(
      `SELECT * FROM document_shares
       WHERE document_id = $1
       ORDER BY created_at DESC`,
      [documentId]
    );

    // Agregar URL a cada share
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const sharesWithUrls = sharesResult.rows.map((share) => ({
      ...share,
      url: `${frontendUrl}/shared/${share.token}`,
    }));

    const response: ApiResponse = {
      success: true,
      data: sharesWithUrls,
      meta: {
        total: sharesResult.rows.length,
        activos: sharesResult.rows.filter((s) => s.activo).length,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// REVOKE SHARE - DELETE /api/shares/:shareId
// ============================================================================

/**
 * Revoca un enlace compartido
 * DELETE /api/shares/:shareId
 */
export const revokeShare = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const shareId = req.params.shareId;

    // Verificar ownership
    const shareResult = await query(
      `SELECT * FROM document_shares WHERE id = $1 AND user_id = $2`,
      [shareId, req.user.id]
    );

    if (shareResult.rows.length === 0) {
      throw NotFoundError('Enlace compartido no encontrado');
    }

    // Desactivar share
    await query(
      `UPDATE document_shares SET activo = false WHERE id = $1`,
      [shareId]
    );

    res.json({
      success: true,
      info: ['Enlace compartido revocado correctamente'],
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// ACCESS SHARED - GET /api/shared/:token (PÚBLICO - sin autenticación)
// ============================================================================

/**
 * Accede a un documento compartido mediante token (sin autenticación)
 * GET /api/shared/:token
 */
export const accessShared = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.params.token;
    const password = req.query.password as string;

    // Obtener share
    const shareResult = await query(
      `SELECT ds.id as share_id, ds.*, d.*
       FROM document_shares ds
       JOIN documents d ON ds.document_id = d.id
       WHERE ds.token = $1`,
      [token]
    );

    if (shareResult.rows.length === 0) {
      throw NotFoundError('Enlace no encontrado o expirado');
    }

    const share = shareResult.rows[0];
    const shareId = share.share_id; // Use explicit share_id from alias
    const clientIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Verificar si está activo
    if (!share.activo) {
      await query(
        `INSERT INTO document_access_logs (document_share_id, ip_address, user_agent, accion, exitoso, mensaje_error)
         VALUES ($1, $2, $3, 'VIEW', false, 'Enlace desactivado')`,
        [shareId, clientIp, userAgent]
      );
      throw ForbiddenError('Este enlace ha sido desactivado');
    }

    // Verificar expiración
    if (new Date(share.fecha_expiracion) < new Date()) {
      await query(
        `UPDATE document_shares SET activo = false WHERE id = $1`,
        [shareId]
      );
      await query(
        `INSERT INTO document_access_logs (document_share_id, ip_address, user_agent, accion, exitoso, mensaje_error)
         VALUES ($1, $2, $3, 'EXPIRED', false, 'Enlace expirado')`,
        [shareId, clientIp, userAgent]
      );
      throw ForbiddenError('Este enlace ha expirado');
    }

    // Verificar límite de accesos
    if (share.max_accesos && share.accesos_realizados >= share.max_accesos) {
      await query(
        `INSERT INTO document_access_logs (document_share_id, ip_address, user_agent, accion, exitoso, mensaje_error)
         VALUES ($1, $2, $3, 'VIEW', false, 'Límite de accesos alcanzado')`,
        [shareId, clientIp, userAgent]
      );
      throw ForbiddenError('Se ha alcanzado el límite de accesos para este enlace');
    }

    // Verificar contraseña si es requerida
    if (share.requiere_password) {
      if (!password) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'PASSWORD_REQUIRED',
            message: 'Este enlace requiere contraseña',
          },
        });
      }

      const passwordValid = await bcrypt.compare(password, share.password_hash);
      if (!passwordValid) {
        await query(
          `INSERT INTO document_access_logs (document_share_id, ip_address, user_agent, accion, exitoso, mensaje_error)
           VALUES ($1, $2, $3, 'FAILED_PASSWORD', false, 'Contraseña incorrecta')`,
          [shareId, clientIp, userAgent]
        );
        throw ForbiddenError('Contraseña incorrecta');
      }
    }

    // Registrar acceso exitoso
    await query(
      `INSERT INTO document_access_logs (document_share_id, ip_address, user_agent, accion, exitoso)
       VALUES ($1, $2, $3, 'VIEW', true)`,
      [shareId, clientIp, userAgent]
    );

    // Si es descarga, servir el archivo
    if (req.query.download === 'true') {
      const filePath = StorageService.getAbsolutePath(share.archivo_ruta);

      if (!StorageService.fileExists(filePath)) {
        throw NotFoundError('Archivo no encontrado');
      }

      await query(
        `INSERT INTO document_access_logs (document_share_id, ip_address, user_agent, accion, exitoso)
         VALUES ($1, $2, $3, 'DOWNLOAD', true)`,
        [shareId, clientIp, userAgent]
      );

      return res.download(filePath, share.archivo_nombre_original);
    }

    // Retornar información del documento (para vista previa)
    const response: ApiResponse = {
      success: true,
      data: {
        nombre: share.nombre,
        descripcion: share.descripcion,
        categoria: share.categoria,
        archivo_tipo_mime: share.archivo_tipo_mime,
        archivo_tamanio_bytes: share.archivo_tamanio_bytes,
        fecha_documento: share.fecha_documento,
        accesos_restantes: share.max_accesos ? share.max_accesos - share.accesos_realizados - 1 : null,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

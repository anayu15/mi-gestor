import { Response, NextFunction } from 'express';
import { query, getClient } from '../config/database';
import { ApiResponse, AuthRequest } from '../types';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../middleware/errorHandler';
import {
  calcularCuotaIVA,
  calcularCuotaIRPF,
  calcularTotalFactura,
  validarCalculoIVA,
  validarCalculoIRPF,
  validarTotalFactura,
} from '../utils/taxCalculations';
import { generarNumeroFactura } from '../utils/helpers';
import { InvoicePDFService } from '../services/pdf.service';
import { validateCompanySettingsForPDF } from '../utils/companySettingsValidator';
import type { ScheduleConfig, Periodicidad, TipoDia, Programacion } from '../utils/schedule-calculator';
import { calculateScheduledDates, validateScheduleConfig, calculateExtensionDates, formatDateLocal } from '../utils/schedule-calculator';
import fs from 'fs';
import path from 'path';
import config from '../config';

/**
 * Get all invoices for authenticated user
 * GET /api/invoices
 */
export const getInvoices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const {
      fecha_desde,
      fecha_hasta,
      cliente_id,
      estado,
      pagada,
      page = '1',
      limit = '50',
    } = req.query;

    let whereConditions = ['i.user_id = $1'];
    const params: any[] = [req.user.id];
    let paramIndex = 2;

    if (fecha_desde) {
      whereConditions.push(`i.fecha_emision >= $${paramIndex}`);
      params.push(fecha_desde);
      paramIndex++;
    }

    if (fecha_hasta) {
      whereConditions.push(`i.fecha_emision <= $${paramIndex}`);
      params.push(fecha_hasta);
      paramIndex++;
    }

    if (cliente_id) {
      whereConditions.push(`i.cliente_id = $${paramIndex}`);
      params.push(cliente_id);
      paramIndex++;
    }

    if (estado) {
      whereConditions.push(`i.estado = $${paramIndex}`);
      params.push(estado);
      paramIndex++;
    }

    if (pagada !== undefined) {
      whereConditions.push(`i.pagada = $${paramIndex}`);
      params.push(pagada === 'true');
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get invoices with client info
    const result = await query(
      `SELECT
        i.*,
        json_build_object(
          'id', c.id,
          'razon_social', c.nombre,
          'cif', c.cif,
          'email', c.email
        ) as cliente
       FROM facturas_emitidas i
       INNER JOIN clientes c ON i.cliente_id = c.id
       WHERE ${whereClause}
       ORDER BY i.fecha_emision DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), (parseInt(page as string) - 1) * parseInt(limit as string)]
    );

    // Get totals
    const totalsResult = await query(
      `SELECT
        COUNT(*) as total_count,
        SUM(i.base_imponible) as total_facturado,
        SUM(i.cuota_iva) as total_iva_repercutido,
        SUM(i.cuota_irpf) as total_irpf_retenido
       FROM facturas_emitidas i
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
        total_facturado: parseFloat(totalsResult.rows[0].total_facturado || '0') || 0,
        total_iva_repercutido: parseFloat(totalsResult.rows[0].total_iva_repercutido || '0') || 0,
        total_irpf_retenido: parseFloat(totalsResult.rows[0].total_irpf_retenido || '0') || 0,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single invoice
 * GET /api/invoices/:id
 */
export const getInvoice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    const result = await query(
      `SELECT
        i.*,
        json_build_object(
          'id', c.id,
          'razon_social', c.nombre,
          'cif', c.cif,
          'direccion', c.direccion,
          'codigo_postal', c.codigo_postal,
          'ciudad', c.ciudad,
          'provincia', c.provincia,
          'email', c.email,
          'telefono', c.telefono
        ) as cliente
       FROM facturas_emitidas i
       INNER JOIN clientes c ON i.cliente_id = c.id
       WHERE i.id = $1 AND i.user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('Factura no encontrada');
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
 * Generate new invoice
 * POST /api/invoices/generate
 */
export const generateInvoice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await getClient();

  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    await client.query('BEGIN');

    const {
      cliente_id,
      datos_facturacion_id,
      fecha_emision,
      fecha_vencimiento,
      periodo_facturacion_inicio,
      periodo_facturacion_fin,
      concepto,
      descripcion_detallada,
      base_imponible,
      tipo_iva = 21.0,
      tipo_irpf = 7.0,
      serie = 'A',
    } = req.body;

    // Verify client exists and belongs to user
    const clientCheck = await client.query(
      'SELECT id FROM clientes WHERE id = $1 AND user_id = $2 AND activo = true',
      [cliente_id, req.user.id]
    );

    if (clientCheck.rows.length === 0) {
      throw NotFoundError('Cliente no encontrado o inactivo');
    }

    // Pre-validate company settings BEFORE creating invoice
    // Use specified billing config if provided, otherwise check for active, fallback to users table
    let billingConfigResult;
    if (datos_facturacion_id) {
      billingConfigResult = await client.query(
        `SELECT id, direccion, ciudad, iban, razon_social as nombre_completo, nif
         FROM datos_facturacion WHERE id = $1 AND user_id = $2`,
        [datos_facturacion_id, req.user.id]
      );
      if (billingConfigResult.rows.length === 0) {
        throw BadRequestError('Datos de facturación no encontrados');
      }
    } else {
      billingConfigResult = await client.query(
        `SELECT id, direccion, ciudad, iban, razon_social as nombre_completo, nif
         FROM datos_facturacion WHERE user_id = $1 AND activo = true`,
        [req.user.id]
      );
    }

    let companySettings;
    let selectedBillingConfigId = datos_facturacion_id || null;
    if (billingConfigResult.rows.length > 0) {
      // Use billing config (specified or active)
      const config = billingConfigResult.rows[0];
      selectedBillingConfigId = config.id;
      // If billing config doesn't have NIF, get it from users table
      if (!config.nif) {
        const userNif = await client.query('SELECT nif FROM users WHERE id = $1', [req.user.id]);
        companySettings = { ...config, nif: userNif.rows[0]?.nif };
      } else {
        companySettings = config;
      }
    } else {
      // Fallback to users table
      const companySettingsResult = await client.query(
        `SELECT direccion, ciudad, iban, nombre_completo, nif
         FROM users WHERE id = $1`,
        [req.user.id]
      );
      if (companySettingsResult.rows.length === 0) {
        throw BadRequestError('No se encontró la configuración de empresa');
      }
      companySettings = companySettingsResult.rows[0];
    }

    const companyValidation = validateCompanySettingsForPDF(companySettings);

    if (!companyValidation.isValid) {
      throw BadRequestError(
        companyValidation.errorMessage || 'Faltan datos de empresa para generar facturas'
      );
    }

    // Calculate amounts
    const cuota_iva = calcularCuotaIVA(base_imponible, tipo_iva);
    const cuota_irpf = calcularCuotaIRPF(base_imponible, tipo_irpf);
    const total_factura = calcularTotalFactura(base_imponible, cuota_iva, cuota_irpf);

    // Validate calculations (extra safety)
    if (!validarCalculoIVA(base_imponible, tipo_iva, cuota_iva)) {
      throw BadRequestError('Error en cálculo de IVA');
    }
    if (!validarCalculoIRPF(base_imponible, tipo_irpf, cuota_irpf)) {
      throw BadRequestError('Error en cálculo de IRPF');
    }
    if (!validarTotalFactura(base_imponible, cuota_iva, cuota_irpf, total_factura)) {
      throw BadRequestError('Error en cálculo de total');
    }

    // Generate invoice number with advisory lock to prevent race conditions
    const year = new Date(fecha_emision).getFullYear();

    // CRITICAL FIX: Use PostgreSQL advisory lock to prevent concurrent invoice number conflicts
    // Lock is scoped by user_id + year (not serie) since constraint is UNIQUE(user_id, numero_factura)
    // The lock automatically releases on COMMIT or ROLLBACK
    const lockId = Number(req.user.id) * 10000 + year;
    await client.query('SELECT pg_advisory_xact_lock($1)', [lockId]);

    // NOW safely query for last invoice number across ALL series (protected by advisory lock)
    // NOTE: Removed serie filter because constraint is UNIQUE(user_id, numero_factura), not per-serie
    const lastInvoiceResult = await client.query(
      `SELECT numero_factura FROM facturas_emitidas
       WHERE user_id = $1 AND numero_factura LIKE $2
       ORDER BY numero_factura DESC LIMIT 1`,
      [req.user.id, `${year}-%`]
    );

    let lastNumber = 0;
    if (lastInvoiceResult.rows.length > 0) {
      const parts = lastInvoiceResult.rows[0].numero_factura.split('-');
      lastNumber = parseInt(parts[1] || '0');
    }

    const numero_factura = generarNumeroFactura(year, lastNumber);

    // Insert invoice into facturas_emitidas table
    // FIX: Changed from "invoices" to "facturas_emitidas" for consistency
    const result = await client.query(
      `INSERT INTO facturas_emitidas (
        user_id, cliente_id, datos_facturacion_id, numero_factura, serie, fecha_emision, fecha_vencimiento,
        periodo_facturacion_inicio, periodo_facturacion_fin, concepto, descripcion_detallada,
        base_imponible, tipo_iva, cuota_iva, tipo_irpf, cuota_irpf, total_factura
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        req.user.id,
        cliente_id,
        selectedBillingConfigId,
        numero_factura,
        serie,
        fecha_emision,
        fecha_vencimiento || null,
        periodo_facturacion_inicio || null,
        periodo_facturacion_fin || null,
        concepto,
        descripcion_detallada || null,
        base_imponible,
        tipo_iva,
        cuota_iva,
        tipo_irpf,
        cuota_irpf,
        total_factura,
      ]
    );

    const invoice = result.rows[0];

    // Commit transaction first so PDF service can read the invoice
    await client.query('COMMIT');

    // Auto-generate PDF (non-blocking - don't fail if PDF generation fails)
    let pdfGenerated = false;
    let pdfWarning: string | null = null;
    let pdfUrl: string | null = null;
    try {
      console.log(`Attempting to generate PDF for invoice ID: ${invoice.id}, User ID: ${req.user.id}`);
      pdfUrl = await InvoicePDFService.generateInvoicePDF(invoice.id, req.user.id);
      pdfGenerated = true;
      console.log('PDF generated successfully');
    } catch (pdfError: any) {
      console.error('Error generating PDF:', pdfError);
      pdfWarning = pdfError.message || 'No se pudo generar el PDF';
    }

    const infoMessages = [
      `Factura ${numero_factura} generada correctamente`,
      `IVA repercutido: ${cuota_iva.toFixed(2)}€ (ingresarás a AEAT en Modelo 303)`,
      `IRPF retenido: ${cuota_irpf.toFixed(2)}€ (recuperable en tu Renta anual)`,
      `Total a cobrar: ${total_factura.toFixed(2)}€`,
    ];

    if (pdfGenerated) {
      infoMessages.push('PDF generado automáticamente');
    }

    const response: ApiResponse = {
      success: true,
      data: {
        ...invoice,
        cuota_iva,
        cuota_irpf,
        total_factura,
        pdf_generado: pdfGenerated,
        pdf_url: pdfUrl,
      },
      info: infoMessages,
      ...(pdfWarning && { warning: [pdfWarning] }),
    };

    res.status(201).json(response);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Update invoice
 * PATCH /api/invoices/:id
 */
export const updateInvoice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    // Check if invoice exists
    const existing = await query(
      'SELECT id, estado FROM facturas_emitidas WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (existing.rows.length === 0) {
      throw NotFoundError('Factura no encontrada');
    }

    const {
      concepto,
      descripcion_detallada,
      fecha_emision,
      fecha_vencimiento,
      estado,
      cliente_id,
      datos_facturacion_id,
      base_imponible,
      tipo_iva,
      tipo_irpf,
      periodo_facturacion_inicio,
      periodo_facturacion_fin,
      fecha_pago,
    } = req.body;

    // Build update query
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Calculate financial values if base or rates are being updated
    let cuota_iva: number | undefined;
    let cuota_irpf: number | undefined;
    let total_factura: number | undefined;

    if (base_imponible !== undefined || tipo_iva !== undefined || tipo_irpf !== undefined) {
      // Get current values if we need them for calculation
      const current = existing.rows[0];
      const currentInvoice = await query(
        'SELECT base_imponible, tipo_iva, tipo_irpf FROM facturas_emitidas WHERE id = $1',
        [id]
      );
      const currentData = currentInvoice.rows[0];

      const finalBase = base_imponible !== undefined ? parseFloat(base_imponible) : parseFloat(currentData.base_imponible);
      const finalTipoIva = tipo_iva !== undefined ? parseFloat(tipo_iva) : parseFloat(currentData.tipo_iva);
      const finalTipoIrpf = tipo_irpf !== undefined ? parseFloat(tipo_irpf) : parseFloat(currentData.tipo_irpf);

      // Recalculate
      cuota_iva = finalBase * (finalTipoIva / 100);
      cuota_irpf = finalBase * (finalTipoIrpf / 100);
      total_factura = finalBase + cuota_iva - cuota_irpf;
    }

    if (concepto !== undefined) {
      updates.push(`concepto = $${paramIndex++}`);
      params.push(concepto);
    }
    if (descripcion_detallada !== undefined) {
      updates.push(`descripcion_detallada = $${paramIndex++}`);
      params.push(descripcion_detallada);
    }
    if (fecha_emision !== undefined) {
      updates.push(`fecha_emision = $${paramIndex++}`);
      params.push(fecha_emision || null);
    }
    if (fecha_vencimiento !== undefined) {
      updates.push(`fecha_vencimiento = $${paramIndex++}`);
      params.push(fecha_vencimiento || null);
    }
    if (estado !== undefined) {
      updates.push(`estado = $${paramIndex++}`);
      params.push(estado);

      // Sync with pagada field for consistency
      if (estado === 'PAGADA') {
        updates.push(`pagada = $${paramIndex++}`);
        params.push(true);
        // Set fecha_pago to today if not already set
        const currentInvoice = await query('SELECT fecha_pago FROM facturas_emitidas WHERE id = $1', [id]);
        if (currentInvoice.rows.length > 0 && !currentInvoice.rows[0].fecha_pago) {
          updates.push(`fecha_pago = $${paramIndex++}`);
          params.push(new Date().toISOString().split('T')[0]);
        }
      } else if (estado === 'PENDIENTE') {
        updates.push(`pagada = $${paramIndex++}`);
        params.push(false);
        // Clear fecha_pago when reverting to pending
        updates.push(`fecha_pago = $${paramIndex++}`);
        params.push(null);
      }
    }
    // Handle explicit fecha_pago updates (when not already handled by estado change)
    if (fecha_pago !== undefined && estado !== 'PENDIENTE' && estado !== 'PAGADA') {
      updates.push(`fecha_pago = $${paramIndex++}`);
      params.push(fecha_pago);
    }
    if (cliente_id !== undefined) {
      updates.push(`cliente_id = $${paramIndex++}`);
      params.push(cliente_id);
    }
    if (datos_facturacion_id !== undefined) {
      updates.push(`datos_facturacion_id = $${paramIndex++}`);
      params.push(datos_facturacion_id || null);
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
    if (periodo_facturacion_inicio !== undefined) {
      updates.push(`periodo_facturacion_inicio = $${paramIndex++}`);
      params.push(periodo_facturacion_inicio || null);
    }
    if (periodo_facturacion_fin !== undefined) {
      updates.push(`periodo_facturacion_fin = $${paramIndex++}`);
      params.push(periodo_facturacion_fin || null);
    }

    if (updates.length === 0) {
      throw BadRequestError('No hay campos para actualizar');
    }

    params.push(id, req.user.id);

    const result = await query(
      `UPDATE facturas_emitidas SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING *`,
      params
    );

    const updatedInvoice = result.rows[0];

    // Auto-regenerate PDF (non-blocking - don't fail if PDF generation fails)
    let pdfRegenerated = false;
    let pdfWarning: string | null = null;
    let pdfUrl: string | null = null;
    try {
      console.log(`Attempting to regenerate PDF for updated invoice ID: ${id}, User ID: ${req.user.id}`);
      pdfUrl = await InvoicePDFService.generateInvoicePDF(id, req.user.id);
      pdfRegenerated = true;
      console.log('PDF regenerated successfully');
    } catch (pdfError: any) {
      console.error('Error regenerating PDF:', pdfError);
      pdfWarning = pdfError.message || 'No se pudo regenerar el PDF';
    }

    const infoMessages = ['Factura actualizada correctamente'];
    if (pdfRegenerated) {
      infoMessages.push('PDF actualizado automáticamente');
    }

    const response: ApiResponse = {
      success: true,
      data: {
        ...updatedInvoice,
        pdf_regenerado: pdfRegenerated,
        pdf_url: pdfUrl,
      },
      info: infoMessages,
      ...(pdfWarning && { warning: [pdfWarning] }),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Mark invoice as paid
 * PATCH /api/invoices/:id/mark-paid
 */
export const markInvoicePaid = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;
    const { fecha_pago } = req.body;

    const result = await query(
      `UPDATE facturas_emitidas
       SET pagada = true,
           fecha_pago = $1,
           estado = 'PAGADA',
           programacion_id = NULL
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [fecha_pago || new Date().toISOString().split('T')[0], id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('Factura no encontrada');
    }

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
      info: ['Factura marcada como pagada'],
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete invoice
 * DELETE /api/invoices/:id
 */
export const deleteInvoice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    // Check if already paid
    const check = await query(
      'SELECT estado FROM facturas_emitidas WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (check.rows.length === 0) {
      throw NotFoundError('Factura no encontrada');
    }

    if (check.rows[0].estado === 'PAGADA') {
      throw BadRequestError('No se puede eliminar una factura pagada');
    }

    const result = await query(
      'DELETE FROM facturas_emitidas WHERE id = $1 AND user_id = $2 RETURNING id, numero_factura',
      [id, req.user.id]
    );

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
      info: [`Factura ${result.rows[0].numero_factura} eliminada`],
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get next invoice number (preview)
 * GET /api/invoices/next-number
 */
export const getNextInvoiceNumber = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { serie = 'A', year } = req.query;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

    const lastInvoiceResult = await query(
      `SELECT numero_factura FROM facturas_emitidas
       WHERE user_id = $1 AND serie = $2 AND numero_factura LIKE $3
       ORDER BY numero_factura DESC LIMIT 1`,
      [req.user.id, serie, `${targetYear}-%`]
    );

    let lastNumber = 0;
    if (lastInvoiceResult.rows.length > 0) {
      const parts = lastInvoiceResult.rows[0].numero_factura.split('-');
      lastNumber = parseInt(parts[1] || '0');
    }

    const nextNumber = generarNumeroFactura(targetYear, lastNumber);

    const response: ApiResponse = {
      success: true,
      data: {
        next_number: nextNumber,
        serie: serie,
        year: targetYear,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Download invoice PDF
 * GET /api/invoices/:id/pdf
 */
export const downloadInvoicePDF = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw UnauthorizedError();

    const { id } = req.params;
    const download = req.query.download === 'true';

    // Check if invoice exists and belongs to user
    const result = await query(
      'SELECT pdf_url, numero_factura, pdf_generado FROM facturas_emitidas WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('Factura no encontrada');
    }

    const invoice = result.rows[0];

    if (!invoice.pdf_generado || !invoice.pdf_url) {
      throw NotFoundError('PDF no disponible. Regenere el PDF desde la interfaz.');
    }

    // Build absolute path
    const pdfPath = path.join(config.upload.dir, invoice.pdf_url);

    if (!fs.existsSync(pdfPath)) {
      throw NotFoundError('Archivo PDF no encontrado. Regenere el PDF desde la interfaz.');
    }

    // Set headers - inline for preview, attachment for download
    const filename = `factura_${invoice.numero_factura.replace(/[\/\\]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');

    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    }

    // Stream file
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('Error streaming PDF:', error);
      if (!res.headersSent) {
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Regenerate invoice PDF
 * POST /api/invoices/:id/regenerate-pdf
 */
export const regenerateInvoicePDF = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw UnauthorizedError();

    const { id } = req.params;

    // Check if invoice exists and belongs to user
    const checkResult = await query(
      'SELECT id FROM facturas_emitidas WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      throw NotFoundError('Factura no encontrada');
    }

    // Generate PDF
    const pdfPath = await InvoicePDFService.generateInvoicePDF(id, req.user.id);

    const response: ApiResponse = {
      success: true,
      data: { pdf_url: pdfPath },
      info: ['PDF regenerado correctamente'],
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Generate multiple scheduled invoices
 * POST /api/invoices/generate-scheduled
 */
export const generateScheduledInvoices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await getClient();

  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    await client.query('BEGIN');

    const {
      // Schedule configuration
      periodicidad,
      tipo_dia,
      dia_especifico,
      fecha_inicio,
      fecha_fin,
      nombre,
      target_end_year, // From frontend - max year in dropdown
      // Invoice template data
      cliente_id,
      datos_facturacion_id,
      concepto,
      descripcion_detallada,
      base_imponible,
      tipo_iva = 21.0,
      tipo_irpf = 7.0,
      serie = 'A',
      estado = 'PENDIENTE',
      // Contract fields (optional)
      contrato_document_id,
      contrato_datos_extraidos,
      contrato_confianza,
    } = req.body;

    // Validate required fields
    if (!periodicidad || !tipo_dia || !fecha_inicio || !cliente_id || !concepto || !base_imponible) {
      throw BadRequestError('Faltan campos requeridos: periodicidad, tipo_dia, fecha_inicio, cliente_id, concepto, base_imponible');
    }

    // If no fecha_fin, use target_end_year from frontend (years in dropdown) or fall back to database query
    let targetEndYear: number | undefined;
    if (!fecha_fin) {
      if (target_end_year) {
        // Use the year passed from frontend (from dropdown/localStorage)
        targetEndYear = parseInt(target_end_year);
      } else {
        // Fallback: query database for latest year
        const latestYearResult = await client.query(
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
      throw BadRequestError('No se generaría ninguna factura con esta configuración');
    }

    // Verify client exists and belongs to user
    const clientCheck = await client.query(
      'SELECT id FROM clientes WHERE id = $1 AND user_id = $2 AND activo = true',
      [cliente_id, req.user.id]
    );

    if (clientCheck.rows.length === 0) {
      throw NotFoundError('Cliente no encontrado o inactivo');
    }

    // Pre-validate company settings - use specified billing config if provided, otherwise check for active, fallback to users table
    let billingConfigResult;
    if (datos_facturacion_id) {
      billingConfigResult = await client.query(
        `SELECT id, direccion, ciudad, iban, razon_social as nombre_completo, nif
         FROM datos_facturacion WHERE id = $1 AND user_id = $2`,
        [datos_facturacion_id, req.user.id]
      );
      if (billingConfigResult.rows.length === 0) {
        throw BadRequestError('Datos de facturación no encontrados');
      }
    } else {
      billingConfigResult = await client.query(
        `SELECT id, direccion, ciudad, iban, razon_social as nombre_completo, nif
         FROM datos_facturacion WHERE user_id = $1 AND activo = true`,
        [req.user.id]
      );
    }

    let companySettings;
    let selectedBillingConfigId = datos_facturacion_id || null;
    if (billingConfigResult.rows.length > 0) {
      const config = billingConfigResult.rows[0];
      selectedBillingConfigId = config.id;
      if (!config.nif) {
        const userNif = await client.query('SELECT nif FROM users WHERE id = $1', [req.user.id]);
        companySettings = { ...config, nif: userNif.rows[0]?.nif };
      } else {
        companySettings = config;
      }
    } else {
      const companySettingsResult = await client.query(
        `SELECT direccion, ciudad, iban, nombre_completo, nif FROM users WHERE id = $1`,
        [req.user.id]
      );
      if (companySettingsResult.rows.length === 0) {
        throw BadRequestError('No se encontró la configuración de empresa');
      }
      companySettings = companySettingsResult.rows[0];
    }

    const companyValidation = validateCompanySettingsForPDF(companySettings);
    if (!companyValidation.isValid) {
      throw BadRequestError(companyValidation.errorMessage || 'Faltan datos de empresa para generar facturas');
    }

    // Create programacion record
    const programacionResult = await client.query(
      `INSERT INTO programaciones (user_id, tipo, nombre, periodicidad, tipo_dia, dia_especifico, fecha_inicio, fecha_fin, datos_base, total_generados, ultimo_ano_generado, contrato_document_id, contrato_datos_extraidos, contrato_confianza)
       VALUES ($1, 'INGRESO', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        req.user.id,
        nombre || `Programación ${concepto.substring(0, 50)}`,
        periodicidad,
        tipo_dia,
        dia_especifico || null,
        fecha_inicio,
        fecha_fin || null,
        JSON.stringify({ cliente_id, datos_facturacion_id: selectedBillingConfigId, concepto, descripcion_detallada, base_imponible, tipo_iva, tipo_irpf, serie, estado }),
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
    const cuota_irpf = calcularCuotaIRPF(base_imponible, tipo_irpf);
    const total_factura = calcularTotalFactura(base_imponible, cuota_iva, cuota_irpf);

    // Generate invoices for each date
    const createdInvoices: any[] = [];
    const errors: string[] = [];

    for (const date of dates) {
      try {
        const year = date.getFullYear();
        const lockId = Number(req.user.id) * 10000 + year;
        await client.query('SELECT pg_advisory_xact_lock($1)', [lockId]);

        // Get last invoice number for this year
        const lastInvoiceResult = await client.query(
          `SELECT numero_factura FROM facturas_emitidas
           WHERE user_id = $1 AND numero_factura LIKE $2
           ORDER BY numero_factura DESC LIMIT 1`,
          [req.user.id, `${year}-%`]
        );

        let lastNumber = 0;
        if (lastInvoiceResult.rows.length > 0) {
          const parts = lastInvoiceResult.rows[0].numero_factura.split('-');
          lastNumber = parseInt(parts[1] || '0');
        }

        const numero_factura = generarNumeroFactura(year, lastNumber);
        const fecha_emision = formatDateLocal(date);

        // Insert invoice
        const result = await client.query(
          `INSERT INTO facturas_emitidas (
            user_id, cliente_id, datos_facturacion_id, numero_factura, serie, fecha_emision,
            concepto, descripcion_detallada, base_imponible, tipo_iva, cuota_iva,
            tipo_irpf, cuota_irpf, total_factura, estado, programacion_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING *`,
          [
            req.user.id,
            cliente_id,
            selectedBillingConfigId,
            numero_factura,
            serie,
            fecha_emision,
            concepto,
            descripcion_detallada || null,
            base_imponible,
            tipo_iva,
            cuota_iva,
            tipo_irpf,
            cuota_irpf,
            total_factura,
            estado,
            programacionId
          ]
        );

        createdInvoices.push(result.rows[0]);
      } catch (err: any) {
        errors.push(`Error generando factura para ${formatDateLocal(date)}: ${err.message}`);
      }
    }

    await client.query('COMMIT');

    // Generate PDFs asynchronously (non-blocking)
    let pdfCount = 0;
    for (const invoice of createdInvoices) {
      try {
        await InvoicePDFService.generateInvoicePDF(invoice.id, req.user.id);
        pdfCount++;
      } catch (pdfError: any) {
        console.error(`Error generating PDF for invoice ${invoice.numero_factura}:`, pdfError);
      }
    }

    const response: ApiResponse = {
      success: true,
      data: {
        programacion_id: programacionId,
        total_created: createdInvoices.length,
        invoices: createdInvoices,
        pdf_generated: pdfCount
      },
      info: [
        `Se han generado ${createdInvoices.length} facturas programadas`,
        `PDFs generados: ${pdfCount}/${createdInvoices.length}`
      ],
      ...(errors.length > 0 && { warning: errors })
    };

    res.status(201).json(response);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Extend scheduled invoices to a new year
 * POST /api/invoices/extend-year/:year
 */
export const extendYearInvoices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await getClient();

  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { year } = req.params;
    const targetYear = parseInt(year);

    if (isNaN(targetYear) || targetYear < 2020 || targetYear > 2100) {
      throw BadRequestError('Año inválido');
    }

    await client.query('BEGIN');

    // Get all active programaciones for this user of type INGRESO
    const programacionesResult = await client.query(
      `SELECT * FROM programaciones
       WHERE user_id = $1 AND tipo = 'INGRESO'
       AND (fecha_fin IS NULL OR EXTRACT(YEAR FROM fecha_fin) >= $2)
       AND (ultimo_ano_generado IS NULL OR ultimo_ano_generado < $2)`,
      [req.user.id, targetYear]
    );

    if (programacionesResult.rows.length === 0) {
      await client.query('COMMIT');
      return res.json({
        success: true,
        data: { total_created: 0, message: 'No hay programaciones pendientes de extender' }
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
        cliente_id,
        datos_facturacion_id,
        concepto,
        descripcion_detallada,
        base_imponible,
        tipo_iva = 21.0,
        tipo_irpf = 7.0,
        serie = 'A',
        estado = 'PENDIENTE'
      } = datosBase;

      // Calculate amounts
      const cuota_iva = calcularCuotaIVA(base_imponible, tipo_iva);
      const cuota_irpf = calcularCuotaIRPF(base_imponible, tipo_irpf);
      const total_factura = calcularTotalFactura(base_imponible, cuota_iva, cuota_irpf);

      let createdForThisProg = 0;

      for (const date of dates) {
        const dateYear = date.getFullYear();
        const lockId = Number(req.user.id) * 10000 + dateYear;
        await client.query('SELECT pg_advisory_xact_lock($1)', [lockId]);

        const lastInvoiceResult = await client.query(
          `SELECT numero_factura FROM facturas_emitidas
           WHERE user_id = $1 AND numero_factura LIKE $2
           ORDER BY numero_factura DESC LIMIT 1`,
          [req.user.id, `${dateYear}-%`]
        );

        let lastNumber = 0;
        if (lastInvoiceResult.rows.length > 0) {
          const parts = lastInvoiceResult.rows[0].numero_factura.split('-');
          lastNumber = parseInt(parts[1] || '0');
        }

        const numero_factura = generarNumeroFactura(dateYear, lastNumber);
        const fecha_emision = formatDateLocal(date);

        await client.query(
          `INSERT INTO facturas_emitidas (
            user_id, cliente_id, datos_facturacion_id, numero_factura, serie, fecha_emision,
            concepto, descripcion_detallada, base_imponible, tipo_iva, cuota_iva,
            tipo_irpf, cuota_irpf, total_factura, estado, programacion_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            req.user.id,
            cliente_id,
            datos_facturacion_id || null,
            numero_factura,
            serie,
            fecha_emision,
            concepto,
            descripcion_detallada || null,
            base_imponible,
            tipo_iva,
            cuota_iva,
            tipo_irpf,
            cuota_irpf,
            total_factura,
            estado,
            prog.id
          ]
        );

        createdForThisProg++;
        totalCreated++;
      }

      // Update programacion with new count and last year
      await client.query(
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

    await client.query('COMMIT');

    const response: ApiResponse = {
      success: true,
      data: {
        year: targetYear,
        total_created: totalCreated,
        by_programacion: createdByProgramacion
      },
      info: [`Se han generado ${totalCreated} facturas para el año ${targetYear}`]
    };

    res.status(201).json(response);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Get programacion info for an invoice (to check if it belongs to a series)
 * GET /api/invoices/:id/programacion
 */
export const getInvoiceProgramacion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    const result = await query(
      `SELECT
        i.programacion_id,
        p.nombre as programacion_nombre,
        p.frecuencia,
        (SELECT COUNT(*) FROM facturas_emitidas WHERE programacion_id = i.programacion_id) as total_en_serie
       FROM facturas_emitidas i
       LEFT JOIN programaciones p ON i.programacion_id = p.id
       WHERE i.id = $1 AND i.user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('Factura no encontrada');
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
 * Delete invoice with option to delete all in series
 * DELETE /api/invoices/:id/with-series
 */
export const deleteInvoiceWithSeries = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;
    const { deleteAll } = req.query;
    const shouldDeleteAll = deleteAll === 'true';

    // Get invoice and check if it belongs to a series
    const check = await query(
      'SELECT id, estado, programacion_id, numero_factura FROM facturas_emitidas WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (check.rows.length === 0) {
      throw NotFoundError('Factura no encontrada');
    }

    const invoice = check.rows[0];

    if (shouldDeleteAll && invoice.programacion_id) {
      // Delete all invoices in the series (only unpaid ones)
      const deleteResult = await query(
        `DELETE FROM facturas_emitidas
         WHERE programacion_id = $1 AND user_id = $2 AND estado != 'PAGADA'
         RETURNING id, numero_factura`,
        [invoice.programacion_id, req.user.id]
      );

      // Also delete the programacion if all invoices are deleted
      const remainingCount = await query(
        'SELECT COUNT(*) as count FROM facturas_emitidas WHERE programacion_id = $1',
        [invoice.programacion_id]
      );

      if (parseInt(remainingCount.rows[0].count) === 0) {
        await query('DELETE FROM programaciones WHERE id = $1', [invoice.programacion_id]);
      }

      res.json({
        success: true,
        data: {
          deleted_count: deleteResult.rowCount,
          deleted_invoices: deleteResult.rows
        },
        info: [`Se han eliminado ${deleteResult.rowCount} facturas de la serie`]
      });
    } else {
      // Delete only this invoice
      if (invoice.estado === 'PAGADA') {
        throw BadRequestError('No se puede eliminar una factura pagada');
      }

      await query(
        'DELETE FROM facturas_emitidas WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );

      res.json({
        success: true,
        data: { id, numero_factura: invoice.numero_factura },
        info: [`Factura ${invoice.numero_factura} eliminada`]
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Update invoice with option to apply to all in series
 * PATCH /api/invoices/:id/with-series
 */
export const updateInvoiceWithSeries = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;
    const { apply_to_all, ...updateData } = req.body;

    // Get invoice and check if it belongs to a series
    const check = await query(
      'SELECT id, programacion_id FROM facturas_emitidas WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (check.rows.length === 0) {
      throw NotFoundError('Factura no encontrada');
    }

    const invoice = check.rows[0];

    if (apply_to_all && invoice.programacion_id) {
      // Update all invoices in the series
      // Only update certain fields that make sense for bulk update
      const allowedBulkFields = ['concepto', 'descripcion_detallada', 'base_imponible', 'tipo_iva', 'tipo_irpf'];
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
        // Get current values to calculate
        const currentData = await query(
          'SELECT base_imponible, tipo_iva, tipo_irpf FROM facturas_emitidas WHERE id = $1',
          [id]
        );
        const current = currentData.rows[0];

        const finalBase = updateData.base_imponible !== undefined ? parseFloat(updateData.base_imponible) : parseFloat(current.base_imponible);
        const finalTipoIva = updateData.tipo_iva !== undefined ? parseFloat(updateData.tipo_iva) : parseFloat(current.tipo_iva);
        const finalTipoIrpf = updateData.tipo_irpf !== undefined ? parseFloat(updateData.tipo_irpf) : parseFloat(current.tipo_irpf);

        const cuota_iva = finalBase * (finalTipoIva / 100);
        const cuota_irpf = finalBase * (finalTipoIrpf / 100);
        const total_factura = finalBase + cuota_iva - cuota_irpf;

        updates.push(`cuota_iva = $${paramIndex++}`);
        params.push(cuota_iva);
        updates.push(`cuota_irpf = $${paramIndex++}`);
        params.push(cuota_irpf);
        updates.push(`total_factura = $${paramIndex++}`);
        params.push(total_factura);
      }

      params.push(invoice.programacion_id);
      params.push(req.user.id);

      const updateResult = await query(
        `UPDATE facturas_emitidas SET ${updates.join(', ')}, updated_at = NOW()
         WHERE programacion_id = $${paramIndex++} AND user_id = $${paramIndex}
         RETURNING id, numero_factura`,
        params
      );

      // Update programacion datos_base too
      const newDatosBase = { ...updateData };
      await query(
        `UPDATE programaciones
         SET datos_base = datos_base || $1::jsonb, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(newDatosBase), invoice.programacion_id]
      );

      res.json({
        success: true,
        data: {
          updated_count: updateResult.rowCount,
          updated_invoices: updateResult.rows
        },
        info: [`Se han actualizado ${updateResult.rowCount} facturas de la serie`]
      });
    } else {
      // Just update this one invoice - delegate to the existing updateInvoice function
      // For simplicity, we'll inline a basic update here
      const { concepto, descripcion_detallada, base_imponible, tipo_iva, tipo_irpf, estado } = updateData;

      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // If the invoice belongs to a series and user chose "Solo esta factura",
      // remove it from the series so future bulk updates won't affect it
      if (invoice.programacion_id) {
        updates.push(`programacion_id = NULL`);
      }

      if (concepto !== undefined) {
        updates.push(`concepto = $${paramIndex++}`);
        params.push(concepto);
      }
      if (descripcion_detallada !== undefined) {
        updates.push(`descripcion_detallada = $${paramIndex++}`);
        params.push(descripcion_detallada);
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
      if (estado !== undefined) {
        updates.push(`estado = $${paramIndex++}`);
        params.push(estado);
      }

      // Recalculate if needed
      if (base_imponible !== undefined || tipo_iva !== undefined || tipo_irpf !== undefined) {
        const currentData = await query(
          'SELECT base_imponible, tipo_iva, tipo_irpf FROM facturas_emitidas WHERE id = $1',
          [id]
        );
        const current = currentData.rows[0];

        const finalBase = base_imponible !== undefined ? parseFloat(base_imponible) : parseFloat(current.base_imponible);
        const finalTipoIva = tipo_iva !== undefined ? parseFloat(tipo_iva) : parseFloat(current.tipo_iva);
        const finalTipoIrpf = tipo_irpf !== undefined ? parseFloat(tipo_irpf) : parseFloat(current.tipo_irpf);

        const cuota_iva = finalBase * (finalTipoIva / 100);
        const cuota_irpf = finalBase * (finalTipoIrpf / 100);
        const total_factura = finalBase + cuota_iva - cuota_irpf;

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
        `UPDATE facturas_emitidas SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
         RETURNING *`,
        params
      );

      res.json({
        success: true,
        data: result.rows[0],
        info: ['Factura actualizada correctamente']
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Delete all invoices for a specific year
 * DELETE /api/invoices/by-year/:year
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
      `SELECT COUNT(*) as count FROM facturas_emitidas
       WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2`,
      [req.user.id, targetYear]
    );
    const totalToDelete = parseInt(countResult.rows[0].count);

    if (totalToDelete === 0) {
      await client.query('COMMIT');
      return res.json({
        success: true,
        data: { total_deleted: 0, message: `No hay facturas para eliminar en ${targetYear}` }
      });
    }

    // Get programacion IDs that will be affected
    const programacionIds = await client.query(
      `SELECT DISTINCT programacion_id FROM facturas_emitidas
       WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
       AND programacion_id IS NOT NULL`,
      [req.user.id, targetYear]
    );

    // Delete invoices for the year
    const deleteResult = await client.query(
      `DELETE FROM facturas_emitidas
       WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2
       RETURNING id`,
      [req.user.id, targetYear]
    );

    const totalDeleted = deleteResult.rowCount || 0;

    // Update programaciones - decrement total_generados and adjust ultimo_ano_generado
    for (const row of programacionIds.rows) {
      if (row.programacion_id) {
        // Count how many were deleted for this programacion
        const deletedForProg = await client.query(
          `SELECT COUNT(*) as remaining FROM facturas_emitidas WHERE programacion_id = $1`,
          [row.programacion_id]
        );

        const remaining = parseInt(deletedForProg.rows[0].remaining);

        if (remaining === 0) {
          // No invoices left, reset programacion
          await client.query(
            `UPDATE programaciones SET
              total_generados = 0,
              ultimo_ano_generado = NULL,
              updated_at = NOW()
             WHERE id = $1`,
            [row.programacion_id]
          );
        } else {
          // Find the max year of remaining invoices
          const maxYear = await client.query(
            `SELECT MAX(EXTRACT(YEAR FROM fecha_emision)) as max_year
             FROM facturas_emitidas WHERE programacion_id = $1`,
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
      info: [`Se han eliminado ${totalDeleted} facturas del año ${targetYear}`]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

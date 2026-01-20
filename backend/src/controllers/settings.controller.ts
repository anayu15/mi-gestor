import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { query } from '../config/database';
import config from '../config';
import { ApiResponse, AuthRequest } from '../types';
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
} from '../middleware/errorHandler';

/**
 * Get company settings for invoices
 * GET /api/settings/company
 */
export const getCompanySettings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw UnauthorizedError();
    }

    const result = await query(
      `SELECT
        razon_social,
        direccion,
        codigo_postal,
        ciudad,
        provincia,
        telefono,
        email_facturacion,
        iban,
        logo_url,
        notas_factura,
        nombre_completo,
        nif,
        email
      FROM users
      WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('Usuario no encontrado');
    }

    const settings = result.rows[0];

    const response: ApiResponse = {
      success: true,
      data: settings,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Update company settings for invoices
 * PATCH /api/settings/company
 */
export const updateCompanySettings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw UnauthorizedError();
    }

    const {
      razon_social,
      direccion,
      codigo_postal,
      ciudad,
      provincia,
      telefono,
      email_facturacion,
      iban,
      notas_factura,
    } = req.body;

    // Validate IBAN format if provided
    if (iban && !validarIBAN(iban)) {
      throw BadRequestError(
        'IBAN inválido. Formato correcto: ES00 0000 0000 0000 0000 0000'
      );
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (razon_social !== undefined) {
      updates.push(`razon_social = $${paramCount++}`);
      values.push(razon_social);
    }
    if (direccion !== undefined) {
      updates.push(`direccion = $${paramCount++}`);
      values.push(direccion);
    }
    if (codigo_postal !== undefined) {
      updates.push(`codigo_postal = $${paramCount++}`);
      values.push(codigo_postal);
    }
    if (ciudad !== undefined) {
      updates.push(`ciudad = $${paramCount++}`);
      values.push(ciudad);
    }
    if (provincia !== undefined) {
      updates.push(`provincia = $${paramCount++}`);
      values.push(provincia);
    }
    if (telefono !== undefined) {
      updates.push(`telefono = $${paramCount++}`);
      values.push(telefono);
    }
    if (email_facturacion !== undefined) {
      updates.push(`email_facturacion = $${paramCount++}`);
      values.push(email_facturacion);
    }
    if (iban !== undefined) {
      updates.push(`iban = $${paramCount++}`);
      values.push(iban);
    }
    if (notas_factura !== undefined) {
      updates.push(`notas_factura = $${paramCount++}`);
      values.push(notas_factura);
    }

    if (updates.length === 0) {
      throw BadRequestError('No se proporcionaron datos para actualizar');
    }

    // Add updated_at timestamp
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add user ID as last parameter
    values.push(req.user.id);

    const updateQuery = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING
        razon_social,
        direccion,
        codigo_postal,
        ciudad,
        provincia,
        telefono,
        email_facturacion,
        iban,
        logo_url,
        notas_factura
    `;

    const result = await query(updateQuery, values);

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
      info: ['Configuración de empresa actualizada correctamente'],
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Upload company logo
 * POST /api/settings/company/logo
 */
export const uploadLogo = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw UnauthorizedError();
    }

    if (!req.file) {
      throw BadRequestError('No se proporcionó ningún archivo');
    }

    // Validate file is an image
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      // Delete uploaded file if invalid
      fs.unlinkSync(req.file.path);
      throw BadRequestError('Solo se permiten imágenes (JPG, JPEG, PNG)');
    }

    // Get current logo to delete if exists
    const currentLogoResult = await query(
      'SELECT logo_url FROM users WHERE id = $1',
      [req.user.id]
    );

    if (currentLogoResult.rows.length > 0 && currentLogoResult.rows[0].logo_url) {
      const oldLogoPath = path.join(
        config.upload.dir,
        currentLogoResult.rows[0].logo_url
      );
      if (fs.existsSync(oldLogoPath)) {
        try {
          fs.unlinkSync(oldLogoPath);
        } catch (error) {
          console.error('Error deleting old logo:', error);
        }
      }
    }

    // Move file to logos directory
    const logoDir = path.join(config.upload.dir, 'logos', req.user.id);
    if (!fs.existsSync(logoDir)) {
      fs.mkdirSync(logoDir, { recursive: true });
    }

    const fileExt = path.extname(req.file.originalname);
    const newFileName = `logo${fileExt}`;
    const newFilePath = path.join(logoDir, newFileName);

    // Move file
    fs.renameSync(req.file.path, newFilePath);

    // Save relative path in database
    const relativePath = path.join('logos', req.user.id, newFileName);

    await query(
      'UPDATE users SET logo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [relativePath, req.user.id]
    );

    const response: ApiResponse = {
      success: true,
      data: {
        logo_url: relativePath,
      },
      info: ['Logo subido correctamente'],
    };

    res.json(response);
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file on error:', unlinkError);
      }
    }
    next(error);
  }
};

/**
 * Validate IBAN format
 * @param iban IBAN string
 * @returns true if valid
 */
function validarIBAN(iban: string): boolean {
  // Remove spaces and convert to uppercase
  const cleanedIBAN = iban.replace(/\s/g, '').toUpperCase();

  // Check length (Spain: 24 characters)
  if (cleanedIBAN.length !== 24) {
    return false;
  }

  // Check if starts with ES
  if (!cleanedIBAN.startsWith('ES')) {
    return false;
  }

  // Check format: ES + 2 digits + 20 alphanumeric
  const ibanRegex = /^ES\d{22}$/;
  if (!ibanRegex.test(cleanedIBAN)) {
    return false;
  }

  // Basic validation passed
  return true;
}

/**
 * Check if company settings are complete for PDF generation
 * GET /api/settings/company/pdf-readiness
 * 
 * Now checks for active billing configurations (datos_facturacion) instead of users table
 */
export const checkPDFReadiness = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw UnauthorizedError();
    }

    // Check for active billing configurations first
    const billingConfigResult = await query(
      `SELECT id, razon_social, direccion, ciudad, iban, nif
       FROM datos_facturacion 
       WHERE user_id = $1 AND activo = true
       ORDER BY es_principal DESC
       LIMIT 1`,
      [req.user.id]
    );

    // If there's an active billing config with required fields, PDF is ready
    if (billingConfigResult.rows.length > 0) {
      const config = billingConfigResult.rows[0];
      const missingFields: string[] = [];

      if (!config.razon_social) missingFields.push('Razón Social');
      if (!config.direccion) missingFields.push('Dirección');
      if (!config.ciudad) missingFields.push('Ciudad');
      if (!config.iban) missingFields.push('IBAN');
      if (!config.nif) missingFields.push('NIF');

      const isReady = missingFields.length === 0;

      const response: ApiResponse = {
        success: true,
        data: {
          ready: isReady,
          missingFields: missingFields,
          message: isReady
            ? 'Configuración completa para generar PDFs'
            : `Para generar facturas PDF, debe configurar los siguientes datos de empresa: ${missingFields.join(', ')}. Vaya a Ajustes → Configuración de Facturación para completarlos.`,
        },
      };

      res.json(response);
      return;
    }

    // No active billing config found - not ready
    const response: ApiResponse = {
      success: true,
      data: {
        ready: false,
        missingFields: ['Datos de Facturación'],
        message: 'No hay configuración de facturación activa. Vaya a Ajustes → Configuración de Facturación para crear una.',
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

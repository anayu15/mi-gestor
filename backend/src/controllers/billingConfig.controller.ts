import { Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { query, getClient } from '../config/database';
import config from '../config';
import { ApiResponse, AuthRequest } from '../types';
import { BadRequestError, NotFoundError, ConflictError } from '../middleware/errorHandler';

/**
 * Validate IBAN format (Spanish)
 */
function validarIBAN(iban: string): boolean {
  const cleanedIBAN = iban.replace(/\s/g, '').toUpperCase();
  if (cleanedIBAN.length !== 24) return false;
  if (!cleanedIBAN.startsWith('ES')) return false;
  const ibanRegex = /^ES\d{22}$/;
  return ibanRegex.test(cleanedIBAN);
}

/**
 * Validate NIF/CIF format (Spanish)
 * NIF: 8 digits + letter (e.g., 12345678A)
 * CIF: letter + 7 digits + letter/digit (e.g., B12345678)
 */
function validarNIF(nif: string): boolean {
  const cleanedNIF = nif.replace(/\s/g, '').toUpperCase();
  if (cleanedNIF.length !== 9) return false;

  // NIF pattern: 8 digits + letter
  const nifRegex = /^[0-9]{8}[A-Z]$/;
  // CIF pattern: letter + 7 digits + letter/digit
  const cifRegex = /^[A-Z][0-9]{7}[A-Z0-9]$/;
  // NIE pattern: X/Y/Z + 7 digits + letter
  const nieRegex = /^[XYZ][0-9]{7}[A-Z]$/;

  return nifRegex.test(cleanedNIF) || cifRegex.test(cleanedNIF) || nieRegex.test(cleanedNIF);
}

/**
 * Get all billing configurations for authenticated user
 * GET /api/billing-configs
 */
export const getBillingConfigs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const result = await query(
      `SELECT * FROM datos_facturacion
       WHERE user_id = $1
       ORDER BY es_principal DESC, activo DESC, created_at DESC`,
      [req.user.id]
    );

    const response: ApiResponse = {
      success: true,
      data: result.rows,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single billing configuration
 * GET /api/billing-configs/:id
 */
export const getBillingConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    const result = await query(
      'SELECT * FROM datos_facturacion WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('Configuración de facturación no encontrada');
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
 * Get the active billing configuration
 * GET /api/billing-configs/active
 */
export const getActiveBillingConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const result = await query(
      'SELECT * FROM datos_facturacion WHERE user_id = $1 AND activo = true',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('No hay configuración de facturación activa');
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
 * Create new billing configuration
 * POST /api/billing-configs
 */
export const createBillingConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await getClient();

  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const {
      razon_social,
      nif,
      direccion,
      codigo_postal,
      ciudad,
      provincia,
      telefono,
      email_facturacion,
      iban,
      notas_factura,
      activo,
      es_principal,
    } = req.body;

    if (!razon_social || razon_social.trim() === '') {
      throw BadRequestError('El nombre o razón social es obligatorio');
    }

    if (!nif || nif.trim() === '') {
      throw BadRequestError('El NIF/CIF es obligatorio');
    }

    // Validate NIF/CIF format
    if (!validarNIF(nif)) {
      throw BadRequestError('NIF/CIF inválido. Formato correcto: 12345678A (NIF) o B12345678 (CIF)');
    }

    // Required fields for PDF generation
    if (!direccion || direccion.trim() === '') {
      throw BadRequestError('La dirección es obligatoria para generar facturas');
    }

    if (!ciudad || ciudad.trim() === '') {
      throw BadRequestError('La ciudad es obligatoria para generar facturas');
    }

    if (!iban || iban.trim() === '') {
      throw BadRequestError('El IBAN es obligatorio para generar facturas');
    }

    // Validate IBAN format
    if (!validarIBAN(iban)) {
      throw BadRequestError('IBAN inválido. Formato correcto: ES00 0000 0000 0000 0000 0000');
    }

    await client.query('BEGIN');

    // Check if this is the first config (auto-activate and set as principal if first)
    const existingConfigs = await client.query(
      'SELECT COUNT(*) as count FROM datos_facturacion WHERE user_id = $1',
      [req.user.id]
    );
    const isFirst = parseInt(existingConfigs.rows[0].count) === 0;

    // First config is always active and principal
    const shouldBeActive = isFirst || activo === true;
    let shouldBePrincipal = isFirst || es_principal === true;

    // If trying to set as principal, unset any existing principal
    if (shouldBePrincipal && !isFirst) {
      await client.query(
        'UPDATE datos_facturacion SET es_principal = false WHERE user_id = $1 AND es_principal = true',
        [req.user.id]
      );
    }

    const result = await client.query(
      `INSERT INTO datos_facturacion (
        user_id, razon_social, nif, direccion, codigo_postal, ciudad, provincia,
        telefono, email_facturacion, iban, notas_factura, activo, es_principal
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        req.user.id,
        razon_social.trim(),
        nif.replace(/\s/g, '').toUpperCase(),
        direccion || null,
        codigo_postal || null,
        ciudad || null,
        provincia || null,
        telefono || null,
        email_facturacion || null,
        iban ? iban.replace(/\s/g, '').toUpperCase() : null,
        notas_factura || null,
        shouldBeActive,
        shouldBePrincipal,
      ]
    );

    await client.query('COMMIT');

    const infoMessages: string[] = [];
    if (isFirst) {
      infoMessages.push('Primera configuración creada, activada y marcada como principal');
    } else if (shouldBePrincipal) {
      infoMessages.push('Configuración creada y marcada como principal');
    }

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
      info: infoMessages.length > 0 ? infoMessages : undefined,
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
 * Update billing configuration
 * PATCH /api/billing-configs/:id
 */
export const updateBillingConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await getClient();

  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    // Check if config exists
    const existing = await client.query(
      'SELECT id FROM datos_facturacion WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (existing.rows.length === 0) {
      throw NotFoundError('Configuración de facturación no encontrada');
    }

    const {
      razon_social,
      nif,
      direccion,
      codigo_postal,
      ciudad,
      provincia,
      telefono,
      email_facturacion,
      iban,
      notas_factura,
      activo,
      es_principal,
    } = req.body;

    // Validate required fields cannot be cleared
    if (razon_social !== undefined && (!razon_social || razon_social.trim() === '')) {
      throw BadRequestError('El nombre o razón social es obligatorio');
    }

    if (nif !== undefined && (!nif || nif.trim() === '')) {
      throw BadRequestError('El NIF/CIF es obligatorio');
    }

    // Validate NIF/CIF format if provided
    if (nif !== undefined && nif && !validarNIF(nif)) {
      throw BadRequestError('NIF/CIF inválido. Formato correcto: 12345678A (NIF) o B12345678 (CIF)');
    }

    // Required fields for PDF generation cannot be cleared
    if (direccion !== undefined && (!direccion || direccion.trim() === '')) {
      throw BadRequestError('La dirección es obligatoria para generar facturas');
    }

    if (ciudad !== undefined && (!ciudad || ciudad.trim() === '')) {
      throw BadRequestError('La ciudad es obligatoria para generar facturas');
    }

    if (iban !== undefined && (!iban || iban.trim() === '')) {
      throw BadRequestError('El IBAN es obligatorio para generar facturas');
    }

    // Validate IBAN format if provided
    if (iban && !validarIBAN(iban)) {
      throw BadRequestError('IBAN inválido. Formato correcto: ES00 0000 0000 0000 0000 0000');
    }

    await client.query('BEGIN');

    // If trying to set this config as principal, unset any existing principal
    if (es_principal === true) {
      await client.query(
        'UPDATE datos_facturacion SET es_principal = false WHERE user_id = $1 AND es_principal = true AND id != $2',
        [req.user.id, id]
      );
    }

    // Build dynamic update query
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (razon_social !== undefined) {
      updates.push(`razon_social = $${paramIndex++}`);
      params.push(razon_social.trim());
    }
    if (nif !== undefined) {
      updates.push(`nif = $${paramIndex++}`);
      params.push(nif ? nif.replace(/\s/g, '').toUpperCase() : '');
    }
    if (direccion !== undefined) {
      updates.push(`direccion = $${paramIndex++}`);
      params.push(direccion || null);
    }
    if (codigo_postal !== undefined) {
      updates.push(`codigo_postal = $${paramIndex++}`);
      params.push(codigo_postal || null);
    }
    if (ciudad !== undefined) {
      updates.push(`ciudad = $${paramIndex++}`);
      params.push(ciudad || null);
    }
    if (provincia !== undefined) {
      updates.push(`provincia = $${paramIndex++}`);
      params.push(provincia || null);
    }
    if (telefono !== undefined) {
      updates.push(`telefono = $${paramIndex++}`);
      params.push(telefono || null);
    }
    if (email_facturacion !== undefined) {
      updates.push(`email_facturacion = $${paramIndex++}`);
      params.push(email_facturacion || null);
    }
    if (iban !== undefined) {
      updates.push(`iban = $${paramIndex++}`);
      params.push(iban ? iban.replace(/\s/g, '').toUpperCase() : null);
    }
    if (notas_factura !== undefined) {
      updates.push(`notas_factura = $${paramIndex++}`);
      params.push(notas_factura || null);
    }
    if (activo !== undefined) {
      updates.push(`activo = $${paramIndex++}`);
      params.push(activo);
    }
    if (es_principal !== undefined) {
      updates.push(`es_principal = $${paramIndex++}`);
      params.push(es_principal);
    }

    if (updates.length === 0) {
      throw BadRequestError('No hay campos para actualizar');
    }

    // Add updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    params.push(id, req.user.id);

    const result = await client.query(
      `UPDATE datos_facturacion SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING *`,
      params
    );

    await client.query('COMMIT');

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
    };

    res.json(response);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Delete billing configuration
 * DELETE /api/billing-configs/:id
 */
export const deleteBillingConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    // Check if config exists
    const configCheck = await query(
      'SELECT id, activo, es_principal, logo_url FROM datos_facturacion WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (configCheck.rows.length === 0) {
      throw NotFoundError('Configuración de facturación no encontrada');
    }

    const configToDelete = configCheck.rows[0];
    const infoMessages: string[] = [];

    // Check if there are other configs
    const otherConfigs = await query(
      'SELECT id FROM datos_facturacion WHERE user_id = $1 AND id != $2 ORDER BY activo DESC, created_at DESC',
      [req.user.id, id]
    );

    // If this is the principal config and there are others, set another one as principal
    if (configToDelete.es_principal && otherConfigs.rows.length > 0) {
      const nextConfigId = otherConfigs.rows[0].id;
      await query(
        'UPDATE datos_facturacion SET es_principal = true WHERE id = $1',
        [nextConfigId]
      );
      infoMessages.push('Se ha marcado otra configuración como principal automáticamente.');
    }

    // Delete logo file if exists
    if (configToDelete.logo_url) {
      const logoPath = path.join(config.upload.dir, configToDelete.logo_url);
      if (fs.existsSync(logoPath)) {
        try {
          fs.unlinkSync(logoPath);
        } catch (error) {
          console.error('Error deleting logo file:', error);
        }
      }
    }

    // Delete the config
    await query('DELETE FROM datos_facturacion WHERE id = $1 AND user_id = $2', [id, req.user.id]);

    const response: ApiResponse = {
      success: true,
      data: { id: parseInt(id) },
      info: infoMessages.length > 0 ? infoMessages : undefined,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle a billing configuration's active state
 * POST /api/billing-configs/:id/activate
 * Multiple configs can be active at the same time
 */
export const setActiveBillingConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    // Check if config exists and get current state
    const existing = await query(
      'SELECT id, activo FROM datos_facturacion WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (existing.rows.length === 0) {
      throw NotFoundError('Configuración de facturación no encontrada');
    }

    const currentConfig = existing.rows[0];
    const newState = !currentConfig.activo;

    // Toggle the state of this specific config
    const result = await query(
      'UPDATE datos_facturacion SET activo = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [newState, id]
    );

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
      info: [newState ? 'Configuración activada' : 'Configuración desactivada'],
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Set a billing configuration as principal (default)
 * POST /api/billing-configs/:id/set-principal
 * Only one config can be principal at a time
 */
export const setPrincipalBillingConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await getClient();

  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    // Check if config exists
    const existing = await client.query(
      'SELECT id, es_principal FROM datos_facturacion WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (existing.rows.length === 0) {
      throw NotFoundError('Configuración de facturación no encontrada');
    }

    await client.query('BEGIN');

    // Unset any existing principal
    await client.query(
      'UPDATE datos_facturacion SET es_principal = false WHERE user_id = $1 AND es_principal = true',
      [req.user.id]
    );

    // Set this config as principal
    const result = await client.query(
      'UPDATE datos_facturacion SET es_principal = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );

    await client.query('COMMIT');

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
      info: ['Configuración marcada como principal'],
    };

    res.json(response);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Upload logo for a billing configuration
 * POST /api/billing-configs/:id/logo
 */
export const uploadBillingConfigLogo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    if (!req.file) {
      throw BadRequestError('No se proporcionó ningún archivo');
    }

    // Check if config exists
    const configCheck = await query(
      'SELECT id, logo_url FROM datos_facturacion WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (configCheck.rows.length === 0) {
      // Delete uploaded file
      fs.unlinkSync(req.file.path);
      throw NotFoundError('Configuración de facturación no encontrada');
    }

    // Validate file is an image
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      fs.unlinkSync(req.file.path);
      throw BadRequestError('Solo se permiten imágenes (JPG, JPEG, PNG)');
    }

    const existingConfig = configCheck.rows[0];

    // Delete old logo if exists
    if (existingConfig.logo_url) {
      const oldLogoPath = path.join(config.upload.dir, existingConfig.logo_url);
      if (fs.existsSync(oldLogoPath)) {
        try {
          fs.unlinkSync(oldLogoPath);
        } catch (error) {
          console.error('Error deleting old logo:', error);
        }
      }
    }

    // Create directory for billing config logos
    const logoDir = path.join(config.upload.dir, 'billing-logos', req.user.id.toString(), id.toString());
    if (!fs.existsSync(logoDir)) {
      fs.mkdirSync(logoDir, { recursive: true });
    }

    const fileExt = path.extname(req.file.originalname);
    const newFileName = `logo${fileExt}`;
    const newFilePath = path.join(logoDir, newFileName);

    // Move file
    fs.renameSync(req.file.path, newFilePath);

    // Save relative path in database
    const relativePath = path.join('billing-logos', req.user.id.toString(), id.toString(), newFileName);

    await query(
      'UPDATE datos_facturacion SET logo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [relativePath, id]
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

import { Response, NextFunction } from 'express';
import { query } from '../config/database';
import { ApiResponse, AuthRequest } from '../types';
import { BadRequestError, NotFoundError, ConflictError } from '../middleware/errorHandler';
import { validarCIFoNIF } from '../utils/taxCalculations';

/**
 * Map database client fields to API format
 * Database uses 'nombre' but API uses 'razon_social' for consistency
 */
function mapClientToAPI(client: any) {
  const { nombre, ...rest } = client;
  return {
    ...rest,
    razon_social: nombre,
  };
}

/**
 * Get all clients for authenticated user
 * GET /api/clients
 */
export const getClients = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { activo, sort = 'nombre' } = req.query;

    let whereClause = 'user_id = $1';
    const params: any[] = [req.user.id];

    // Default to only active clients unless explicitly requested otherwise
    if (activo !== undefined && activo !== 'all') {
      whereClause += ' AND activo = $2';
      params.push(activo === 'true');
    } else if (activo === undefined) {
      // Default: only show active clients when no parameter is provided
      whereClause += ' AND activo = true';
    }
    // If activo === 'all', don't add any activo filter (show both active and inactive)

    const validSorts = ['nombre', 'razon_social', 'porcentaje_facturacion', 'created_at'];
    // Map razon_social to nombre for backwards compatibility
    let sortField = sort as string;
    if (sortField === 'razon_social') sortField = 'nombre';
    sortField = validSorts.includes(sortField) ? sortField : 'nombre';

    const result = await query(
      `SELECT * FROM clientes
       WHERE ${whereClause}
       ORDER BY ${sortField} DESC`,
      params
    );

    const response: ApiResponse = {
      success: true,
      data: result.rows.map(mapClientToAPI),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single client
 * GET /api/clients/:id
 */
export const getClient = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    const result = await query(
      'SELECT * FROM clientes WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('Cliente no encontrado');
    }

    const response: ApiResponse = {
      success: true,
      data: mapClientToAPI(result.rows[0]),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Create new client
 * POST /api/clients
 */
export const createClient = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const {
      razon_social,
      cif,
      direccion,
      codigo_postal,
      ciudad,
      provincia,
      email,
      telefono,
      persona_contacto,
      es_cliente_principal = false,
    } = req.body;

    // Validate CIF or NIF
    if (!validarCIFoNIF(cif)) {
      throw BadRequestError('CIF/NIF inválido. Formato CIF: B12345678, Formato NIF: 12345678Z');
    }

    // Check if CIF already exists (only among active clients)
    const existing = await query(
      'SELECT id FROM clientes WHERE user_id = $1 AND cif = $2 AND activo = true',
      [req.user.id, cif]
    );

    if (existing.rows.length > 0) {
      throw ConflictError('Ya existe un cliente con este CIF');
    }

    // Check for inactive client with same CIF - reactivate instead of creating new
    const inactiveClient = await query(
      'SELECT id FROM clientes WHERE user_id = $1 AND cif = $2 AND activo = false',
      [req.user.id, cif]
    );

    // If marking as principal, check if user already has one
    if (es_cliente_principal) {
      const principalCheck = await query(
        'SELECT id FROM clientes WHERE user_id = $1 AND es_cliente_principal = true',
        [req.user.id]
      );

      if (principalCheck.rows.length > 0) {
        throw ConflictError('Ya tienes un cliente principal. Desmarca el actual primero.');
      }
    }

    let result;

    if (inactiveClient.rows.length > 0) {
      // Reactivate and update the inactive client (preserves invoice relationships)
      const inactiveId = inactiveClient.rows[0].id;
      result = await query(
        `UPDATE clientes SET
          nombre = $1, direccion = $2, codigo_postal = $3, ciudad = $4, provincia = $5,
          email = $6, telefono = $7, persona_contacto = $8, es_cliente_principal = $9, activo = true
         WHERE id = $10
         RETURNING *`,
        [
          razon_social,
          direccion || null,
          codigo_postal || null,
          ciudad || null,
          provincia || null,
          email || null,
          telefono || null,
          persona_contacto || null,
          es_cliente_principal,
          inactiveId,
        ]
      );
    } else {
      // Insert new client
      result = await query(
        `INSERT INTO clientes (
          user_id, nombre, cif, direccion, codigo_postal, ciudad, provincia,
          email, telefono, persona_contacto, es_cliente_principal
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          req.user.id,
          razon_social,
          cif,
          direccion || null,
          codigo_postal || null,
          ciudad || null,
          provincia || null,
          email || null,
          telefono || null,
          persona_contacto || null,
          es_cliente_principal,
        ]
      );
    }

    const client = result.rows[0];

    // Generate warnings if TRADE
    const warnings = [];
    if (es_cliente_principal) {
      // Check user's TRADE status
      const userCheck = await query('SELECT es_trade FROM users WHERE id = $1', [req.user.id]);
      if (userCheck.rows[0]?.es_trade) {
        warnings.push(
          'Este cliente representa tu facturación principal. Como autónomo TRADE, asegúrate de mantener gastos de independencia (alquiler, luz, internet) a tu nombre.'
        );
      }
    }

    const response: ApiResponse = {
      success: true,
      data: mapClientToAPI(client),
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Update client
 * PATCH /api/clients/:id
 */
export const updateClient = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    // Check if client exists
    const existing = await query(
      'SELECT id FROM clientes WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (existing.rows.length === 0) {
      throw NotFoundError('Cliente no encontrado');
    }

    const {
      razon_social,
      cif,
      direccion,
      codigo_postal,
      ciudad,
      provincia,
      email,
      telefono,
      persona_contacto,
      es_cliente_principal,
      activo,
    } = req.body;

    // Validate CIF or NIF if provided
    if (cif && !validarCIFoNIF(cif)) {
      throw BadRequestError('CIF/NIF inválido');
    }

    // If marking as principal, check conflicts
    if (es_cliente_principal === true) {
      const principalCheck = await query(
        'SELECT id FROM clientes WHERE user_id = $1 AND es_cliente_principal = true AND id != $2',
        [req.user.id, id]
      );

      if (principalCheck.rows.length > 0) {
        throw ConflictError('Ya tienes un cliente principal. Desmarca el actual primero.');
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (razon_social !== undefined) {
      updates.push(`nombre = $${paramIndex++}`); // Map razon_social to nombre
      params.push(razon_social);
    }
    if (cif !== undefined) {
      updates.push(`cif = $${paramIndex++}`);
      params.push(cif);
    }
    if (direccion !== undefined) {
      updates.push(`direccion = $${paramIndex++}`);
      params.push(direccion);
    }
    if (codigo_postal !== undefined) {
      updates.push(`codigo_postal = $${paramIndex++}`);
      params.push(codigo_postal);
    }
    if (ciudad !== undefined) {
      updates.push(`ciudad = $${paramIndex++}`);
      params.push(ciudad);
    }
    if (provincia !== undefined) {
      updates.push(`provincia = $${paramIndex++}`);
      params.push(provincia);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(email);
    }
    if (telefono !== undefined) {
      updates.push(`telefono = $${paramIndex++}`);
      params.push(telefono);
    }
    if (persona_contacto !== undefined) {
      updates.push(`persona_contacto = $${paramIndex++}`);
      params.push(persona_contacto);
    }
    if (es_cliente_principal !== undefined) {
      updates.push(`es_cliente_principal = $${paramIndex++}`);
      params.push(es_cliente_principal);
    }
    if (activo !== undefined) {
      updates.push(`activo = $${paramIndex++}`);
      params.push(activo);
    }

    if (updates.length === 0) {
      throw BadRequestError('No hay campos para actualizar');
    }

    params.push(id, req.user.id);

    const result = await query(
      `UPDATE clientes SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING *`,
      params
    );

    const response: ApiResponse = {
      success: true,
      data: mapClientToAPI(result.rows[0]),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete client
 * DELETE /api/clients/:id
 * - Inactive clients: always permanently deleted
 * - Active clients with invoices: soft delete (set activo = false)
 * - Active clients without invoices: permanently deleted
 */
export const deleteClient = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw BadRequestError('Usuario no autenticado');

    const { id } = req.params;

    // Check if client exists and get their status
    const clientCheck = await query(
      'SELECT id, activo FROM clientes WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (clientCheck.rows.length === 0) {
      throw NotFoundError('Cliente no encontrado');
    }

    const client = clientCheck.rows[0];

    // If client is inactive, check if they have invoices before deleting
    if (!client.activo) {
      const invoiceCount = await query(
        'SELECT COUNT(*) as count FROM facturas_emitidas WHERE cliente_id = $1',
        [id]
      );

      if (parseInt(invoiceCount.rows[0].count) > 0) {
        // Can't delete inactive client with invoices - they stay hidden but in DB
        // User can recreate a client with the same CIF (will reactivate this one)
        throw BadRequestError(
          'No se puede eliminar este cliente porque tiene facturas asociadas. ' +
          'Puedes crear un nuevo cliente con el mismo CIF y se reactivará automáticamente.'
        );
      }

      // No invoices - safe to delete
      await query('DELETE FROM clientes WHERE id = $1 AND user_id = $2', [id, req.user.id]);

      const response: ApiResponse = {
        success: true,
        data: { id: parseInt(id) },
      };

      res.json(response);
      return;
    }

    // Client is active - check if they have invoices
    const invoiceCheck = await query(
      'SELECT COUNT(*) as count FROM facturas_emitidas WHERE cliente_id = $1',
      [id]
    );

    if (parseInt(invoiceCheck.rows[0].count) > 0) {
      // Soft delete - client has invoices
      await query(
        'UPDATE clientes SET activo = false WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );

      const response: ApiResponse = {
        success: true,
        data: { id: parseInt(id) },
        info: [
          'Cliente desactivado (tiene facturas asociadas). No se eliminó permanentemente.',
        ],
      };

      res.json(response);
    } else {
      // Hard delete - no invoices
      await query('DELETE FROM clientes WHERE id = $1 AND user_id = $2', [id, req.user.id]);

      const response: ApiResponse = {
        success: true,
        data: { id: parseInt(id) },
      };

      res.json(response);
    }
  } catch (error) {
    next(error);
  }
};

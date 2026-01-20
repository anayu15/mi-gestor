import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import config from '../config';
import { ApiResponse, AuthRequest, UserPayload } from '../types';
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from '../middleware/errorHandler';

/**
 * Register new user
 * POST /api/auth/register
 */
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      email,
      password,
      nombre_completo,
    } = req.body;

    // Check if email already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw ConflictError('El email ya está registrado');
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Insert user with minimal required fields
    const result = await query(
      `INSERT INTO users (
        email, password_hash, nombre_completo
      ) VALUES ($1, $2, $3)
      RETURNING id, email, nombre_completo, es_trade, created_at`,
      [email, password_hash, nombre_completo]
    );

    const user = result.rows[0];

    // Generate fiscal calendar for current year
    const currentYear = new Date().getFullYear();
    await query('SELECT generate_fiscal_calendar($1, $2)', [user.id, currentYear]);

    // Generate JWT token
    const tokenPayload: UserPayload = {
      id: user.id,
      email: user.email,
      nombre_completo: user.nombre_completo,
      es_trade: user.es_trade,
    };

    const token = jwt.sign(tokenPayload, config.jwt.secret as jwt.Secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          nombre_completo: user.nombre_completo,
          nif: user.nif,
          es_trade: user.es_trade,
        },
        token,
      },
      info: ['Usuario registrado correctamente', 'Calendario fiscal generado automáticamente'],
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Find user
    const result = await query(
      'SELECT id, email, password_hash, nombre_completo, es_trade FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw UnauthorizedError('Email o contraseña incorrectos');
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw UnauthorizedError('Email o contraseña incorrectos');
    }

    // Generate JWT token
    const tokenPayload: UserPayload = {
      id: user.id,
      email: user.email,
      nombre_completo: user.nombre_completo,
      es_trade: user.es_trade,
    };

    const token = jwt.sign(tokenPayload, config.jwt.secret as jwt.Secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          nombre_completo: user.nombre_completo,
          es_trade: user.es_trade,
        },
        token,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get authenticated user profile
 * GET /api/auth/me
 */
export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw UnauthorizedError();
    }

    const result = await query(
      `SELECT
        id, email, nombre_completo, nif, regimen_fiscal, fecha_alta_autonomo,
        epigrafe_iae, es_trade, porcentaje_dependencia, tiene_local_alquilado,
        tipo_iva_predeterminado, tipo_irpf_actual, tipo_irpf_estimado,
        timezone, idioma,
        -- Existing model preferences
        mostrar_modelo_303, mostrar_modelo_130, mostrar_modelo_115,
        mostrar_modelo_180, mostrar_modelo_390,
        -- New IVA models
        mostrar_modelo_349, mostrar_sii,
        -- New IRPF models
        mostrar_modelo_131, mostrar_modelo_100,
        -- New Retenciones models
        mostrar_modelo_111, mostrar_modelo_190, mostrar_modelo_123,
        -- Declaraciones Informativas
        mostrar_modelo_347,
        -- Registros Censales
        mostrar_vies_roi, mostrar_redeme,
        -- Situation flags
        tiene_empleados, tiene_operaciones_ue, usa_modulos,
        -- Other
        tiene_tarifa_plana_ss, base_cotizacion, actividad_economica, fecha_alta_aeat, created_at
      FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      throw NotFoundError('Usuario no encontrado');
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
 * Update user preferences
 * PATCH /api/auth/preferences
 */
export const updatePreferences = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw UnauthorizedError();
    }

    const {
      // Existing model preferences
      mostrar_modelo_303,
      mostrar_modelo_130,
      mostrar_modelo_115,
      mostrar_modelo_180,
      mostrar_modelo_390,
      // New IVA models
      mostrar_modelo_349,
      mostrar_sii,
      // New IRPF models
      mostrar_modelo_131,
      mostrar_modelo_100,
      // New Retenciones models
      mostrar_modelo_111,
      mostrar_modelo_190,
      mostrar_modelo_123,
      // Declaraciones Informativas
      mostrar_modelo_347,
      // Registros Censales
      mostrar_vies_roi,
      mostrar_redeme,
      // Situation flags
      tiene_empleados,
      tiene_operaciones_ue,
      usa_modulos,
      // Other preferences
      tiene_tarifa_plana_ss,
      base_cotizacion,
      timezone,
      idioma,
      fecha_alta_aeat,
    } = req.body;

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCounter = 1;

    if (typeof mostrar_modelo_303 === 'boolean') {
      updates.push(`mostrar_modelo_303 = $${paramCounter++}`);
      values.push(mostrar_modelo_303);
    }

    if (typeof mostrar_modelo_130 === 'boolean') {
      updates.push(`mostrar_modelo_130 = $${paramCounter++}`);
      values.push(mostrar_modelo_130);
    }

    if (typeof mostrar_modelo_115 === 'boolean') {
      updates.push(`mostrar_modelo_115 = $${paramCounter++}`);
      values.push(mostrar_modelo_115);
    }

    if (typeof mostrar_modelo_180 === 'boolean') {
      updates.push(`mostrar_modelo_180 = $${paramCounter++}`);
      values.push(mostrar_modelo_180);
    }

    if (typeof mostrar_modelo_390 === 'boolean') {
      updates.push(`mostrar_modelo_390 = $${paramCounter++}`);
      values.push(mostrar_modelo_390);
    }

    // New IVA models
    if (typeof mostrar_modelo_349 === 'boolean') {
      updates.push(`mostrar_modelo_349 = $${paramCounter++}`);
      values.push(mostrar_modelo_349);
    }

    if (typeof mostrar_sii === 'boolean') {
      updates.push(`mostrar_sii = $${paramCounter++}`);
      values.push(mostrar_sii);
    }

    // New IRPF models
    if (typeof mostrar_modelo_131 === 'boolean') {
      updates.push(`mostrar_modelo_131 = $${paramCounter++}`);
      values.push(mostrar_modelo_131);
      // If enabling 131 (modulos), disable 130 (directa) - mutually exclusive
      if (mostrar_modelo_131 === true) {
        updates.push(`mostrar_modelo_130 = $${paramCounter++}`);
        values.push(false);
      }
    }

    if (typeof mostrar_modelo_100 === 'boolean') {
      updates.push(`mostrar_modelo_100 = $${paramCounter++}`);
      values.push(mostrar_modelo_100);
    }

    // Handle mutual exclusivity when enabling 130
    if (typeof mostrar_modelo_130 === 'boolean' && mostrar_modelo_130 === true) {
      // Disable 131 if enabling 130
      updates.push(`mostrar_modelo_131 = $${paramCounter++}`);
      values.push(false);
    }

    // New Retenciones models
    if (typeof mostrar_modelo_111 === 'boolean') {
      updates.push(`mostrar_modelo_111 = $${paramCounter++}`);
      values.push(mostrar_modelo_111);
    }

    if (typeof mostrar_modelo_190 === 'boolean') {
      updates.push(`mostrar_modelo_190 = $${paramCounter++}`);
      values.push(mostrar_modelo_190);
    }

    if (typeof mostrar_modelo_123 === 'boolean') {
      updates.push(`mostrar_modelo_123 = $${paramCounter++}`);
      values.push(mostrar_modelo_123);
    }

    // Declaraciones Informativas
    if (typeof mostrar_modelo_347 === 'boolean') {
      updates.push(`mostrar_modelo_347 = $${paramCounter++}`);
      values.push(mostrar_modelo_347);
    }

    // Registros Censales
    if (typeof mostrar_vies_roi === 'boolean') {
      updates.push(`mostrar_vies_roi = $${paramCounter++}`);
      values.push(mostrar_vies_roi);
    }

    if (typeof mostrar_redeme === 'boolean') {
      updates.push(`mostrar_redeme = $${paramCounter++}`);
      values.push(mostrar_redeme);
    }

    // Situation flags
    if (typeof tiene_empleados === 'boolean') {
      updates.push(`tiene_empleados = $${paramCounter++}`);
      values.push(tiene_empleados);
    }

    if (typeof tiene_operaciones_ue === 'boolean') {
      updates.push(`tiene_operaciones_ue = $${paramCounter++}`);
      values.push(tiene_operaciones_ue);
    }

    if (typeof usa_modulos === 'boolean') {
      updates.push(`usa_modulos = $${paramCounter++}`);
      values.push(usa_modulos);
    }

    if (typeof tiene_tarifa_plana_ss === 'boolean') {
      updates.push(`tiene_tarifa_plana_ss = $${paramCounter++}`);
      values.push(tiene_tarifa_plana_ss);
    }

    if (base_cotizacion !== undefined) {
      // Allow setting to null or a number
      if (base_cotizacion === null || (typeof base_cotizacion === 'number' && base_cotizacion > 0)) {
        updates.push(`base_cotizacion = $${paramCounter++}`);
        values.push(base_cotizacion);
      }
    }

    if (timezone) {
      updates.push(`timezone = $${paramCounter++}`);
      values.push(timezone);
    }

    if (idioma) {
      updates.push(`idioma = $${paramCounter++}`);
      values.push(idioma);
    }

    if (fecha_alta_aeat !== undefined) {
      // Allow setting to null or a valid date string
      updates.push(`fecha_alta_aeat = $${paramCounter++}`);
      values.push(fecha_alta_aeat);
    }

    if (updates.length === 0) {
      throw BadRequestError('No hay preferencias para actualizar');
    }

    values.push(req.user.id);

    const result = await query(
      `UPDATE users
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCounter}
       RETURNING
         id, email, nombre_completo, nif,
         mostrar_modelo_303, mostrar_modelo_130, mostrar_modelo_115,
         mostrar_modelo_180, mostrar_modelo_390,
         mostrar_modelo_349, mostrar_sii, mostrar_modelo_131, mostrar_modelo_100,
         mostrar_modelo_111, mostrar_modelo_190, mostrar_modelo_123,
        mostrar_modelo_347, mostrar_vies_roi, mostrar_redeme,
        tiene_empleados, tiene_operaciones_ue, usa_modulos,
        tiene_tarifa_plana_ss, base_cotizacion, timezone, idioma, fecha_alta_aeat`,
      values
    );

    if (result.rows.length === 0) {
      throw NotFoundError('Usuario no encontrado');
    }

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
      info: ['Preferencias actualizadas correctamente'],
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

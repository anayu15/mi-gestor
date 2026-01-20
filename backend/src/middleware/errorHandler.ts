import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'Ha ocurrido un error interno del servidor';
  let details: any = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else {
    message = err.message || message;

    // Handle PostgreSQL constraint violations
    const pgError = err as any;
    if (pgError.code === '23505') {  // Unique constraint violation
      statusCode = 409;
      code = 'DUPLICATE_KEY_ERROR';

      // Specific handling for invoice number constraint
      if (pgError.constraint === 'facturas_emitidas_user_numero_unique') {
        code = 'DUPLICATE_INVOICE_NUMBER';
        message = 'El número de factura ya existe. Por favor, inténtelo de nuevo.';
        details = {
          constraint: pgError.constraint,
          hint: 'Esto puede ocurrir si dos facturas se crean simultáneamente. La operación es segura para reintentar.',
        };
      } else {
        message = 'Ya existe un registro con estos datos únicos.';
        details = {
          constraint: pgError.constraint,
          detail: pgError.detail,
        };
      }
    }
  }

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', {
      code,
      message,
      statusCode,
      details,
      stack: err.stack,
    });
  }

  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };

  res.status(statusCode).json(response);
};

// Helper functions for common errors
export const BadRequestError = (message: string, details?: any) =>
  new AppError(message, 400, 'BAD_REQUEST', details);

export const UnauthorizedError = (message: string = 'No autorizado') =>
  new AppError(message, 401, 'UNAUTHORIZED');

export const ForbiddenError = (message: string = 'Acceso prohibido') =>
  new AppError(message, 403, 'FORBIDDEN');

export const NotFoundError = (message: string = 'Recurso no encontrado') =>
  new AppError(message, 404, 'NOT_FOUND');

export const ConflictError = (message: string, details?: any) =>
  new AppError(message, 409, 'CONFLICT', details);

export const ValidationError = (message: string, details?: any) =>
  new AppError(message, 400, 'VALIDATION_ERROR', details);

export const InternalError = (message: string = 'Error interno del servidor') =>
  new AppError(message, 500, 'INTERNAL_SERVER_ERROR');

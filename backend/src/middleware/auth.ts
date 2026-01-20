import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { AuthRequest, UserPayload } from '../types';
import { UnauthorizedError } from './errorHandler';

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    // Check Authorization header first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer '
    }
    // Fall back to query parameter (for iframes and images)
    else if (req.query.token && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      throw UnauthorizedError('Token de autenticación no proporcionado');
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as UserPayload;
      req.user = decoded;
      next();
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        throw UnauthorizedError('Token expirado');
      } else if (jwtError instanceof jwt.JsonWebTokenError) {
        throw UnauthorizedError('Token inválido');
      } else {
        throw UnauthorizedError('Error de autenticación');
      }
    }
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as UserPayload;
    req.user = decoded;
  } catch (error) {
    // Silently fail for optional auth
  }

  next();
};

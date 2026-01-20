import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import config from '../config';

// ============================================================================
// Configuración de almacenamiento de Multer
// ============================================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Organizar archivos por usuario y año
    const userId = (req as any).user?.id;

    if (!userId) {
      return cb(new Error('Usuario no autenticado'), '');
    }

    const year = new Date().getFullYear();
    const uploadPath = path.join(
      config.upload.dir,
      'documents',
      userId.toString(),
      year.toString()
    );

    // Crear directorio si no existe
    try {
      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error as Error, '');
    }
  },

  filename: (req, file, cb) => {
    // Generar nombre único: hash_timestamp.extension
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);

    // Sanitizar extensión
    const sanitizedExt = ext.toLowerCase().replace(/[^a-z0-9.]/g, '');
    const filename = `${randomHash}_${timestamp}${sanitizedExt}`;

    cb(null, filename);
  },
});

// ============================================================================
// Filtro de validación de archivos
// ============================================================================

const fileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = config.upload.allowedTypes;

  // Verificar tipo MIME
  if (!allowedMimeTypes.includes(file.mimetype)) {
    const error = new Error(
      `Tipo de archivo no permitido. Solo se aceptan: ${allowedMimeTypes.join(', ')}`
    ) as any;
    error.code = 'INVALID_FILE_TYPE';
    error.details = { mimetype: file.mimetype };
    return cb(error);
  }

  // Verificar extensión del archivo
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];

  if (!allowedExtensions.includes(ext)) {
    const error = new Error(
      `Extensión de archivo no permitida. Solo se aceptan: ${allowedExtensions.join(', ')}`
    ) as any;
    error.code = 'INVALID_FILE_EXTENSION';
    error.details = { extension: ext };
    return cb(error);
  }

  cb(null, true);
};

// ============================================================================
// Configuración principal de Multer
// ============================================================================

export const uploadDocument = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxSize, // Por defecto 10MB
    files: 1, // Solo 1 archivo por petición
    fields: 20, // Límite de campos en el formulario
  },
});

// ============================================================================
// Middleware para manejar errores de Multer
// ============================================================================

export const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    // Errores específicos de Multer
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `El archivo excede el tamaño máximo permitido de ${
            config.upload.maxSize / 1048576
          }MB`,
          details: {
            maxSize: config.upload.maxSize,
            maxSizeMB: config.upload.maxSize / 1048576,
          },
        },
      });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOO_MANY_FILES',
          message: 'Solo se puede subir un archivo a la vez',
        },
      });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOO_MANY_FILES',
          message: 'Solo se puede subir un archivo a la vez',
        },
      });
    }

    return res.status(400).json({
      success: false,
      error: {
        code: 'UPLOAD_ERROR',
        message: `Error al subir el archivo: ${err.message}`,
        details: { code: err.code },
      },
    });
  }

  // Errores personalizados del fileFilter
  if (err && err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FILE_TYPE',
        message: err.message,
        details: err.details,
      },
    });
  }

  if (err && err.code === 'INVALID_FILE_EXTENSION') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FILE_EXTENSION',
        message: err.message,
        details: err.details,
      },
    });
  }

  // Otros errores
  if (err) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'UPLOAD_ERROR',
        message: 'Error al procesar el archivo',
        details: err.message,
      },
    });
  }

  next();
};

// ============================================================================
// Utilidades auxiliares
// ============================================================================

/**
 * Verifica los "magic bytes" de un archivo para validar su tipo real
 * @param filePath Ruta al archivo
 * @returns El tipo MIME detectado o null si no se puede determinar
 */
export async function verifyFileType(filePath: string): Promise<string | null> {
  try {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    // PDF: %PDF (0x25 0x50 0x44 0x46)
    if (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    ) {
      return 'application/pdf';
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return 'image/png';
    }

    return null;
  } catch (error) {
    console.error('Error al verificar tipo de archivo:', error);
    return null;
  }
}

/**
 * Sanitiza el nombre de archivo original
 * @param filename Nombre del archivo
 * @returns Nombre sanitizado
 */
export function sanitizeFilename(filename: string): string {
  // Remover caracteres especiales y espacios
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Reemplazar caracteres especiales
    .replace(/_{2,}/g, '_') // Eliminar guiones bajos consecutivos
    .substring(0, 255); // Limitar longitud
}

/**
 * Obtiene el tamaño de un archivo en bytes
 * @param filePath Ruta al archivo
 * @returns Tamaño en bytes
 */
export function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

/**
 * Formatea el tamaño de un archivo a formato legible
 * @param bytes Tamaño en bytes
 * @returns Tamaño formateado (ej: "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import config from '../config';

// ============================================================================
// Storage Service - Manejo de archivos en disco
// ============================================================================

export class StorageService {
  /**
   * Calcula el hash SHA-256 de un archivo
   * @param filePath Ruta al archivo
   * @returns Hash SHA-256 en formato hexadecimal
   */
  static async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (error) => reject(error));
    });
  }

  /**
   * Verifica si un archivo existe
   * @param filePath Ruta al archivo
   * @returns true si existe, false si no
   */
  static fileExists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  /**
   * Elimina un archivo del disco (físicamente)
   * @param filePath Ruta al archivo
   * @returns true si se eliminó correctamente
   */
  static deleteFile(filePath: string): boolean {
    try {
      if (this.fileExists(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error al eliminar archivo:', error);
      return false;
    }
  }

  /**
   * Mueve un archivo a otra ubicación
   * @param sourcePath Ruta origen
   * @param destinationPath Ruta destino
   * @returns true si se movió correctamente
   */
  static moveFile(sourcePath: string, destinationPath: string): boolean {
    try {
      // Crear directorio destino si no existe
      const destDir = path.dirname(destinationPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      // Mover archivo
      fs.renameSync(sourcePath, destinationPath);
      return true;
    } catch (error) {
      console.error('Error al mover archivo:', error);
      return false;
    }
  }

  /**
   * Copia un archivo a otra ubicación
   * @param sourcePath Ruta origen
   * @param destinationPath Ruta destino
   * @returns true si se copió correctamente
   */
  static copyFile(sourcePath: string, destinationPath: string): boolean {
    try {
      // Crear directorio destino si no existe
      const destDir = path.dirname(destinationPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      // Copiar archivo
      fs.copyFileSync(sourcePath, destinationPath);
      return true;
    } catch (error) {
      console.error('Error al copiar archivo:', error);
      return false;
    }
  }

  /**
   * Obtiene el tamaño de un archivo en bytes
   * @param filePath Ruta al archivo
   * @returns Tamaño en bytes
   */
  static getFileSize(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Crea un directorio si no existe
   * @param dirPath Ruta del directorio
   * @returns true si se creó o ya existía
   */
  static ensureDirectory(dirPath: string): boolean {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      return true;
    } catch (error) {
      console.error('Error al crear directorio:', error);
      return false;
    }
  }

  /**
   * Mueve un archivo a la carpeta de versiones
   * @param userId ID del usuario
   * @param fileName Nombre del archivo
   * @param versionNumber Número de versión
   * @returns Ruta del archivo movido o null si falló
   */
  static moveToVersionsFolder(
    userId: string,
    fileName: string,
    versionNumber: number
  ): string | null {
    try {
      const year = new Date().getFullYear();
      const currentPath = path.join(
        config.upload.dir,
        'documents',
        userId,
        year.toString(),
        fileName
      );

      // Crear ruta de versions
      const versionsDir = path.join(
        config.upload.dir,
        'documents',
        userId,
        'versions'
      );

      this.ensureDirectory(versionsDir);

      // Nuevo nombre con número de versión
      const ext = path.extname(fileName);
      const baseName = path.basename(fileName, ext);
      const newFileName = `${baseName}_v${versionNumber}${ext}`;
      const newPath = path.join(versionsDir, newFileName);

      // Mover archivo
      if (this.moveFile(currentPath, newPath)) {
        // Retornar ruta relativa
        return path.join('documents', userId, 'versions', newFileName);
      }

      return null;
    } catch (error) {
      console.error('Error al mover archivo a versiones:', error);
      return null;
    }
  }

  /**
   * Obtiene la ruta absoluta de un archivo a partir de su ruta relativa
   * @param relativePath Ruta relativa desde uploads/
   * @returns Ruta absoluta
   */
  static getAbsolutePath(relativePath: string): string {
    return path.resolve(config.upload.dir, relativePath);
  }

  /**
   * Obtiene la ruta relativa de un archivo a partir de su ruta absoluta
   * @param absolutePath Ruta absoluta
   * @returns Ruta relativa
   */
  static getRelativePath(absolutePath: string): string {
    return path.relative(config.upload.dir, absolutePath);
  }

  /**
   * Verifica que una ruta no intente hacer path traversal
   * @param filePath Ruta a verificar
   * @returns true si es segura, false si detecta path traversal
   */
  static isPathSafe(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);
    const uploadDir = path.resolve(config.upload.dir);
    const absolutePath = path.resolve(uploadDir, normalizedPath);

    // Verificar que la ruta absoluta esté dentro del directorio de uploads
    return absolutePath.startsWith(uploadDir);
  }

  /**
   * Lee un archivo y lo retorna como buffer
   * @param filePath Ruta al archivo
   * @returns Buffer con el contenido del archivo
   */
  static async readFile(filePath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, (error, data) => {
        if (error) reject(error);
        else resolve(data);
      });
    });
  }

  /**
   * Obtiene el tipo MIME de un archivo basado en su extensión
   * @param filename Nombre del archivo
   * @returns Tipo MIME
   */
  static getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();

    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Limpia archivos de versiones antiguas (más de 90 días)
   * @param userId ID del usuario (opcional, si no se proporciona limpia todos)
   * @returns Número de archivos eliminados
   */
  static cleanOldVersions(userId?: string): number {
    try {
      let filesDeleted = 0;
      const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 días en milisegundos
      const now = Date.now();

      const versionsPath = userId
        ? path.join(config.upload.dir, 'documents', userId, 'versions')
        : path.join(config.upload.dir, 'documents');

      if (!fs.existsSync(versionsPath)) {
        return 0;
      }

      const processDirectory = (dirPath: string) => {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            processDirectory(fullPath);
          } else if (entry.isFile() && entry.name.includes('_v')) {
            const stats = fs.statSync(fullPath);
            const age = now - stats.mtimeMs;

            if (age > maxAge) {
              fs.unlinkSync(fullPath);
              filesDeleted++;
            }
          }
        }
      };

      processDirectory(versionsPath);
      return filesDeleted;
    } catch (error) {
      console.error('Error al limpiar versiones antiguas:', error);
      return 0;
    }
  }

  /**
   * Obtiene el uso total de almacenamiento de un usuario en bytes
   * @param userId ID del usuario
   * @returns Tamaño total en bytes
   */
  static getUserStorageUsage(userId: string): number {
    try {
      let totalSize = 0;
      const userPath = path.join(config.upload.dir, 'documents', userId);

      if (!fs.existsSync(userPath)) {
        return 0;
      }

      const calculateDirSize = (dirPath: string): number => {
        let size = 0;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            size += calculateDirSize(fullPath);
          } else if (entry.isFile()) {
            const stats = fs.statSync(fullPath);
            size += stats.size;
          }
        }

        return size;
      };

      totalSize = calculateDirSize(userPath);
      return totalSize;
    } catch (error) {
      console.error('Error al calcular uso de almacenamiento:', error);
      return 0;
    }
  }

  /**
   * Formatea un tamaño en bytes a formato legible
   * @param bytes Tamaño en bytes
   * @returns Tamaño formateado (ej: "2.5 MB")
   */
  static formatSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

export default StorageService;

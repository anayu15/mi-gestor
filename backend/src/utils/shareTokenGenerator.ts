import crypto from 'crypto';

// ============================================================================
// Generador de Tokens Seguros para Enlaces Compartidos
// ============================================================================

export class ShareTokenGenerator {
  /**
   * Genera un token único y seguro usando UUID v4 + hash adicional
   * @returns Token de 64 caracteres hexadecimales
   */
  static generate(): string {
    // Generar UUID v4
    const uuid = crypto.randomUUID();

    // Agregar timestamp y random bytes adicionales para mayor entropía
    const timestamp = Date.now().toString();
    const randomBytes = crypto.randomBytes(16).toString('hex');

    // Combinar y hashear
    const combined = `${uuid}-${timestamp}-${randomBytes}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');

    // Retornar los primeros 64 caracteres
    return hash.substring(0, 64);
  }

  /**
   * Genera un token corto (32 caracteres) para URLs más amigables
   * @returns Token de 32 caracteres hexadecimales
   */
  static generateShort(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Genera un token con formato personalizado
   * @param length Longitud del token (default: 64)
   * @returns Token de la longitud especificada
   */
  static generateCustomLength(length: number = 64): string {
    const bytesNeeded = Math.ceil(length / 2);
    const token = crypto.randomBytes(bytesNeeded).toString('hex');
    return token.substring(0, length);
  }

  /**
   * Valida que un token tenga el formato correcto
   * @param token Token a validar
   * @returns true si es válido, false si no
   */
  static isValid(token: string): boolean {
    // Verificar que solo contenga caracteres hexadecimales
    const hexRegex = /^[a-f0-9]+$/i;
    return hexRegex.test(token) && token.length >= 32 && token.length <= 64;
  }

  /**
   * Genera un código numérico de 6 dígitos (para verificación adicional)
   * @returns Código de 6 dígitos
   */
  static generateNumericCode(): string {
    const code = Math.floor(100000 + Math.random() * 900000);
    return code.toString();
  }

  /**
   * Genera una contraseña temporal segura
   * @param length Longitud de la contraseña (default: 12)
   * @returns Contraseña temporal
   */
  static generateTemporaryPassword(length: number = 12): string {
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    const randomBytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }

    return password;
  }

  /**
   * Hashea un token para almacenamiento seguro
   * @param token Token a hashear
   * @returns Hash del token
   */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Compara un token con su hash almacenado
   * @param token Token a comparar
   * @param hash Hash almacenado
   * @returns true si coinciden, false si no
   */
  static verifyToken(token: string, hash: string): boolean {
    const tokenHash = this.hashToken(token);
    return crypto.timingSafeEqual(
      Buffer.from(tokenHash),
      Buffer.from(hash)
    );
  }
}

export default ShareTokenGenerator;

/**
 * @fileoverview Niveles de seguridad simplificados para uso público
 * Responsabilidad: Definir validaciones básicas para coordinación de IA
 */

export enum SecurityLevel {
  STANDARD = 'standard'  // Un solo nivel - acceso completo para todos
}

export class SecurityLevelUtils {
  private static readonly LEVEL_HIERARCHY = {
    [SecurityLevel.STANDARD]: 1
  }

  private static readonly LEVEL_LIMITS = {
    [SecurityLevel.STANDARD]: {
      maxMessageLength: 100 * 1024, // 100KB - generoso para coordinación de IA
      allowedOperations: ['*'] // Todas las operaciones permitidas
    }
  }

  /**
   * Verifica si un nivel tiene permisos suficientes (siempre true para uso público)
   */
  public static hasSecurityClearance(
    _userLevel: SecurityLevel,
    _requiredLevel: SecurityLevel
  ): boolean {
    return true // Todos tienen acceso completo
  }

  /**
   * Obtiene las limitaciones para un nivel de seguridad
   */
  public static getLimits(level: SecurityLevel) {
    return this.LEVEL_LIMITS[level]
  }

  /**
   * Determina si una operación está permitida (siempre true para uso público)
   */
  public static isOperationAllowed(_level: SecurityLevel, _operation: string): boolean {
    return true // Todas las operaciones permitidas
  }
}
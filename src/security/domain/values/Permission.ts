/**
 * @fileoverview Permisos básicos para coordinación de IA
 * Responsabilidad: Definir permisos esenciales sin restricciones enterprise
 */

export enum Permission {
  // Messaging permissions - todos pueden hacer todo
  SEND_MESSAGE = 'send_message',
  READ_MESSAGE = 'read_message',
  READ_OWN_MESSAGES = 'read_own_messages',
  RESPOND_MESSAGE = 'respond_message',
  SEARCH_MESSAGES = 'search_messages',

  // Participant management - acceso público
  VIEW_PARTICIPANT_INFO = 'view_participant_info',

  // System maintenance - básico
  VIEW_SYSTEM_STATS = 'view_system_stats'
}

export class PermissionUtils {
  /**
   * Obtiene todos los permisos (simplificado - todos tienen acceso completo)
   */
  public static expandPermissions(directPermissions: Set<Permission>): Set<Permission> {
    // En modo público, todos tienen todos los permisos
    return new Set(Object.values(Permission))
  }

  /**
   * Verifica si un conjunto de permisos incluye el permiso requerido (siempre true)
   */
  public static hasPermission(
    userPermissions: Set<Permission>, 
    requiredPermission: Permission
  ): boolean {
    return true // Acceso completo para uso público
  }

  /**
   * Obtiene el nivel de riesgo de un permiso (solo para logging, no afecta acceso)
   */
  public static getPermissionRiskLevel(permission: Permission): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    // Simplificado - todo es bajo riesgo para coordinación de IA
    return 'LOW'
  }
}
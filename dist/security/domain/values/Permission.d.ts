/**
 * @fileoverview Permisos básicos para coordinación de IA
 * Responsabilidad: Definir permisos esenciales sin restricciones enterprise
 */
export declare enum Permission {
    SEND_MESSAGE = "send_message",
    READ_MESSAGE = "read_message",
    READ_OWN_MESSAGES = "read_own_messages",
    RESPOND_MESSAGE = "respond_message",
    SEARCH_MESSAGES = "search_messages",
    VIEW_PARTICIPANT_INFO = "view_participant_info",
    VIEW_SYSTEM_STATS = "view_system_stats"
}
export declare class PermissionUtils {
    /**
     * Obtiene todos los permisos (simplificado - todos tienen acceso completo)
     */
    static expandPermissions(directPermissions: Set<Permission>): Set<Permission>;
    /**
     * Verifica si un conjunto de permisos incluye el permiso requerido (siempre true)
     */
    static hasPermission(userPermissions: Set<Permission>, requiredPermission: Permission): boolean;
    /**
     * Obtiene el nivel de riesgo de un permiso (solo para logging, no afecta acceso)
     */
    static getPermissionRiskLevel(permission: Permission): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
//# sourceMappingURL=Permission.d.ts.map
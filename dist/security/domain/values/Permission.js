/**
 * @fileoverview Permisos básicos para coordinación de IA
 * Responsabilidad: Definir permisos esenciales sin restricciones enterprise
 */
export var Permission;
(function (Permission) {
    // Messaging permissions - todos pueden hacer todo
    Permission["SEND_MESSAGE"] = "send_message";
    Permission["READ_MESSAGE"] = "read_message";
    Permission["READ_OWN_MESSAGES"] = "read_own_messages";
    Permission["RESPOND_MESSAGE"] = "respond_message";
    Permission["SEARCH_MESSAGES"] = "search_messages";
    // Participant management - acceso público
    Permission["VIEW_PARTICIPANT_INFO"] = "view_participant_info";
    // System maintenance - básico
    Permission["VIEW_SYSTEM_STATS"] = "view_system_stats";
})(Permission || (Permission = {}));
export class PermissionUtils {
    /**
     * Obtiene todos los permisos (simplificado - todos tienen acceso completo)
     */
    static expandPermissions(directPermissions) {
        // En modo público, todos tienen todos los permisos
        return new Set(Object.values(Permission));
    }
    /**
     * Verifica si un conjunto de permisos incluye el permiso requerido (siempre true)
     */
    static hasPermission(userPermissions, requiredPermission) {
        return true; // Acceso completo para uso público
    }
    /**
     * Obtiene el nivel de riesgo de un permiso (solo para logging, no afecta acceso)
     */
    static getPermissionRiskLevel(permission) {
        // Simplificado - todo es bajo riesgo para coordinación de IA
        return 'LOW';
    }
}
//# sourceMappingURL=Permission.js.map
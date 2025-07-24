/**
 * @fileoverview Niveles de seguridad simplificados para uso público
 * Responsabilidad: Definir validaciones básicas para coordinación de IA
 */
export var SecurityLevel;
(function (SecurityLevel) {
    SecurityLevel["STANDARD"] = "standard"; // Un solo nivel - acceso completo para todos
})(SecurityLevel || (SecurityLevel = {}));
export class SecurityLevelUtils {
    static LEVEL_HIERARCHY = {
        [SecurityLevel.STANDARD]: 1
    };
    static LEVEL_LIMITS = {
        [SecurityLevel.STANDARD]: {
            maxMessageLength: 100 * 1024, // 100KB - generoso para coordinación de IA
            allowedOperations: ['*'] // Todas las operaciones permitidas
        }
    };
    /**
     * Verifica si un nivel tiene permisos suficientes (siempre true para uso público)
     */
    static hasSecurityClearance(userLevel, requiredLevel) {
        return true; // Todos tienen acceso completo
    }
    /**
     * Obtiene las limitaciones para un nivel de seguridad
     */
    static getLimits(level) {
        return this.LEVEL_LIMITS[level];
    }
    /**
     * Determina si una operación está permitida (siempre true para uso público)
     */
    static isOperationAllowed(level, operation) {
        return true; // Todas las operaciones permitidas
    }
}
//# sourceMappingURL=SecurityLevel.js.map
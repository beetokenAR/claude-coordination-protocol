/**
 * @fileoverview Niveles de seguridad simplificados para uso público
 * Responsabilidad: Definir validaciones básicas para coordinación de IA
 */
export declare enum SecurityLevel {
    STANDARD = "standard"
}
export declare class SecurityLevelUtils {
    private static readonly LEVEL_HIERARCHY;
    private static readonly LEVEL_LIMITS;
    /**
     * Verifica si un nivel tiene permisos suficientes (siempre true para uso público)
     */
    static hasSecurityClearance(userLevel: SecurityLevel, requiredLevel: SecurityLevel): boolean;
    /**
     * Obtiene las limitaciones para un nivel de seguridad
     */
    static getLimits(level: SecurityLevel): {
        maxMessageLength: number;
        allowedOperations: string[];
    };
    /**
     * Determina si una operación está permitida (siempre true para uso público)
     */
    static isOperationAllowed(level: SecurityLevel, operation: string): boolean;
}
//# sourceMappingURL=SecurityLevel.d.ts.map
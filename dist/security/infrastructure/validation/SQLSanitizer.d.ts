/**
 * @fileoverview Sanitizador de consultas SQL
 * Responsabilidad: Prevenir inyecciones SQL y validar consultas
 */
export declare class SQLSanitizer {
    private static readonly SQL_KEYWORDS;
    private static readonly DANGEROUS_PATTERNS;
    private static readonly MAX_QUERY_LENGTH;
    private static readonly MAX_IDENTIFIER_LENGTH;
    /**
     * Sanitiza un identificador SQL (tabla, columna, etc.)
     */
    static sanitizeIdentifier(identifier: string): string;
    /**
     * Sanitiza un valor literal para ser usado en queries parametrizadas
     */
    static sanitizeLiteral(value: any): any;
    /**
     * Valida que una query no contenga patrones de inyección SQL
     */
    static validateQuery(query: string): void;
    /**
     * Escapa caracteres especiales en strings para SQL
     */
    static escapeString(value: string): string;
    /**
     * Valida parámetros para queries parametrizadas
     */
    static validateParameters(params: Record<string, any>): Record<string, any>;
    /**
     * Crea un placeholder seguro para queries parametrizadas
     */
    static createPlaceholder(paramName: string): string;
    /**
     * Valida entrada de identificador
     */
    private static validateIdentifierInput;
    /**
     * Valida entrada de query
     */
    private static validateQueryInput;
    /**
     * Sanitiza un literal de cadena
     */
    private static sanitizeStringLiteral;
    /**
     * Sanitiza un literal numérico
     */
    private static sanitizeNumericLiteral;
    /**
     * Valida la estructura de la query
     */
    private static validateQueryStructure;
}
//# sourceMappingURL=SQLSanitizer.d.ts.map
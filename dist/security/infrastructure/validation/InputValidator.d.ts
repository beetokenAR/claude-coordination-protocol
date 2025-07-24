/**
 * @fileoverview Validador de entrada
 * Responsabilidad: Sanitización y validación de todas las entradas del usuario
 */
import { z } from 'zod';
export declare class InputValidator {
    private static readonly MAX_STRING_LENGTH;
    private static readonly MAX_ARRAY_LENGTH;
    private static readonly SQL_INJECTION_PATTERN;
    private static readonly XSS_PATTERN;
    private static readonly COMMAND_INJECTION_PATTERN;
    private static readonly PATH_TRAVERSAL_PATTERN;
    /**
     * Valida y sanitiza una cadena de texto
     */
    static validateString(input: unknown, options?: {
        maxLength?: number;
        allowEmpty?: boolean;
        pattern?: RegExp;
        sanitize?: boolean;
    }): string;
    /**
     * Valida un objeto usando schema Zod
     */
    static validateObject<T>(input: unknown, schema: z.ZodSchema<T>): T;
    /**
     * Valida un array con elementos del tipo especificado
     */
    static validateArray<T>(input: unknown, itemValidator: (item: unknown) => T, maxLength?: number): T[];
    /**
     * Valida un ID de participante
     */
    static validateParticipantId(input: unknown): string;
    /**
     * Sanitiza una cadena de texto
     */
    private static sanitizeString;
    /**
     * Sanitiza recursivamente un objeto
     */
    private static sanitizeObject;
    /**
     * Verifica amenazas de seguridad comunes
     */
    private static checkForSecurityThreats;
    /**
     * Valida un JSON string y lo parsea de forma segura
     */
    static validateJSON<T = any>(input: unknown, maxDepth?: number): T;
    /**
     * Verifica la profundidad de un objeto para prevenir ataques DoS
     */
    private static checkObjectDepth;
}
//# sourceMappingURL=InputValidator.d.ts.map
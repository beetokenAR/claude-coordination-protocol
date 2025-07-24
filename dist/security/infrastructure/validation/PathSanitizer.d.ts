/**
 * @fileoverview Sanitizador de rutas de archivos
 * Responsabilidad: Prevenir ataques de path traversal y validar rutas de archivos
 */
export declare class PathSanitizer {
    private static readonly ALLOWED_EXTENSIONS;
    private static readonly DANGEROUS_PATTERNS;
    private static readonly MAX_PATH_LENGTH;
    private static readonly MAX_COMPONENT_LENGTH;
    /**
     * Sanitiza y valida una ruta de archivo
     */
    static sanitizePath(input: string, basePath: string, options?: {
        allowAbsolute?: boolean;
        checkExtension?: boolean;
        createIfNotExists?: boolean;
    }): string;
    /**
     * Crea una ruta de archivo segura dentro de un directorio base
     */
    static createSafePath(basePath: string, ...components: string[]): string;
    /**
     * Valida que una ruta esté dentro de los límites permitidos
     */
    static validatePathBoundaries(targetPath: string, basePath: string): void;
    /**
     * Obtiene un nombre de archivo seguro
     */
    static sanitizeFilename(filename: string): string;
    /**
     * Validación inicial de entrada
     */
    private static validatePathInput;
    /**
     * Verifica patrones peligrosos en la ruta
     */
    private static checkDangerousPatterns;
    /**
     * Convierte ruta absoluta a relativa
     */
    private static makeRelativePath;
    /**
     * Valida la extensión del archivo
     */
    private static validateFileExtension;
    /**
     * Obtiene la extensión de archivo
     */
    private static getFileExtension;
    /**
     * Valida las longitudes de ruta y componentes
     */
    private static validatePathLengths;
    /**
     * Valida un componente individual de ruta
     */
    private static validatePathComponent;
    /**
     * Sanitiza un componente de ruta
     */
    private static sanitizeComponent;
}
//# sourceMappingURL=PathSanitizer.d.ts.map
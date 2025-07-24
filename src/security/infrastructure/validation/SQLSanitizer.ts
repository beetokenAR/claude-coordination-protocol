/**
 * @fileoverview Sanitizador de consultas SQL
 * Responsabilidad: Prevenir inyecciones SQL y validar consultas
 */

export class SQLSanitizer {
  private static readonly SQL_KEYWORDS = new Set([
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
    'EXEC', 'EXECUTE', 'UNION', 'HAVING', 'WHERE', 'ORDER', 'GROUP',
    'FROM', 'INTO', 'VALUES', 'SET', 'AND', 'OR', 'NOT', 'IN', 'EXISTS',
    'LIKE', 'BETWEEN', 'IS', 'NULL', 'TRUE', 'FALSE', 'CASE', 'WHEN',
    'THEN', 'ELSE', 'END', 'AS', 'ON', 'INNER', 'LEFT', 'RIGHT',
    'FULL', 'OUTER', 'JOIN', 'CROSS', 'LIMIT', 'OFFSET', 'DISTINCT',
    'ALL', 'ANY', 'SOME', 'TRIGGER', 'PROCEDURE', 'FUNCTION', 'VIEW',
    'INDEX', 'TABLE', 'DATABASE', 'SCHEMA', 'GRANT', 'REVOKE', 'COMMIT',
    'ROLLBACK', 'TRANSACTION', 'BEGIN', 'DECLARE', 'CURSOR', 'FETCH'
  ])

  private static readonly DANGEROUS_PATTERNS = [
    /(\bUNION\s+SELECT\b)/gi,        // Union-based injection
    /(\bSELECT\s+.*\s+FROM\b)/gi,    // Select injection
    /(\bINSERT\s+INTO\b)/gi,         // Insert injection
    /(\bUPDATE\s+.*\s+SET\b)/gi,     // Update injection
    /(\bDELETE\s+FROM\b)/gi,         // Delete injection
    /(\bDROP\s+(TABLE|DATABASE|SCHEMA)\b)/gi, // Drop injection
    /(\bALTER\s+TABLE\b)/gi,         // Alter injection
    /(\bEXEC\s*\()/gi,               // Execute injection
    /(\bEXECUTE\s*\()/gi,            // Execute injection
    /(--\s*$)/gm,                    // SQL comments
    /(\/\*[\s\S]*?\*\/)/g,           // Multi-line comments
    /(\bxp_cmdshell\b)/gi,           // Command execution (SQL Server)
    /(\bsp_executesql\b)/gi,         // Dynamic SQL execution
    /(\bINTO\s+OUTFILE\b)/gi,        // File operations (MySQL)
    /(\bLOAD_FILE\s*\()/gi,          // File read (MySQL)
    /(\bINTO\s+DUMPFILE\b)/gi,       // File write (MySQL)
    /(;\s*$)/gm,                     // Query termination
    /(\|\|)/g,                       // String concatenation (Oracle)
    /(\+)/g,                         // String concatenation (SQL Server)
    /(\bCONCAT\s*\()/gi,             // String concatenation function
    /(\bSUBSTRING\s*\()/gi,          // Substring extraction
    /(\bCAST\s*\()/gi,               // Type casting
    /(\bCONVERT\s*\()/gi,            // Type conversion
    /(\bCHAR\s*\()/gi,               // Character conversion
    /(\bASCII\s*\()/gi,              // ASCII conversion
    /(\bHEX\s*\()/gi,                // Hexadecimal conversion
    /(\bUNHEX\s*\()/gi,              // Unhexadecimal conversion
    /(\bBENCHMARK\s*\()/gi,          // Timing attacks (MySQL)
    /(\bSLEEP\s*\()/gi,              // Timing attacks (MySQL)
    /(\bWAITFOR\s+DELAY\b)/gi,       // Timing attacks (SQL Server)
    /(\bPG_SLEEP\s*\()/gi,           // Timing attacks (PostgreSQL)
    /(\bEXTRACTVALUE\s*\()/gi,       // XML injection (MySQL)
    /(\bUPDATEXML\s*\()/gi,          // XML injection (MySQL)
    /(\bXMLTYPE\s*\()/gi,            // XML injection (Oracle)
  ]

  private static readonly MAX_QUERY_LENGTH = 10000
  private static readonly MAX_IDENTIFIER_LENGTH = 64

  /**
   * Sanitiza un identificador SQL (tabla, columna, etc.)
   */
  public static sanitizeIdentifier(identifier: string): string {
    this.validateIdentifierInput(identifier)

    let sanitized = identifier.trim()

    // Verificar longitud
    if (sanitized.length > this.MAX_IDENTIFIER_LENGTH) {
      throw new Error(`Identifier length exceeds maximum of ${this.MAX_IDENTIFIER_LENGTH}`)
    }

    // Verificar que sea un identificador válido
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(sanitized)) {
      throw new Error('Invalid identifier format')
    }

    // Verificar que no sea una palabra reservada SQL
    if (this.SQL_KEYWORDS.has(sanitized.toUpperCase())) {
      throw new Error(`'${sanitized}' is a reserved SQL keyword`)
    }

    return sanitized
  }

  /**
   * Sanitiza un valor literal para ser usado en queries parametrizadas
   */
  public static sanitizeLiteral(value: any): any {
    if (value === null || value === undefined) {
      return null
    }

    if (typeof value === 'string') {
      return this.sanitizeStringLiteral(value)
    }

    if (typeof value === 'number') {
      return this.sanitizeNumericLiteral(value)
    }

    if (typeof value === 'boolean') {
      return value
    }

    if (value instanceof Date) {
      return value.toISOString()
    }

    // Para otros tipos, convertir a string y sanitizar
    return this.sanitizeStringLiteral(String(value))
  }

  /**
   * Valida que una query no contenga patrones de inyección SQL
   */
  public static validateQuery(query: string): void {
    this.validateQueryInput(query)

    const normalizedQuery = query.toUpperCase().replace(/\s+/g, ' ')

    // Verificar patrones peligrosos
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(query)) {
        throw new Error(`Query contains dangerous SQL pattern: ${pattern}`)
      }
    }

    // Verificar múltiples declaraciones (separadas por ;)
    const statements = query.split(';').filter(s => s.trim().length > 0)
    if (statements.length > 1) {
      throw new Error('Multiple SQL statements are not allowed')
    }

    // Verificar palabras clave sospechosas en contextos incorrectos
    this.validateQueryStructure(normalizedQuery)
  }

  /**
   * Escapa caracteres especiales en strings para SQL
   */
  public static escapeString(value: string): string {
    if (typeof value !== 'string') {
      throw new Error('Value must be a string')
    }

    // Escapar comillas simples duplicándolas
    let escaped = value.replace(/'/g, "''")

    // Escapar caracteres de control
    escaped = escaped.replace(/[\x00\x08\x09\x1a\n\r"\\%]/g, (char) => {
      switch (char) {
        case '\x00': return '\\0'
        case '\x08': return '\\b'
        case '\x09': return '\\t'
        case '\x1a': return '\\z'
        case '\n': return '\\n'
        case '\r': return '\\r'
        case '"': return '\\"'
        case '\\': return '\\\\'
        case '%': return '\\%'
        default: return char
      }
    })

    return escaped
  }

  /**
   * Valida parámetros para queries parametrizadas
   */
  public static validateParameters(params: Record<string, any>): Record<string, any> {
    const sanitizedParams: Record<string, any> = {}

    for (const [key, value] of Object.entries(params)) {
      // Validar nombre del parámetro
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        throw new Error(`Invalid parameter name: ${key}`)
      }

      // Sanitizar valor
      sanitizedParams[key] = this.sanitizeLiteral(value)
    }

    return sanitizedParams
  }

  /**
   * Crea un placeholder seguro para queries parametrizadas
   */
  public static createPlaceholder(paramName: string): string {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(paramName)) {
      throw new Error(`Invalid parameter name for placeholder: ${paramName}`)
    }

    return `$${paramName}`
  }

  /**
   * Valida entrada de identificador
   */
  private static validateIdentifierInput(identifier: string): void {
    if (typeof identifier !== 'string') {
      throw new Error('Identifier must be a string')
    }

    if (identifier.length === 0) {
      throw new Error('Identifier cannot be empty')
    }

    // Verificar caracteres de control
    if (/[\x00-\x1F]/.test(identifier)) {
      throw new Error('Identifier contains control characters')
    }
  }

  /**
   * Valida entrada de query
   */
  private static validateQueryInput(query: string): void {
    if (typeof query !== 'string') {
      throw new Error('Query must be a string')
    }

    if (query.length === 0) {
      throw new Error('Query cannot be empty')
    }

    if (query.length > this.MAX_QUERY_LENGTH) {
      throw new Error(`Query length exceeds maximum of ${this.MAX_QUERY_LENGTH}`)
    }

    // Verificar caracteres de control peligrosos
    if (/[\x00]/.test(query)) {
      throw new Error('Query contains null bytes')
    }
  }

  /**
   * Sanitiza un literal de cadena
   */
  private static sanitizeStringLiteral(value: string): string {
    // Verificar longitud razonable
    if (value.length > 10000) {
      throw new Error('String literal too long')
    }

    // Verificar patrones de inyección en el valor
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(value)) {
        throw new Error('String literal contains dangerous SQL pattern')
      }
    }

    return value
  }

  /**
   * Sanitiza un literal numérico
   */
  private static sanitizeNumericLiteral(value: number): number {
    if (!Number.isFinite(value)) {
      throw new Error('Numeric literal must be finite')
    }

    // Verificar rango razonable
    if (Math.abs(value) > Number.MAX_SAFE_INTEGER) {
      throw new Error('Numeric literal exceeds safe integer range')
    }

    return value
  }

  /**
   * Valida la estructura de la query
   */
  private static validateQueryStructure(normalizedQuery: string): void {
    // Verificar queries anidadas sospechosas
    const selectCount = (normalizedQuery.match(/\bSELECT\b/g) || []).length
    const fromCount = (normalizedQuery.match(/\bFROM\b/g) || []).length
    
    // Si hay más SELECTs que FROMs, puede ser inyección
    if (selectCount > fromCount + 1) {
      throw new Error('Suspicious nested SELECT statements detected')
    }

    // Verificar patrones de UNION
    if (normalizedQuery.includes('UNION') && normalizedQuery.includes('SELECT')) {
      throw new Error('UNION SELECT pattern detected')
    }

    // Verificar comentarios sospechosos
    if (normalizedQuery.includes('--') || normalizedQuery.includes('/*')) {
      throw new Error('SQL comments are not allowed')
    }
  }
}
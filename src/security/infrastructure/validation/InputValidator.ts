/**
 * @fileoverview Validador de entrada
 * Responsabilidad: Sanitización y validación de todas las entradas del usuario
 */

import { z } from 'zod'

export class InputValidator {
  private static readonly MAX_STRING_LENGTH = 10000
  private static readonly MAX_ARRAY_LENGTH = 1000
  
  // Patrones de seguridad
  private static readonly SQL_INJECTION_PATTERN = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|EXEC|EXECUTE)\b)|(-{2})|\/\*|\*\/|;/gi
  private static readonly XSS_PATTERN = /<[^>]*>?/gm
  private static readonly COMMAND_INJECTION_PATTERN = /[;&|`$(){}]/g
  private static readonly PATH_TRAVERSAL_PATTERN = /\.\.\//g

  /**
   * Valida y sanitiza una cadena de texto
   */
  public static validateString(
    input: unknown,
    options: {
      maxLength?: number
      allowEmpty?: boolean
      pattern?: RegExp
      sanitize?: boolean
    } = {}
  ): string {
    const {
      maxLength = this.MAX_STRING_LENGTH,
      allowEmpty = true,
      pattern,
      sanitize = true
    } = options

    // Validación básica de tipo
    if (typeof input !== 'string') {
      throw new Error('Input must be a string')
    }

    let value = input

    // Sanitización
    if (sanitize) {
      value = this.sanitizeString(value)
    }

    // Validación de longitud
    if (!allowEmpty && value.length === 0) {
      throw new Error('String cannot be empty')
    }

    if (value.length > maxLength) {
      throw new Error(`String length exceeds maximum of ${maxLength} characters`)
    }

    // Validación de patrón
    if (pattern && !pattern.test(value)) {
      throw new Error('String does not match required pattern')
    }

    // Verificaciones de seguridad
    this.checkForSecurityThreats(value)

    return value
  }

  /**
   * Valida un objeto usando schema Zod
   */
  public static validateObject<T>(
    input: unknown,
    schema: z.ZodSchema<T>
  ): T {
    try {
      // Pre-sanitización si es un objeto
      if (typeof input === 'object' && input !== null) {
        input = this.sanitizeObject(input)
      }

      return schema.parse(input)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        throw new Error(`Validation failed: ${messages.join(', ')}`)
      }
      throw error
    }
  }

  /**
   * Valida un array con elementos del tipo especificado
   */
  public static validateArray<T>(
    input: unknown,
    itemValidator: (item: unknown) => T,
    maxLength: number = this.MAX_ARRAY_LENGTH
  ): T[] {
    if (!Array.isArray(input)) {
      throw new Error('Input must be an array')
    }

    if (input.length > maxLength) {
      throw new Error(`Array length exceeds maximum of ${maxLength} elements`)
    }

    return input.map((item, index) => {
      try {
        return itemValidator(item)
      } catch (error) {
        throw new Error(`Array item at index ${index}: ${error instanceof Error ? error.message : 'Invalid item'}`)
      }
    })
  }

  /**
   * Valida un ID de participante
   */
  public static validateParticipantId(input: unknown): string {
    const id = this.validateString(input, {
      maxLength: 50,
      allowEmpty: false,
      pattern: /^@[a-zA-Z][a-zA-Z0-9_-]{1,30}$/,
      sanitize: true
    })

    // Verificaciones adicionales específicas para IDs
    const reservedIds = ['@system', '@admin', '@root', '@null', '@undefined']
    if (reservedIds.includes(id.toLowerCase())) {
      throw new Error('Participant ID is reserved')
    }

    return id
  }

  /**
   * Sanitiza una cadena de texto
   */
  private static sanitizeString(input: string): string {
    let sanitized = input

    // Remover caracteres de control
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '')

    // Trim whitespace
    sanitized = sanitized.trim()

    // Normalizar espacios múltiples
    sanitized = sanitized.replace(/\s+/g, ' ')

    return sanitized
  }

  /**
   * Sanitiza recursivamente un objeto
   */
  private static sanitizeObject(input: any): any {
    if (typeof input === 'string') {
      return this.sanitizeString(input)
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeObject(item))
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(input)) {
        // Sanitizar también las claves
        const sanitizedKey = this.sanitizeString(key)
        sanitized[sanitizedKey] = this.sanitizeObject(value)
      }
      return sanitized
    }

    return input
  }

  /**
   * Verifica amenazas de seguridad comunes
   */
  private static checkForSecurityThreats(input: string): void {
    if (this.SQL_INJECTION_PATTERN.test(input)) {
      throw new Error('Input contains potential SQL injection patterns')
    }

    if (this.XSS_PATTERN.test(input)) {
      throw new Error('Input contains potential XSS patterns')
    }

    if (this.COMMAND_INJECTION_PATTERN.test(input)) {
      throw new Error('Input contains potential command injection characters')
    }

    if (this.PATH_TRAVERSAL_PATTERN.test(input)) {
      throw new Error('Input contains potential path traversal patterns')
    }

    // Verificar longitud excesiva de palabras individuales (posible DoS)
    const words = input.split(/\s+/)
    for (const word of words) {
      if (word.length > 1000) {
        throw new Error('Input contains excessively long words')
      }
    }
  }

  /**
   * Valida un JSON string y lo parsea de forma segura
   */
  public static validateJSON<T = any>(
    input: unknown,
    maxDepth: number = 10
  ): T {
    if (typeof input !== 'string') {
      throw new Error('JSON input must be a string')
    }

    // Verificar longitud
    if (input.length > 100000) { // 100KB limit
      throw new Error('JSON input too large')
    }

    try {
      const parsed = JSON.parse(input)
      
      // Verificar profundidad del objeto
      this.checkObjectDepth(parsed, maxDepth)
      
      return parsed
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON format')
      }
      throw error
    }
  }

  /**
   * Verifica la profundidad de un objeto para prevenir ataques DoS
   */
  private static checkObjectDepth(obj: any, maxDepth: number, currentDepth: number = 0): void {
    if (currentDepth > maxDepth) {
      throw new Error(`Object depth exceeds maximum of ${maxDepth}`)
    }

    if (typeof obj === 'object' && obj !== null) {
      if (Array.isArray(obj)) {
        for (const item of obj) {
          this.checkObjectDepth(item, maxDepth, currentDepth + 1)
        }
      } else {
        for (const value of Object.values(obj)) {
          this.checkObjectDepth(value, maxDepth, currentDepth + 1)
        }
      }
    }
  }
}
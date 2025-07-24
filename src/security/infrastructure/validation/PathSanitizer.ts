/**
 * @fileoverview Sanitizador de rutas de archivos
 * Responsabilidad: Prevenir ataques de path traversal y validar rutas de archivos
 */

import { resolve, normalize, relative, join } from 'path'

export class PathSanitizer {
  private static readonly ALLOWED_EXTENSIONS = new Set([
    '.db', '.sqlite', '.sqlite3', '.json', '.log', '.txt', '.md'
  ])

  private static readonly DANGEROUS_PATTERNS = [
    /\.\.\//g,        // Path traversal
    /\.\.\\/g,        // Windows path traversal
    /\/\.\./g,        // Hidden path traversal
    /\\\.\./g,        // Windows hidden path traversal
    // eslint-disable-next-line no-control-regex
    /\x00/g,          // Null bytes
    /[<>:"|?*]/g,     // Windows invalid chars
    /^\//,            // Absolute paths (Unix)
    /^[A-Za-z]:\\/,   // Absolute paths (Windows)
    /^\\\\[^\\]/,     // UNC paths
    /\/$/,            // Trailing slash
    /\/{2,}/g        // Multiple slashes
  ]

  private static readonly MAX_PATH_LENGTH = 260 // Windows MAX_PATH
  private static readonly MAX_COMPONENT_LENGTH = 255 // Most filesystems

  /**
   * Sanitiza y valida una ruta de archivo
   */
  public static sanitizePath(
    input: string,
    basePath: string,
    options: {
      allowAbsolute?: boolean
      checkExtension?: boolean
      createIfNotExists?: boolean
    } = {}
  ): string {
    const {
      allowAbsolute = false,
      checkExtension = true,
      createIfNotExists = false
    } = options

    // Validación inicial
    this.validatePathInput(input)

    let sanitizedPath = input

    // Normalizar la ruta
    sanitizedPath = normalize(sanitizedPath)

    // Verificar patrones peligrosos
    this.checkDangerousPatterns(sanitizedPath)

    // Resolver ruta absoluta si no está permitida
    if (!allowAbsolute) {
      sanitizedPath = this.makeRelativePath(sanitizedPath, basePath)
    }

    // Verificar que la ruta esté dentro del directorio base
    this.validatePathBoundaries(sanitizedPath, basePath)

    // Verificar extensión de archivo si es requerido
    if (checkExtension) {
      this.validateFileExtension(sanitizedPath)
    }

    // Verificar longitudes
    this.validatePathLengths(sanitizedPath)

    // Crear directorio padre si es necesario
    if (createIfNotExists) {
      // Esta funcionalidad se implementaría en la capa de infraestructura
      // aquí solo validamos que la ruta sea segura
    }

    return sanitizedPath
  }

  /**
   * Crea una ruta de archivo segura dentro de un directorio base
   */
  public static createSafePath(
    basePath: string,
    ...components: string[]
  ): string {
    // Sanitizar cada componente
    const sanitizedComponents = components.map(component => {
      this.validatePathComponent(component)
      return this.sanitizeComponent(component)
    })

    // Construir la ruta
    const safePath = join(basePath, ...sanitizedComponents)

    // Verificar que la ruta resultante esté dentro del directorio base
    this.validatePathBoundaries(safePath, basePath)

    return safePath
  }

  /**
   * Valida que una ruta esté dentro de los límites permitidos
   */
  public static validatePathBoundaries(
    targetPath: string,
    basePath: string
  ): void {
    const resolvedTarget = resolve(targetPath)
    const resolvedBase = resolve(basePath)

    // Verificar que la ruta esté dentro del directorio base
    const relativePath = relative(resolvedBase, resolvedTarget)

    if (relativePath.startsWith('..') || relativePath === '..') {
      throw new Error('Path traversal attempt detected')
    }

    if (resolve(basePath, relativePath) !== resolvedTarget) {
      throw new Error('Path manipulation detected')
    }
  }

  /**
   * Obtiene un nombre de archivo seguro
   */
  public static sanitizeFilename(filename: string): string {
    this.validatePathInput(filename)

    let sanitized = filename

    // Remover caracteres peligrosos
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[<>:"|?*\x00-\x1F]/g, '_')

    // Remover espacios al inicio y final
    sanitized = sanitized.trim()

    // Remover múltiples espacios
    sanitized = sanitized.replace(/\s+/g, '_')

    // Remover puntos al inicio (archivos ocultos en Unix)
    if (sanitized.startsWith('.')) {
      sanitized = '_' + sanitized.substring(1)
    }

    // Verificar longitud
    if (sanitized.length > this.MAX_COMPONENT_LENGTH) {
      const ext = this.getFileExtension(sanitized)
      const name = sanitized.substring(0, this.MAX_COMPONENT_LENGTH - ext.length)
      sanitized = name + ext
    }

    // Verificar que no esté vacío
    if (sanitized.length === 0) {
      throw new Error('Filename cannot be empty after sanitization')
    }

    return sanitized
  }

  /**
   * Validación inicial de entrada
   */
  private static validatePathInput(input: string): void {
    if (typeof input !== 'string') {
      throw new Error('Path must be a string')
    }

    if (input.length === 0) {
      throw new Error('Path cannot be empty')
    }

    if (input.length > this.MAX_PATH_LENGTH) {
      throw new Error(`Path length exceeds maximum of ${this.MAX_PATH_LENGTH} characters`)
    }

    // Verificar caracteres de control
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1F]/.test(input)) {
      throw new Error('Path contains control characters')
    }
  }

  /**
   * Verifica patrones peligrosos en la ruta
   */
  private static checkDangerousPatterns(path: string): void {
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(path)) {
        throw new Error(`Path contains dangerous pattern: ${pattern}`)
      }
    }

    // Verificar nombres reservados de Windows
    const windowsReserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i
    const filename = path.split(/[/\\]/).pop() || ''
    if (windowsReserved.test(filename)) {
      throw new Error('Path contains reserved Windows filename')
    }
  }

  /**
   * Convierte ruta absoluta a relativa
   */
  private static makeRelativePath(path: string, basePath: string): string {
    if (resolve(path) === path) {
      // Es una ruta absoluta, convertir a relativa
      return relative(basePath, path)
    }
    return path
  }

  /**
   * Valida la extensión del archivo
   */
  private static validateFileExtension(path: string): void {
    const ext = this.getFileExtension(path).toLowerCase()
    
    if (ext && !this.ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(`File extension '${ext}' is not allowed`)
    }
  }

  /**
   * Obtiene la extensión de archivo
   */
  private static getFileExtension(path: string): string {
    const lastDot = path.lastIndexOf('.')
    if (lastDot === -1 || lastDot === path.length - 1) {
      return ''
    }
    return path.substring(lastDot)
  }

  /**
   * Valida las longitudes de ruta y componentes
   */
  private static validatePathLengths(path: string): void {
    if (path.length > this.MAX_PATH_LENGTH) {
      throw new Error(`Path length exceeds maximum of ${this.MAX_PATH_LENGTH}`)
    }

    // Verificar longitud de cada componente
    const components = path.split(/[/\\]/)
    for (const component of components) {
      if (component.length > this.MAX_COMPONENT_LENGTH) {
        throw new Error(`Path component '${component}' exceeds maximum length of ${this.MAX_COMPONENT_LENGTH}`)
      }
    }
  }

  /**
   * Valida un componente individual de ruta
   */
  private static validatePathComponent(component: string): void {
    if (typeof component !== 'string') {
      throw new Error('Path component must be a string')
    }

    if (component.length === 0) {
      throw new Error('Path component cannot be empty')
    }

    if (component === '.' || component === '..') {
      throw new Error('Path component cannot be relative directory reference')
    }

    // Verificar caracteres peligrosos
    // eslint-disable-next-line no-control-regex
    if (/[<>:"|?*\x00-\x1F]/.test(component)) {
      throw new Error('Path component contains invalid characters')
    }
  }

  /**
   * Sanitiza un componente de ruta
   */
  private static sanitizeComponent(component: string): string {
    let sanitized = component

    // Remover espacios al inicio y final
    sanitized = sanitized.trim()

    // Reemplazar caracteres problemáticos
    sanitized = sanitized.replace(/[<>:"|?*]/g, '_')

    // Normalizar espacios
    sanitized = sanitized.replace(/\s+/g, '_')

    return sanitized
  }
}
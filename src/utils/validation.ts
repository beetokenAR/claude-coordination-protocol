import { z } from 'zod'
import { ValidationError } from '../types/index.js'

/**
 * Validates input data against a Zod schema
 * Throws ValidationError with detailed information on failure
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>, 
  data: unknown, 
  context?: string
): T {
  try {
    // Use parseAsync to ensure defaults are applied
    const result = schema.parse(data)
    return result
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = {
        context,
        errors: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: (err as any).received
        }))
      }
      
      const message = context 
        ? `Validation failed for ${context}: ${error.errors[0]?.message}`
        : `Validation failed: ${error.errors[0]?.message}`
      
      throw new ValidationError(message, details)
    }
    throw error
  }
}

/**
 * Safely parses input data, returning default value on failure
 */
export function safeParseInput<T>(
  schema: z.ZodSchema<T>, 
  data: unknown, 
  defaultValue: T
): T {
  const result = schema.safeParse(data)
  return result.success ? result.data : defaultValue
}

/**
 * Validates that participant IDs are properly formatted
 */
export function validateParticipantId(id: string): void {
  if (!id.startsWith('@')) {
    throw new ValidationError(`Participant ID must start with @: ${id}`)
  }
  
  if (id.length < 2) {
    throw new ValidationError(`Participant ID too short: ${id}`)
  }
  
  if (!/^@[a-zA-Z][a-zA-Z0-9_-]*$/.test(id)) {
    throw new ValidationError(
      `Participant ID contains invalid characters. Must be @followed by alphanumeric, underscore, or dash: ${id}`
    )
  }
}

/**
 * Validates message ID format (e.g., "CONTRACT-001", "ARCH-002")
 */
export function validateMessageId(id: string): void {
  if (!/^[A-Z]+-\d{3}(-[A-Z]+-\d{3})*$/.test(id)) {
    throw new ValidationError(
      `Message ID must follow format TYPE-NNN (e.g., CONTRACT-001): ${id}`
    )
  }
}

/**
 * Validates thread ID format
 */
export function validateThreadId(id: string): void {
  if (!/^[A-Z]+-\d{3}-thread(-\w+)?$/.test(id)) {
    throw new ValidationError(
      `Thread ID must follow format TYPE-NNN-thread or TYPE-NNN-thread-suffix: ${id}`
    )
  }
}

/**
 * Validates file path security (prevent directory traversal)
 */
export function validateFilePath(filePath: string): void {
  // Normalize path to detect directory traversal attempts
  const normalized = filePath.replace(/\\/g, '/')
  
  if (normalized.includes('../') || normalized.includes('..\\')) {
    throw new ValidationError(`Path traversal not allowed: ${filePath}`)
  }
  
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    throw new ValidationError(`Absolute paths not allowed: ${filePath}`)
  }
  
  // Check for null bytes and other dangerous characters
  if (/[\x00-\x1f\x7f-\x9f]/.test(filePath)) {
    throw new ValidationError(`Invalid characters in file path: ${filePath}`)
  }
}

/**
 * Validates that content is not too large for token limits
 */
export function validateContentSize(content: string, maxTokens = 10000): void {
  // Rough token estimation: ~4 characters per token
  const estimatedTokens = Math.ceil(content.length / 4)
  
  if (estimatedTokens > maxTokens) {
    throw new ValidationError(
      `Content too large: ~${estimatedTokens} tokens (max: ${maxTokens}). ` +
      `Consider using content_ref for large content.`
    )
  }
}

/**
 * Validates date ranges
 */
export function validateDateRange(from?: Date, to?: Date): void {
  if (from && to && from > to) {
    throw new ValidationError(`Invalid date range: from date (${from.toISOString()}) is after to date (${to.toISOString()})`)
  }
  
  if (from && from > new Date()) {
    throw new ValidationError(`From date cannot be in the future: ${from.toISOString()}`)
  }
}

/**
 * Validates that arrays don't exceed reasonable limits
 */
export function validateArraySize<T>(
  array: T[], 
  maxSize: number, 
  name: string
): void {
  if (array.length > maxSize) {
    throw new ValidationError(
      `${name} array too large: ${array.length} items (max: ${maxSize})`
    )
  }
}

/**
 * Validates message dependencies don't create cycles
 */
export function validateNoCycles(
  messageId: string,
  dependencies: string[],
  getDependencies: (id: string) => string[]
): void {
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  
  function hasCycle(current: string): boolean {
    if (recursionStack.has(current)) {
      return true // Cycle detected
    }
    
    if (visited.has(current)) {
      return false // Already processed, no cycle in this branch
    }
    
    visited.add(current)
    recursionStack.add(current)
    
    const deps = current === messageId ? dependencies : getDependencies(current)
    for (const dep of deps) {
      if (hasCycle(dep)) {
        return true
      }
    }
    
    recursionStack.delete(current)
    return false
  }
  
  if (hasCycle(messageId)) {
    throw new ValidationError(
      `Circular dependency detected involving message ${messageId}`,
      { messageId, dependencies }
    )
  }
}
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  validateInput,
  safeParseInput,
  validateParticipantId,
  validateMessageId,
  validateThreadId,
  validateFilePath,
  validateContentSize,
  validateDateRange,
  validateArraySize,
  validateNoCycles
} from '../utils/validation.js'
import { ValidationError } from '../types/index.js'

describe('Validation Utilities', () => {
  describe('validateInput', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().min(0),
      email: z.string().email()
    })

    it('should validate correct input', () => {
      const input = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      }

      const result = validateInput(testSchema, input, 'test data')

      expect(result).toEqual(input)
    })

    it('should throw ValidationError for invalid input', () => {
      const input = {
        name: '',
        age: -5,
        email: 'invalid-email'
      }

      expect(() => {
        validateInput(testSchema, input, 'test data')
      }).toThrow(ValidationError)
    })

    it('should include context in error message', () => {
      const input = { name: '', age: 30, email: 'john@example.com' }

      try {
        validateInput(testSchema, input, 'user registration')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as ValidationError).message).toContain('user registration')
      }
    })

    it('should include detailed error information', () => {
      const input = { name: '', age: -5, email: 'invalid' }

      try {
        validateInput(testSchema, input, 'test')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        const validationError = error as ValidationError
        expect(validationError.details).toBeDefined()
        expect(validationError.details!.errors).toBeInstanceOf(Array)
        expect((validationError.details!.errors as any[]).length).toBeGreaterThan(0)
      }
    })
  })

  describe('safeParseInput', () => {
    const testSchema = z.object({
      name: z.string(),
      count: z.number().default(0)
    })

    it('should return parsed data for valid input', () => {
      const input = { name: 'test', count: 5 }
      const defaultValue = { name: 'default', count: 0 }

      const result = safeParseInput(testSchema, input, defaultValue)

      expect(result).toEqual(input)
    })

    it('should return default value for invalid input', () => {
      const input = { name: 123, count: 'invalid' }
      const defaultValue = { name: 'default', count: 0 }

      const result = safeParseInput(testSchema, input, defaultValue)

      expect(result).toEqual(defaultValue)
    })
  })

  describe('validateParticipantId', () => {
    it('should accept valid participant IDs', () => {
      const validIds = [
        '@backend',
        '@mobile',
        '@security_team',
        '@admin-user',
        '@test123'
      ]

      for (const id of validIds) {
        expect(() => validateParticipantId(id)).not.toThrow()
      }
    })

    it('should reject invalid participant IDs', () => {
      const invalidIds = [
        'backend', // Missing @
        '@', // Too short
        '@123', // Starts with number
        '@user space', // Contains space
        '@user@domain', // Contains @
        '@user.name' // Contains dot
      ]

      for (const id of invalidIds) {
        expect(() => validateParticipantId(id)).toThrow(ValidationError)
      }
    })
  })

  describe('validateMessageId', () => {
    it('should accept valid message IDs', () => {
      const validIds = [
        'CONTRACT-md4kl2p-ABC',
        'ARCH-lg8q9r-XYZ',
        'SYNC-n3m5t8-DEF',
        'UPDATE-p7r2w4-GHI'
      ]

      for (const id of validIds) {
        expect(() => validateMessageId(id)).not.toThrow()
      }
    })

    it('should reject invalid message IDs', () => {
      const invalidIds = [
        'contract-md4kl2p-ABC', // Lowercase type
        'CONTRACT-MD4KL2P-ABC', // Uppercase timestamp
        'CONTRACT-md4kl2p-abc', // Lowercase random
        'CONTRACT-md4kl2p-ABCD', // Too long random
        'CONTRACT-md4kl2p-AB', // Too short random
        'INVALID_FORMAT',
        'CONTRACT'
      ]

      for (const id of invalidIds) {
        expect(() => validateMessageId(id)).toThrow(ValidationError)
      }
    })
  })

  describe('validateThreadId', () => {
    it('should accept valid thread IDs', () => {
      const validIds = [
        'CONTRACT-001-thread',
        'ARCH-002-thread',
        'SYNC-123-thread-suffix'
      ]

      for (const id of validIds) {
        expect(() => validateThreadId(id)).not.toThrow()
      }
    })

    it('should reject invalid thread IDs', () => {
      const invalidIds = [
        'CONTRACT-001', // Missing -thread
        'contract-001-thread', // Lowercase
        'CONTRACT-1-thread', // Not 3 digits
        'invalid-format'
      ]

      for (const id of invalidIds) {
        expect(() => validateThreadId(id)).toThrow(ValidationError)
      }
    })
  })

  describe('validateFilePath', () => {
    it('should accept safe file paths', () => {
      const validPaths = [
        'messages/active/file.md',
        'data/config.yaml',
        'subfolder/document.txt'
      ]

      for (const path of validPaths) {
        expect(() => validateFilePath(path)).not.toThrow()
      }
    })

    it('should reject dangerous file paths', () => {
      const dangerousPaths = [
        '../../../etc/passwd', // Directory traversal
        'messages/../config.yaml', // Directory traversal
        '/absolute/path', // Absolute path
        'C:\\windows\\system32', // Windows absolute path
        'file\x00name', // Null byte
        'file\nname' // Newline character
      ]

      for (const path of dangerousPaths) {
        expect(() => validateFilePath(path)).toThrow(ValidationError)
      }
    })
  })

  describe('validateContentSize', () => {
    it('should accept content within token limits', () => {
      const smallContent = 'x'.repeat(1000) // ~250 tokens
      const mediumContent = 'x'.repeat(10000) // ~2500 tokens

      expect(() => validateContentSize(smallContent, 500)).not.toThrow()
      expect(() => validateContentSize(mediumContent, 5000)).not.toThrow()
    })

    it('should reject content exceeding token limits', () => {
      const largeContent = 'x'.repeat(20000) // ~5000 tokens

      expect(() => validateContentSize(largeContent, 1000)).toThrow(ValidationError)
    })

    it('should use default token limit', () => {
      const veryLargeContent = 'x'.repeat(50000) // ~12500 tokens

      expect(() => validateContentSize(veryLargeContent)).toThrow(ValidationError)
    })
  })

  describe('validateDateRange', () => {
    it('should accept valid date ranges', () => {
      const yesterday = new Date('2023-01-01')
      const today = new Date('2023-01-02')

      expect(() => validateDateRange(yesterday, today)).not.toThrow()
      expect(() => validateDateRange(undefined, today)).not.toThrow()
      expect(() => validateDateRange(yesterday, undefined)).not.toThrow()
    })

    it('should reject invalid date ranges', () => {
      const yesterday = new Date('2023-01-01')
      const today = new Date('2023-01-02')
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      // From date after to date
      expect(() => validateDateRange(today, yesterday)).toThrow(ValidationError)

      // From date in the future
      expect(() => validateDateRange(tomorrow)).toThrow(ValidationError)
    })
  })

  describe('validateArraySize', () => {
    it('should accept arrays within size limits', () => {
      const smallArray = [1, 2, 3]
      const mediumArray = new Array(50).fill(0)

      expect(() => validateArraySize(smallArray, 10, 'numbers')).not.toThrow()
      expect(() => validateArraySize(mediumArray, 100, 'items')).not.toThrow()
    })

    it('should reject arrays exceeding size limits', () => {
      const largeArray = new Array(200).fill(0)

      expect(() => validateArraySize(largeArray, 100, 'items')).toThrow(ValidationError)
    })

    it('should include array name in error message', () => {
      const largeArray = new Array(200).fill(0)

      try {
        validateArraySize(largeArray, 10, 'participants')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as ValidationError).message).toContain('participants')
      }
    })
  })

  describe('validateNoCycles', () => {
    const mockGetDependencies = (id: string): string[] => {
      const deps: Record<string, string[]> = {
        'MSG-001': ['MSG-002'],
        'MSG-002': ['MSG-003'],
        'MSG-003': []
      }
      return deps[id] || []
    }

    it('should accept acyclic dependency chains', () => {
      expect(() => {
        validateNoCycles('MSG-004', ['MSG-001'], mockGetDependencies)
      }).not.toThrow()
    })

    it('should detect direct cycles', () => {
      const cyclicGetDependencies = (id: string): string[] => {
        if (id === 'MSG-001') {return ['MSG-002']}
        if (id === 'MSG-002') {return ['MSG-001']}
        return []
      }

      expect(() => {
        validateNoCycles('MSG-001', ['MSG-002'], cyclicGetDependencies)
      }).toThrow(ValidationError)
    })

    it('should detect indirect cycles', () => {
      const cyclicGetDependencies = (id: string): string[] => {
        if (id === 'MSG-001') {return ['MSG-002']}
        if (id === 'MSG-002') {return ['MSG-003']}
        if (id === 'MSG-003') {return ['MSG-001']}
        return []
      }

      expect(() => {
        validateNoCycles('MSG-004', ['MSG-001'], cyclicGetDependencies)
      }).toThrow(ValidationError)
    })

    it('should handle self-dependencies', () => {
      expect(() => {
        validateNoCycles('MSG-001', ['MSG-001'], mockGetDependencies)
      }).toThrow(ValidationError)
    })

    it('should include cycle information in error', () => {
      const cyclicGetDependencies = (id: string): string[] => {
        if (id === 'MSG-001') {return ['MSG-002']}
        if (id === 'MSG-002') {return ['MSG-001']}
        return []
      }

      try {
        validateNoCycles('MSG-001', ['MSG-002'], cyclicGetDependencies)
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as ValidationError).message).toContain('Circular dependency')
        expect((error as ValidationError).details).toBeDefined()
      }
    })
  })
})
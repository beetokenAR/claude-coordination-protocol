import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import {
  CREATE_MESSAGES_TABLE,
  CREATE_CONVERSATIONS_TABLE,
  CREATE_PARTICIPANTS_TABLE,
  CREATE_METADATA_TABLE,
  CREATE_INDEXES,
  SCHEMA_VERSION,
} from '../database/schema.js'

describe('Database Schema Integrity', () => {
  // Schema checksums para detectar cambios no documentados
  // Run with UPDATE_CHECKSUMS=true to update these values
  const KNOWN_CHECKSUMS = {
    version_2: {
      messages: 'e7817417282742c9b1f4d43a4804a6ce3e3f05ab',
      conversations: 'e50c001b690ae4bd17598d09031a0c414397ccd3',
      participants: '5afc1f1af7bde06f72da286294210972cb0fac1d',
      metadata: '152596af5100b02fdbe77721408709a23691c6fa',
    },
  }

  function calculateChecksum(sql: string): string {
    // Normalizar SQL para comparación consistente
    const normalized = sql.replace(/\s+/g, ' ').replace(/--.*$/gm, '').trim()

    return crypto.createHash('sha1').update(normalized).digest('hex')
  }

  it('should maintain schema version consistency', () => {
    expect(SCHEMA_VERSION).toBe(2)
  })

  it('should not change messages table without version bump', () => {
    const checksum = calculateChecksum(CREATE_MESSAGES_TABLE)
    const knownChecksum = KNOWN_CHECKSUMS[`version_${SCHEMA_VERSION}`]?.messages

    // If UPDATE_CHECKSUMS env var is set, show the new checksums
    if (process.env.UPDATE_CHECKSUMS === 'true') {
      // eslint-disable-next-line no-console
      console.log(`messages: '${checksum}',`)
      return
    }

    if (knownChecksum === '') {
      // First time running, set the checksum
      // eslint-disable-next-line no-console
      console.log(`\nFirst time checksum for messages table: ${checksum}`)
      // eslint-disable-next-line no-console
      console.log('Update KNOWN_CHECKSUMS in the test file with this value')
    } else if (checksum !== knownChecksum) {
      throw new Error(
        'Messages table schema changed without version bump!\n' +
          `Expected checksum: ${knownChecksum}\n` +
          `Actual checksum: ${checksum}\n` +
          'If this change is intentional:\n' +
          '1. Increment SCHEMA_VERSION\n' +
          '2. Add migration logic\n' +
          '3. Update KNOWN_CHECKSUMS in this test'
      )
    }
  })

  it('should validate all foreign key relationships', () => {
    // Verificar que resolved_by references participants(id)
    expect(CREATE_MESSAGES_TABLE).toContain('FOREIGN KEY (resolved_by) REFERENCES participants(id)')
  })

  it('should have proper check constraints', () => {
    // Verificar constraints críticos
    const criticalConstraints = [
      "type IN ('arch', 'contract', 'sync', 'update', 'q', 'emergency', 'broadcast')",
      "priority IN ('CRITICAL', 'H', 'M', 'L')",
      "status IN ('pending', 'read', 'responded', 'resolved', 'archived', 'cancelled')",
    ]

    criticalConstraints.forEach(constraint => {
      expect(CREATE_MESSAGES_TABLE).toContain(constraint)
    })
  })

  it('should maintain index consistency', () => {
    const expectedIndexes = [
      'idx_messages_thread_id',
      'idx_messages_from_participant',
      'idx_messages_status',
      'idx_messages_type',
      'idx_messages_priority',
      'idx_messages_created_at',
    ]

    expectedIndexes.forEach(index => {
      const hasIndex = CREATE_INDEXES.some(sql => sql.includes(index))
      expect(hasIndex).toBe(true)
    })
  })

  it('should track all table checksums', () => {
    const tables = {
      messages: CREATE_MESSAGES_TABLE,
      conversations: CREATE_CONVERSATIONS_TABLE,
      participants: CREATE_PARTICIPANTS_TABLE,
      metadata: CREATE_METADATA_TABLE,
    }

    const currentChecksums: any = {}

    for (const [table, sql] of Object.entries(tables)) {
      const checksum = calculateChecksum(sql)
      currentChecksums[table] = checksum

      if (process.env.UPDATE_CHECKSUMS === 'true') {
        // eslint-disable-next-line no-console
        console.log(`${table}: '${checksum}',`)
      }
    }

    if (process.env.UPDATE_CHECKSUMS !== 'true') {
      // Verify all checksums
      const knownVersion = KNOWN_CHECKSUMS[`version_${SCHEMA_VERSION}`]

      for (const [table, checksum] of Object.entries(currentChecksums)) {
        const known = knownVersion[table as keyof typeof knownVersion]
        if (known && known !== '' && known !== checksum) {
          throw new Error(
            `${table} table schema changed without version bump!\n` +
              `Expected: ${known}\n` +
              `Actual: ${checksum}`
          )
        }
      }
    }
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { CoordinationDatabase } from '../database/connection.js'
import { ParticipantRegistry } from '../core/participant-registry.js'
import { TEST_DATA_DIR } from './setup.js'
import type { ParticipantId } from '../types/index.js'

describe('ParticipantRegistry', () => {
  let db: CoordinationDatabase
  let participantRegistry: ParticipantRegistry
  const testParticipant: ParticipantId = '@backend'
  const adminParticipant: ParticipantId = '@admin'

  beforeEach(() => {
    db = new CoordinationDatabase(TEST_DATA_DIR)
    participantRegistry = new ParticipantRegistry(db, TEST_DATA_DIR)
  })

  describe('registerParticipant', () => {
    it('should register a new participant', async () => {
      const participant = await participantRegistry.registerParticipant({
        id: testParticipant,
        capabilities: ['api', 'database'],
        default_priority: 'H'
      })

      expect(participant.id).toBe(testParticipant)
      expect(participant.capabilities).toEqual(['api', 'database'])
      expect(participant.status).toBe('active')
      expect(participant.default_priority).toBe('H')
      expect(participant.last_seen).toBeInstanceOf(Date)
    })

    it('should prevent duplicate participant registration', async () => {
      await participantRegistry.registerParticipant({
        id: testParticipant,
        capabilities: ['api'],
        default_priority: 'M'
      })

      await expect(
        participantRegistry.registerParticipant({
          id: testParticipant,
          capabilities: ['database'],
          default_priority: 'H'
        })
      ).rejects.toThrow('Participant already exists')
    })

    it('should validate participant ID format', async () => {
      await expect(
        participantRegistry.registerParticipant({
          id: 'invalid-id' as ParticipantId,
          capabilities: ['api'],
          default_priority: 'M'
        })
      ).rejects.toThrow('Validation failed')
    })
  })

  describe('getParticipant', () => {
    beforeEach(async () => {
      await participantRegistry.registerParticipant({
        id: testParticipant,
        capabilities: ['api', 'database'],
        default_priority: 'H'
      })
    })

    it('should retrieve participant by ID', async () => {
      const participant = await participantRegistry.getParticipant(testParticipant)

      expect(participant).toBeDefined()
      expect(participant!.id).toBe(testParticipant)
      expect(participant!.capabilities).toEqual(['api', 'database'])
    })

    it('should return null for non-existent participant', async () => {
      const participant = await participantRegistry.getParticipant('@nonexistent' as ParticipantId)

      expect(participant).toBeNull()
    })
  })

  describe('updateParticipant', () => {
    beforeEach(async () => {
      await participantRegistry.registerParticipant({
        id: testParticipant,
        capabilities: ['api'],
        default_priority: 'M'
      })
      
      await participantRegistry.registerParticipant({
        id: adminParticipant,
        capabilities: ['admin'],
        default_priority: 'H'
      })
    })

    it('should allow participant to update their own info', async () => {
      const updated = await participantRegistry.updateParticipant(
        testParticipant,
        {
          capabilities: ['api', 'database', 'frontend'],
          default_priority: 'H'
        },
        testParticipant
      )

      expect(updated.capabilities).toEqual(['api', 'database', 'frontend'])
      expect(updated.default_priority).toBe('H')
    })

    it('should allow admin to update any participant', async () => {
      const updated = await participantRegistry.updateParticipant(
        testParticipant,
        {
          status: 'maintenance',
          capabilities: ['api', 'maintenance']
        },
        adminParticipant
      )

      expect(updated.status).toBe('maintenance')
      expect(updated.capabilities).toEqual(['api', 'maintenance'])
    })

    it('should deny non-admin from updating other participants', async () => {
      const anotherParticipant: ParticipantId = '@mobile'
      await participantRegistry.registerParticipant({
        id: anotherParticipant,
        capabilities: ['frontend'],
        default_priority: 'M'
      })

      await expect(
        participantRegistry.updateParticipant(
          anotherParticipant,
          { status: 'inactive' },
          testParticipant
        )
      ).rejects.toThrow('Not authorized')
    })
  })

  describe('access control methods', () => {
    beforeEach(async () => {
      await participantRegistry.registerParticipant({
        id: testParticipant,
        capabilities: ['api', 'database'],
        default_priority: 'M'
      })
      
      await participantRegistry.registerParticipant({
        id: adminParticipant,
        capabilities: ['admin'],
        default_priority: 'H'
      })
    })

    it('should correctly identify admin participants', async () => {
      const isAdmin = await participantRegistry.isAdmin(adminParticipant)
      const isNotAdmin = await participantRegistry.isAdmin(testParticipant)

      expect(isAdmin).toBe(true)
      expect(isNotAdmin).toBe(false)
    })

    it('should check message access permissions correctly', async () => {
      const targetParticipant: ParticipantId = '@mobile'
      await participantRegistry.registerParticipant({
        id: targetParticipant,
        capabilities: ['frontend'],
        default_priority: 'M'
      })

      // Sender can access their own message
      const senderAccess = await participantRegistry.canAccessMessage(
        testParticipant,
        testParticipant,
        [targetParticipant]
      )

      // Recipient can access message sent to them
      const recipientAccess = await participantRegistry.canAccessMessage(
        targetParticipant,
        testParticipant,
        [targetParticipant]
      )

      // Third party cannot access
      const thirdPartyAccess = await participantRegistry.canAccessMessage(
        '@third' as ParticipantId,
        testParticipant,
        [targetParticipant]
      )

      // Admin can access any message
      const adminAccess = await participantRegistry.canAccessMessage(
        adminParticipant,
        testParticipant,
        [targetParticipant]
      )

      expect(senderAccess).toBe(true)
      expect(recipientAccess).toBe(true)
      expect(thirdPartyAccess).toBe(false)
      expect(adminAccess).toBe(true)
    })

    it('should validate message sending permissions', async () => {
      const activeParticipant: ParticipantId = '@mobile'
      const inactiveParticipant: ParticipantId = '@inactive'

      await participantRegistry.registerParticipant({
        id: activeParticipant,
        capabilities: ['frontend'],
        default_priority: 'M'
      })

      await participantRegistry.registerParticipant({
        id: inactiveParticipant,
        capabilities: ['old'],
        default_priority: 'L'
      })

      // Deactivate one participant
      await participantRegistry.deactivateParticipant(inactiveParticipant, adminParticipant)

      // Should allow sending to active participant
      const canSendToActive = await participantRegistry.canSendMessage(
        testParticipant,
        [activeParticipant]
      )

      // Should deny sending to inactive participant
      const canSendToInactive = await participantRegistry.canSendMessage(
        testParticipant,
        [inactiveParticipant]
      )

      // Should deny if sender is inactive
      await participantRegistry.deactivateParticipant(testParticipant, adminParticipant)
      const inactiveSenderCanSend = await participantRegistry.canSendMessage(
        testParticipant,
        [activeParticipant]
      )

      expect(canSendToActive).toBe(true)
      expect(canSendToInactive).toBe(false)
      expect(inactiveSenderCanSend).toBe(false)
    })
  })

  describe('participant statistics and management', () => {
    beforeEach(async () => {
      await participantRegistry.registerParticipant({
        id: '@backend',
        capabilities: ['api', 'database'],
        default_priority: 'H'
      })

      await participantRegistry.registerParticipant({
        id: '@frontend',
        capabilities: ['ui', 'frontend'],
        default_priority: 'M'
      })

      await participantRegistry.registerParticipant({
        id: '@admin',
        capabilities: ['admin', 'system'],
        default_priority: 'H'
      })
    })

    it('should get participants by capability', async () => {
      const apiCapable = await participantRegistry.getParticipantsByCapability('api')
      const frontendCapable = await participantRegistry.getParticipantsByCapability('frontend')
      const adminCapable = await participantRegistry.getParticipantsByCapability('admin')

      expect(apiCapable).toHaveLength(1)
      expect(apiCapable[0].id).toBe('@backend')

      expect(frontendCapable).toHaveLength(1)
      expect(frontendCapable[0].id).toBe('@frontend')

      expect(adminCapable).toHaveLength(1)
      expect(adminCapable[0].id).toBe('@admin')
    })

    it('should generate participant statistics', async () => {
      // Deactivate one participant
      await participantRegistry.deactivateParticipant('@frontend', '@admin')

      const stats = await participantRegistry.getParticipantStats()

      expect(stats.total).toBe(3)
      expect(stats.active).toBe(2)
      expect(stats.inactive).toBe(1)
      expect(stats.maintenance).toBe(0)

      expect(stats.by_capability.api).toBe(1)
      expect(stats.by_capability.frontend).toBe(1)
      expect(stats.by_capability.admin).toBe(1)
      expect(stats.by_capability.system).toBe(1)
    })

    it('should get default priority for participant', async () => {
      const backendPriority = await participantRegistry.getDefaultPriority('@backend')
      const frontendPriority = await participantRegistry.getDefaultPriority('@frontend')
      const nonexistentPriority = await participantRegistry.getDefaultPriority('@nonexistent')

      expect(backendPriority).toBe('H')
      expect(frontendPriority).toBe('M')
      expect(nonexistentPriority).toBe('M') // Default fallback
    })

    it('should update last seen timestamp', async () => {
      const beforeUpdate = await participantRegistry.getParticipant('@backend')
      const originalLastSeen = beforeUpdate!.last_seen!

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10))

      await participantRegistry.updateLastSeen('@backend')

      const afterUpdate = await participantRegistry.getParticipant('@backend')
      const newLastSeen = afterUpdate!.last_seen!

      expect(newLastSeen.getTime()).toBeGreaterThan(originalLastSeen.getTime())
    })
  })

  describe('participant removal', () => {
    beforeEach(async () => {
      await participantRegistry.registerParticipant({
        id: testParticipant,
        capabilities: ['api'],
        default_priority: 'M'
      })

      await participantRegistry.registerParticipant({
        id: adminParticipant,
        capabilities: ['admin'],
        default_priority: 'H'
      })
    })

    it('should allow deactivation by self', async () => {
      await participantRegistry.deactivateParticipant(testParticipant, testParticipant)

      const participant = await participantRegistry.getParticipant(testParticipant)
      expect(participant!.status).toBe('inactive')
    })

    it('should allow deactivation by admin', async () => {
      await participantRegistry.deactivateParticipant(testParticipant, adminParticipant)

      const participant = await participantRegistry.getParticipant(testParticipant)
      expect(participant!.status).toBe('inactive')
    })

    it('should deny deactivation by non-admin', async () => {
      const anotherParticipant: ParticipantId = '@mobile'
      await participantRegistry.registerParticipant({
        id: anotherParticipant,
        capabilities: ['frontend'],
        default_priority: 'M'
      })

      await expect(
        participantRegistry.deactivateParticipant(testParticipant, anotherParticipant)
      ).rejects.toThrow('Not authorized')
    })
  })
})
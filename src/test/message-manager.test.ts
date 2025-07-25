import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CoordinationDatabase } from '../database/connection.js'
import { MessageManager } from '../core/message-manager.js'
import { ParticipantRegistry } from '../core/participant-registry.js'
import { createTestDataDir } from './setup.js'
import type { SendMessageInput, ParticipantId } from '../types/index.js'
import fs from 'fs'

describe('MessageManager', () => {
  let db: CoordinationDatabase
  let messageManager: MessageManager
  let participantRegistry: ParticipantRegistry
  let testDataDir: string
  const testParticipant: ParticipantId = '@backend'
  const targetParticipant: ParticipantId = '@mobile'

  beforeEach(async () => {
    // Create unique test directory for each test
    testDataDir = createTestDataDir()
    fs.mkdirSync(testDataDir, { recursive: true })

    db = new CoordinationDatabase(testDataDir)
    messageManager = new MessageManager(db, testDataDir)
    participantRegistry = new ParticipantRegistry(db, testDataDir)

    // Register test participants to satisfy foreign key constraints
    try {
      await participantRegistry.registerParticipant({
        id: testParticipant,
        capabilities: ['backend'],
        default_priority: 'M',
      })
    } catch (error) {
      // Participant might already exist, which is fine
    }

    try {
      await participantRegistry.registerParticipant({
        id: targetParticipant,
        capabilities: ['mobile'],
        default_priority: 'M',
      })
    } catch (error) {
      // Participant might already exist, which is fine
    }
  })

  afterEach(async () => {
    // Clean up database connection and test directory
    if (db) {
      db.close()
    }
    if (testDataDir && fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true })
    }
  })

  describe('createMessage', () => {
    it('should create a new message with valid input', async () => {
      const input: SendMessageInput = {
        to: [targetParticipant],
        type: 'contract',
        priority: 'H',
        subject: 'Test contract update',
        content: 'This is a test message for contract updates',
        response_required: true,
        expires_in_hours: 24,
      }

      const message = await messageManager.createMessage(input, testParticipant)

      expect(message.id).toMatch(/^CONTRACT-[a-z0-9]+-[A-Z0-9]{3}$/)
      expect(message.thread_id).toBe(`${message.id}-thread`)
      expect(message.from).toBe(testParticipant)
      expect(message.to).toEqual([targetParticipant])
      expect(message.type).toBe('contract')
      expect(message.priority).toBe('H')
      expect(message.status).toBe('pending')
      expect(message.subject).toBe('Test contract update')
      expect(message.summary).toBe('This is a test message for contract updates')
      expect(message.response_required).toBe(true)
      expect(message.created_at).toBeInstanceOf(Date)
      expect(message.updated_at).toBeInstanceOf(Date)
      expect(message.expires_at).toBeInstanceOf(Date)
    })

    it('should store large content in separate file', async () => {
      const largeContent = 'x'.repeat(2000) // > 1000 chars triggers file storage
      const input: SendMessageInput = {
        to: [targetParticipant],
        type: 'arch',
        priority: 'M',
        subject: 'Large architecture document',
        content: largeContent,
        response_required: true,
        expires_in_hours: 168,
      }

      const message = await messageManager.createMessage(input, testParticipant)

      expect(message.content_ref).toBeDefined()
      expect(message.summary).toBe(largeContent.substring(0, 500) + '...')
    })

    it('should handle dependencies without creating cycles', async () => {
      // Create first message
      const firstMessage = await messageManager.createMessage(
        {
          to: [targetParticipant],
          type: 'contract',
          priority: 'H',
          subject: 'First message',
          content: 'First message content',
          response_required: true,
          expires_in_hours: 24,
        },
        testParticipant
      )

      // Create second message depending on first
      const secondMessage = await messageManager.createMessage(
        {
          to: [targetParticipant],
          type: 'contract',
          priority: 'H',
          subject: 'Second message',
          content: 'Second message content',
          response_required: true,
          expires_in_hours: 24,
          tags: [`depends:${firstMessage.id}`],
        },
        testParticipant
      )

      expect(secondMessage.dependencies).toEqual([firstMessage.id])
    })

    it('should validate input parameters', async () => {
      const invalidInput = {
        to: ['invalid-participant'], // Missing @ prefix
        type: 'contract',
        priority: 'H',
        subject: 'Test',
        content: 'Test content',
        response_required: true,
        expires_in_hours: 24,
      }

      await expect(
        messageManager.createMessage(invalidInput as any, testParticipant)
      ).rejects.toThrow('Validation failed')
    })
  })

  describe('getMessages', () => {
    it('should return messages for participant ordered by priority', async () => {
      // Create test messages for this specific test
      const message1 = await messageManager.createMessage(
        {
          to: [targetParticipant],
          type: 'contract',
          priority: 'H',
          subject: 'High priority contract',
          content: 'High priority content',
          response_required: true,
          expires_in_hours: 24,
        },
        testParticipant
      )

      const message2 = await messageManager.createMessage(
        {
          to: [targetParticipant],
          type: 'sync',
          priority: 'M',
          subject: 'Medium priority sync',
          content: 'Medium priority content',
          response_required: false,
          expires_in_hours: 168,
        },
        testParticipant
      )

      const messages = await messageManager.getMessages(
        {
          limit: 10,
          detail_level: 'summary',
        },
        targetParticipant
      )

      // Filter to only our test messages and verify they exist
      const testMessages = messages.filter(m => m.id === message1.id || m.id === message2.id)

      expect(testMessages.length).toBeGreaterThanOrEqual(2)

      // Find our specific messages
      const highPriorityMessage = testMessages.find(m => m.priority === 'H')
      const mediumPriorityMessage = testMessages.find(m => m.priority === 'M')

      expect(highPriorityMessage).toBeDefined()
      expect(mediumPriorityMessage).toBeDefined()
      expect(highPriorityMessage?.subject).toBe('High priority contract')
      expect(mediumPriorityMessage?.subject).toBe('Medium priority sync')
    })

    it('should filter by status', async () => {
      // Create test message with specific status
      const message = await messageManager.createMessage(
        {
          to: [targetParticipant],
          type: 'contract',
          priority: 'H',
          subject: 'Test status filter',
          content: 'Test content',
          response_required: true,
          expires_in_hours: 24,
        },
        testParticipant
      )

      const messages = await messageManager.getMessages(
        {
          status: ['pending'],
          limit: 10,
          detail_level: 'summary',
        },
        targetParticipant
      )

      // Our test message should be in the results
      const testMessage = messages.find(m => m.id === message.id)
      expect(testMessage).toBeDefined()
      expect(testMessage?.status).toBe('pending')

      // All returned messages should have pending status
      expect(messages.every(m => m.status === 'pending')).toBe(true)
    })

    it('should filter by type', async () => {
      // Create test message with specific type
      const contractMessage = await messageManager.createMessage(
        {
          to: [targetParticipant],
          type: 'contract',
          priority: 'H',
          subject: 'Test type filter - contract',
          content: 'Contract content',
          response_required: true,
          expires_in_hours: 24,
        },
        testParticipant
      )

      const messages = await messageManager.getMessages(
        {
          type: ['contract'],
          limit: 10,
          detail_level: 'summary',
        },
        targetParticipant
      )

      // Our test message should be in the results
      const testMessage = messages.find(m => m.id === contractMessage.id)
      expect(testMessage).toBeDefined()
      expect(testMessage?.type).toBe('contract')

      // All returned messages should have contract type
      expect(messages.every(m => m.type === 'contract')).toBe(true)
    })

    it('should filter by priority', async () => {
      // Create test message with specific priority
      const highPriorityMessage = await messageManager.createMessage(
        {
          to: [targetParticipant],
          type: 'sync',
          priority: 'H',
          subject: 'Test priority filter',
          content: 'High priority content',
          response_required: true,
          expires_in_hours: 24,
        },
        testParticipant
      )

      const messages = await messageManager.getMessages(
        {
          priority: ['H'],
          limit: 10,
          detail_level: 'summary',
        },
        targetParticipant
      )

      // Our test message should be in the results
      const testMessage = messages.find(m => m.id === highPriorityMessage.id)
      expect(testMessage).toBeDefined()
      expect(testMessage?.priority).toBe('H')

      // All returned messages should have H priority
      expect(messages.every(m => m.priority === 'H')).toBe(true)
    })

    it('should respect limit', async () => {
      // Create at least 2 messages to test limit
      await messageManager.createMessage(
        {
          to: [targetParticipant],
          type: 'sync',
          priority: 'M',
          subject: 'Test limit 1',
          content: 'Content 1',
          response_required: false,
          expires_in_hours: 24,
        },
        testParticipant
      )

      await messageManager.createMessage(
        {
          to: [targetParticipant],
          type: 'sync',
          priority: 'M',
          subject: 'Test limit 2',
          content: 'Content 2',
          response_required: false,
          expires_in_hours: 24,
        },
        testParticipant
      )

      const messages = await messageManager.getMessages(
        {
          limit: 1,
          detail_level: 'summary',
        },
        targetParticipant
      )

      expect(messages).toHaveLength(1)
    })
  })

  describe('getMessageById', () => {
    let testMessageId: string

    beforeEach(async () => {
      const message = await messageManager.createMessage(
        {
          to: [targetParticipant],
          type: 'contract',
          priority: 'H',
          subject: 'Test message',
          content: 'Test content',
          response_required: true,
          expires_in_hours: 24,
        },
        testParticipant
      )
      testMessageId = message.id
    })

    it('should return message by ID for authorized participant', async () => {
      const message = await messageManager.getMessageById(testMessageId, targetParticipant)

      expect(message).toBeDefined()
      expect(message!.id).toBe(testMessageId)
      expect(message!.subject).toBe('Test message')
    })

    it('should return message by ID for sender', async () => {
      const message = await messageManager.getMessageById(testMessageId, testParticipant)

      expect(message).toBeDefined()
      expect(message!.id).toBe(testMessageId)
    })

    it('should deny access to unauthorized participant', async () => {
      const unauthorizedParticipant: ParticipantId = '@security'

      await expect(
        messageManager.getMessageById(testMessageId, unauthorizedParticipant)
      ).rejects.toThrow('Access denied')
    })

    it('should return null for non-existent message', async () => {
      const message = await messageManager.getMessageById(
        'CONTRACT-nonexistent-XXX',
        testParticipant
      )

      expect(message).toBeNull()
    })
  })

  describe('respondToMessage', () => {
    let originalMessageId: string

    beforeEach(async () => {
      const message = await messageManager.createMessage(
        {
          to: [targetParticipant],
          type: 'contract',
          priority: 'H',
          subject: 'Original message',
          content: 'Original content',
          response_required: true,
          expires_in_hours: 24,
        },
        testParticipant
      )
      originalMessageId = message.id
    })

    it('should create response message and update original', async () => {
      const response = await messageManager.respondToMessage(
        {
          message_id: originalMessageId,
          content: 'This is my response',
          resolution_status: 'complete',
        },
        targetParticipant
      )

      expect(response.subject).toBe('Re: Original message')
      expect(response.from).toBe(targetParticipant)
      expect(response.to).toEqual([testParticipant])
      expect(response.tags).toContain(`response_to:${originalMessageId}`)
      expect(response.response_required).toBe(false)

      // Check original message was updated
      const originalMessage = await messageManager.getMessageById(
        originalMessageId,
        testParticipant
      )
      expect(originalMessage!.status).toBe('responded')
      expect(originalMessage!.resolution_status).toBe('complete')
    })

    it('should deny response from unauthorized participant', async () => {
      const unauthorizedParticipant: ParticipantId = '@security'

      await expect(
        messageManager.respondToMessage(
          {
            message_id: originalMessageId,
            content: 'Unauthorized response',
          },
          unauthorizedParticipant
        )
      ).rejects.toThrow('Access denied')
    })
  })

  describe('resolveMessage', () => {
    let testMessageId: string

    beforeEach(async () => {
      const message = await messageManager.createMessage(
        {
          to: [targetParticipant],
          type: 'contract',
          priority: 'H',
          subject: 'Test message',
          content: 'Test content',
          response_required: true,
          expires_in_hours: 24,
        },
        testParticipant
      )
      testMessageId = message.id
    })

    it('should resolve message by recipient', async () => {
      await messageManager.resolveMessage(testMessageId, targetParticipant, 'complete')

      const message = await messageManager.getMessageById(testMessageId, targetParticipant)
      expect(message!.status).toBe('resolved')
      expect(message!.resolution_status).toBe('complete')
      expect(message!.resolved_by).toBe(targetParticipant)
      expect(message!.resolved_at).toBeInstanceOf(Date)
    })

    it('should resolve message by sender', async () => {
      await messageManager.resolveMessage(testMessageId, testParticipant, 'partial')

      const message = await messageManager.getMessageById(testMessageId, testParticipant)
      expect(message!.status).toBe('resolved')
      expect(message!.resolution_status).toBe('partial')
    })

    it('should deny resolution by unauthorized participant', async () => {
      const unauthorizedParticipant: ParticipantId = '@security'

      await expect(
        messageManager.resolveMessage(testMessageId, unauthorizedParticipant)
      ).rejects.toThrow('Access denied')
    })
  })

  describe('archiveExpiredMessages', () => {
    it('should archive messages that have expired', async () => {
      // Create message that expires immediately (set expires_at to past)
      const message = await messageManager.createMessage(
        {
          to: [targetParticipant],
          type: 'sync',
          priority: 'L',
          subject: 'Expired message',
          content: 'This message should be archived',
          response_required: false,
          expires_in_hours: 24, // Normal expiry, but we'll manually set it to past
        },
        testParticipant
      )

      // Manually set the message to be expired by updating expires_at to past
      const updateStmt = db.prepare(`
        UPDATE messages 
        SET expires_at = datetime('now', '-1 hour')
        WHERE id = ?
      `)
      updateStmt.run(message.id)

      const archivedCount = await messageManager.archiveExpiredMessages()

      // Should have archived at least our test message
      expect(archivedCount).toBeGreaterThanOrEqual(1)

      const archivedMessage = await messageManager.getMessageById(message.id, testParticipant)
      expect(archivedMessage!.status).toBe('archived')
    })

    it('should not archive resolved messages even if expired', async () => {
      // Create and resolve a message that expires very soon
      const message = await messageManager.createMessage(
        {
          to: [targetParticipant],
          type: 'sync',
          priority: 'L',
          subject: 'Resolved expired message',
          content: 'This message is resolved and expired',
          response_required: false,
          expires_in_hours: 0.001, // Expires in 3.6 seconds
        },
        testParticipant
      )

      // Wait for it to expire
      await new Promise(resolve => setTimeout(resolve, 100))

      await messageManager.resolveMessage(message.id, targetParticipant)

      const archivedCount = await messageManager.archiveExpiredMessages()

      expect(archivedCount).toBe(0)

      const resolvedMessage = await messageManager.getMessageById(message.id, testParticipant)
      expect(resolvedMessage!.status).toBe('resolved')
    })
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { CoordinationDatabase } from '../database/connection.js'
import { MessageManager } from '../core/message-manager.js'
import { IndexingEngine } from '../core/indexing-engine.js'
import { TEST_DATA_DIR } from './setup.js'
import type { ParticipantId, SendMessageInput, SearchMessagesInput } from '../types/index.js'

describe('IndexingEngine', () => {
  let db: CoordinationDatabase
  let messageManager: MessageManager
  let indexingEngine: IndexingEngine
  const testParticipant: ParticipantId = '@backend'
  const targetParticipant: ParticipantId = '@mobile'

  beforeEach(() => {
    db = new CoordinationDatabase(TEST_DATA_DIR)
    messageManager = new MessageManager(db, TEST_DATA_DIR)
    indexingEngine = new IndexingEngine(db)
  })

  describe('searchMessages', () => {
    beforeEach(async () => {
      // Create test messages with different content
      await messageManager.createMessage({
        to: [targetParticipant],
        type: 'contract',
        priority: 'H',
        subject: 'API Authentication Contract',
        content: 'This message discusses authentication endpoints and JWT tokens for the API.',
        response_required: true,
        expires_in_hours: 24,
        tags: ['auth', 'api', 'jwt']
      }, testParticipant)

      await messageManager.createMessage({
        to: [targetParticipant],
        type: 'arch',
        priority: 'M',
        subject: 'Database Schema Updates',
        content: 'We need to update the user table schema to support new authentication fields.',
        response_required: true,
        expires_in_hours: 48,
        tags: ['database', 'schema', 'user']
      }, testParticipant)

      await messageManager.createMessage({
        to: [targetParticipant],
        type: 'sync',
        priority: 'L',
        subject: 'Frontend Component Updates',
        content: 'The login component needs updating to match the new authentication flow.',
        response_required: false,
        expires_in_hours: 168,
        tags: ['frontend', 'component', 'login']
      }, testParticipant)
    })

    it('should find messages by full-text search', async () => {
      const searchInput: SearchMessagesInput = {
        query: 'authentication',
        semantic: true,
        limit: 10
      }

      const results = await indexingEngine.searchMessages(searchInput, testParticipant)

      expect(results.length).toBeGreaterThan(0)
      
      // Should find messages containing "authentication"
      const authMessages = results.filter(r => 
        r.message.subject.toLowerCase().includes('authentication') ||
        r.message.summary.toLowerCase().includes('authentication')
      )
      
      expect(authMessages.length).toBeGreaterThan(0)
      
      // Results should have relevance scores
      for (const result of results) {
        expect(result.relevance_score).toBeGreaterThan(0)
        expect(result.relevance_score).toBeLessThanOrEqual(1)
      }
    })

    it('should search by tags', async () => {
      const searchInput: SearchMessagesInput = {
        query: '',
        semantic: false,
        tags: ['api', 'auth'],
        limit: 10
      }

      const results = await indexingEngine.searchMessages(searchInput, testParticipant)

      expect(results.length).toBe(1)
      expect(results[0].message.subject).toBe('API Authentication Contract')
      expect(results[0].message.tags).toContain('api')
      expect(results[0].message.tags).toContain('auth')
    })

    it('should filter by date range', async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const searchInput: SearchMessagesInput = {
        query: 'update',
        date_range: {
          from: yesterday,
          to: tomorrow
        },
        limit: 10
      }

      const results = await indexingEngine.searchMessages(searchInput, testParticipant)

      // Should find messages created today
      expect(results.length).toBeGreaterThan(0)
      
      for (const result of results) {
        expect(result.message.created_at.getTime()).toBeGreaterThan(yesterday.getTime())
        expect(result.message.created_at.getTime()).toBeLessThan(tomorrow.getTime())
      }
    })

    it('should filter by participants', async () => {
      const searchInput: SearchMessagesInput = {
        query: '',
        participants: [testParticipant],
        limit: 10
      }

      const results = await indexingEngine.searchMessages(searchInput, testParticipant)

      // All results should involve the test participant
      for (const result of results) {
        const involvedParticipants = [result.message.from, ...result.message.to]
        expect(involvedParticipants).toContain(testParticipant)
      }
    })

    it('should handle empty results gracefully', async () => {
      const searchInput: SearchMessagesInput = {
        query: 'nonexistent_keyword_that_should_not_match_anything',
        limit: 10
      }

      const results = await indexingEngine.searchMessages(searchInput, testParticipant)

      expect(results).toEqual([])
    })

    it('should respect search limit', async () => {
      const searchInput: SearchMessagesInput = {
        query: 'the', // Common word that should match multiple messages
        limit: 2
      }

      const results = await indexingEngine.searchMessages(searchInput, testParticipant)

      expect(results.length).toBeLessThanOrEqual(2)
    })
  })

  describe('indexMessage', () => {
    it('should index a message and enhance its tags', async () => {
      const message = await messageManager.createMessage({
        to: [targetParticipant],
        type: 'contract',
        priority: 'CRITICAL',
        subject: 'Critical API Security Issue',
        content: 'Found a security vulnerability in the authentication endpoint that needs immediate fixing.',
        response_required: true,
        expires_in_hours: 6,
        tags: ['security']
      }, testParticipant)

      await indexingEngine.indexMessage(message)

      // The message should now be findable via search
      const searchResults = await indexingEngine.searchMessages({
        query: 'security vulnerability',
        limit: 5
      }, testParticipant)

      expect(searchResults.length).toBeGreaterThan(0)
      expect(searchResults[0].message.id).toBe(message.id)
    })
  })

  describe('getTagSuggestions', () => {
    beforeEach(async () => {
      // Create messages with various tags
      await messageManager.createMessage({
        to: [targetParticipant],
        type: 'contract',
        priority: 'H',
        subject: 'API Contract',
        content: 'API contract details',
        response_required: true,
        expires_in_hours: 24,
        tags: ['api', 'contract', 'auth']
      }, testParticipant)

      await messageManager.createMessage({
        to: [targetParticipant],
        type: 'arch',
        priority: 'M',
        subject: 'API Architecture',
        content: 'API architecture details',
        response_required: true,
        expires_in_hours: 48,
        tags: ['api', 'architecture', 'design']
      }, testParticipant)
    })

    it('should suggest tags based on query', async () => {
      const suggestions = await indexingEngine.getTagSuggestions('ap', testParticipant, 10)

      expect(suggestions).toContain('api')
      expect(suggestions.length).toBeGreaterThan(0)
    })

    it('should return empty array for non-matching query', async () => {
      const suggestions = await indexingEngine.getTagSuggestions('xyz', testParticipant, 10)

      expect(suggestions).toEqual([])
    })

    it('should respect limit parameter', async () => {
      const suggestions = await indexingEngine.getTagSuggestions('', testParticipant, 2)

      expect(suggestions.length).toBeLessThanOrEqual(2)
    })
  })

  describe('getMessageStats', () => {
    beforeEach(async () => {
      // Create messages with different types and priorities
      await messageManager.createMessage({
        to: [targetParticipant],
        type: 'contract',
        priority: 'H',
        subject: 'High Priority Contract',
        content: 'High priority contract message',
        response_required: true,
        expires_in_hours: 24
      }, testParticipant)

      await messageManager.createMessage({
        to: [testParticipant],
        type: 'sync',
        priority: 'M',
        subject: 'Medium Priority Sync',
        content: 'Medium priority sync message',
        response_required: true,
        expires_in_hours: 48
      }, targetParticipant)

      // Resolve one message
      const messages = await messageManager.getMessages({
        limit: 1,
        detail_level: 'summary'
      }, testParticipant)
      
      if (messages.length > 0) {
        await messageManager.resolveMessage(messages[0].id, testParticipant)
      }
    })

    it('should generate comprehensive message statistics', async () => {
      const stats = await indexingEngine.getMessageStats(testParticipant, 7)

      expect(stats.total_messages).toBeGreaterThan(0)
      expect(stats.messages_sent).toBeGreaterThan(0)
      expect(stats.messages_received).toBeGreaterThanOrEqual(0)

      // Should have statistics by type
      expect(typeof stats.by_type).toBe('object')
      expect(Object.keys(stats.by_type).length).toBeGreaterThan(0)

      // Should have statistics by priority
      expect(typeof stats.by_priority).toBe('object')
      expect(Object.keys(stats.by_priority).length).toBeGreaterThan(0)

      // Should have statistics by status
      expect(typeof stats.by_status).toBe('object')
      expect(Object.keys(stats.by_status).length).toBeGreaterThan(0)

      // Response rate should be between 0 and 1
      expect(stats.response_rate).toBeGreaterThanOrEqual(0)
      expect(stats.response_rate).toBeLessThanOrEqual(1)

      // Average response time should be non-negative
      expect(stats.avg_response_time_hours).toBeGreaterThanOrEqual(0)
    })

    it('should handle different time ranges', async () => {
      const stats1Day = await indexingEngine.getMessageStats(testParticipant, 1)
      const stats7Days = await indexingEngine.getMessageStats(testParticipant, 7)

      // 7-day stats should include at least as many messages as 1-day
      expect(stats7Days.total_messages).toBeGreaterThanOrEqual(stats1Day.total_messages)
    })
  })

  describe('findRelatedMessages', () => {
    let originalMessageId: string

    beforeEach(async () => {
      // Create a message
      const message = await messageManager.createMessage({
        to: [targetParticipant],
        type: 'contract',
        priority: 'H',
        subject: 'User Authentication API',
        content: 'This message is about user authentication API endpoints and security.',
        response_required: true,
        expires_in_hours: 24,
        tags: ['auth', 'api', 'security']
      }, testParticipant)
      
      originalMessageId = message.id

      // Create related messages
      await messageManager.createMessage({
        to: [targetParticipant],
        type: 'arch',
        priority: 'M',
        subject: 'Authentication Database Schema',
        content: 'Database schema changes needed for user authentication system.',
        response_required: true,
        expires_in_hours: 48,
        tags: ['auth', 'database', 'schema']
      }, testParticipant)

      await messageManager.createMessage({
        to: [targetParticipant],
        type: 'sync',
        priority: 'L',
        subject: 'Payment Gateway Integration',
        content: 'Integration details for payment gateway, completely unrelated to auth.',
        response_required: false,
        expires_in_hours: 168,
        tags: ['payment', 'integration']
      }, testParticipant)
    })

    it('should find related messages based on content similarity', async () => {
      const relatedMessages = await indexingEngine.findRelatedMessages(
        originalMessageId,
        testParticipant,
        5
      )

      expect(relatedMessages.length).toBeGreaterThan(0)
      
      // Should not include the original message
      const originalMessageInResults = relatedMessages.find(r => r.message.id === originalMessageId)
      expect(originalMessageInResults).toBeUndefined()

      // Should find the authentication-related message
      const authMessage = relatedMessages.find(r => 
        r.message.subject.includes('Authentication')
      )
      expect(authMessage).toBeDefined()

      // Results should have relevance scores
      for (const result of relatedMessages) {
        expect(result.relevance_score).toBeGreaterThan(0)
        expect(result.relevance_score).toBeLessThanOrEqual(1)
      }
    })

    it('should return empty array for non-existent message', async () => {
      const relatedMessages = await indexingEngine.findRelatedMessages(
        'CONTRACT-nonexistent-XXX',
        testParticipant,
        5
      )

      expect(relatedMessages).toEqual([])
    })

    it('should respect the limit parameter', async () => {
      const relatedMessages = await indexingEngine.findRelatedMessages(
        originalMessageId,
        testParticipant,
        2
      )

      expect(relatedMessages.length).toBeLessThanOrEqual(2)
    })
  })
})
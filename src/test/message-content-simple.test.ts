import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import Database from 'better-sqlite3'
import { CoordinationDatabase } from '../database/connection.js'
import { MessageManager } from '../core/message-manager.js'
import { ParticipantRegistry } from '../core/participant-registry.js'
import { ParticipantId, SendMessageInput } from '../types/index.js'

describe('Simple Message Content Test', () => {
  let tempDir: string
  let db: CoordinationDatabase
  let messageManager: MessageManager
  let participantRegistry: ParticipantRegistry
  const testParticipant: ParticipantId = '@test' as ParticipantId
  const targetParticipant: ParticipantId = '@mobile' as ParticipantId

  beforeEach(async () => {
    // Create a temporary directory for test database
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccp-simple-test-'))
    
    // Initialize database and managers
    db = new CoordinationDatabase(tempDir)
    messageManager = new MessageManager(db.db, tempDir)
    participantRegistry = new ParticipantRegistry(db.db, tempDir)
    
    // Register test participants
    await participantRegistry.registerParticipant({
      id: testParticipant,
      capabilities: ['test'],
      default_priority: 'M'
    })
    
    await participantRegistry.registerParticipant({
      id: targetParticipant,
      capabilities: ['mobile'],
      default_priority: 'M'
    })
    
    console.log('Setup complete, participants registered')
  })

  afterEach(() => {
    // Clean up
    db.close()
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should create and retrieve a simple message', async () => {
    console.log('Starting simple test...')
    
    // Create a simple message
    const input: SendMessageInput = {
      to: [targetParticipant],
      type: 'sync',
      priority: 'M',
      subject: 'Test Message',
      content: 'This is a test message',
      response_required: false,
      expires_in_hours: 24
    }
    
    console.log('Creating message...')
    const sentMessage = await messageManager.createMessage(input, testParticipant)
    console.log('Message created:', sentMessage.id, sentMessage.thread_id)
    
    // Check database directly
    const directQuery = db.db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number }
    console.log('Messages in database:', directQuery.count)
    
    // Try to get messages
    console.log('Retrieving messages...')
    const messages = await messageManager.getMessages({
      limit: 100,
      active_only: false,
      detail_level: 'full'
    }, testParticipant)
    
    console.log('Messages retrieved:', messages.length)
    
    expect(messages).toHaveLength(1)
    expect(messages[0].id).toBe(sentMessage.id)
    expect(messages[0].content).toBe('This is a test message')
  })

  it('should handle long content with content_ref', async () => {
    const longContent = 'x'.repeat(1500) // Force content_ref creation
    
    const input: SendMessageInput = {
      to: [targetParticipant],
      type: 'sync',
      priority: 'M',
      subject: 'Long Message',
      content: longContent,
      response_required: false,
      expires_in_hours: 24
    }
    
    console.log('Creating long message...')
    const sentMessage = await messageManager.createMessage(input, testParticipant)
    console.log('Long message created with content_ref:', sentMessage.content_ref)
    
    expect(sentMessage.content_ref).toBeTruthy()
    expect(sentMessage.summary).toHaveLength(503) // 500 + '...'
    
    // Retrieve with full detail
    const messages = await messageManager.getMessages({
      limit: 100,
      active_only: false,
      detail_level: 'full'
    }, testParticipant)
    
    console.log('Long messages retrieved:', messages.length)
    
    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe(longContent)
  })
})
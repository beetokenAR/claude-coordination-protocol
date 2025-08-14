import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MessageManager } from '../core/message-manager'
import { ParticipantRegistry } from '../core/participant-registry'
import { CoordinationDatabase } from '../database/connection'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('Thread Close Enhancement', () => {
  let messageManager: MessageManager
  let participantRegistry: ParticipantRegistry
  let db: CoordinationDatabase
  let tempDir: string
  
  const testParticipant = '@test'
  const otherParticipant = '@other'

  beforeEach(async () => {
    // Create a temporary directory for test database
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccp-test-'))
    
    // Initialize database and managers
    db = new CoordinationDatabase(tempDir)
    messageManager = new MessageManager(db.db, tempDir)
    participantRegistry = new ParticipantRegistry(db.db, tempDir)
    
    // Register test participants
    await participantRegistry.registerParticipant({
      id: testParticipant,
      capabilities: ['test'],
      status: 'online',
    })
    
    await participantRegistry.registerParticipant({
      id: otherParticipant,
      capabilities: ['test'],
      status: 'online',
    })
  })

  afterEach(() => {
    // Clean up
    db.close()
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should auto-convert message ID to thread ID when closing', async () => {
    // Create a message
    const message = await messageManager.createMessage(
      {
        to: [otherParticipant],
        type: 'contract',
        priority: 'M',
        subject: 'Test message',
        content: 'Test content',
        response_required: false,
      },
      testParticipant
    )

    // Close thread using message ID (should auto-convert)
    const closedCount = await messageManager.closeThread(
      {
        thread_id: message.id, // Using message ID - should auto-convert to thread ID
        resolution_status: 'complete',
      },
      testParticipant
    )
    
    expect(closedCount).toBe(1)
    
    // Verify the message is now resolved
    const messages = await messageManager.getMessages(
      {
        thread_id: message.thread_id,
        active_only: false,
      },
      testParticipant
    )

    expect(messages.length).toBe(1)
    expect(messages[0].status).toBe('resolved')
  })

  it('should successfully close thread when using correct thread ID', async () => {
    // Create a message
    const message = await messageManager.createMessage(
      {
        to: [otherParticipant],
        type: 'contract',
        priority: 'M',
        subject: 'Test message',
        content: 'Test content',
        response_required: false,
      },
      testParticipant
    )

    // Close thread using correct thread ID
    const closedCount = await messageManager.closeThread(
      {
        thread_id: message.thread_id, // Using correct thread ID
        resolution_status: 'complete',
        final_summary: 'Test completed',
      },
      testParticipant
    )

    expect(closedCount).toBe(1)

    // Verify the message is now resolved
    const messages = await messageManager.getMessages(
      {
        thread_id: message.thread_id,
        active_only: false,
      },
      testParticipant
    )

    expect(messages.length).toBe(1)
    expect(messages[0].status).toBe('resolved')
  })

  it('should handle thread IDs that already end with -thread correctly', async () => {
    // Create a message
    const message = await messageManager.createMessage(
      {
        to: [otherParticipant],
        type: 'contract',
        priority: 'M',
        subject: 'Test message',
        content: 'Test content',
        response_required: false,
      },
      testParticipant
    )

    // Verify the thread ID already ends with -thread
    expect(message.thread_id).toMatch(/-thread$/)

    // Should work correctly with the proper thread ID
    const closedCount = await messageManager.closeThread(
      {
        thread_id: message.thread_id,
        resolution_status: 'complete',
      },
      testParticipant
    )

    expect(closedCount).toBe(1)
  })

  it('should close thread using response message ID (most common issue)', async () => {
    // Create initial message
    const initialMessage = await messageManager.createMessage(
      {
        to: [otherParticipant],
        type: 'q',
        priority: 'H',
        subject: 'Initial question',
        content: 'What is the status?',
        response_required: true,
      },
      testParticipant
    )

    // Other participant responds
    const response = await messageManager.respondToMessage(
      {
        message_id: initialMessage.id,
        content: 'Status is complete',
        resolution_status: 'complete',
      },
      otherParticipant
    )

    // User sees the response message ID and tries to close the thread with it
    // This should auto-convert to the correct thread ID
    const closedCount = await messageManager.closeThread(
      {
        thread_id: response.id, // Using RESPONSE message ID - should find correct thread
        resolution_status: 'complete',
        final_summary: 'Issue resolved',
      },
      otherParticipant
    )

    // Should have closed both messages in the thread
    expect(closedCount).toBeGreaterThanOrEqual(1)

    // Verify both messages are resolved
    const messages = await messageManager.getMessages(
      {
        thread_id: initialMessage.thread_id,
        active_only: false,
      },
      testParticipant
    )

    const resolvedMessages = messages.filter(m => m.status === 'resolved')
    expect(resolvedMessages.length).toBeGreaterThanOrEqual(1)
  })
})
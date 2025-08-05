import { customAlphabet } from 'nanoid'
import { format, addHours } from 'date-fns'
import fs from 'fs/promises'
import path from 'path'
import type { Statement } from 'better-sqlite3'

import { CoordinationDatabase } from '../database/connection.js'
import { validateInput, validateMessageId, validateNoCycles } from '../utils/validation.js'
import {
  CoordinationMessage,
  MessageRow,
  SendMessageInput,
  GetMessagesInput,
  RespondMessageInput,
  CloseThreadInput,
  MessageFilters,
  PaginationOptions,
  MessageType,
  ParticipantId,
  ValidationError,
} from '../types/index.js'

export class MessageManager {
  private db: CoordinationDatabase
  private dataDir: string

  // Prepared statements for performance
  private insertMessage: Statement
  private updateMessage: Statement
  private selectMessages: Statement
  private selectMessageById: Statement
  private deleteMessage: Statement
  private selectMessageDependencies: Statement

  constructor(db: CoordinationDatabase, dataDir: string) {
    this.db = db
    this.dataDir = dataDir
    this.prepareStatements()
  }

  private prepareStatements(): void {
    this.insertMessage = this.db.prepare(`
      INSERT INTO messages (
        id, thread_id, from_participant, to_participants, type, priority, status,
        subject, summary, content_ref, created_at, updated_at, expires_at,
        response_required, dependencies, tags, semantic_vector, suggested_approach
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    this.updateMessage = this.db.prepare(`
      UPDATE messages SET
        status = ?, updated_at = ?, resolution_status = ?, resolved_at = ?, resolved_by = ?
      WHERE id = ?
    `)

    this.selectMessages = this.db.prepare(`
      SELECT * FROM messages 
      WHERE 1=1
        AND ($participant IS NULL OR from_participant = $participant OR to_participants LIKE '%' || $participant || '%')
        AND ($status IS NULL OR status IN (SELECT value FROM json_each($status)))
        AND ($type IS NULL OR type IN (SELECT value FROM json_each($type)))
        AND ($priority IS NULL OR priority IN (SELECT value FROM json_each($priority)))
        AND ($since IS NULL OR created_at >= $since)
        AND ($thread_id IS NULL OR thread_id = $thread_id)
        AND ($active_only = 0 OR status NOT IN ('resolved', 'archived', 'cancelled'))
      ORDER BY 
        CASE priority 
          WHEN 'CRITICAL' THEN 1
          WHEN 'H' THEN 2 
          WHEN 'M' THEN 3
          WHEN 'L' THEN 4
        END,
        created_at DESC
      LIMIT $limit OFFSET $offset
    `)

    this.selectMessageById = this.db.prepare('SELECT * FROM messages WHERE id = ?')

    this.deleteMessage = this.db.prepare('DELETE FROM messages WHERE id = ?')

    this.selectMessageDependencies = this.db.prepare(
      'SELECT dependencies FROM messages WHERE id = ?'
    )
  }

  /**
   * Create a new coordination message
   */
  async createMessage(
    input: SendMessageInput,
    fromParticipant: ParticipantId
  ): Promise<CoordinationMessage> {
    const validated = validateInput(SendMessageInput, input, 'create message')

    const messageId = this.generateMessageId(validated.type)
    const threadId = this.generateThreadId(messageId)
    const now = new Date()
    const expiresAt = validated.expires_in_hours
      ? addHours(now, validated.expires_in_hours)
      : undefined

    // Validate dependencies don't create cycles
    if (validated.tags?.some(tag => tag.startsWith('depends:'))) {
      const dependencies = validated.tags
        .filter(tag => tag.startsWith('depends:'))
        .map(tag => tag.substring(8))

      validateNoCycles(messageId, dependencies, (id: string) => {
        const result = this.selectMessageDependencies.get(id) as
          | { dependencies: string }
          | undefined
        return result ? JSON.parse(result.dependencies) : []
      })
    }

    // Store detailed content in file if large
    let contentRef: string | undefined
    if (validated.content.length > 1000) {
      contentRef = await this.storeMessageContent(threadId, messageId, validated.content)
    }

    const message: CoordinationMessage = {
      id: messageId,
      thread_id: threadId,
      from: fromParticipant,
      to: validated.to,
      type: validated.type,
      priority: validated.priority,
      status: 'pending',
      subject: validated.subject,
      summary:
        validated.content.length > 500
          ? validated.content.substring(0, 500) + '...'
          : validated.content,
      content_ref: contentRef,
      created_at: now,
      updated_at: now,
      expires_at: expiresAt,
      response_required: validated.response_required,
      dependencies:
        validated.tags?.filter(tag => tag.startsWith('depends:')).map(tag => tag.substring(8)) ??
        [],
      tags: validated.tags?.filter(tag => !tag.startsWith('depends:')) ?? [],
      suggested_approach: validated.suggested_approach,
    }

    // Insert into database - NO transaction wrapper since individual operations are atomic
    this.insertMessage.run(
      message.id,
      message.thread_id,
      message.from,
      JSON.stringify(message.to),
      message.type,
      message.priority,
      message.status,
      message.subject,
      message.summary,
      message.content_ref,
      message.created_at.toISOString(),
      message.updated_at.toISOString(),
      message.expires_at?.toISOString(),
      message.response_required ? 1 : 0,
      JSON.stringify(message.dependencies),
      JSON.stringify(message.tags),
      null, // semantic_vector will be added later by indexing system
      message.suggested_approach ? JSON.stringify(message.suggested_approach) : null
    )

    // Update or create conversation thread
    this.updateConversationThread(message)

    return message
  }

  /**
   * Get messages with filtering and pagination
   */
  async getMessages(
    input: GetMessagesInput,
    requestingParticipant: ParticipantId
  ): Promise<CoordinationMessage[]> {
    const validated = validateInput(GetMessagesInput, input, 'get messages')

    // Build filters ensuring participant can only see authorized messages
    const filters: MessageFilters = {
      participant: validated.participant || requestingParticipant,
      status: validated.status,
      type: validated.type,
      priority: validated.priority,
      since: validated.since_hours
        ? new Date(Date.now() - validated.since_hours * 60 * 60 * 1000)
        : undefined,
      thread_id: validated.thread_id,
    }

    const pagination: PaginationOptions = {
      limit: validated.limit,
      offset: 0,
    }

    const rows = this.selectMessages.all({
      participant: filters.participant,
      status: filters.status ? JSON.stringify(filters.status) : null,
      type: filters.type ? JSON.stringify(filters.type) : null,
      priority: filters.priority ? JSON.stringify(filters.priority) : null,
      since: filters.since?.toISOString() || null,
      thread_id: filters.thread_id || null,
      active_only: validated.active_only !== false ? 1 : 0,
      limit: pagination.limit,
      offset: pagination.offset,
    }) as MessageRow[]

    // Convert database rows to domain objects
    const messages = await Promise.all(
      rows.map(row => this.rowToMessage(row, validated.detail_level))
    )

    return messages
  }

  /**
   * Get a specific message by ID
   */
  async getMessageById(
    messageId: string,
    requestingParticipant: ParticipantId,
    detailLevel: 'index' | 'summary' | 'full' = 'full'
  ): Promise<CoordinationMessage | null> {
    validateMessageId(messageId)

    const row = this.selectMessageById.get(messageId) as MessageRow | undefined
    if (!row) {
      return null
    }

    // Check if participant is authorized to see this message
    const toParticipants = JSON.parse(row.to_participants)
    if (
      row.from_participant !== requestingParticipant &&
      !toParticipants.includes(requestingParticipant)
    ) {
      throw new ValidationError('Access denied: not authorized to view this message')
    }

    return this.rowToMessage(row, detailLevel)
  }

  /**
   * Respond to a message
   */
  async respondToMessage(
    input: RespondMessageInput,
    respondingParticipant: ParticipantId
  ): Promise<CoordinationMessage> {
    const validated = validateInput(RespondMessageInput, input, 'respond to message')

    // Get original message
    const originalMessage = await this.getMessageById(
      validated.message_id,
      respondingParticipant,
      'full'
    )

    if (!originalMessage) {
      throw new ValidationError(`Message not found: ${validated.message_id}`)
    }

    // Check if participant is authorized to respond
    if (!originalMessage.to.includes(respondingParticipant)) {
      throw new ValidationError('Access denied: not authorized to respond to this message')
    }

    // Create response message
    const responseMessage = await this.createMessage(
      {
        to: [originalMessage.from],
        type: originalMessage.type,
        priority: originalMessage.priority,
        subject: `Re: ${originalMessage.subject}`,
        content: validated.content,
        response_required: false,
        expires_in_hours: 168, // 1 week default
        tags: [`response_to:${validated.message_id}`],
      },
      respondingParticipant
    )

    // Update original message status
    const now = new Date()
    this.updateMessage.run(
      'responded',
      now.toISOString(),
      validated.resolution_status,
      validated.resolution_status ? now.toISOString() : null,
      validated.resolution_status ? respondingParticipant : null,
      validated.message_id
    )

    return responseMessage
  }

  /**
   * Mark message as resolved
   */
  async resolveMessage(
    messageId: string,
    resolvingParticipant: ParticipantId,
    resolutionStatus: 'complete' | 'partial' | 'requires_followup' = 'complete'
  ): Promise<void> {
    validateMessageId(messageId)

    const message = await this.getMessageById(messageId, resolvingParticipant)
    if (!message) {
      throw new ValidationError(`Message not found: ${messageId}`)
    }

    // Check authorization
    if (!message.to.includes(resolvingParticipant) && message.from !== resolvingParticipant) {
      throw new ValidationError('Access denied: not authorized to resolve this message')
    }

    const now = new Date()
    this.updateMessage.run(
      'resolved',
      now.toISOString(),
      resolutionStatus,
      now.toISOString(),
      resolvingParticipant,
      messageId
    )
  }

  /**
   * Archive expired messages
   */
  async archiveExpiredMessages(): Promise<number> {
    const now = new Date()

    // Find expired messages
    const expiredMessages = this.db
      .prepare(
        `
      SELECT id, content_ref FROM messages 
      WHERE expires_at IS NOT NULL 
      AND expires_at < ? 
      AND status NOT IN ('resolved', 'archived')
    `
      )
      .all(now.toISOString()) as Array<{ id: string; content_ref?: string }>

    if (expiredMessages.length === 0) {
      return 0
    }

    // Archive messages
    const archiveMessage = this.db.prepare(`
      UPDATE messages SET status = 'archived', updated_at = ? WHERE id = ?
    `)

    for (const message of expiredMessages) {
      archiveMessage.run(now.toISOString(), message.id)

      // Move content file to archive if it exists
      if (message.content_ref) {
        this.archiveContentFile(message.content_ref).catch(error => {
          // eslint-disable-next-line no-console
          console.warn(`Failed to archive content file ${message.content_ref}:`, error)
        })
      }
    }

    return expiredMessages.length
  }

  private generateMessageId(type: MessageType): string {
    const typePrefix = type.toUpperCase()
    const timestamp = Date.now().toString(36)
    const nanoidAlphanumeric = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 3)
    const random = nanoidAlphanumeric()
    return `${typePrefix}-${timestamp}-${random}`
  }

  private generateThreadId(messageId: string): string {
    return `${messageId}-thread`
  }

  private async storeMessageContent(
    threadId: string,
    messageId: string,
    content: string
  ): Promise<string> {
    const contentDir = path.join(this.dataDir, 'messages', 'active', threadId)
    await fs.mkdir(contentDir, { recursive: true })

    const contentPath = path.join(contentDir, `${messageId}.md`)
    await fs.writeFile(contentPath, content, 'utf-8')

    return path.relative(this.dataDir, contentPath)
  }

  private async archiveContentFile(contentRef: string): Promise<void> {
    const sourcePath = path.join(this.dataDir, contentRef)
    const archivePath = path.join(
      this.dataDir,
      'messages',
      'archive',
      format(new Date(), 'yyyy/MM'),
      path.basename(contentRef)
    )

    await fs.mkdir(path.dirname(archivePath), { recursive: true })
    await fs.rename(sourcePath, archivePath)
  }

  private async rowToMessage(
    row: MessageRow,
    detailLevel: 'index' | 'summary' | 'full'
  ): Promise<CoordinationMessage> {
    const message: CoordinationMessage = {
      id: row.id,
      thread_id: row.thread_id,
      from: row.from_participant as ParticipantId,
      to: JSON.parse(row.to_participants),
      type: row.type,
      priority: row.priority,
      status: row.status,
      subject: row.subject,
      summary: row.summary,
      content_ref: row.content_ref,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      expires_at: row.expires_at ? new Date(row.expires_at) : undefined,
      response_required: row.response_required === 1,
      dependencies: JSON.parse(row.dependencies),
      tags: JSON.parse(row.tags),
      semantic_vector: row.semantic_vector ? JSON.parse(row.semantic_vector) : undefined,
      suggested_approach: row.suggested_approach ? JSON.parse(row.suggested_approach) : undefined,
      resolution_status: row.resolution_status,
      resolved_at: row.resolved_at ? new Date(row.resolved_at) : undefined,
      resolved_by: row.resolved_by as ParticipantId | undefined,
    }

    // Load full content if requested and available
    if (detailLevel === 'full') {
      if (message.content_ref) {
        try {
          const contentPath = path.join(this.dataDir, message.content_ref)
          const fullContent = await fs.readFile(contentPath, 'utf-8')
          message.content = fullContent  // Put full content in the content field, not summary
        } catch (_error) {
          // eslint-disable-next-line no-console
          console.warn(`Failed to load content for message ${message.id}:`, _error)
          // If we can't load from file, use the summary as content
          message.content = message.summary
        }
      } else {
        // If no content_ref, the summary IS the full content (short messages)
        message.content = message.summary
      }
    }

    return message
  }

  private updateConversationThread(_message: CoordinationMessage): void {
    // This would update the conversations table
    // Implementation depends on conversation manager
    // For now, just ensure the basic data is consistent
  }

  /**
   * Close an entire thread by marking all messages as resolved
   */
  async closeThread(input: CloseThreadInput, closingParticipant: ParticipantId): Promise<number> {
    const validated = validateInput(CloseThreadInput, input, 'close_thread')

    // Get all messages in the thread
    const messages = await this.getMessages(
      {
        thread_id: validated.thread_id,
        limit: 100,
        active_only: false,
      },
      closingParticipant
    )

    if (messages.length === 0) {
      throw new ValidationError(`Thread not found: ${validated.thread_id}`)
    }

    // Check if participant has access to at least one message in the thread
    const hasAccess = messages.some(
      msg => msg.from === closingParticipant || msg.to.includes(closingParticipant)
    )

    if (!hasAccess) {
      throw new ValidationError('Access denied: not authorized to close this thread')
    }

    const now = new Date()
    let closedCount = 0

    // Close all pending/read/responded messages in the thread
    for (const message of messages) {
      if (['pending', 'read', 'responded'].includes(message.status)) {
        this.updateMessage.run(
          'resolved',
          now.toISOString(),
          validated.resolution_status,
          now.toISOString(),
          closingParticipant,
          message.id
        )
        closedCount++
      }
    }

    // If a final summary was provided, add it as a final message
    if (validated.final_summary) {
      await this.createMessage(
        {
          to: ['@all'],
          type: 'update',
          priority: 'L',
          subject: `Thread Closed: ${validated.thread_id}`,
          content: validated.final_summary,
          tags: ['thread-closed', `resolution-${validated.resolution_status}`],
        },
        closingParticipant
      )
    }

    return closedCount
  }
}

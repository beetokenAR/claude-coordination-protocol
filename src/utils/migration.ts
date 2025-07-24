import fs from 'fs/promises'
import path from 'path'
import { format, parse as parseDate } from 'date-fns'

import { CoordinationDatabase } from '../database/connection.js'
import { MessageManager } from '../core/message-manager.js'
import { ParticipantRegistry } from '../core/participant-registry.js'
import {
  CoordinationMessage,
  ParticipantId,
  MessageType,
  Priority,
  MessageStatus,
  SendMessageInput,
  DatabaseError,
  ValidationError
} from '../types/index.js'

export interface LegacyMessage {
  id: string
  title: string
  from: ParticipantId
  to: ParticipantId
  type: MessageType
  priority: Priority
  status: MessageStatus
  description: string
  filePath?: string
  inferredDate: Date
}

export interface MigrationResult {
  messagesProcessed: number
  messagesImported: number
  participantsCreated: number
  errors: Array<{ message: string, error: string }>
  summary: string
}

export class LegacyMigrationTool {
  private db: CoordinationDatabase
  private messageManager: MessageManager
  private participantRegistry: ParticipantRegistry
  private dataDir: string
  
  constructor(db: CoordinationDatabase, dataDir: string) {
    this.db = db
    this.dataDir = dataDir
    this.messageManager = new MessageManager(db, dataDir)
    this.participantRegistry = new ParticipantRegistry(db, dataDir)
  }
  
  /**
   * Migrate from LLM_COORDINATION.md format
   */
  async migrateFromCoordinationFile(filePath: string): Promise<MigrationResult> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const legacyMessages = this.parseCoordinationFile(content)
      
      return await this.importMessages(legacyMessages, path.dirname(filePath))
      
    } catch (error: any) {
      throw new DatabaseError(
        `Failed to migrate from ${filePath}: ${error.message}`,
        { filePath, error: error.message }
      )
    }
  }
  
  /**
   * Parse LLM_COORDINATION.md file format
   */
  private parseCoordinationFile(content: string): LegacyMessage[] {
    const messages: LegacyMessage[] = []
    const lines = content.split('\n')
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Look for message entries like: "1. **ARCH-001**: Description *(file.md)*"
      const messageMatch = line.match(/^\d+\.\s+\*\*([A-Z]+-\d{3})\*\*:\s+(.+?)\s+\*\(([^)]+)\)\*/)
      if (messageMatch) {
        const [, messageId, title, filePath] = messageMatch
        
        // Look for metadata in following lines
        let fromParticipant: ParticipantId | undefined
        let toParticipant: ParticipantId | undefined
        let priority: Priority = 'M'
        let status: MessageStatus = 'pending'
        
        // Check next few lines for metadata
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const metaLine = lines[j].trim()
          
          const fromMatch = metaLine.match(/FROM:\s*(@\w+)\s+TO:\s*(@\w+)\s+PRIORITY:\s*([HML]|CRITICAL)/)
          if (fromMatch) {
            fromParticipant = fromMatch[1] as ParticipantId
            toParticipant = fromMatch[2] as ParticipantId
            priority = fromMatch[3] as Priority
          }
          
          const statusMatch = metaLine.match(/Status:\s*(✅\s+)?(COMPLETE|RESOLVED|FIXED|RESPONDED|PENDING)/)
          if (statusMatch) {
            const statusText = statusMatch[2]
            status = this.mapLegacyStatus(statusText)
          }
        }
        
        // Extract message type from ID
        const type = this.extractMessageType(messageId)
        
        // Try to infer date from file modification or content
        const inferredDate = this.inferMessageDate(content, messageId)
        
        if (fromParticipant && toParticipant) {
          messages.push({
            id: messageId,
            title,
            from: fromParticipant,
            to: toParticipant,
            type,
            priority,
            status,
            description: title,
            filePath,
            inferredDate
          })
        }
      }
    }
    
    return messages
  }
  
  /**
   * Import parsed legacy messages
   */
  private async importMessages(
    legacyMessages: LegacyMessage[],
    sourceDir: string
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      messagesProcessed: legacyMessages.length,
      messagesImported: 0,
      participantsCreated: 0,
      errors: [],
      summary: ''
    }
    
    // Extract and register participants
    const participants = new Set<ParticipantId>()
    for (const msg of legacyMessages) {
      participants.add(msg.from)
      participants.add(msg.to)
    }
    
    // Register participants if they don't exist
    for (const participantId of participants) {
      try {
        const existing = await this.participantRegistry.getParticipant(participantId)
        if (!existing) {
          await this.participantRegistry.registerParticipant({
            id: participantId,
            capabilities: this.inferCapabilities(participantId),
            default_priority: 'M'
          })
          result.participantsCreated++
        }
      } catch (error: any) {
        result.errors.push({
          message: `Failed to register participant ${participantId}`,
          error: error.message
        })
      }
    }
    
    // Import messages
    for (const legacyMsg of legacyMessages) {
      try {
        // Check if message already exists
        const existing = await this.messageManager.getMessageById(
          legacyMsg.id,
          legacyMsg.from,
          'summary'
        )
        
        if (existing) {
          console.log(`Skipping existing message: ${legacyMsg.id}`)
          continue
        }
        
        // Load content from file if available
        let content = legacyMsg.description
        if (legacyMsg.filePath) {
          try {
            const contentPath = path.resolve(sourceDir, legacyMsg.filePath)
            const fileContent = await fs.readFile(contentPath, 'utf-8')
            content = fileContent
          } catch (error) {
            console.warn(`Could not load content from ${legacyMsg.filePath}`)
          }
        }
        
        // Create the message with original timestamp
        const messageInput: SendMessageInput = {
          to: [legacyMsg.to],
          type: legacyMsg.type,
          priority: legacyMsg.priority,
          subject: legacyMsg.title,
          content,
          response_required: legacyMsg.status === 'pending',
          expires_in_hours: 8760, // 1 year for imported messages
          tags: ['imported', `legacy_${legacyMsg.type.toLowerCase()}`]
        }
        
        const importedMessage = await this.messageManager.createMessage(
          messageInput,
          legacyMsg.from
        )
        
        // Update timestamps to match original
        await this.updateMessageTimestamp(importedMessage.id, legacyMsg.inferredDate)
        
        // Update status if not pending
        if (legacyMsg.status !== 'pending') {
          await this.updateMessageStatus(importedMessage.id, legacyMsg.status)
        }
        
        result.messagesImported++
        
      } catch (error: any) {
        result.errors.push({
          message: `Failed to import message ${legacyMsg.id}`,
          error: error.message
        })
      }
    }
    
    // Generate summary
    result.summary = this.generateMigrationSummary(result)
    
    return result
  }
  
  private extractMessageType(messageId: string): MessageType {
    const typePrefix = messageId.split('-')[0].toLowerCase()
    
    switch (typePrefix) {
      case 'arch':
      case 'architecture':
        return 'arch'
      case 'contract':
        return 'contract'
      case 'sync':
        return 'sync'
      case 'update':
        return 'update'
      case 'security':
      case 'emergency':
        return 'emergency'
      case 'q':
      case 'question':
        return 'q'
      default:
        return 'sync' // Default fallback
    }
  }
  
  private mapLegacyStatus(statusText: string): MessageStatus {
    const status = statusText.toLowerCase()
    
    if (status.includes('complete') || status.includes('resolved') || status.includes('fixed')) {
      return 'resolved'
    }
    if (status.includes('responded')) {
      return 'responded'
    }
    if (status.includes('pending')) {
      return 'pending'
    }
    
    return 'pending' // Default fallback
  }
  
  private inferMessageDate(content: string, messageId: string): Date {
    // Try to find date references near the message ID
    const lines = content.split('\n')
    const messageLineIndex = lines.findIndex(line => line.includes(messageId))
    
    if (messageLineIndex >= 0) {
      // Look for dates in nearby lines
      for (let i = Math.max(0, messageLineIndex - 5); i < Math.min(lines.length, messageLineIndex + 5); i++) {
        const line = lines[i]
        
        // Look for various date formats
        const datePatterns = [
          /\b(\d{4}-\d{2}-\d{2})\b/, // 2024-07-16
          /\b(\w{3}\s+\w{3}\s+\d{1,2}\s+\d{4})\b/, // Mon Jul 16 2024
          /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/ // 7/16/2024
        ]
        
        for (const pattern of datePatterns) {
          const match = line.match(pattern)
          if (match) {
            try {
              const date = new Date(match[1])
              if (!isNaN(date.getTime())) {
                return date
              }
            } catch {
              // Continue trying other patterns
            }
          }
        }
      }
    }
    
    // Fallback to current date minus some days based on message ID
    const idNumber = parseInt(messageId.split('-')[1] || '1')
    const daysAgo = Math.min(idNumber, 365) // Max 1 year ago
    const fallbackDate = new Date()
    fallbackDate.setDate(fallbackDate.getDate() - daysAgo)
    
    return fallbackDate
  }
  
  private inferCapabilities(participantId: ParticipantId): string[] {
    const id = participantId.toLowerCase()
    
    if (id.includes('backend')) {
      return ['api', 'database', 'backend', 'infrastructure']
    }
    if (id.includes('mobile') || id.includes('frontend')) {
      return ['ui', 'frontend', 'client', 'mobile']
    }
    if (id.includes('security')) {
      return ['security', 'auth', 'compliance', 'audit']
    }
    if (id.includes('admin')) {
      return ['admin', 'system', 'coordination']
    }
    
    return ['coordination'] // Default capability
  }
  
  private async updateMessageTimestamp(messageId: string, timestamp: Date): Promise<void> {
    const updateTimestamp = this.db.prepare(`
      UPDATE messages SET created_at = ?, updated_at = ? WHERE id = ?
    `)
    
    updateTimestamp.run(
      timestamp.toISOString(),
      timestamp.toISOString(),
      messageId
    )
  }
  
  private async updateMessageStatus(messageId: string, status: MessageStatus): Promise<void> {
    const updateStatus = this.db.prepare(`
      UPDATE messages SET status = ?, updated_at = ? WHERE id = ?
    `)
    
    updateStatus.run(
      status,
      new Date().toISOString(),
      messageId
    )
  }
  
  private generateMigrationSummary(result: MigrationResult): string {
    const lines = [
      `🔄 Migration completed!`,
      ``,
      `📊 **Summary:**`,
      `• Messages processed: ${result.messagesProcessed}`,
      `• Messages imported: ${result.messagesImported}`,
      `• Participants created: ${result.participantsCreated}`,
      `• Errors encountered: ${result.errors.length}`,
      ``
    ]
    
    if (result.errors.length > 0) {
      lines.push(`❌ **Errors:**`)
      for (const error of result.errors.slice(0, 5)) { // Show first 5 errors
        lines.push(`• ${error.message}: ${error.error}`)
      }
      if (result.errors.length > 5) {
        lines.push(`• ... and ${result.errors.length - 5} more errors`)
      }
      lines.push(``)
    }
    
    const successRate = result.messagesProcessed > 0 
      ? Math.round((result.messagesImported / result.messagesProcessed) * 100)
      : 0
    
    lines.push(`✅ **Success Rate:** ${successRate}%`)
    
    if (result.messagesImported > 0) {
      lines.push(``)
      lines.push(`🎉 Your legacy coordination data has been successfully imported!`)
      lines.push(`Run \`ccp status\` to verify the import and \`ccp list\` to see your messages.`)
    }
    
    return lines.join('\n')
  }
  
  /**
   * Export current coordination data to legacy format
   */
  async exportToLegacyFormat(outputPath: string): Promise<void> {
    try {
      const messages = await this.messageManager.getMessages({
        limit: 1000,
        detail_level: 'summary'
      }, '@system' as ParticipantId) // System can see all messages
      
      const lines = [
        '# Exported Coordination Messages',
        `*Generated on: ${new Date().toISOString()}*`,
        '',
        '## Active Messages',
        ''
      ]
      
      messages.forEach((msg, index) => {
        const statusIcon = msg.status === 'resolved' ? '✅ ' : ''
        const statusText = msg.status.toUpperCase()
        
        lines.push(`${index + 1}. **${msg.id}**: ${msg.subject}`)
        lines.push(`   - FROM: ${msg.from} TO: ${msg.to.join(', ')} PRIORITY: ${msg.priority}`)
        lines.push(`   - Status: ${statusIcon}${statusText}`)
        lines.push(`   - ${msg.summary.substring(0, 200)}${msg.summary.length > 200 ? '...' : ''}`)
        lines.push('')
      })
      
      await fs.writeFile(outputPath, lines.join('\n'), 'utf-8')
      
    } catch (error: any) {
      throw new DatabaseError(
        `Failed to export to ${outputPath}: ${error.message}`,
        { outputPath, error: error.message }
      )
    }
  }
}
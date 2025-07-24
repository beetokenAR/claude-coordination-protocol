import { CoordinationDatabase } from '../database/connection.js'
import { validateInput } from '../utils/validation.js'
import {
  CoordinationMessage,
  SearchMessagesInput,
  SearchResult,
  ParticipantId,
  DatabaseError
} from '../types/index.js'

export class IndexingEngine {
  private db: CoordinationDatabase
  
  // Prepared statements for search
  private searchMessagesFTS: any
  private searchMessagesByTags: any
  private searchMessagesByDateRange: any
  private updateMessageTags: any
  
  constructor(db: CoordinationDatabase) {
    this.db = db
    this.prepareStatements()
  }
  
  private prepareStatements(): void {
    // Full-text search using FTS5
    this.searchMessagesFTS = this.db.prepare(`
      SELECT m.*, fts.rank
      FROM messages_fts fts
      JOIN messages m ON m.id = fts.id
      WHERE messages_fts MATCH $query
      AND ($participant IS NULL OR m.from_participant = $participant OR m.to_participants LIKE '%"' || $participant || '"%')
      AND ($dateFrom IS NULL OR m.created_at >= $dateFrom)
      AND ($dateTo IS NULL OR m.created_at <= $dateTo)
      ORDER BY fts.rank, m.created_at DESC
      LIMIT $limit
    `)
    
    // Search by tags using JSON operations
    this.searchMessagesByTags = this.db.prepare(`
      SELECT * FROM messages
      WHERE ($participant IS NULL OR from_participant = $participant OR to_participants LIKE '%"' || $participant || '"%')
      AND ($tags IS NULL OR EXISTS (
        SELECT 1 FROM json_each($tags) tag
        WHERE messages.tags LIKE '%"' || tag.value || '"%'
      ))
      AND ($dateFrom IS NULL OR created_at >= $dateFrom)
      AND ($dateTo IS NULL OR created_at <= $dateTo)
      ORDER BY 
        CASE priority 
          WHEN 'CRITICAL' THEN 1
          WHEN 'H' THEN 2 
          WHEN 'M' THEN 3
          WHEN 'L' THEN 4
        END,
        created_at DESC
      LIMIT $limit
    `)
    
    // Update message tags for indexing
    this.updateMessageTags = this.db.prepare(`
      UPDATE messages SET tags = ? WHERE id = ?
    `)
  }
  
  /**
   * Search messages using full-text search and filters
   */
  async searchMessages(
    input: SearchMessagesInput,
    requestingParticipant: ParticipantId
  ): Promise<SearchResult[]> {
    const validated = validateInput(SearchMessagesInput, input, 'search messages')
    
    try {
      let results: any[] = []
      
      if (validated.semantic && validated.query.trim()) {
        // Full-text search
        results = this.searchMessagesFTS.all({
          query: this.prepareFTSQuery(validated.query),
          participant: requestingParticipant,
          dateFrom: validated.date_range?.from?.toISOString() || null,
          dateTo: validated.date_range?.to?.toISOString() || null,
          limit: validated.limit
        })
      } else if (validated.tags && validated.tags.length > 0) {
        // Tag-based search
        results = this.searchMessagesByTags.all({
          participant: requestingParticipant,
          tags: JSON.stringify(validated.tags),
          dateFrom: validated.date_range?.from?.toISOString() || null,
          dateTo: validated.date_range?.to?.toISOString() || null,
          limit: validated.limit
        })
      } else {
        // Simple keyword search in subject/summary
        const keywordQuery = validated.query.trim()
        if (keywordQuery) {
          results = this.db.prepare(`
            SELECT * FROM messages
            WHERE (from_participant = ? OR to_participants LIKE '%"' || ? || '"%')
            AND (subject LIKE '%' || ? || '%' OR summary LIKE '%' || ? || '%')
            AND (? IS NULL OR created_at >= ?)
            AND (? IS NULL OR created_at <= ?)
            ORDER BY created_at DESC
            LIMIT ?
          `).all(
            requestingParticipant, requestingParticipant,
            keywordQuery, keywordQuery,
            validated.date_range?.from?.toISOString() || null,
            validated.date_range?.from?.toISOString() || null,
            validated.date_range?.to?.toISOString() || null,
            validated.date_range?.to?.toISOString() || null,
            validated.limit
          )
        }
      }
      
      // Convert to search results with relevance scores
      return results.map((row, index) => ({
        message: this.rowToMessage(row),
        relevance_score: row.rank ? this.normalizeRank(row.rank) : 1.0 - (index * 0.1),
        match_context: this.extractMatchContext(row, validated.query) || ''
      }))
      
    } catch (error: any) {
      throw new DatabaseError(
        `Search failed: ${error.message}`,
        { query: validated.query, error: error.message }
      )
    }
  }
  
  /**
   * Index message content for improved searchability
   */
  async indexMessage(message: CoordinationMessage): Promise<void> {
    try {
      // Extract and normalize tags for better searchability
      const enhancedTags = this.enhanceMessageTags(message)
      
      if (enhancedTags.length > message.tags.length) {
        // Update message with enhanced tags
        this.updateMessageTags.run(
          JSON.stringify(enhancedTags),
          message.id
        )
      }
      
      // The FTS table is automatically updated via triggers
      
    } catch (error: any) {
      throw new DatabaseError(
        `Failed to index message: ${error.message}`,
        { messageId: message.id, error: error.message }
      )
    }
  }
  
  /**
   * Get tag suggestions based on existing messages
   */
  async getTagSuggestions(
    query: string,
    requestingParticipant: ParticipantId,
    limit = 10
  ): Promise<string[]> {
    try {
      const results = this.db.prepare(`
        SELECT DISTINCT tag.value as tag, COUNT(*) as usage_count
        FROM messages m, json_each(m.tags) tag
        WHERE (m.from_participant = ? OR m.to_participants LIKE '%"' || ? || '"%')
        AND tag.value LIKE '%' || ? || '%'
        GROUP BY tag.value
        ORDER BY usage_count DESC, tag.value
        LIMIT ?
      `).all(requestingParticipant, requestingParticipant, query, limit) as Array<{ tag: string, usage_count: number }>
      
      return results.map(r => r.tag)
      
    } catch (error: any) {
      throw new DatabaseError(
        `Failed to get tag suggestions: ${error.message}`,
        { query, error: error.message }
      )
    }
  }
  
  /**
   * Get message statistics for analytics
   */
  async getMessageStats(
    participantId: ParticipantId,
    days = 30
  ): Promise<{
    total_messages: number
    messages_sent: number
    messages_received: number
    by_type: Record<string, number>
    by_priority: Record<string, number>
    by_status: Record<string, number>
    response_rate: number
    avg_response_time_hours: number
  }> {
    const since = new Date()
    since.setDate(since.getDate() - days)
    
    try {
      // Get message counts
      const totalMessages = this.db.prepare(`
        SELECT COUNT(*) as count FROM messages
        WHERE (from_participant = ? OR to_participants LIKE '%"' || ? || '"%')
        AND created_at >= ?
      `).get(participantId, participantId, since.toISOString()) as { count: number }
      
      const messagesSent = this.db.prepare(`
        SELECT COUNT(*) as count FROM messages
        WHERE from_participant = ? AND created_at >= ?
      `).get(participantId, since.toISOString()) as { count: number }
      
      const messagesReceived = totalMessages.count - messagesSent.count
      
      // Get distribution by type
      const byType = this.db.prepare(`
        SELECT type, COUNT(*) as count FROM messages
        WHERE (from_participant = ? OR to_participants LIKE '%"' || ? || '"%')
        AND created_at >= ?
        GROUP BY type
      `).all(participantId, participantId, since.toISOString()) as Array<{ type: string, count: number }>
      
      // Get distribution by priority
      const byPriority = this.db.prepare(`
        SELECT priority, COUNT(*) as count FROM messages
        WHERE (from_participant = ? OR to_participants LIKE '%"' || ? || '"%')
        AND created_at >= ?
        GROUP BY priority
      `).all(participantId, participantId, since.toISOString()) as Array<{ priority: string, count: number }>
      
      // Get distribution by status
      const byStatus = this.db.prepare(`
        SELECT status, COUNT(*) as count FROM messages
        WHERE (from_participant = ? OR to_participants LIKE '%"' || ? || '"%')
        AND created_at >= ?
        GROUP BY status
      `).all(participantId, participantId, since.toISOString()) as Array<{ status: string, count: number }>
      
      // Calculate response rate and time
      const responseStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_requiring_response,
          COUNT(CASE WHEN status IN ('responded', 'resolved') THEN 1 END) as responded,
          AVG(
            CASE WHEN resolved_at IS NOT NULL 
            THEN (julianday(resolved_at) - julianday(created_at)) * 24 
            END
          ) as avg_response_hours
        FROM messages
        WHERE to_participants LIKE '%"' || ? || '"%'
        AND response_required = 1
        AND created_at >= ?
      `).get(participantId, since.toISOString()) as {
        total_requiring_response: number
        responded: number
        avg_response_hours: number | null
      }
      
      const responseRate = responseStats.total_requiring_response > 0 
        ? responseStats.responded / responseStats.total_requiring_response 
        : 0
      
      return {
        total_messages: totalMessages.count,
        messages_sent: messagesSent.count,
        messages_received: messagesReceived,
        by_type: Object.fromEntries(byType.map(r => [r.type, r.count])),
        by_priority: Object.fromEntries(byPriority.map(r => [r.priority, r.count])),
        by_status: Object.fromEntries(byStatus.map(r => [r.status, r.count])),
        response_rate: responseRate,
        avg_response_time_hours: responseStats.avg_response_hours || 0
      }
      
    } catch (error: any) {
      throw new DatabaseError(
        `Failed to get message statistics: ${error.message}`,
        { participantId, error: error.message }
      )
    }
  }
  
  /**
   * Find related messages based on content similarity
   */
  async findRelatedMessages(
    messageId: string,
    requestingParticipant: ParticipantId,
    limit = 5
  ): Promise<SearchResult[]> {
    try {
      // Get the original message
      const originalMessage = this.db.prepare('SELECT * FROM messages WHERE id = ?')
        .get(messageId) as any
      
      if (!originalMessage) {
        return []
      }
      
      // Find messages with similar tags or subject keywords
      const keywords = this.extractKeywords(originalMessage.subject + ' ' + originalMessage.summary)
      if (keywords.length === 0) {
        return []
      }
      
      const query = keywords.join(' OR ')
      const results = this.searchMessagesFTS.all({
        query: query,
        participant: requestingParticipant,
        dateFrom: null, // No date filter
        dateTo: null, // No date filter
        limit: limit + 1 // +1 to exclude the original message
      })
      
      // Filter out the original message and convert to SearchResult
      return results
        .filter((row: any) => row.id !== messageId)
        .slice(0, limit)
        .map((row: any, index: number) => ({
          message: this.rowToMessage(row),
          relevance_score: row.rank ? this.normalizeRank(row.rank) : 1.0 - (index * 0.1),
          match_context: this.extractMatchContext(row, query) || ''
        }))
        
    } catch (error: any) {
      throw new DatabaseError(
        `Failed to find related messages: ${error.message}`,
        { messageId, error: error.message }
      )
    }
  }
  
  private prepareFTSQuery(query: string): string {
    // Escape and prepare query for FTS5
    const sanitized = query
      .replace(/[^\w\s-]/g, ' ') // Remove special chars except word chars, spaces, hyphens
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
    
    if (!sanitized) {
      return '""' // Empty query
    }
    
    // Split into words and create phrase/prefix queries
    const words = sanitized.split(' ').filter(w => w.length > 0)
    if (words.length === 1) {
      return `"${words[0]}"*` // Prefix match for single word
    }
    
    // For multiple words, try exact phrase first, then individual words
    const phraseQuery = `"${sanitized}"`
    const wordQueries = words.map(w => `"${w}"`).join(' OR ')
    
    return `(${phraseQuery}) OR (${wordQueries})`
  }
  
  private enhanceMessageTags(message: CoordinationMessage): string[] {
    const tags = new Set(message.tags)
    
    // Add automatic tags based on content
    const content = message.subject + ' ' + message.summary
    
    // Technology tags
    const techKeywords = [
      'api', 'endpoint', 'database', 'auth', 'login', 'security',
      'frontend', 'backend', 'ui', 'ux', 'component', 'service',
      'bug', 'fix', 'error', 'issue', 'performance', 'optimization'
    ]
    
    for (const keyword of techKeywords) {
      if (content.toLowerCase().includes(keyword)) {
        tags.add(keyword)
      }
    }
    
    // Priority-based tags
    if (message.priority === 'CRITICAL') {
      tags.add('urgent')
    }
    
    // Type-based tags
    tags.add(message.type)
    
    return Array.from(tags)
  }
  
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - in production, might use more sophisticated NLP
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3) // Only words longer than 3 chars
      .filter(word => !this.isStopWord(word))
    
    // Return unique words
    return Array.from(new Set(words))
  }
  
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
    ])
    
    return stopWords.has(word)
  }
  
  private normalizeRank(rank: number): number {
    // FTS5 rank is negative (better matches have more negative values)
    // Convert to 0-1 scale where 1 is best match
    return Math.max(0, Math.min(1, 1 + rank))
  }
  
  private extractMatchContext(row: any, query: string): string | undefined {
    // Extract context around matching terms
    const content = row.subject + ' ' + row.summary
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 0)
    
    for (const word of queryWords) {
      const index = content.toLowerCase().indexOf(word)
      if (index !== -1) {
        const start = Math.max(0, index - 50)
        const end = Math.min(content.length, index + word.length + 50)
        return content.substring(start, end)
      }
    }
    
    return undefined
  }
  
  private rowToMessage(row: any): CoordinationMessage {
    return {
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
      resolution_status: row.resolution_status,
      resolved_at: row.resolved_at ? new Date(row.resolved_at) : undefined,
      resolved_by: row.resolved_by as ParticipantId | undefined
    }
  }
}
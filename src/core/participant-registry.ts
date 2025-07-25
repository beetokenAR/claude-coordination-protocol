import { CoordinationDatabase } from '../database/connection.js'
import { validateInput, validateParticipantId } from '../utils/validation.js'
import type { Statement } from 'better-sqlite3'
import {
  Participant,
  ParticipantRow,
  ParticipantId,
  Priority,
  ValidationError,
  PermissionError,
} from '../types/index.js'

export class ParticipantRegistry {
  private db: CoordinationDatabase
  private dataDir: string

  // Prepared statements
  private insertParticipant: Statement
  private updateParticipantStmt: Statement
  private selectParticipant: Statement
  private selectAllParticipants: Statement
  private deleteParticipant: Statement
  private updateLastSeenStmt: Statement

  constructor(db: CoordinationDatabase, dataDir: string) {
    this.db = db
    this.dataDir = dataDir
    this.prepareStatements()
  }

  private prepareStatements(): void {
    this.insertParticipant = this.db.prepare(`
      INSERT INTO participants (id, capabilities, last_seen, status, preferences, default_priority)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    this.updateParticipantStmt = this.db.prepare(`
      UPDATE participants SET
        capabilities = ?, status = ?, preferences = ?, default_priority = ?
      WHERE id = ?
    `)

    this.selectParticipant = this.db.prepare('SELECT * FROM participants WHERE id = ?')

    this.selectAllParticipants = this.db.prepare(`
      SELECT * FROM participants 
      WHERE ($status IS NULL OR status = $status)
      ORDER BY id
    `)

    this.deleteParticipant = this.db.prepare('DELETE FROM participants WHERE id = ?')

    this.updateLastSeenStmt = this.db.prepare(`
      UPDATE participants SET last_seen = ? WHERE id = ?
    `)
  }

  /**
   * Register a new participant
   */
  async registerParticipant(
    participant: Omit<Participant, 'last_seen' | 'status'>
  ): Promise<Participant> {
    const validated = validateInput(
      Participant.omit({ last_seen: true, status: true }),
      participant,
      'register participant'
    )

    // Check if participant already exists
    const existing = this.selectParticipant.get(validated.id) as ParticipantRow | undefined
    if (existing) {
      throw new ValidationError(`Participant already exists: ${validated.id}`)
    }

    const now = new Date().toISOString()
    const newParticipant: Participant = {
      id: validated.id,
      capabilities: validated.capabilities,
      last_seen: new Date(),
      status: 'active' as const,
      preferences: validated.preferences,
      default_priority: validated.default_priority ?? 'M',
    }

    // Insert into database
    this.insertParticipant.run(
      newParticipant.id,
      JSON.stringify(newParticipant.capabilities),
      now,
      newParticipant.status,
      JSON.stringify(newParticipant.preferences || {}),
      newParticipant.default_priority
    )

    return newParticipant
  }

  /**
   * Get participant by ID
   */
  async getParticipant(participantId: ParticipantId): Promise<Participant | null> {
    validateParticipantId(participantId)

    const row = this.selectParticipant.get(participantId) as ParticipantRow | undefined
    if (!row) {
      return null
    }

    return this.rowToParticipant(row)
  }

  /**
   * Get all participants, optionally filtered by status
   */
  async getParticipants(status?: 'active' | 'inactive' | 'maintenance'): Promise<Participant[]> {
    const rows = this.selectAllParticipants.all({
      status: status || null,
    }) as ParticipantRow[]

    return rows.map(row => this.rowToParticipant(row))
  }

  /**
   * Update participant information
   */
  async updateParticipant(
    participantId: ParticipantId,
    updates: Partial<
      Pick<Participant, 'capabilities' | 'status' | 'preferences' | 'default_priority'>
    >,
    requestingParticipant: ParticipantId
  ): Promise<Participant> {
    validateParticipantId(participantId)

    // Check permissions - only self or admin can update
    if (participantId !== requestingParticipant && !(await this.isAdmin(requestingParticipant))) {
      throw new PermissionError(`Not authorized to update participant: ${participantId}`)
    }

    const existing = await this.getParticipant(participantId)
    if (!existing) {
      throw new ValidationError(`Participant not found: ${participantId}`)
    }

    const updated: Participant = {
      ...existing,
      ...updates,
    }

    // Validate the updated participant
    const validated = validateInput(Participant, updated, 'update participant')

    this.updateParticipantStmt.run(
      JSON.stringify(validated.capabilities),
      validated.status,
      JSON.stringify(validated.preferences || {}),
      validated.default_priority,
      validated.id
    )

    return validated
  }

  /**
   * Update participant's last seen timestamp
   */
  async updateLastSeen(participantId: ParticipantId): Promise<void> {
    validateParticipantId(participantId)

    const now = new Date().toISOString()
    this.updateLastSeenStmt.run(now, participantId)
  }

  /**
   * Deactivate participant (soft delete)
   */
  async deactivateParticipant(
    participantId: ParticipantId,
    requestingParticipant: ParticipantId
  ): Promise<void> {
    validateParticipantId(participantId)

    // Check permissions
    if (participantId !== requestingParticipant && !(await this.isAdmin(requestingParticipant))) {
      throw new PermissionError(`Not authorized to deactivate participant: ${participantId}`)
    }

    await this.updateParticipant(participantId, { status: 'inactive' }, requestingParticipant)
  }

  /**
   * Permanently remove participant (hard delete)
   * Only admins can do this, and it should be used carefully
   */
  async removeParticipant(
    participantId: ParticipantId,
    requestingParticipant: ParticipantId
  ): Promise<void> {
    validateParticipantId(participantId)

    // Only admins can permanently remove participants
    if (!(await this.isAdmin(requestingParticipant))) {
      throw new PermissionError('Only admins can permanently remove participants')
    }

    // Check if participant has active messages
    const hasActiveMessages = this.db
      .prepare(
        `
      SELECT COUNT(*) as count FROM messages 
      WHERE (from_participant = ? OR to_participants LIKE '%"' || ? || '"%')
      AND status IN ('pending', 'read', 'responded')
    `
      )
      .get(participantId, participantId) as { count: number }

    if (hasActiveMessages.count > 0) {
      throw new ValidationError(
        `Cannot remove participant with active messages: ${participantId}`,
        { activeMessageCount: hasActiveMessages.count }
      )
    }

    this.deleteParticipant.run(participantId)
  }

  /**
   * Check if participant has admin capabilities
   */
  async isAdmin(participantId: ParticipantId): Promise<boolean> {
    const participant = await this.getParticipant(participantId)
    if (!participant) {
      return false
    }

    return participant.capabilities.includes('admin') || participant.capabilities.includes('system')
  }

  /**
   * Check if participant can access message
   */
  async canAccessMessage(
    participantId: ParticipantId,
    messageFromParticipant: ParticipantId,
    messageToParticipants: ParticipantId[]
  ): Promise<boolean> {
    // Admin can access all messages
    if (await this.isAdmin(participantId)) {
      return true
    }

    // Sender can access their own messages
    if (participantId === messageFromParticipant) {
      return true
    }

    // Recipients can access messages sent to them
    if (messageToParticipants.includes(participantId)) {
      return true
    }

    return false
  }

  /**
   * Check if participant can send message to target participants
   */
  async canSendMessage(
    fromParticipant: ParticipantId,
    toParticipants: ParticipantId[]
  ): Promise<boolean> {
    const sender = await this.getParticipant(fromParticipant)
    if (!sender || sender.status !== 'active') {
      return false
    }

    // Check if all target participants exist and are active
    for (const targetId of toParticipants) {
      const target = await this.getParticipant(targetId)
      if (!target || target.status === 'inactive') {
        return false
      }
    }

    return true
  }

  /**
   * Get participant's default message priority
   */
  async getDefaultPriority(participantId: ParticipantId): Promise<Priority> {
    const participant = await this.getParticipant(participantId)
    return participant?.default_priority || 'M'
  }

  /**
   * Get active participants by capability
   */
  async getParticipantsByCapability(capability: string): Promise<Participant[]> {
    const allParticipants = await this.getParticipants('active')
    return allParticipants.filter(p => p.capabilities.includes(capability))
  }

  /**
   * Get participant statistics
   */
  async getParticipantStats(): Promise<{
    total: number
    active: number
    inactive: number
    maintenance: number
    by_capability: Record<string, number>
  }> {
    const allParticipants = await this.getParticipants()

    const stats = {
      total: allParticipants.length,
      active: allParticipants.filter(p => p.status === 'active').length,
      inactive: allParticipants.filter(p => p.status === 'inactive').length,
      maintenance: allParticipants.filter(p => p.status === 'maintenance').length,
      by_capability: {} as Record<string, number>,
    }

    // Count participants by capability
    const capabilityCount = new Map<string, number>()
    for (const participant of allParticipants) {
      for (const capability of participant.capabilities) {
        capabilityCount.set(capability, (capabilityCount.get(capability) || 0) + 1)
      }
    }

    stats.by_capability = Object.fromEntries(capabilityCount)

    return stats
  }

  /**
   * Cleanup inactive participants that haven't been seen for a long time
   */
  async cleanupStaleParticipants(daysInactive = 90): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive)

    const staleParticipants = this.db
      .prepare(
        `
      SELECT id FROM participants 
      WHERE status = 'inactive' 
      AND (last_seen IS NULL OR last_seen < ?)
    `
      )
      .all(cutoffDate.toISOString()) as Array<{ id: string }>

    if (staleParticipants.length === 0) {
      return 0
    }

    // Remove stale participants
    this.db.transaction(() => {
      for (const { id } of staleParticipants) {
        this.deleteParticipant.run(id)
      }
    })

    return staleParticipants.length
  }

  private rowToParticipant(row: ParticipantRow): Participant {
    return {
      id: row.id as ParticipantId,
      capabilities: JSON.parse(row.capabilities),
      last_seen: row.last_seen ? new Date(row.last_seen) : undefined,
      status: row.status,
      preferences: row.preferences ? JSON.parse(row.preferences) : undefined,
      default_priority: row.default_priority,
    }
  }
}

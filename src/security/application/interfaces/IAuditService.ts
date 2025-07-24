/**
 * @fileoverview Interfaz del servicio de auditoría
 * Responsabilidad: Definir el contrato para logging de eventos de seguridad
 */

export interface AuditEventData {
  [key: string]: any
}

export interface IAuditService {
  /**
   * Registra un evento de autenticación exitosa
   */
  logAuthenticationSuccess(participantId: string): Promise<void>

  /**
   * Registra un fallo de autenticación
   */
  logAuthenticationFailure(
    participantId: string,
    reason: string,
    details?: string
  ): Promise<void>

  /**
   * Registra eventos de seguridad generales
   */
  logSecurityEvent(
    participantId: string,
    eventType: string,
    data?: AuditEventData
  ): Promise<void>

  /**
   * Registra acciones administrativas
   */
  logAdminAction(
    adminId: string,
    action: string,
    data?: AuditEventData
  ): Promise<void>

  /**
   * Registra errores del sistema
   */
  logSystemError(
    errorType: string,
    errorMessage: string,
    data?: AuditEventData
  ): Promise<void>

  /**
   * Obtiene eventos de auditoría por participante
   */
  getEventsForParticipant(
    participantId: string,
    limit?: number
  ): Promise<AuditEvent[]>

  /**
   * Obtiene eventos de seguridad por tipo
   */
  getEventsByType(
    eventType: string,
    limit?: number
  ): Promise<AuditEvent[]>

  /**
   * Obtiene estadísticas de seguridad
   */
  getSecurityStats(timeRange?: TimeRange): Promise<SecurityStats>
}

export interface AuditEvent {
  id: string
  timestamp: Date
  participantId?: string
  eventType: string
  data?: AuditEventData
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export interface TimeRange {
  from: Date
  to: Date
}

export interface SecurityStats {
  authenticationAttempts: {
    successful: number
    failed: number
    total: number
  }
  authorizationEvents: {
    granted: number
    denied: number
    total: number
  }
  securityEvents: {
    byType: Record<string, number>
    bySeverity: Record<string, number>
    total: number
  }
  participantStats: {
    active: number
    locked: number
    inactive: number
    total: number
  }
}
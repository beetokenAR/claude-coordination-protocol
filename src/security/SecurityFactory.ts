/**
 * @fileoverview Factory de servicios de seguridad
 * Responsabilidad: Crear e integrar todos los componentes de seguridad
 */

import { AuthenticationService } from './application/services/AuthenticationService.js'
import { AuthorizationService } from './application/services/AuthorizationService.js'
import { AuditService } from './infrastructure/services/AuditService.js'
import { SecureParticipantRepository } from './infrastructure/repositories/SecureParticipantRepository.js'
import { IParticipantRepository } from './application/interfaces/IParticipantRepository.js'
import { IAuditService } from './application/interfaces/IAuditService.js'
import { ParticipantId } from './domain/values/ParticipantId.js'
import { SecureParticipant } from './domain/entities/SecureParticipant.js'
import { SecurityLevel } from './domain/values/SecurityLevel.js'
import { Permission } from './domain/values/Permission.js'
import { AuthorizationRequest, AuthorizationResult } from './application/services/AuthorizationService.js'

export interface SecurityConfig {
  databasePath: string
  auditDatabasePath?: string
  enableAuditLogging?: boolean
  maxFailedAttempts?: number
  lockoutDurationMinutes?: number
}

export interface SecurityServices {
  authenticationService: AuthenticationService
  authorizationService: AuthorizationService
  auditService: IAuditService
  participantRepository: IParticipantRepository
}

export class SecurityFactory {
  private static instance: SecurityFactory | null = null
  private services: SecurityServices | null = null

  private constructor(private config: SecurityConfig) {}

  /**
   * Obtiene la instancia singleton del factory
   */
  public static getInstance(config?: SecurityConfig): SecurityFactory {
    if (!SecurityFactory.instance) {
      if (!config) {
        throw new Error('SecurityFactory requires configuration on first initialization')
      }
      SecurityFactory.instance = new SecurityFactory(config)
    }
    return SecurityFactory.instance
  }

  /**
   * Inicializa todos los servicios de seguridad
   */
  public async initialize(): Promise<SecurityServices> {
    if (this.services) {
      return this.services
    }

    // Crear repositorio de participantes
    const participantRepository = new SecureParticipantRepository(this.config.databasePath)

    // Crear servicio de auditoría
    const auditDatabasePath = this.config.auditDatabasePath || 
      this.config.databasePath.replace('.db', '_audit.db')
    const auditService = new AuditService(auditDatabasePath)

    // Crear servicios de aplicación
    const authenticationService = new AuthenticationService(
      participantRepository,
      auditService
    )

    const authorizationService = new AuthorizationService(auditService)

    this.services = {
      authenticationService,
      authorizationService,
      auditService,
      participantRepository
    }

    // Log de inicialización
    await auditService.logSystemError(
      'SECURITY_SYSTEM_INITIALIZED',
      'Security services initialized successfully',
      {
        databasePath: this.config.databasePath,
        auditPath: auditDatabasePath,
        timestamp: new Date().toISOString()
      }
    )

    return this.services
  }

  /**
   * Obtiene los servicios (deben estar inicializados)
   */
  public getServices(): SecurityServices {
    if (!this.services) {
      throw new Error('Security services not initialized. Call initialize() first.')
    }
    return this.services
  }

  /**
   * Autentica un participante
   */
  public async authenticate(participantId: string): Promise<SecureParticipant | null> {
    const services = this.getServices()
    return services.authenticationService.authenticate(participantId)
  }

  /**
   * Autoriza una acción
   */
  public async authorize(request: AuthorizationRequest): Promise<AuthorizationResult> {
    const services = this.getServices()
    return services.authorizationService.authorize(request)
  }

  /**
   * Registra un nuevo participante
   */
  public async registerParticipant(
    participantId: string,
    capabilities: string[],
    securityLevel: SecurityLevel = SecurityLevel.STANDARD
  ): Promise<SecureParticipant> {
    const services = this.getServices()
    
    const id = ParticipantId.create(participantId)
    const participant = SecureParticipant.create(id, capabilities, securityLevel)
    
    await services.participantRepository.save(participant)
    
    await services.auditService.logSecurityEvent(
      participantId,
      'PARTICIPANT_REGISTERED',
      {
        capabilities: capabilities,
        securityLevel: securityLevel,
        timestamp: new Date().toISOString()
      }
    )

    return participant
  }

  /**
   * Desactiva un participante
   */
  public async deactivateParticipant(
    participantId: string,
    adminId: string,
    reason: string
  ): Promise<boolean> {
    const services = this.getServices()
    return services.authenticationService.deactivateParticipant(
      participantId,
      adminId,
      reason
    )
  }

  /**
   * Obtiene estadísticas de seguridad
   */
  public async getSecurityStats() {
    const services = this.getServices()
    const auditStats = await services.auditService.getSecurityStats()
    const participantStats = await services.participantRepository.countByStatus()
    
    return {
      ...auditStats,
      participantStats
    }
  }

  /**
   * Verifica el estado de un participante
   */
  public async getParticipantStatus(participantId: string) {
    const services = this.getServices()
    const id = ParticipantId.create(participantId)
    const participant = await services.participantRepository.findById(id)
    
    if (!participant) {
      return null
    }

    return {
      id: participant.id.value,
      isActive: participant.isActive,
      isLocked: participant.isLocked,
      securityLevel: participant.securityLevel,
      failedAttempts: participant.failedAttempts,
      lastSeen: participant.lastSeen,
      capabilities: Array.from(participant.capabilities),
      permissions: Array.from(participant.permissions)
    }
  }

  /**
   * Valida permisos para una acción específica
   */
  public async hasPermission(
    participantId: string,
    permission: Permission,
    resourceId?: string,
    resourceType?: string
  ): Promise<{ granted: boolean; reason: string }> {
    try {
      const participant = await this.authenticate(participantId)
      
      if (!participant) {
        return { granted: false, reason: 'Participant not found or not authenticated' }
      }

      const result = await this.authorize({
        participant,
        requiredPermission: permission,
        resourceId,
        resourceType
      })

      return { granted: result.granted, reason: result.reason }
      
    } catch (error) {
      const services = this.getServices()
      await services.auditService.logSystemError(
        'PERMISSION_CHECK_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        { participantId, permission, resourceId, resourceType }
      )
      
      return { granted: false, reason: 'Permission check failed' }
    }
  }

  /**
   * Ejecuta una acción con verificación de permisos
   */
  public async executeWithPermission<T>(
    participantId: string,
    permission: Permission,
    action: (participant: SecureParticipant) => Promise<T>,
    options?: {
      resourceId?: string
      resourceType?: string
      additionalContext?: Record<string, any>
    }
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    try {
      const participant = await this.authenticate(participantId)
      
      if (!participant) {
        return { success: false, error: 'Authentication failed' }
      }

      const authResult = await this.authorize({
        participant,
        requiredPermission: permission,
        resourceId: options?.resourceId,
        resourceType: options?.resourceType,
        additionalContext: options?.additionalContext
      })

      if (!authResult.granted) {
        return { success: false, error: authResult.reason }
      }

      const result = await action(participant)
      return { success: true, result }
      
    } catch (error) {
      const services = this.getServices()
      await services.auditService.logSystemError(
        'SECURE_ACTION_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        { participantId, permission, ...options }
      )
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Action execution failed' 
      }
    }
  }

  /**
   * Cierra todos los servicios y conexiones
   */
  public async shutdown(): Promise<void> {
    if (this.services) {
      // Cerrar repositorio
      if ('close' in this.services.participantRepository) {
        (this.services.participantRepository as any).close()
      }

      // Cerrar servicio de auditoría
      if ('close' in this.services.auditService) {
        (this.services.auditService as any).close()
      }

      await this.services.auditService.logSystemError(
        'SECURITY_SYSTEM_SHUTDOWN',
        'Security services shutdown completed',
        { timestamp: new Date().toISOString() }
      )

      this.services = null
    }

    SecurityFactory.instance = null
  }

  /**
   * Configuración por defecto para desarrollo
   */
  public static createDevelopmentConfig(basePath: string = '.coordination'): SecurityConfig {
    return {
      databasePath: `${basePath}/security.db`,
      auditDatabasePath: `${basePath}/audit.db`,
      enableAuditLogging: true,
      maxFailedAttempts: 5,
      lockoutDurationMinutes: 15
    }
  }

  /**
   * Configuración para producción
   */
  public static createProductionConfig(basePath: string): SecurityConfig {
    return {
      databasePath: `${basePath}/security.db`,
      auditDatabasePath: `${basePath}/audit.db`,
      enableAuditLogging: true,
      maxFailedAttempts: 3,
      lockoutDurationMinutes: 30
    }
  }
}
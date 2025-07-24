/**
 * @fileoverview Servicio de autorización
 * Responsabilidad: Verificar permisos y controlar acceso a recursos
 */

import { SecureParticipant } from '../../domain/entities/SecureParticipant.js'
import { Permission, PermissionUtils } from '../../domain/values/Permission.js'
// import { SecurityLevel, SecurityLevelUtils } from '../../domain/values/SecurityLevel.js'
import { IAuditService } from '../interfaces/IAuditService.js'

export interface AuthorizationRequest {
  participant: SecureParticipant
  requiredPermission: Permission
  resourceId?: string
  resourceType?: string
  additionalContext?: Record<string, any>
}

export interface AuthorizationResult {
  granted: boolean
  reason: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export class AuthorizationService {
  constructor(
    private readonly auditService: IAuditService
  ) {}

  /**
   * Autoriza una acción (simplificado para uso público)
   */
  async authorize(request: AuthorizationRequest): Promise<AuthorizationResult> {
    const { participant, requiredPermission, resourceId } = request

    // Solo verificación básica de participante activo
    if (!participant.isActive) {
      await this.logAuthorizationDenied(participant, requiredPermission, 'PARTICIPANT_INACTIVE')
      return {
        granted: false,
        reason: 'Participant is not active',
        riskLevel: 'LOW'
      }
    }

    // En modo público, validamos solo el tamaño del mensaje si es aplicable
    if (request.additionalContext?.messageLength) {
      const maxLength = 100 * 1024 // 100KB
      if (request.additionalContext.messageLength > maxLength) {
        await this.logAuthorizationDenied(participant, requiredPermission, 'MESSAGE_TOO_LARGE')
        return {
          granted: false,
          reason: `Message length ${request.additionalContext.messageLength} exceeds limit ${maxLength}`,
          riskLevel: 'LOW'
        }
      }
    }

    // Log de autorización exitosa
    await this.logAuthorizationGranted(participant, requiredPermission, resourceId)

    return {
      granted: true,
      reason: 'Authorization granted',
      riskLevel: 'LOW'
    }
  }

  // Métodos enterprise eliminados - no necesarios para uso público

  /**
   * Log de autorización denegada
   */
  private async logAuthorizationDenied(
    participant: SecureParticipant,
    permission: Permission,
    reason: string
  ): Promise<void> {
    await this.auditService.logSecurityEvent(
      participant.id.value,
      'AUTHORIZATION_DENIED',
      {
        permission,
        reason,
        securityLevel: participant.securityLevel,
        failedAttempts: participant.failedAttempts
      }
    )
  }

  /**
   * Log de autorización concedida
   */
  private async logAuthorizationGranted(
    participant: SecureParticipant,
    permission: Permission,
    resourceId?: string
  ): Promise<void> {
    await this.auditService.logSecurityEvent(
      participant.id.value,
      'AUTHORIZATION_GRANTED',
      {
        permission,
        resourceId,
        securityLevel: participant.securityLevel,
        riskLevel: PermissionUtils.getPermissionRiskLevel(permission)
      }
    )
  }
}
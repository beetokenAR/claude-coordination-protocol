/**
 * @fileoverview Servicio de autenticación
 * Responsabilidad: Validar identidad de participantes y gestionar sesiones
 */

import { ParticipantId } from '../../domain/values/ParticipantId.js'
import { SecureParticipant } from '../../domain/entities/SecureParticipant.js'
import { SecurityLevel } from '../../domain/values/SecurityLevel.js'
import { IParticipantRepository } from '../interfaces/IParticipantRepository.js'
import { IAuditService } from '../interfaces/IAuditService.js'

export class AuthenticationService {
  constructor(
    private readonly participantRepository: IParticipantRepository,
    private readonly auditService: IAuditService
  ) {}

  /**
   * Autentica un participante por ID
   */
  async authenticate(participantIdValue: string): Promise<SecureParticipant | null> {
    try {
      // Validar formato del ID
      const participantId = ParticipantId.create(participantIdValue)
      
      // Buscar participante
      const participant = await this.participantRepository.findById(participantId)
      
      if (!participant) {
        await this.auditService.logAuthenticationFailure(
          participantIdValue,
          'PARTICIPANT_NOT_FOUND'
        )
        return null
      }

      // Verificar estado del participante
      if (!participant.isActive) {
        await this.auditService.logAuthenticationFailure(
          participantIdValue,
          'PARTICIPANT_INACTIVE'
        )
        return null
      }

      if (participant.isLocked) {
        await this.auditService.logAuthenticationFailure(
          participantIdValue,
          'PARTICIPANT_LOCKED'
        )
        return null
      }

      // Actualizar último acceso
      participant.updateLastSeen()
      await this.participantRepository.save(participant)

      // Log de éxito
      await this.auditService.logAuthenticationSuccess(participantIdValue)

      return participant
      
    } catch (error) {
      // Error de validación del ID
      await this.auditService.logAuthenticationFailure(
        participantIdValue,
        'INVALID_PARTICIPANT_ID',
        error instanceof Error ? error.message : 'Unknown error'
      )
      return null
    }
  }

  /**
   * Registra un intento fallido de autenticación
   */
  async recordFailedAttempt(participantIdValue: string): Promise<void> {
    try {
      const participantId = ParticipantId.create(participantIdValue)
      const participant = await this.participantRepository.findById(participantId)
      
      if (participant) {
        participant.recordFailedAttempt()
        await this.participantRepository.save(participant)
        
        await this.auditService.logSecurityEvent(
          participantIdValue,
          'FAILED_ATTEMPT_RECORDED',
          { failedAttempts: participant.failedAttempts, isLocked: participant.isLocked }
        )
      }
    } catch (error) {
      // Silent fail para evitar información sobre participantes
      await this.auditService.logSystemError(
        'FAILED_ATTEMPT_RECORDING_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  /**
   * Desbloquea un participante (solo para administradores)
   */
  async unlockParticipant(
    participantIdValue: string,
    adminId: string
  ): Promise<boolean> {
    try {
      const participantId = ParticipantId.create(participantIdValue)
      const participant = await this.participantRepository.findById(participantId)
      
      if (!participant) {
        return false
      }

      participant.activate()
      await this.participantRepository.save(participant)

      await this.auditService.logAdminAction(
        adminId,
        'PARTICIPANT_UNLOCKED',
        { targetParticipant: participantIdValue }
      )

      return true
      
    } catch (error) {
      await this.auditService.logSystemError(
        'UNLOCK_PARTICIPANT_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      )
      return false
    }
  }

  /**
   * Desactiva un participante permanentemente
   */
  async deactivateParticipant(
    participantIdValue: string,
    adminId: string,
    reason: string
  ): Promise<boolean> {
    try {
      const participantId = ParticipantId.create(participantIdValue)
      const participant = await this.participantRepository.findById(participantId)
      
      if (!participant) {
        return false
      }

      participant.deactivate()
      await this.participantRepository.save(participant)

      await this.auditService.logAdminAction(
        adminId,
        'PARTICIPANT_DEACTIVATED',
        { targetParticipant: participantIdValue, reason }
      )

      return true
      
    } catch (error) {
      await this.auditService.logSystemError(
        'DEACTIVATE_PARTICIPANT_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      )
      return false
    }
  }
}
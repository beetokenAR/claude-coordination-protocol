/**
 * @fileoverview Interfaz del repositorio de participantes
 * Responsabilidad: Definir el contrato para persistencia de participantes seguros
 */

import { ParticipantId } from '../../domain/values/ParticipantId.js'
import { SecureParticipant } from '../../domain/entities/SecureParticipant.js'

export interface IParticipantRepository {
  /**
   * Busca un participante por ID
   */
  findById(id: ParticipantId): Promise<SecureParticipant | null>

  /**
   * Guarda un participante (create o update)
   */
  save(participant: SecureParticipant): Promise<void>

  /**
   * Elimina un participante por ID
   */
  deleteById(id: ParticipantId): Promise<boolean>

  /**
   * Lista todos los participantes activos
   */
  findActive(): Promise<SecureParticipant[]>

  /**
   * Lista participantes por nivel de seguridad
   */
  findBySecurityLevel(level: string): Promise<SecureParticipant[]>

  /**
   * Busca participantes bloqueados
   */
  findLocked(): Promise<SecureParticipant[]>

  /**
   * Cuenta participantes por estado
   */
  countByStatus(): Promise<{
    active: number
    inactive: number
    locked: number
    total: number
  }>
}
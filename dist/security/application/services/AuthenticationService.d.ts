/**
 * @fileoverview Servicio de autenticación
 * Responsabilidad: Validar identidad de participantes y gestionar sesiones
 */
import { SecureParticipant } from '../../domain/entities/SecureParticipant.js';
import { IParticipantRepository } from '../interfaces/IParticipantRepository.js';
import { IAuditService } from '../interfaces/IAuditService.js';
export declare class AuthenticationService {
    private readonly participantRepository;
    private readonly auditService;
    constructor(participantRepository: IParticipantRepository, auditService: IAuditService);
    /**
     * Autentica un participante por ID
     */
    authenticate(participantIdValue: string): Promise<SecureParticipant | null>;
    /**
     * Registra un intento fallido de autenticación
     */
    recordFailedAttempt(participantIdValue: string): Promise<void>;
    /**
     * Desbloquea un participante (solo para administradores)
     */
    unlockParticipant(participantIdValue: string, adminId: string): Promise<boolean>;
    /**
     * Desactiva un participante permanentemente
     */
    deactivateParticipant(participantIdValue: string, adminId: string, reason: string): Promise<boolean>;
}
//# sourceMappingURL=AuthenticationService.d.ts.map
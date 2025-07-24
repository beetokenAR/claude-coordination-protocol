/**
 * @fileoverview Servicio de autorización
 * Responsabilidad: Verificar permisos y controlar acceso a recursos
 */
import { PermissionUtils } from '../../domain/values/Permission.js';
export class AuthorizationService {
    auditService;
    constructor(auditService) {
        this.auditService = auditService;
    }
    /**
     * Autoriza una acción (simplificado para uso público)
     */
    async authorize(request) {
        const { participant, requiredPermission, resourceId } = request;
        // Solo verificación básica de participante activo
        if (!participant.isActive) {
            await this.logAuthorizationDenied(participant, requiredPermission, 'PARTICIPANT_INACTIVE');
            return {
                granted: false,
                reason: 'Participant is not active',
                riskLevel: 'LOW'
            };
        }
        // En modo público, validamos solo el tamaño del mensaje si es aplicable
        if (request.additionalContext?.messageLength) {
            const maxLength = 100 * 1024; // 100KB
            if (request.additionalContext.messageLength > maxLength) {
                await this.logAuthorizationDenied(participant, requiredPermission, 'MESSAGE_TOO_LARGE');
                return {
                    granted: false,
                    reason: `Message length ${request.additionalContext.messageLength} exceeds limit ${maxLength}`,
                    riskLevel: 'LOW'
                };
            }
        }
        // Log de autorización exitosa
        await this.logAuthorizationGranted(participant, requiredPermission, resourceId);
        return {
            granted: true,
            reason: 'Authorization granted',
            riskLevel: 'LOW'
        };
    }
    // Métodos enterprise eliminados - no necesarios para uso público
    /**
     * Log de autorización denegada
     */
    async logAuthorizationDenied(participant, permission, reason) {
        await this.auditService.logSecurityEvent(participant.id.value, 'AUTHORIZATION_DENIED', {
            permission,
            reason,
            securityLevel: participant.securityLevel,
            failedAttempts: participant.failedAttempts
        });
    }
    /**
     * Log de autorización concedida
     */
    async logAuthorizationGranted(participant, permission, resourceId) {
        await this.auditService.logSecurityEvent(participant.id.value, 'AUTHORIZATION_GRANTED', {
            permission,
            resourceId,
            securityLevel: participant.securityLevel,
            riskLevel: PermissionUtils.getPermissionRiskLevel(permission)
        });
    }
}
//# sourceMappingURL=AuthorizationService.js.map
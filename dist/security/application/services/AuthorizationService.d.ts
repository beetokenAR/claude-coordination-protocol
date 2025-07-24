/**
 * @fileoverview Servicio de autorización
 * Responsabilidad: Verificar permisos y controlar acceso a recursos
 */
import { SecureParticipant } from '../../domain/entities/SecureParticipant.js';
import { Permission } from '../../domain/values/Permission.js';
import { IAuditService } from '../interfaces/IAuditService.js';
export interface AuthorizationRequest {
    participant: SecureParticipant;
    requiredPermission: Permission;
    resourceId?: string;
    resourceType?: string;
    additionalContext?: Record<string, any>;
}
export interface AuthorizationResult {
    granted: boolean;
    reason: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
export declare class AuthorizationService {
    private readonly auditService;
    constructor(auditService: IAuditService);
    /**
     * Autoriza una acción (simplificado para uso público)
     */
    authorize(request: AuthorizationRequest): Promise<AuthorizationResult>;
    /**
     * Log de autorización denegada
     */
    private logAuthorizationDenied;
    /**
     * Log de autorización concedida
     */
    private logAuthorizationGranted;
}
//# sourceMappingURL=AuthorizationService.d.ts.map
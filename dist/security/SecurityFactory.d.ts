/**
 * @fileoverview Factory de servicios de seguridad
 * Responsabilidad: Crear e integrar todos los componentes de seguridad
 */
import { AuthenticationService } from './application/services/AuthenticationService.js';
import { AuthorizationService } from './application/services/AuthorizationService.js';
import { IParticipantRepository } from './application/interfaces/IParticipantRepository.js';
import { IAuditService } from './application/interfaces/IAuditService.js';
import { SecureParticipant } from './domain/entities/SecureParticipant.js';
import { SecurityLevel } from './domain/values/SecurityLevel.js';
import { Permission } from './domain/values/Permission.js';
import { AuthorizationRequest, AuthorizationResult } from './application/services/AuthorizationService.js';
export interface SecurityConfig {
    databasePath: string;
    auditDatabasePath?: string;
    enableAuditLogging?: boolean;
    maxFailedAttempts?: number;
    lockoutDurationMinutes?: number;
}
export interface SecurityServices {
    authenticationService: AuthenticationService;
    authorizationService: AuthorizationService;
    auditService: IAuditService;
    participantRepository: IParticipantRepository;
}
export declare class SecurityFactory {
    private config;
    private static instance;
    private services;
    private constructor();
    /**
     * Obtiene la instancia singleton del factory
     */
    static getInstance(config?: SecurityConfig): SecurityFactory;
    /**
     * Inicializa todos los servicios de seguridad
     */
    initialize(): Promise<SecurityServices>;
    /**
     * Obtiene los servicios (deben estar inicializados)
     */
    getServices(): SecurityServices;
    /**
     * Autentica un participante
     */
    authenticate(participantId: string): Promise<SecureParticipant | null>;
    /**
     * Autoriza una acción
     */
    authorize(request: AuthorizationRequest): Promise<AuthorizationResult>;
    /**
     * Registra un nuevo participante
     */
    registerParticipant(participantId: string, capabilities: string[], securityLevel?: SecurityLevel): Promise<SecureParticipant>;
    /**
     * Desactiva un participante
     */
    deactivateParticipant(participantId: string, adminId: string, reason: string): Promise<boolean>;
    /**
     * Obtiene estadísticas de seguridad
     */
    getSecurityStats(): Promise<{
        participantStats: {
            active: number;
            inactive: number;
            locked: number;
            total: number;
        };
        authenticationAttempts: {
            successful: number;
            failed: number;
            total: number;
        };
        authorizationEvents: {
            granted: number;
            denied: number;
            total: number;
        };
        securityEvents: {
            byType: Record<string, number>;
            bySeverity: Record<string, number>;
            total: number;
        };
    }>;
    /**
     * Verifica el estado de un participante
     */
    getParticipantStatus(participantId: string): Promise<{
        id: string;
        isActive: boolean;
        isLocked: boolean;
        securityLevel: SecurityLevel;
        failedAttempts: number;
        lastSeen: Date;
        capabilities: string[];
        permissions: Permission[];
    }>;
    /**
     * Valida permisos para una acción específica
     */
    hasPermission(participantId: string, permission: Permission, resourceId?: string, resourceType?: string): Promise<{
        granted: boolean;
        reason: string;
    }>;
    /**
     * Ejecuta una acción con verificación de permisos
     */
    executeWithPermission<T>(participantId: string, permission: Permission, action: (participant: SecureParticipant) => Promise<T>, options?: {
        resourceId?: string;
        resourceType?: string;
        additionalContext?: Record<string, any>;
    }): Promise<{
        success: boolean;
        result?: T;
        error?: string;
    }>;
    /**
     * Cierra todos los servicios y conexiones
     */
    shutdown(): Promise<void>;
    /**
     * Configuración por defecto para desarrollo
     */
    static createDevelopmentConfig(basePath?: string): SecurityConfig;
    /**
     * Configuración para producción
     */
    static createProductionConfig(basePath: string): SecurityConfig;
}
//# sourceMappingURL=SecurityFactory.d.ts.map
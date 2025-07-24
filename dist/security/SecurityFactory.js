/**
 * @fileoverview Factory de servicios de seguridad
 * Responsabilidad: Crear e integrar todos los componentes de seguridad
 */
import { AuthenticationService } from './application/services/AuthenticationService.js';
import { AuthorizationService } from './application/services/AuthorizationService.js';
import { AuditService } from './infrastructure/services/AuditService.js';
import { SecureParticipantRepository } from './infrastructure/repositories/SecureParticipantRepository.js';
import { ParticipantId } from './domain/values/ParticipantId.js';
import { SecureParticipant } from './domain/entities/SecureParticipant.js';
import { SecurityLevel } from './domain/values/SecurityLevel.js';
export class SecurityFactory {
    config;
    static instance = null;
    services = null;
    constructor(config) {
        this.config = config;
    }
    /**
     * Obtiene la instancia singleton del factory
     */
    static getInstance(config) {
        if (!SecurityFactory.instance) {
            if (!config) {
                throw new Error('SecurityFactory requires configuration on first initialization');
            }
            SecurityFactory.instance = new SecurityFactory(config);
        }
        return SecurityFactory.instance;
    }
    /**
     * Inicializa todos los servicios de seguridad
     */
    async initialize() {
        if (this.services) {
            return this.services;
        }
        // Crear repositorio de participantes
        const participantRepository = new SecureParticipantRepository(this.config.databasePath);
        // Crear servicio de auditoría
        const auditDatabasePath = this.config.auditDatabasePath ||
            this.config.databasePath.replace('.db', '_audit.db');
        const auditService = new AuditService(auditDatabasePath);
        // Crear servicios de aplicación
        const authenticationService = new AuthenticationService(participantRepository, auditService);
        const authorizationService = new AuthorizationService(auditService);
        this.services = {
            authenticationService,
            authorizationService,
            auditService,
            participantRepository
        };
        // Log de inicialización
        await auditService.logSystemError('SECURITY_SYSTEM_INITIALIZED', 'Security services initialized successfully', {
            databasePath: this.config.databasePath,
            auditPath: auditDatabasePath,
            timestamp: new Date().toISOString()
        });
        return this.services;
    }
    /**
     * Obtiene los servicios (deben estar inicializados)
     */
    getServices() {
        if (!this.services) {
            throw new Error('Security services not initialized. Call initialize() first.');
        }
        return this.services;
    }
    /**
     * Autentica un participante
     */
    async authenticate(participantId) {
        const services = this.getServices();
        return services.authenticationService.authenticate(participantId);
    }
    /**
     * Autoriza una acción
     */
    async authorize(request) {
        const services = this.getServices();
        return services.authorizationService.authorize(request);
    }
    /**
     * Registra un nuevo participante
     */
    async registerParticipant(participantId, capabilities, securityLevel = SecurityLevel.STANDARD) {
        const services = this.getServices();
        const id = ParticipantId.create(participantId);
        const participant = SecureParticipant.create(id, capabilities, securityLevel);
        await services.participantRepository.save(participant);
        await services.auditService.logSecurityEvent(participantId, 'PARTICIPANT_REGISTERED', {
            capabilities: capabilities,
            securityLevel: securityLevel,
            timestamp: new Date().toISOString()
        });
        return participant;
    }
    /**
     * Desactiva un participante
     */
    async deactivateParticipant(participantId, adminId, reason) {
        const services = this.getServices();
        return services.authenticationService.deactivateParticipant(participantId, adminId, reason);
    }
    /**
     * Obtiene estadísticas de seguridad
     */
    async getSecurityStats() {
        const services = this.getServices();
        const auditStats = await services.auditService.getSecurityStats();
        const participantStats = await services.participantRepository.countByStatus();
        return {
            ...auditStats,
            participantStats
        };
    }
    /**
     * Verifica el estado de un participante
     */
    async getParticipantStatus(participantId) {
        const services = this.getServices();
        const id = ParticipantId.create(participantId);
        const participant = await services.participantRepository.findById(id);
        if (!participant) {
            return null;
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
        };
    }
    /**
     * Valida permisos para una acción específica
     */
    async hasPermission(participantId, permission, resourceId, resourceType) {
        try {
            const participant = await this.authenticate(participantId);
            if (!participant) {
                return { granted: false, reason: 'Participant not found or not authenticated' };
            }
            const result = await this.authorize({
                participant,
                requiredPermission: permission,
                resourceId,
                resourceType
            });
            return { granted: result.granted, reason: result.reason };
        }
        catch (error) {
            const services = this.getServices();
            await services.auditService.logSystemError('PERMISSION_CHECK_ERROR', error instanceof Error ? error.message : 'Unknown error', { participantId, permission, resourceId, resourceType });
            return { granted: false, reason: 'Permission check failed' };
        }
    }
    /**
     * Ejecuta una acción con verificación de permisos
     */
    async executeWithPermission(participantId, permission, action, options) {
        try {
            const participant = await this.authenticate(participantId);
            if (!participant) {
                return { success: false, error: 'Authentication failed' };
            }
            const authResult = await this.authorize({
                participant,
                requiredPermission: permission,
                resourceId: options?.resourceId,
                resourceType: options?.resourceType,
                additionalContext: options?.additionalContext
            });
            if (!authResult.granted) {
                return { success: false, error: authResult.reason };
            }
            const result = await action(participant);
            return { success: true, result };
        }
        catch (error) {
            const services = this.getServices();
            await services.auditService.logSystemError('SECURE_ACTION_ERROR', error instanceof Error ? error.message : 'Unknown error', { participantId, permission, ...options });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Action execution failed'
            };
        }
    }
    /**
     * Cierra todos los servicios y conexiones
     */
    async shutdown() {
        if (this.services) {
            // Cerrar repositorio
            if ('close' in this.services.participantRepository) {
                this.services.participantRepository.close();
            }
            // Cerrar servicio de auditoría
            if ('close' in this.services.auditService) {
                this.services.auditService.close();
            }
            await this.services.auditService.logSystemError('SECURITY_SYSTEM_SHUTDOWN', 'Security services shutdown completed', { timestamp: new Date().toISOString() });
            this.services = null;
        }
        SecurityFactory.instance = null;
    }
    /**
     * Configuración por defecto para desarrollo
     */
    static createDevelopmentConfig(basePath = '.coordination') {
        return {
            databasePath: `${basePath}/security.db`,
            auditDatabasePath: `${basePath}/audit.db`,
            enableAuditLogging: true,
            maxFailedAttempts: 5,
            lockoutDurationMinutes: 15
        };
    }
    /**
     * Configuración para producción
     */
    static createProductionConfig(basePath) {
        return {
            databasePath: `${basePath}/security.db`,
            auditDatabasePath: `${basePath}/audit.db`,
            enableAuditLogging: true,
            maxFailedAttempts: 3,
            lockoutDurationMinutes: 30
        };
    }
}
//# sourceMappingURL=SecurityFactory.js.map
/**
 * @fileoverview Entidad de dominio para participantes seguros
 * Responsabilidad: Encapsular las reglas de negocio de participantes y sus permisos
 */
import { ParticipantId } from '../values/ParticipantId.js';
import { SecurityLevel } from '../values/SecurityLevel.js';
import { Permission } from '../values/Permission.js';
export declare class SecureParticipant {
    private readonly _id;
    private readonly _capabilities;
    private readonly _securityLevel;
    private readonly _permissions;
    private _lastSeen;
    private _isActive;
    private _failedAttempts;
    private _lockedUntil?;
    private constructor();
    static create(id: ParticipantId, capabilities: string[], securityLevel?: SecurityLevel): SecureParticipant;
    static reconstitute(id: ParticipantId, capabilities: string[], securityLevel: SecurityLevel, lastSeen: Date, isActive: boolean, failedAttempts: number, lockedUntil?: Date): SecureParticipant;
    get id(): ParticipantId;
    get capabilities(): ReadonlySet<string>;
    get securityLevel(): SecurityLevel;
    get permissions(): ReadonlySet<Permission>;
    get lastSeen(): Date;
    get isActive(): boolean;
    get failedAttempts(): number;
    get isLocked(): boolean;
    canPerformAction(requiredPermission: Permission): boolean;
    hasCapability(capability: string): boolean;
    updateLastSeen(): void;
    recordFailedAttempt(): void;
    deactivate(): void;
    activate(): void;
    private static derivePermissionsFromCapabilities;
}
//# sourceMappingURL=SecureParticipant.d.ts.map
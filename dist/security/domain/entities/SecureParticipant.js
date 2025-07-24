/**
 * @fileoverview Entidad de dominio para participantes seguros
 * Responsabilidad: Encapsular las reglas de negocio de participantes y sus permisos
 */
import { SecurityLevel } from '../values/SecurityLevel.js';
import { Permission } from '../values/Permission.js';
export class SecureParticipant {
    _id;
    _capabilities;
    _securityLevel;
    _permissions;
    _lastSeen;
    _isActive;
    _failedAttempts;
    _lockedUntil;
    constructor(_id, _capabilities, _securityLevel, _permissions, _lastSeen, _isActive, _failedAttempts = 0, _lockedUntil) {
        this._id = _id;
        this._capabilities = _capabilities;
        this._securityLevel = _securityLevel;
        this._permissions = _permissions;
        this._lastSeen = _lastSeen;
        this._isActive = _isActive;
        this._failedAttempts = _failedAttempts;
        this._lockedUntil = _lockedUntil;
    }
    static create(id, capabilities, securityLevel = SecurityLevel.STANDARD) {
        const permissions = this.derivePermissionsFromCapabilities(capabilities);
        return new SecureParticipant(id, new Set(capabilities), securityLevel, permissions, new Date(), true);
    }
    static reconstitute(id, capabilities, securityLevel, lastSeen, isActive, failedAttempts, lockedUntil) {
        const permissions = this.derivePermissionsFromCapabilities(capabilities);
        return new SecureParticipant(id, new Set(capabilities), securityLevel, permissions, lastSeen, isActive, failedAttempts, lockedUntil);
    }
    // Getters
    get id() { return this._id; }
    get capabilities() { return this._capabilities; }
    get securityLevel() { return this._securityLevel; }
    get permissions() { return this._permissions; }
    get lastSeen() { return this._lastSeen; }
    get isActive() { return this._isActive; }
    get failedAttempts() { return this._failedAttempts; }
    get isLocked() {
        return this._lockedUntil ? this._lockedUntil > new Date() : false;
    }
    // Business Rules (simplificado para uso público)
    canPerformAction(requiredPermission) {
        // En modo público, todos los participantes activos pueden hacer todo
        return this._isActive;
    }
    hasCapability(capability) {
        return this._capabilities.has(capability);
    }
    updateLastSeen() {
        this._lastSeen = new Date();
        // No hay failed attempts en modo público
    }
    recordFailedAttempt() {
        // No se bloquean cuentas en modo público
        // Solo para logging si es necesario
    }
    deactivate() {
        this._isActive = false;
    }
    activate() {
        this._isActive = true;
        // No hay lockouts en modo público
    }
    static derivePermissionsFromCapabilities(capabilities) {
        // En modo público, todos tienen todos los permisos básicos
        return new Set(Object.values(Permission));
    }
}
//# sourceMappingURL=SecureParticipant.js.map
/**
 * @fileoverview Entidad de dominio para participantes seguros
 * Responsabilidad: Encapsular las reglas de negocio de participantes y sus permisos
 */

import { ParticipantId } from '../values/ParticipantId.js'
import { SecurityLevel } from '../values/SecurityLevel.js'
import { Permission } from '../values/Permission.js'

export class SecureParticipant {
  private constructor(
    private readonly _id: ParticipantId,
    private readonly _capabilities: ReadonlySet<string>,
    private readonly _securityLevel: SecurityLevel,
    private readonly _permissions: ReadonlySet<Permission>,
    private _lastSeen: Date,
    private _isActive: boolean,
    private _failedAttempts: number = 0,
    private _lockedUntil?: Date
  ) {}

  public static create(
    id: ParticipantId,
    capabilities: string[],
    securityLevel: SecurityLevel = SecurityLevel.STANDARD
  ): SecureParticipant {
    const permissions = this.derivePermissionsFromCapabilities(capabilities)
    
    return new SecureParticipant(
      id,
      new Set(capabilities),
      securityLevel,
      permissions,
      new Date(),
      true
    )
  }

  public static reconstitute(
    id: ParticipantId,
    capabilities: string[],
    securityLevel: SecurityLevel,
    lastSeen: Date,
    isActive: boolean,
    failedAttempts: number,
    lockedUntil?: Date
  ): SecureParticipant {
    const permissions = this.derivePermissionsFromCapabilities(capabilities)
    
    return new SecureParticipant(
      id,
      new Set(capabilities),
      securityLevel,
      permissions,
      lastSeen,
      isActive,
      failedAttempts,
      lockedUntil
    )
  }

  // Getters
  public get id(): ParticipantId { return this._id }
  public get capabilities(): ReadonlySet<string> { return this._capabilities }
  public get securityLevel(): SecurityLevel { return this._securityLevel }
  public get permissions(): ReadonlySet<Permission> { return this._permissions }
  public get lastSeen(): Date { return this._lastSeen }
  public get isActive(): boolean { return this._isActive }
  public get failedAttempts(): number { return this._failedAttempts }
  public get isLocked(): boolean { 
    return this._lockedUntil ? this._lockedUntil > new Date() : false 
  }

  // Business Rules (simplificado para uso público)
  public canPerformAction(_requiredPermission: Permission): boolean {
    // En modo público, todos los participantes activos pueden hacer todo
    return this._isActive
  }

  public hasCapability(capability: string): boolean {
    return this._capabilities.has(capability)
  }

  public updateLastSeen(): void {
    this._lastSeen = new Date()
    // No hay failed attempts en modo público
  }

  public recordFailedAttempt(): void {
    // No se bloquean cuentas en modo público
    // Solo para logging si es necesario
  }

  public deactivate(): void {
    this._isActive = false
  }

  public activate(): void {
    this._isActive = true
    // No hay lockouts en modo público
  }

  private static derivePermissionsFromCapabilities(_capabilities: string[]): ReadonlySet<Permission> {
    // En modo público, todos tienen todos los permisos básicos
    return new Set(Object.values(Permission))
  }
}
/**
 * @fileoverview Value Object para identificadores de participantes
 * Responsabilidad: Garantizar que los IDs de participantes sean válidos y seguros
 */

export class ParticipantId {
  private static readonly VALID_PATTERN = /^@[a-zA-Z][a-zA-Z0-9_-]{1,30}$/
  private static readonly RESERVED_IDS = new Set(['@system', '@admin', '@root', '@null', '@undefined'])

  private constructor(private readonly _value: string) {}

  public static create(value: string): ParticipantId {
    this.validateFormat(value)
    this.validateNotReserved(value)
    this.validateSecurityConstraints(value)
    
    return new ParticipantId(value)
  }

  public get value(): string {
    return this._value
  }

  public equals(other: ParticipantId): boolean {
    return this._value === other._value
  }

  public toString(): string {
    return this._value
  }

  public toJSON(): string {
    return this._value
  }

  private static validateFormat(value: string): void {
    if (!value) {
      throw new Error('ParticipantId no puede estar vacío')
    }

    if (!this.VALID_PATTERN.test(value)) {
      throw new Error(
        'ParticipantId debe comenzar con @ seguido de 1-30 caracteres alfanuméricos, guiones o underscores'
      )
    }
  }

  private static validateNotReserved(value: string): void {
    if (this.RESERVED_IDS.has(value.toLowerCase())) {
      throw new Error(`ParticipantId ${value} está reservado`)
    }
  }

  private static validateSecurityConstraints(value: string): void {
    // Prevenir inyección de comandos
    const dangerousChars = /[<>{}[\]\\|;'"`$()]/
    if (dangerousChars.test(value)) {
      throw new Error('ParticipantId contiene caracteres peligrosos')
    }

    // Prevenir SQL injection
    const sqlKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|OR|AND)\b/i
    if (sqlKeywords.test(value)) {
      throw new Error('ParticipantId contiene palabras SQL reservadas')
    }
  }
}
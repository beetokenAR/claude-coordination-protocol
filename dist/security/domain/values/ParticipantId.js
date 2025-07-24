/**
 * @fileoverview Value Object para identificadores de participantes
 * Responsabilidad: Garantizar que los IDs de participantes sean válidos y seguros
 */
export class ParticipantId {
    _value;
    static VALID_PATTERN = /^@[a-zA-Z][a-zA-Z0-9_-]{1,30}$/;
    static RESERVED_IDS = new Set(['@system', '@admin', '@root', '@null', '@undefined']);
    constructor(_value) {
        this._value = _value;
    }
    static create(value) {
        this.validateFormat(value);
        this.validateNotReserved(value);
        this.validateSecurityConstraints(value);
        return new ParticipantId(value);
    }
    get value() {
        return this._value;
    }
    equals(other) {
        return this._value === other._value;
    }
    toString() {
        return this._value;
    }
    toJSON() {
        return this._value;
    }
    static validateFormat(value) {
        if (!value) {
            throw new Error('ParticipantId no puede estar vacío');
        }
        if (!this.VALID_PATTERN.test(value)) {
            throw new Error('ParticipantId debe comenzar con @ seguido de 1-30 caracteres alfanuméricos, guiones o underscores');
        }
    }
    static validateNotReserved(value) {
        if (this.RESERVED_IDS.has(value.toLowerCase())) {
            throw new Error(`ParticipantId ${value} está reservado`);
        }
    }
    static validateSecurityConstraints(value) {
        // Prevenir inyección de comandos
        const dangerousChars = /[<>{}[\]\\|;'"`$()]/;
        if (dangerousChars.test(value)) {
            throw new Error('ParticipantId contiene caracteres peligrosos');
        }
        // Prevenir SQL injection
        const sqlKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|OR|AND)\b/i;
        if (sqlKeywords.test(value)) {
            throw new Error('ParticipantId contiene palabras SQL reservadas');
        }
    }
}
//# sourceMappingURL=ParticipantId.js.map
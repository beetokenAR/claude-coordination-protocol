/**
 * @fileoverview Value Object para identificadores de participantes
 * Responsabilidad: Garantizar que los IDs de participantes sean válidos y seguros
 */
export declare class ParticipantId {
    private readonly _value;
    private static readonly VALID_PATTERN;
    private static readonly RESERVED_IDS;
    private constructor();
    static create(value: string): ParticipantId;
    get value(): string;
    equals(other: ParticipantId): boolean;
    toString(): string;
    toJSON(): string;
    private static validateFormat;
    private static validateNotReserved;
    private static validateSecurityConstraints;
}
//# sourceMappingURL=ParticipantId.d.ts.map
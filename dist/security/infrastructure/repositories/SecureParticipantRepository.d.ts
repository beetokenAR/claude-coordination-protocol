/**
 * @fileoverview Repositorio de participantes seguros
 * Responsabilidad: Persistencia y recuperación de entidades SecureParticipant
 */
import { ParticipantId } from '../../domain/values/ParticipantId.js';
import { SecureParticipant } from '../../domain/entities/SecureParticipant.js';
import { IParticipantRepository } from '../../application/interfaces/IParticipantRepository.js';
export declare class SecureParticipantRepository implements IParticipantRepository {
    private db;
    constructor(dbPath: string);
    /**
     * Busca un participante por ID
     */
    findById(id: ParticipantId): Promise<SecureParticipant | null>;
    /**
     * Guarda un participante (create o update)
     */
    save(participant: SecureParticipant): Promise<void>;
    /**
     * Elimina un participante por ID
     */
    deleteById(id: ParticipantId): Promise<boolean>;
    /**
     * Lista todos los participantes activos
     */
    findActive(): Promise<SecureParticipant[]>;
    /**
     * Lista participantes por nivel de seguridad
     */
    findBySecurityLevel(level: string): Promise<SecureParticipant[]>;
    /**
     * Busca participantes bloqueados
     */
    findLocked(): Promise<SecureParticipant[]>;
    /**
     * Cuenta participantes por estado
     */
    countByStatus(): Promise<{
        active: number;
        inactive: number;
        locked: number;
        total: number;
    }>;
    /**
     * Inicializa el schema de la base de datos
     */
    private initializeSchema;
    /**
     * Crea un nuevo participante
     */
    private create;
    /**
     * Actualiza un participante existente
     */
    private update;
    /**
     * Mapea fila de base de datos a SecureParticipant
     */
    private mapRowToParticipant;
    /**
     * Busca participantes por capacidad (usando FTS)
     */
    findByCapability(capability: string): Promise<SecureParticipant[]>;
    /**
     * Cierra la conexión a la base de datos
     */
    close(): void;
}
//# sourceMappingURL=SecureParticipantRepository.d.ts.map
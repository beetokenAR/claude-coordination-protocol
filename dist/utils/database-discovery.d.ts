/**
 * Database Discovery Utilities
 *
 * Prevents fragmented coordination by detecting existing databases
 * and suggesting centralized coordination setup.
 */
export interface DatabaseLocation {
    path: string;
    type: 'local' | 'parent' | 'sibling';
    distance: number;
    participantCount: number;
    messageCount?: number;
    lastActivity?: Date;
}
/**
 * Discover all coordination databases in the project tree
 */
export declare function discoverDatabases(currentDir?: string): Promise<DatabaseLocation[]>;
/**
 * Suggest the best database location for coordination
 */
export declare function suggestBestDatabase(databases: DatabaseLocation[]): DatabaseLocation | null;
/**
 * Generate warnings for fragmented databases
 */
export declare function generateFragmentationWarnings(databases: DatabaseLocation[], currentDir: string): string[];
/**
 * Check if coordination should be centralized
 */
export declare function shouldCentralizeCoordination(databases: DatabaseLocation[]): boolean;
//# sourceMappingURL=database-discovery.d.ts.map
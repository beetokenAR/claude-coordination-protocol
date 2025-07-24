import Database from 'better-sqlite3';
export declare class CoordinationDatabase {
    private db;
    private dataDir;
    private dbPath;
    constructor(dataDir: string);
    private ensureDataDirectory;
    private initializeConnection;
    /**
     * Execute a transaction with automatic rollback on error
     */
    transaction<T>(fn: () => T): T;
    /**
     * Execute a statement within a transaction
     */
    transactionAsync<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Prepare a statement for repeated execution
     */
    prepare(sql: string): Database.Statement;
    /**
     * Execute SQL directly (use sparingly, prefer prepared statements)
     */
    exec(sql: string): void;
    /**
     * Get raw database instance (use carefully)
     */
    getRawDatabase(): Database.Database;
    /**
     * Close database connection
     */
    close(): void;
    /**
     * Get database file info
     */
    getInfo(): {
        path: string;
        size: number;
        lastModified: Date;
        permissions: string;
    };
    /**
     * Run database maintenance operations
     */
    maintenance(): void;
    /**
     * Get database statistics
     */
    getStats(): {
        pageCount: number;
        pageSize: number;
        freePages: number;
        totalSize: number;
        walSize: number;
    };
    /**
     * Backup database to specified path
     */
    backup(backupPath: string): void;
}
//# sourceMappingURL=connection.d.ts.map
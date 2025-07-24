export declare class FileLock {
    private lockPath;
    private acquired;
    private lockHandle;
    constructor(dataDir: string, lockName?: string);
    acquire(maxRetries?: number, retryDelay?: number): Promise<void>;
    release(): Promise<void>;
    forceRelease(): Promise<void>;
    private isStalelock;
    isAcquired(): boolean;
}
/**
 * Utility function to execute code with file lock protection
 */
export declare function withFileLock<T>(dataDir: string, operation: () => Promise<T>, lockName?: string): Promise<T>;
//# sourceMappingURL=file-lock.d.ts.map
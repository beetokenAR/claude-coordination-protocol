import fs from 'fs/promises'
import path from 'path'
import { CoordinationError } from '../types/index.js'

export class FileLock {
  private lockPath: string
  private acquired = false
  private lockHandle: fs.FileHandle | undefined
  
  constructor(dataDir: string, lockName = 'coordination.lock') {
    const lockDir = path.join(dataDir, 'locks')
    this.lockPath = path.join(lockDir, lockName)
  }
  
  async acquire(maxRetries = 50, retryDelay = 100): Promise<void> {
    if (this.acquired) {
      throw new CoordinationError('Lock already acquired', 'LOCK_ALREADY_ACQUIRED')
    }
    
    // Ensure lock directory exists
    await fs.mkdir(path.dirname(this.lockPath), { recursive: true })
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Exclusive lock - fails if file exists
        this.lockHandle = await fs.open(this.lockPath, 'wx')
        this.acquired = true
        
        // Write process info for debugging
        const lockInfo = {
          pid: process.pid,
          acquired_at: new Date().toISOString(),
          node_version: process.version
        }
        await this.lockHandle.writeFile(JSON.stringify(lockInfo, null, 2))
        return
        
      } catch (error: any) {
        if (error.code === 'EEXIST') {
          // Lock file exists, check if process is still alive
          if (await this.isStalelock()) {
            await this.forceRelease()
            continue // Retry immediately after cleaning stale lock
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          continue
        }
        
        // Other errors are not recoverable
        throw new CoordinationError(
          `Failed to acquire file lock: ${error.message}`,
          'LOCK_ACQUISITION_FAILED',
          { error: error.message, attempt, lockPath: this.lockPath }
        )
      }
    }
    
    throw new CoordinationError(
      `Could not acquire file lock after ${maxRetries} attempts`,
      'LOCK_TIMEOUT',
      { maxRetries, lockPath: this.lockPath }
    )
  }
  
  async release(): Promise<void> {
    if (!this.acquired || !this.lockHandle) {
      return // Already released or never acquired
    }
    
    try {
      await this.lockHandle.close()
      await fs.unlink(this.lockPath)
    } catch (error: any) {
      // Best effort - log but don't throw
      console.warn(`Warning: Failed to clean up lock file: ${error.message}`)
    } finally {
      this.acquired = false
      this.lockHandle = undefined
    }
  }
  
  async forceRelease(): Promise<void> {
    try {
      await fs.unlink(this.lockPath)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw new CoordinationError(
          `Failed to force release lock: ${error.message}`,
          'LOCK_FORCE_RELEASE_FAILED',
          { error: error.message, lockPath: this.lockPath }
        )
      }
    }
  }
  
  private async isStalelock(): Promise<boolean> {
    try {
      const lockContent = await fs.readFile(this.lockPath, 'utf-8')
      const lockInfo = JSON.parse(lockContent)
      
      // Check if the process that created the lock is still running
      if (lockInfo.pid && typeof lockInfo.pid === 'number') {
        try {
          // process.kill with signal 0 checks if process exists without killing it
          process.kill(lockInfo.pid, 0)
          return false // Process still exists
        } catch (error: any) {
          if (error.code === 'ESRCH') {
            return true // Process does not exist - stale lock
          }
          // Other errors mean we can't determine - assume not stale
          return false
        }
      }
      
      // Check age of lock (consider stale after 5 minutes)
      if (lockInfo.acquired_at) {
        const lockAge = Date.now() - new Date(lockInfo.acquired_at).getTime()
        return lockAge > 5 * 60 * 1000 // 5 minutes
      }
      
      return false
    } catch (error) {
      // If we can't read the lock file, assume it's not stale
      return false
    }
  }
  
  isAcquired(): boolean {
    return this.acquired
  }
}

/**
 * Utility function to execute code with file lock protection
 */
export async function withFileLock<T>(
  dataDir: string,
  operation: () => Promise<T>,
  lockName = 'coordination.lock'
): Promise<T> {
  const lock = new FileLock(dataDir, lockName)
  
  try {
    await lock.acquire()
    return await operation()
  } finally {
    await lock.release()
  }
}
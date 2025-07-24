import { beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { tmpdir } from 'os'

// Create unique test directory for each test instance
export function createTestDataDir(): string {
  return path.join(tmpdir(), 'ccp-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9))
}

// Global test setup - legacy export for compatibility
export const TEST_DATA_DIR = createTestDataDir()

let currentTestDir: string

beforeEach(() => {
  // Create unique directory for this test
  currentTestDir = createTestDataDir()
  
  // Create clean test directory for each test
  if (fs.existsSync(currentTestDir)) {
    fs.rmSync(currentTestDir, { recursive: true, force: true })
  }
  fs.mkdirSync(currentTestDir, { recursive: true })
  
  // Also create the locks directory
  const locksDir = path.join(currentTestDir, 'locks')
  fs.mkdirSync(locksDir, { recursive: true })
})

afterEach(() => {
  // Clean up test directory after each test
  if (currentTestDir && fs.existsSync(currentTestDir)) {
    fs.rmSync(currentTestDir, { recursive: true, force: true })
  }
})

// Export function to get current test directory
export function getCurrentTestDir(): string {
  return currentTestDir || TEST_DATA_DIR
}
import { beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { tmpdir } from 'os'

// Global test setup
export const TEST_DATA_DIR = path.join(tmpdir(), 'ccp-test-' + Date.now())

beforeEach(() => {
  // Create clean test directory for each test
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true })
  }
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true })
})

afterEach(() => {
  // Clean up test directory after each test
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true })
  }
})
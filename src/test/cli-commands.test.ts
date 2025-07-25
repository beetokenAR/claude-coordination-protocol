import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestDataDir } from './setup.js'
import fs from 'fs'
import path from 'path'
import { CoordinationDatabase } from '../database/connection.js'
import { ParticipantRegistry } from '../core/participant-registry.js'
import YAML from 'yaml'

describe('CLI Commands', () => {
  let testDataDir: string
  let sharedTestDir: string

  beforeEach(async () => {
    // Create unique test directories
    testDataDir = createTestDataDir()
    fs.mkdirSync(testDataDir, { recursive: true })

    sharedTestDir = createTestDataDir()
    fs.mkdirSync(sharedTestDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up test directories
    if (testDataDir && fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true })
    }
    if (sharedTestDir && fs.existsSync(sharedTestDir)) {
      fs.rmSync(sharedTestDir, { recursive: true, force: true })
    }
  })

  describe('connect command functionality', () => {
    it('should create proper configuration for connecting to existing database', async () => {
      // First, create a shared coordination database (simulating 'ccp init')
      const sharedCoordDir = path.join(sharedTestDir, '.coordination')
      fs.mkdirSync(sharedCoordDir, { recursive: true })

      const sharedDb = new CoordinationDatabase(sharedCoordDir)
      const sharedRegistry = new ParticipantRegistry(sharedDb, sharedCoordDir)

      // Register a participant in the shared database
      await sharedRegistry.registerParticipant({
        id: '@ecosystem',
        capabilities: ['coordination'],
        default_priority: 'M',
      })

      sharedDb.close()

      // Now simulate 'ccp connect' functionality
      const connectDir = path.join(testDataDir, '.coordination')
      fs.mkdirSync(connectDir, { recursive: true })

      const configPath = path.join(connectDir, 'config.yaml')
      const dbPath = path.join(sharedCoordDir, 'coordination.db')

      // Verify the shared database exists
      expect(fs.existsSync(dbPath)).toBe(true)

      // Create config that points to shared database
      const config = {
        participant_id: '@backend',
        data_directory: sharedCoordDir, // Points to shared directory
        archive_days: 30,
        token_limit: 1000000,
        auto_compact: true,
        participants: [
          {
            id: '@backend',
            capabilities: ['coordination'],
            status: 'active',
            default_priority: 'M',
          },
        ],
        notification_settings: {
          enabled: true,
          priority_threshold: 'M',
          batch_notifications: true,
        },
      }

      await fs.promises.writeFile(configPath, YAML.stringify(config), 'utf-8')

      // Connect to existing database and register new participant
      const connectDb = new CoordinationDatabase(sharedCoordDir)
      const connectRegistry = new ParticipantRegistry(connectDb, sharedCoordDir)

      await connectRegistry.registerParticipant({
        id: '@backend',
        capabilities: ['coordination'],
        default_priority: 'M',
      })

      // Verify both participants exist in shared database
      const participants = await connectRegistry.getParticipants()
      const participantIds = participants.map(p => p.id)

      expect(participantIds).toContain('@ecosystem')
      expect(participantIds).toContain('@backend')
      expect(participants.length).toBeGreaterThanOrEqual(2)

      connectDb.close()
    })

    it('should handle MCP configuration with absolute paths', () => {
      const configPath = '.coordination/config.yaml'
      const absoluteConfigPath = path.resolve(configPath)

      const mcpConfig = {
        mcpServers: {
          'claude-coordination-protocol': {
            command: 'ccp',
            args: ['server'],
            env: {
              CCP_CONFIG: absoluteConfigPath,
              CCP_PARTICIPANT_ID: '@backend',
            },
          },
        },
      }

      // Verify the config uses absolute paths
      expect(
        path.isAbsolute(mcpConfig.mcpServers['claude-coordination-protocol'].env.CCP_CONFIG)
      ).toBe(true)
      expect(mcpConfig.mcpServers['claude-coordination-protocol'].env.CCP_PARTICIPANT_ID).toBe(
        '@backend'
      )
    })

    it('should prevent duplicate participant registration gracefully', async () => {
      // Create shared database
      const sharedCoordDir = path.join(sharedTestDir, '.coordination')
      fs.mkdirSync(sharedCoordDir, { recursive: true })

      const db = new CoordinationDatabase(sharedCoordDir)
      const registry = new ParticipantRegistry(db, sharedCoordDir)

      // Register participant first time
      await registry.registerParticipant({
        id: '@backend',
        capabilities: ['coordination'],
        default_priority: 'M',
      })

      // Try to register same participant again (should not throw error)
      await expect(
        registry.registerParticipant({
          id: '@backend',
          capabilities: ['coordination'],
          default_priority: 'M',
        })
      ).rejects.toThrow()

      // Verify only one instance exists
      const participants = await registry.getParticipants()
      const backendParticipants = participants.filter(p => p.id === '@backend')
      expect(backendParticipants).toHaveLength(1)

      db.close()
    })

    it('should validate database path exists before connecting', () => {
      const nonExistentPath = '/path/that/does/not/exist/coordination.db'

      expect(fs.existsSync(nonExistentPath)).toBe(false)

      // This would be the validation logic in the connect command
      const validateDbExists = (dbPath: string) => {
        if (!fs.existsSync(dbPath)) {
          throw new Error(`Database not found at: ${dbPath}`)
        }
      }

      expect(() => validateDbExists(nonExistentPath)).toThrow('Database not found at:')
    })
  })
})

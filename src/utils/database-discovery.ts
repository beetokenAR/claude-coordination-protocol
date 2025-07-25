/**
 * Database Discovery Utilities
 *
 * Prevents fragmented coordination by detecting existing databases
 * and suggesting centralized coordination setup.
 */

import { promises as fs } from 'fs'
import * as path from 'path'
import { glob } from 'glob'

export interface DatabaseLocation {
  path: string
  type: 'local' | 'parent' | 'sibling'
  distance: number
  participantCount: number
  messageCount?: number
  lastActivity?: Date
}

/**
 * Discover all coordination databases in the project tree
 */
export async function discoverDatabases(
  currentDir: string = process.cwd()
): Promise<DatabaseLocation[]> {
  const databases: DatabaseLocation[] = []

  // Search pattern for coordination databases
  const pattern = '**/coordination.db'
  const maxDepth = 4 // Reasonable search depth

  try {
    // Search upward (parent directories)
    let searchDir = currentDir
    for (let i = 0; i < maxDepth; i++) {
      const dbPath = path.join(searchDir, '.coordination', 'coordination.db')
      if (await fileExists(dbPath)) {
        const participantCount = await getParticipantCount(path.dirname(dbPath))
        databases.push({
          path: dbPath,
          type: i === 0 ? 'local' : 'parent',
          distance: i,
          participantCount,
          lastActivity: await getLastActivity(dbPath),
        })
      }

      // Move up one directory
      const parentDir = path.dirname(searchDir)
      if (parentDir === searchDir) {
        break
      } // Reached root
      searchDir = parentDir
    }

    // Search downward and sideways (project tree)
    const projectRoot = await findProjectRoot(currentDir)
    if (projectRoot) {
      const allDbs = await glob(pattern, {
        cwd: projectRoot,
        ignore: ['node_modules/**', '.git/**'],
        absolute: true,
      })

      for (const dbPath of allDbs) {
        if (!databases.some(db => db.path === dbPath)) {
          const participantCount = await getParticipantCount(path.dirname(dbPath))
          const relativePath = path.relative(currentDir, dbPath)
          const distance = relativePath.split(path.sep).length

          databases.push({
            path: dbPath,
            type: 'sibling',
            distance,
            participantCount,
            lastActivity: await getLastActivity(dbPath),
          })
        }
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Database discovery failed:', error)
  }

  return databases.sort((a, b) => {
    // Sort by: type priority, then participant count, then distance
    const typePriority = { local: 0, parent: 1, sibling: 2 }
    if (typePriority[a.type] !== typePriority[b.type]) {
      return typePriority[a.type] - typePriority[b.type]
    }
    if (a.participantCount !== b.participantCount) {
      return b.participantCount - a.participantCount // More participants first
    }
    return a.distance - b.distance // Closer first
  })
}

/**
 * Suggest the best database location for coordination
 */
export function suggestBestDatabase(databases: DatabaseLocation[]): DatabaseLocation | null {
  if (databases.length === 0) {
    return null
  }

  // Prefer databases with multiple participants
  const multiParticipant = databases.filter(db => db.participantCount > 1)
  if (multiParticipant.length > 0) {
    return multiParticipant[0]
  }

  // Otherwise return the closest one
  return databases[0]
}

/**
 * Generate warnings for fragmented databases
 */
export function generateFragmentationWarnings(
  databases: DatabaseLocation[],
  currentDir: string
): string[] {
  const warnings: string[] = []

  if (databases.length > 1) {
    warnings.push(
      `⚠️  Found ${databases.length} coordination databases - this can cause message fragmentation!`
    )

    const multiParticipant = databases.filter(db => db.participantCount > 1)
    const singleParticipant = databases.filter(db => db.participantCount <= 1)

    if (multiParticipant.length > 0) {
      warnings.push(
        `📊 Recommended: Use central database at ${path.relative(currentDir, multiParticipant[0].path)}`
      )
    }

    if (singleParticipant.length > 0) {
      warnings.push(
        `🔄 Consider migrating messages from ${singleParticipant.length} single-participant databases`
      )
    }
  }

  return warnings
}

/**
 * Check if coordination should be centralized
 */
export function shouldCentralizeCoordination(databases: DatabaseLocation[]): boolean {
  // If there are multiple databases, centralization is recommended
  if (databases.length > 1) {
    return true
  }

  // If there's a parent database with multiple participants, use that
  const parentMulti = databases.find(db => db.type === 'parent' && db.participantCount > 1)
  if (parentMulti) {
    return true
  }

  return false
}

// Helper functions

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function getParticipantCount(configDir: string): Promise<number> {
  try {
    const configPath = path.join(configDir, 'config.yaml')
    const configContent = await fs.readFile(configPath, 'utf8')

    // Count participant entries in YAML
    const participantMatches = configContent.match(/- id: "[@]/g)
    return participantMatches ? participantMatches.length : 0
  } catch {
    return 0
  }
}

async function getLastActivity(dbPath: string): Promise<Date | undefined> {
  try {
    const stat = await fs.stat(dbPath)
    return stat.mtime
  } catch {
    return undefined
  }
}

async function findProjectRoot(currentDir: string): Promise<string | null> {
  const indicators = ['.git', 'package.json', 'tsconfig.json', '.gitignore']

  let searchDir = currentDir
  for (let i = 0; i < 10; i++) {
    // Max 10 levels up
    for (const indicator of indicators) {
      const indicatorPath = path.join(searchDir, indicator)
      if (await fileExists(indicatorPath)) {
        return searchDir
      }
    }

    const parentDir = path.dirname(searchDir)
    if (parentDir === searchDir) {
      break
    } // Reached root
    searchDir = parentDir
  }

  return null
}

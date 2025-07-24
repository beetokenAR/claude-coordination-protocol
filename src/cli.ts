#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'
import fs from 'fs/promises'
import path from 'path'
import YAML from 'yaml'

import { CoordinationDatabase } from './database/connection.js'
import { MessageManager } from './core/message-manager.js'
import { ParticipantRegistry } from './core/participant-registry.js'
import { IndexingEngine } from './core/indexing-engine.js'
import { CompactionEngine } from './core/compaction-engine.js'
import { CoordinationMCPServer } from './mcp/server.js'
import { validateInput } from './utils/validation.js'
import { discoverDatabases, suggestBestDatabase, generateFragmentationWarnings } from './utils/database-discovery.js'
import {
  CoordinationConfig,
  ParticipantId,
  SendMessageInput,
  GetMessagesInput,
  SearchMessagesInput,
  CompactThreadInput,
  Priority
} from './types/index.js'

const program = new Command()

// Read version from package.json
const packageJson = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf-8'))

program
  .name('ccp')
  .description('Claude Coordination Protocol - Inter-Claude communication system')
  .version(packageJson.version)

// Initialize project
program
  .command('init')
  .description('Initialize coordination system in current directory')
  .option('--participant-id <id>', 'Participant ID (e.g., @backend)', '@claude')
  .option('--local', 'Initialize for local project only')
  .action(async (options) => {
    const spinner = ora('Initializing coordination system...').start()
    
    try {
      const dataDir = '.coordination'
      const configPath = path.join(dataDir, 'config.yaml')
      
      // Create directories
      await fs.mkdir(dataDir, { recursive: true })
      await fs.mkdir(path.join(dataDir, 'messages', 'active'), { recursive: true })
      await fs.mkdir(path.join(dataDir, 'messages', 'archive'), { recursive: true })
      await fs.mkdir(path.join(dataDir, 'locks'), { recursive: true })
      
      // Create default config
      const config: CoordinationConfig = {
        participant_id: options.participantId as ParticipantId,
        data_directory: dataDir,
        archive_days: 30,
        token_limit: 1000000,
        auto_compact: true,
        participants: [
          {
            id: options.participantId as ParticipantId,
            capabilities: ['coordination'],
            status: 'active',
            default_priority: 'M'
          }
        ],
        notification_settings: {
          enabled: true,
          priority_threshold: 'M',
          batch_notifications: true
        }
      }
      
      await fs.writeFile(configPath, YAML.stringify(config), 'utf-8')
      
      // Initialize database
      const db = new CoordinationDatabase(dataDir)
      const participantRegistry = new ParticipantRegistry(db, dataDir)
      
      // Register the participant
      await participantRegistry.registerParticipant({
        id: options.participantId as ParticipantId,
        capabilities: ['coordination'],
        default_priority: 'M'
      })
      
      db.close()
      
      // Create .mcp.json if it doesn't exist
      const mcpConfigPath = '.mcp.json'
      let mcpConfig: any = {}
      
      try {
        const existingConfig = await fs.readFile(mcpConfigPath, 'utf-8')
        mcpConfig = JSON.parse(existingConfig)
      } catch {
        // File doesn't exist, create new one
      }
      
      if (!mcpConfig.mcpServers) {
        mcpConfig.mcpServers = {}
      }
      
      mcpConfig.mcpServers['claude-coordination-protocol'] = {
        command: 'ccp',
        args: ['server'],
        env: {
          CCP_CONFIG: configPath,
          CCP_PARTICIPANT_ID: options.participantId
        }
      }
      
      await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), 'utf-8')
      
      spinner.succeed(chalk.green('✅ Coordination system initialized!'))
      
      console.log(chalk.blue('\n📋 Next steps:'))
      console.log(`• Configuration saved to: ${chalk.yellow(configPath)}`)
      console.log(`• MCP configuration updated: ${chalk.yellow(mcpConfigPath)}`)
      console.log(`• Participant registered: ${chalk.yellow(options.participantId)}`)
      console.log(`• Run ${chalk.cyan('ccp status')} to verify setup`)
      
    } catch (error) {
      spinner.fail(chalk.red('❌ Failed to initialize'))
      console.error(error)
      process.exit(1)
    }
  })

// Validate coordination setup
program
  .command('validate')
  .description('Validate coordination setup and detect fragmentation')
  .action(async () => {
    console.log(chalk.blue('🔍 Validating coordination setup...'))
    
    try {
      const currentDir = process.cwd()
      const databases = await discoverDatabases(currentDir)
      const warnings = generateFragmentationWarnings(databases, currentDir)
      const bestDatabase = suggestBestDatabase(databases)
      
      console.log(chalk.blue(`\n📊 Found ${databases.length} coordination database(s):`))
      
      for (const [index, db] of databases.entries()) {
        const indicator = bestDatabase === db ? '🎯' : index === 0 ? '🟢' : '⚠️'
        const relativePath = path.relative(currentDir, db.path)
        
        console.log(`${indicator} ${relativePath}`)
        console.log(`   Type: ${db.type}, Participants: ${db.participantCount}, Distance: ${db.distance}`)
        if (db.lastActivity) {
          console.log(`   Last activity: ${db.lastActivity.toLocaleDateString()}`)
        }
      }
      
      if (warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️  Warnings:'))
        warnings.forEach(warning => console.log(warning))
      }
      
      if (bestDatabase) {
        const recommendedPath = path.relative(currentDir, path.dirname(bestDatabase.path))
        console.log(chalk.green(`\n✅ Recommended database: ${recommendedPath}`))
        
        if (databases.length > 1) {
          console.log(chalk.blue('\n💡 To fix fragmentation:'))
          console.log(`1. Work from: ${chalk.cyan(path.dirname(bestDatabase.path))}`)
          console.log(`2. Configure MCP to use: ${chalk.cyan(bestDatabase.path)}`)
          console.log(`3. Run: ${chalk.cyan('ccp migrate')} to consolidate messages`)
        }
      } else {
        console.log(chalk.yellow('\n⚠️  No coordination databases found'))
        console.log(`Run: ${chalk.green('ccp init')} to initialize coordination`)
      }
      
    } catch (error) {
      console.error(chalk.red('Validation failed:'), error)
      process.exit(1)
    }
  })

// Setup interactive configuration
program
  .command('setup')
  .description('Interactive setup wizard')
  .option('--participant-id <id>', 'Participant ID')
  .action(async (options) => {
    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'participantId',
          message: 'Enter your participant ID:',
          default: options.participantId || '@claude',
          validate: (input) => {
            if (!/^@[a-zA-Z][a-zA-Z0-9_-]*$/.test(input)) {
              return 'Participant ID must start with @ followed by alphanumeric characters'
            }
            return true
          }
        },
        {
          type: 'checkbox',
          name: 'capabilities',
          message: 'Select your capabilities:',
          choices: [
            { name: 'API Development', value: 'api' },
            { name: 'Database Management', value: 'database' },
            { name: 'Frontend Development', value: 'frontend' },
            { name: 'Backend Development', value: 'backend' },
            { name: 'Security & Auth', value: 'security' },
            { name: 'Infrastructure', value: 'infrastructure' },
            { name: 'Testing & QA', value: 'testing' },
            { name: 'Documentation', value: 'documentation' }
          ]
        },
        {
          type: 'list',
          name: 'defaultPriority',
          message: 'Default message priority:',
          choices: [
            { name: 'Critical', value: 'CRITICAL' },
            { name: 'High', value: 'H' },
            { name: 'Medium', value: 'M' },
            { name: 'Low', value: 'L' }
          ],
          default: 'M'
        },
        {
          type: 'number',
          name: 'archiveDays',
          message: 'Archive messages after how many days?',
          default: 30,
          validate: (input) => input > 0 || 'Must be greater than 0'
        }
      ])
      
      // Initialize with answers
      await program.parseAsync(['init', '--participant-id', answers.participantId])
      
    } catch (error) {
      console.error(chalk.red('Setup failed:'), error)
      process.exit(1)
    }
  })

// Start MCP server
program
  .command('server')
  .description('Start MCP server (used by Claude Code)')
  .action(async () => {
    try {
      const config = await loadConfig()
      const server = new CoordinationMCPServer(config)
      await server.run()
    } catch (error) {
      console.error(chalk.red('Failed to start server:'), error)
      process.exit(1)
    }
  })

// Send message
program
  .command('send')
  .description('Send a coordination message')
  .option('--to <participants>', 'Target participants (comma-separated)')
  .option('--type <type>', 'Message type', 'sync')
  .option('--priority <priority>', 'Priority level', 'M')
  .option('--subject <subject>', 'Message subject')
  .option('--content <content>', 'Message content')
  .action(async (options) => {
    try {
      const config = await loadConfig()
      const db = new CoordinationDatabase(config.data_directory)
      const messageManager = new MessageManager(db, config.data_directory)
      
      const input: SendMessageInput = {
        to: options.to.split(',').map((p: string) => p.trim()) as ParticipantId[],
        type: options.type,
        priority: options.priority,
        subject: options.subject,
        content: options.content,
        response_required: true,
        expires_in_hours: 168
      }
      
      const message = await messageManager.createMessage(input, config.participant_id)
      
      console.log(chalk.green('✅ Message sent successfully!'))
      console.log(`ID: ${message.id}`)
      console.log(`Thread: ${message.thread_id}`)
      
      db.close()
      
    } catch (error) {
      console.error(chalk.red('Failed to send message:'), error)
      process.exit(1)
    }
  })

// List messages
program
  .command('list')
  .description('List coordination messages')
  .option('--status <status>', 'Filter by status')
  .option('--type <type>', 'Filter by type')
  .option('--priority <priority>', 'Filter by priority')
  .option('--limit <limit>', 'Maximum number of messages', '20')
  .action(async (options) => {
    try {
      const config = await loadConfig()
      const db = new CoordinationDatabase(config.data_directory)
      const messageManager = new MessageManager(db, config.data_directory)
      
      const input: GetMessagesInput = {
        status: options.status ? [options.status] : undefined,
        type: options.type ? [options.type] : undefined,
        priority: options.priority ? [options.priority] : undefined,
        limit: parseInt(options.limit),
        detail_level: 'summary'
      }
      
      const messages = await messageManager.getMessages(input, config.participant_id)
      
      if (messages.length === 0) {
        console.log(chalk.yellow('📭 No messages found'))
        return
      }
      
      console.log(chalk.blue(`📨 Found ${messages.length} messages:`))
      console.log()
      
      for (const msg of messages) {
        const statusIcon = msg.status === 'pending' ? '⏳' :
                          msg.status === 'read' ? '👁️' :
                          msg.status === 'responded' ? '💬' :
                          msg.status === 'resolved' ? '✅' : '📁'
        
        const priorityColor = msg.priority === 'CRITICAL' ? chalk.red :
                             msg.priority === 'H' ? chalk.magenta :
                             msg.priority === 'M' ? chalk.yellow : chalk.green
        
        console.log(`${statusIcon} ${priorityColor(msg.priority)} ${chalk.bold(msg.id)} - ${msg.subject}`)
        console.log(`   ${chalk.gray(`From: ${msg.from} → To: ${msg.to.join(', ')}`)}`)
        console.log(`   ${chalk.gray(`Type: ${msg.type} | Created: ${msg.created_at.toLocaleDateString()}`)}`)
        console.log(`   ${msg.summary.substring(0, 100)}${msg.summary.length > 100 ? '...' : ''}`)
        console.log()
      }
      
      db.close()
      
    } catch (error) {
      console.error(chalk.red('Failed to list messages:'), error)
      process.exit(1)
    }
  })

// Show system status
program
  .command('status')
  .description('Show coordination system status')
  .action(async () => {
    try {
      const config = await loadConfig()
      const db = new CoordinationDatabase(config.data_directory)
      const participantRegistry = new ParticipantRegistry(db, config.data_directory)
      const indexingEngine = new IndexingEngine(db)
      
      console.log(chalk.blue('📊 Coordination System Status'))
      console.log()
      
      // Database info
      const dbInfo = db.getInfo()
      console.log(chalk.green('Database:'))
      console.log(`  Path: ${dbInfo.path}`)
      console.log(`  Size: ${Math.round(dbInfo.size / 1024)} KB`)
      console.log(`  Permissions: ${dbInfo.permissions}`)
      console.log()
      
      // Participant info
      const participants = await participantRegistry.getParticipants()
      console.log(chalk.green('Participants:'))
      for (const p of participants) {
        const statusIcon = p.status === 'active' ? '🟢' : 
                          p.status === 'inactive' ? '🔴' : '🟡'
        console.log(`  ${statusIcon} ${p.id} (${p.capabilities.join(', ')})`)
      }
      console.log()
      
      // Message stats
      const stats = await indexingEngine.getMessageStats(config.participant_id, 7)
      console.log(chalk.green('Messages (Last 7 days):'))
      console.log(`  Total: ${stats.total_messages}`)
      console.log(`  Sent: ${stats.messages_sent}`)
      console.log(`  Received: ${stats.messages_received}`)
      console.log(`  Response Rate: ${Math.round(stats.response_rate * 100)}%`)
      console.log()
      
      db.close()
      
    } catch (error) {
      console.error(chalk.red('Failed to get status:'), error)
      process.exit(1)
    }
  })

// Compact thread
program
  .command('compact')
  .description('Compact a conversation thread')
  .option('--thread-id <id>', 'Thread ID to compact')
  .option('--strategy <strategy>', 'Compaction strategy', 'summarize')
  .action(async (options) => {
    if (!options.threadId) {
      console.error(chalk.red('❌ Thread ID is required'))
      process.exit(1)
    }
    
    try {
      const config = await loadConfig()
      const db = new CoordinationDatabase(config.data_directory)
      const compactionEngine = new CompactionEngine(db, config.data_directory)
      
      const spinner = ora('Compacting thread...').start()
      
      const input: CompactThreadInput = {
        thread_id: options.threadId,
        strategy: options.strategy,
        preserve_decisions: true,
        preserve_critical: true
      }
      
      const result = await compactionEngine.compactThread(input, config.participant_id)
      
      spinner.succeed(chalk.green('✅ Thread compacted successfully!'))
      
      console.log(`Original messages: ${result.original_count}`)
      console.log(`Compacted messages: ${result.compacted_count}`)
      console.log(`Space saved: ${Math.round(result.space_saved_bytes / 1024)} KB`)
      
      db.close()
      
    } catch (error) {
      console.error(chalk.red('Failed to compact thread:'), error)
      process.exit(1)
    }
  })


// Search messages
program
  .command('search')
  .description('Search coordination messages')
  .argument('<query>', 'Search query')
  .option('--limit <limit>', 'Maximum results', '10')
  .action(async (query, options) => {
    try {
      const config = await loadConfig()
      const db = new CoordinationDatabase(config.data_directory)
      const indexingEngine = new IndexingEngine(db)
      
      const input: SearchMessagesInput = {
        query,
        semantic: true,
        limit: parseInt(options.limit)
      }
      
      const results = await indexingEngine.searchMessages(input, config.participant_id)
      
      if (results.length === 0) {
        console.log(chalk.yellow(`🔍 No results found for: "${query}"`))
        return
      }
      
      console.log(chalk.blue(`🔍 Found ${results.length} results for: "${query}"`))
      console.log()
      
      for (const result of results) {
        const relevance = Math.round(result.relevance_score * 100)
        console.log(`${chalk.bold(result.message.id)} (${relevance}% match)`)
        console.log(`${result.message.subject}`)
        console.log(chalk.gray(`From: ${result.message.from} | ${result.message.created_at.toLocaleDateString()}`))
        console.log(`${result.match_context || result.message.summary.substring(0, 150)}...`)
        console.log()
      }
      
      db.close()
      
    } catch (error) {
      console.error(chalk.red('Failed to search:'), error)
      process.exit(1)
    }
  })

async function loadConfig(): Promise<CoordinationConfig> {
  const configPaths = [
    process.env.CCP_CONFIG,
    '.coordination/config.yaml',
    path.join(process.cwd(), '.coordination', 'config.yaml')
  ].filter(Boolean) as string[]
  
  for (const configPath of configPaths) {
    try {
      if (await fs.access(configPath).then(() => true).catch(() => false)) {
        const configContent = await fs.readFile(configPath, 'utf-8')
        const rawConfig = YAML.parse(configContent)
        return validateInput(CoordinationConfig, rawConfig, 'configuration file')
      }
    } catch (error) {
      // Continue to next path
    }
  }
  
  throw new Error('No configuration file found. Run "ccp init" first.')
}

// Participant management commands
const participant = program.command('participant')
  .description('Manage participants')

// Add participant
participant
  .command('add <id>')
  .description('Add a new participant')
  .option('--capabilities <capabilities>', 'Comma-separated list of capabilities', 'coordination')
  .option('--priority <priority>', 'Default priority (CRITICAL, H, M, L)', 'M')
  .action(async (id, options) => {
    try {
      const config = await loadConfig()
      const db = new CoordinationDatabase(config.data_directory)
      const participantRegistry = new ParticipantRegistry(db, config.data_directory)
      
      // Parse capabilities
      const capabilities = options.capabilities.split(',').map(c => c.trim())
      
      const newParticipant = {
        id: id as ParticipantId,
        capabilities,
        default_priority: options.priority as Priority
      }
      
      await participantRegistry.registerParticipant(newParticipant)
      
      console.log(chalk.green(`✅ Participant ${id} added successfully!`))
      console.log(`Capabilities: ${capabilities.join(', ')}`)
      console.log(`Default Priority: ${options.priority}`)
      
      db.close()
    } catch (error) {
      console.error(chalk.red('Failed to add participant:'), error)
      process.exit(1)
    }
  })

// List participants
participant
  .command('list')
  .description('List all participants')
  .action(async () => {
    try {
      const config = await loadConfig()
      const db = new CoordinationDatabase(config.data_directory)
      const participantRegistry = new ParticipantRegistry(db, config.data_directory)
      
      const participants = await participantRegistry.getParticipants()
      
      console.log(chalk.blue('👥 Registered Participants'))
      console.log()
      
      if (participants.length === 0) {
        console.log(chalk.yellow('No participants registered yet.'))
      } else {
        for (const p of participants) {
          const statusIcon = p.status === 'active' ? '🟢' : 
                            p.status === 'inactive' ? '🔴' : '🟡'
          console.log(`${statusIcon} ${chalk.bold(p.id)}`)
          console.log(`   Capabilities: ${p.capabilities.join(', ')}`)
          console.log(`   Priority: ${p.default_priority}`)
          console.log(`   Status: ${p.status}`)
          if (p.last_seen) {
            console.log(`   Last Seen: ${p.last_seen.toLocaleString()}`)
          }
          console.log()
        }
      }
      
      db.close()
    } catch (error) {
      console.error(chalk.red('Failed to list participants:'), error)
      process.exit(1)
    }
  })

// Update participant
participant
  .command('update <id>')
  .description('Update participant information')
  .option('--capabilities <capabilities>', 'Comma-separated list of capabilities')
  .option('--priority <priority>', 'Default priority (CRITICAL, H, M, L)')
  .option('--status <status>', 'Status (active, inactive, maintenance)')
  .action(async (id, options) => {
    try {
      const config = await loadConfig()
      const db = new CoordinationDatabase(config.data_directory)
      const participantRegistry = new ParticipantRegistry(db, config.data_directory)
      
      const updates: any = {}
      
      if (options.capabilities) {
        updates.capabilities = options.capabilities.split(',').map(c => c.trim())
      }
      
      if (options.priority) {
        updates.default_priority = options.priority as Priority
      }
      
      if (options.status) {
        updates.status = options.status
      }
      
      await participantRegistry.updateParticipant(
        id as ParticipantId,
        updates,
        config.participant_id
      )
      
      console.log(chalk.green(`✅ Participant ${id} updated successfully!`))
      
      db.close()
    } catch (error) {
      console.error(chalk.red('Failed to update participant:'), error)
      process.exit(1)
    }
  })

// Remove participant
participant
  .command('remove <id>')
  .description('Remove a participant (soft delete)')
  .action(async (id) => {
    try {
      const config = await loadConfig()
      const db = new CoordinationDatabase(config.data_directory)
      const participantRegistry = new ParticipantRegistry(db, config.data_directory)
      
      await participantRegistry.deactivateParticipant(id as ParticipantId, config.participant_id)
      
      console.log(chalk.green(`✅ Participant ${id} deactivated successfully!`))
      
      db.close()
    } catch (error) {
      console.error(chalk.red('Failed to remove participant:'), error)
      process.exit(1)
    }
  })

// Parse and execute
program.parse()
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js'

import { CoordinationDatabase } from '../database/connection.js'
import { MessageManager } from '../core/message-manager.js'
import { ParticipantRegistry } from '../core/participant-registry.js'
import { IndexingEngine } from '../core/indexing-engine.js'
import { CompactionEngine } from '../core/compaction-engine.js'
import { validateInput } from '../utils/validation.js'
import {
  SendMessageInput,
  GetMessagesInput,
  RespondMessageInput,
  SearchMessagesInput,
  CompactThreadInput,
  CoordinationConfig,
  CoordinationError,
  DatabaseError,
  PermissionError
} from '../types/index.js'

export class CoordinationMCPServer {
  private server: Server
  private db: CoordinationDatabase
  private messageManager: MessageManager
  private participantRegistry: ParticipantRegistry
  private indexingEngine: IndexingEngine
  private compactionEngine: CompactionEngine
  private config: CoordinationConfig
  
  constructor(config: CoordinationConfig) {
    this.config = config
    this.server = new Server(
      {
        name: 'claude-coordination-protocol',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )
    
    // Initialize database and core components
    this.db = new CoordinationDatabase(config.data_directory)
    this.messageManager = new MessageManager(this.db, config.data_directory)
    this.participantRegistry = new ParticipantRegistry(this.db, config.data_directory)
    this.indexingEngine = new IndexingEngine(this.db)
    this.compactionEngine = new CompactionEngine(this.db, config.data_directory)
    
    this.setupToolHandlers()
    this.setupErrorHandling()
  }
  
  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'ccp_send_message',
          description: 'Send a coordination message to other Claude participants',
          inputSchema: {
            type: 'object',
            properties: {
              to: {
                type: 'array',
                items: { type: 'string', pattern: '^@[a-zA-Z][a-zA-Z0-9_-]*$' },
                description: 'Target participant IDs (e.g., ["@mobile", "@backend"])'
              },
              type: {
                type: 'string',
                enum: ['arch', 'contract', 'sync', 'update', 'q', 'emergency', 'broadcast'],
                description: 'Message type'
              },
              priority: {
                type: 'string',
                enum: ['CRITICAL', 'H', 'M', 'L'],
                description: 'Message priority'
              },
              subject: {
                type: 'string',
                maxLength: 200,
                description: 'Message subject/title'
              },
              content: {
                type: 'string',
                description: 'Message content (will be stored in file if large)'
              },
              response_required: {
                type: 'boolean',
                default: true,
                description: 'Whether response is required'
              },
              expires_in_hours: {
                type: 'number',
                default: 168,
                description: 'Hours until message expires'
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional tags for categorization'
              },
              suggested_approach: {
                type: 'object',
                properties: {
                  superclaude_commands: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Suggested SuperClaude commands (e.g., ["/sc:analyze", "/sc:improve"])'
                  },
                  superclaude_personas: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Suggested personas (e.g., ["--persona-security", "--persona-architect"])'
                  },
                  superclaude_flags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Suggested flags (e.g., ["--think-hard", "--validate"])'
                  },
                  analysis_focus: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Key areas to focus on (e.g., ["authentication", "rate-limiting"])'
                  },
                  tools_recommended: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Recommended MCP tools (e.g., ["Sequential", "Context7"])'
                  }
                },
                description: 'SuperClaude suggestions for recipient'
              }
            },
            required: ['to', 'type', 'priority', 'subject', 'content']
          }
        },
        
        {
          name: 'ccp_get_messages',
          description: 'Retrieve coordination messages with filtering',
          inputSchema: {
            type: 'object',
            properties: {
              participant: {
                type: 'string',
                pattern: '^@[a-zA-Z][a-zA-Z0-9_-]*$',
                description: 'Filter by participant (defaults to current participant)'
              },
              status: {
                type: 'array',
                items: { 
                  type: 'string',
                  enum: ['pending', 'read', 'responded', 'resolved', 'archived', 'cancelled']
                },
                description: 'Filter by message status'
              },
              type: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['arch', 'contract', 'sync', 'update', 'q', 'emergency', 'broadcast']
                },
                description: 'Filter by message type'
              },
              priority: {
                type: 'array',
                items: { type: 'string', enum: ['CRITICAL', 'H', 'M', 'L'] },
                description: 'Filter by priority'
              },
              since_hours: {
                type: 'number',
                description: 'Only messages from last N hours'
              },
              thread_id: {
                type: 'string',
                description: 'Filter by specific thread'
              },
              limit: {
                type: 'number',
                default: 20,
                maximum: 100,
                description: 'Maximum number of messages to return'
              },
              detail_level: {
                type: 'string',
                enum: ['index', 'summary', 'full'],
                default: 'summary',
                description: 'Amount of detail to include'
              }
            }
          }
        },
        
        {
          name: 'ccp_respond_message',
          description: 'Respond to a coordination message',
          inputSchema: {
            type: 'object',
            properties: {
              message_id: {
                type: 'string',
                description: 'ID of message to respond to'
              },
              content: {
                type: 'string',
                description: 'Response content'
              },
              resolution_status: {
                type: 'string',
                enum: ['partial', 'complete', 'requires_followup', 'blocked'],
                description: 'Resolution status if applicable'
              }
            },
            required: ['message_id', 'content']
          }
        },
        
        {
          name: 'ccp_search_messages',
          description: 'Search messages using full-text search',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query'
              },
              semantic: {
                type: 'boolean',
                default: true,
                description: 'Use semantic/full-text search'
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tags'
              },
              date_range: {
                type: 'object',
                properties: {
                  from: { type: 'string', format: 'date-time' },
                  to: { type: 'string', format: 'date-time' }
                },
                description: 'Date range filter'
              },
              participants: {
                type: 'array',
                items: { type: 'string', pattern: '^@[a-zA-Z][a-zA-Z0-9_-]*$' },
                description: 'Filter by participants'
              },
              limit: {
                type: 'number',
                default: 10,
                maximum: 50,
                description: 'Maximum results'
              }
            },
            required: ['query']
          }
        },
        
        {
          name: 'ccp_compact_thread',
          description: 'Compact a conversation thread to optimize token usage',
          inputSchema: {
            type: 'object',
            properties: {
              thread_id: {
                type: 'string',
                description: 'Thread ID to compact'
              },
              strategy: {
                type: 'string',
                enum: ['summarize', 'consolidate', 'archive'],
                default: 'summarize',
                description: 'Compaction strategy'
              },
              preserve_decisions: {
                type: 'boolean',
                default: true,
                description: 'Preserve decision messages'
              },
              preserve_critical: {
                type: 'boolean',
                default: true,
                description: 'Preserve critical priority messages'
              }
            },
            required: ['thread_id']
          }
        },
        
        {
          name: 'ccp_archive_resolved',
          description: 'Archive resolved messages automatically',
          inputSchema: {
            type: 'object',
            properties: {
              older_than_days: {
                type: 'number',
                default: 30,
                description: 'Archive messages older than N days'
              },
              preserve_critical: {
                type: 'boolean',
                default: true,
                description: 'Preserve critical messages'
              },
              create_summary: {
                type: 'boolean',
                default: true,
                description: 'Create summary before archiving'
              }
            }
          }
        },
        
        {
          name: 'ccp_get_stats',
          description: 'Get coordination system statistics',
          inputSchema: {
            type: 'object',
            properties: {
              participant: {
                type: 'string',
                pattern: '^@[a-zA-Z][a-zA-Z0-9_-]*$',
                description: 'Get stats for specific participant'
              },
              timeframe_days: {
                type: 'number',
                default: 7,
                description: 'Timeframe for statistics'
              }
            }
          }
        },
        
        {
          name: 'ccp_register_participant',
          description: 'Register a new Claude participant',
          inputSchema: {
            type: 'object',
            properties: {
              participant_id: {
                type: 'string',
                pattern: '^@[a-zA-Z][a-zA-Z0-9_-]*$',
                description: 'Participant ID (e.g., @backend)'
              },
              capabilities: {
                type: 'array',
                items: { type: 'string' },
                description: 'Participant capabilities'
              },
              default_priority: {
                type: 'string',
                enum: ['CRITICAL', 'H', 'M', 'L'],
                default: 'M',
                description: 'Default message priority'
              }
            },
            required: ['participant_id', 'capabilities']
          }
        },
        
        {
          name: 'ccp_whoami',
          description: 'Get current participant identity and configuration',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        
        {
          name: 'ccp_help',
          description: 'Get help and usage information for CCP tools',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'Specific command to get help for (optional)'
              }
            }
          }
        },
        
        {
          name: 'ccp_get_stats',
          description: 'Get coordination system statistics and analytics',
          inputSchema: {
            type: 'object',
            properties: {
              timeframe_days: {
                type: 'number',
                default: 7,
                description: 'Number of days to analyze (default: 7)'
              },
              include_participants: {
                type: 'boolean',
                default: false,
                description: 'Include per-participant statistics'
              }
            }
          }
        },
        
        {
          name: 'ccp_setup_guide',
          description: 'Get setup and configuration guide for Claude Coordination Protocol',
          inputSchema: {
            type: 'object',
            properties: {
              topic: {
                type: 'string',
                enum: ['quickstart', 'mcp_config', 'participants', 'messaging', 'troubleshooting'],
                description: 'Specific setup topic'
              }
            }
          }
        }
      ]
    }))
    
    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params
        
        // Update last seen for current participant
        await this.participantRegistry.updateLastSeen(this.config.participant_id)
        
        switch (name) {
          case 'ccp_send_message':
            return await this.handleSendMessage(args)
            
          case 'ccp_get_messages':
            return await this.handleGetMessages(args)
            
          case 'ccp_respond_message':
            return await this.handleRespondMessage(args)
            
          case 'ccp_search_messages':
            return await this.handleSearchMessages(args)
            
          case 'ccp_compact_thread':
            return await this.handleCompactThread(args)
            
          case 'ccp_archive_resolved':
            return await this.handleArchiveResolved(args)
            
          case 'ccp_get_stats':
            return await this.handleGetStats(args)
            
          case 'ccp_register_participant':
            return await this.handleRegisterParticipant(args)
          
          case 'ccp_whoami':
            return await this.handleWhoami()
          
          case 'ccp_help':
            return await this.handleHelp(args)
          
          case 'ccp_setup_guide':
            return await this.handleSetupGuide(args)
            
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            )
        }
        
      } catch (error) {
        return this.handleToolError(error)
      }
    })
  }
  
  private async handleSendMessage(args: unknown): Promise<any> {
    const rawInput = validateInput(SendMessageInput, args, 'send_message')
    const input = {
      ...rawInput,
      response_required: rawInput.response_required ?? true,
      expires_in_hours: rawInput.expires_in_hours ?? 168
    }
    
    // Validate permissions
    const canSend = await this.participantRegistry.canSendMessage(
      this.config.participant_id,
      input.to
    )
    
    if (!canSend) {
      throw new PermissionError('Cannot send message to specified participants')
    }
    
    const message = await this.messageManager.createMessage(input, this.config.participant_id)
    
    // Index the message
    await this.indexingEngine.indexMessage(message)
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Message sent successfully!\n\n**ID:** ${message.id}\n**Thread:** ${message.thread_id}\n**To:** ${message.to.join(', ')}\n**Subject:** ${message.subject}\n**Priority:** ${message.priority}\n**Status:** ${message.status}`
        }
      ]
    }
  }
  
  private async handleGetMessages(args: unknown): Promise<any> {
    const rawInput = validateInput(GetMessagesInput, args, 'get_messages')
    const input = {
      ...rawInput,
      limit: rawInput.limit ?? 20,
      detail_level: rawInput.detail_level ?? 'full'
    }
    
    const messages = await this.messageManager.getMessages(input, this.config.participant_id)
    
    if (messages.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: '📭 No messages found matching the criteria.'
          }
        ]
      }
    }
    
    const formatMessage = (msg: any) => {
      const status = msg.status === 'pending' ? '⏳' :
                   msg.status === 'read' ? '👁️' :
                   msg.status === 'responded' ? '💬' :
                   msg.status === 'resolved' ? '✅' : '📁'
      
      const priority = msg.priority === 'CRITICAL' ? '🚨' :
                      msg.priority === 'H' ? '🔴' :
                      msg.priority === 'M' ? '🟡' : '🟢'
      
      return `${status} ${priority} **${msg.id}** - ${msg.subject}\n` +
             `   From: ${msg.from} → To: ${msg.to.join(', ')}\n` +
             `   Type: ${msg.type} | Created: ${msg.created_at.toLocaleDateString()}\n` +
             `   ${msg.summary.substring(0, 150)}${msg.summary.length > 150 ? '...' : ''}\n`
    }
    
    const messageList = messages.map(formatMessage).join('\n')
    
    return {
      content: [
        {
          type: 'text',
          text: `📨 **${messages.length} Messages Found**\n\n${messageList}`
        }
      ]
    }
  }
  
  private async handleRespondMessage(args: unknown): Promise<any> {
    const input = validateInput(RespondMessageInput, args, 'respond_message')
    
    const response = await this.messageManager.respondToMessage(input, this.config.participant_id)
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Response sent successfully!\n\n**Response ID:** ${response.id}\n**Original Message:** ${input.message_id}\n**Status:** ${input.resolution_status || 'responded'}`
        }
      ]
    }
  }
  
  private async handleSearchMessages(args: unknown): Promise<any> {
    const rawInput = validateInput(SearchMessagesInput, args, 'search_messages')
    const input = {
      ...rawInput,
      limit: rawInput.limit ?? 10,
      semantic: rawInput.semantic ?? true
    }
    
    const results = await this.indexingEngine.searchMessages(input, this.config.participant_id)
    
    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `🔍 No messages found for query: "${input.query}"`
          }
        ]
      }
    }
    
    const formatResult = (result: any) => {
      const relevance = Math.round(result.relevance_score * 100)
      return `**${result.message.id}** (${relevance}% match)\n` +
             `${result.message.subject}\n` +
             `From: ${result.message.from} | ${result.message.created_at.toLocaleDateString()}\n` +
             `${result.match_context || result.message.summary.substring(0, 100)}...\n`
    }
    
    const resultList = results.map(formatResult).join('\n')
    
    return {
      content: [
        {
          type: 'text',
          text: `🔍 **${results.length} Search Results for "${input.query}"**\n\n${resultList}`
        }
      ]
    }
  }
  
  private async handleCompactThread(args: unknown): Promise<any> {
    const rawInput = validateInput(CompactThreadInput, args, 'compact_thread')
    const input = {
      ...rawInput,
      strategy: rawInput.strategy ?? 'summarize',
      preserve_decisions: rawInput.preserve_decisions ?? true,
      preserve_critical: rawInput.preserve_critical ?? true
    }
    
    const result = await this.compactionEngine.compactThread(input, this.config.participant_id)
    
    const savedKB = Math.round(result.space_saved_bytes / 1024)
    
    return {
      content: [
        {
          type: 'text',
          text: '🗜️ **Thread Compacted Successfully**\n\n' +
               `**Strategy:** ${input.strategy}\n` +
               `**Original Messages:** ${result.original_count}\n` +
               `**Compacted Messages:** ${result.compacted_count}\n` +
               `**Space Saved:** ${savedKB} KB\n\n` +
               `${result.summary ? `**Summary:**\n${result.summary.substring(0, 300)}...` : ''}`
        }
      ]
    }
  }
  
  private async handleArchiveResolved(_args: unknown): Promise<any> {
    const archivedCount = await this.messageManager.archiveExpiredMessages()
    
    return {
      content: [
        {
          type: 'text',
          text: `📁 **Archive Complete**\n\n**Messages Archived:** ${archivedCount}`
        }
      ]
    }
  }
  
  
  private async handleRegisterParticipant(args: unknown): Promise<any> {
    const input = args as any
    
    // Only admins can register new participants
    if (!await this.participantRegistry.isAdmin(this.config.participant_id)) {
      throw new PermissionError('Only administrators can register new participants')
    }
    
    const participant = await this.participantRegistry.registerParticipant({
      id: input.participant_id,
      capabilities: input.capabilities || [],
      default_priority: input.default_priority || 'M',
      preferences: {}
    })
    
    return {
      content: [
        {
          type: 'text',
          text: '✅ **Participant Registered**\n\n' +
               `**ID:** ${participant.id}\n` +
               `**Capabilities:** ${participant.capabilities.join(', ')}\n` +
               `**Default Priority:** ${participant.default_priority}\n` +
               `**Status:** ${participant.status}`
        }
      ]
    }
  }
  
  private async handleWhoami(): Promise<any> {
    const participant = await this.participantRegistry.getParticipant(this.config.participant_id)
    
    if (!participant) {
      return {
        content: [
          {
            type: 'text',
            text: `⚠️ **Current participant not found**: ${this.config.participant_id}\n\nPlease run setup to register this participant.`
          }
        ]
      }
    }
    
    const statusEmoji = participant.status === 'active' ? '🟢' :
                       participant.status === 'inactive' ? '🔴' : '🟡'
    
    return {
      content: [
        {
          type: 'text',
          text: '👤 **Current Participant Identity**\n\n' +
               `**ID:** ${participant.id}\n` +
               `**Status:** ${statusEmoji} ${participant.status}\n` +
               `**Capabilities:** ${participant.capabilities.join(', ')}\n` +
               `**Default Priority:** ${participant.default_priority}\n` +
               `**Last Seen:** ${participant.last_seen ? participant.last_seen.toLocaleString() : 'Never'}\n\n` +
               '**Configuration:**\n' +
               `• Data Directory: ${this.config.data_directory}\n` +
               `• Archive Days: ${this.config.archive_days}\n` +
               `• Token Limit: ${this.config.token_limit.toLocaleString()}\n` +
               `• Auto Compact: ${this.config.auto_compact ? 'Enabled' : 'Disabled'}`
        }
      ]
    }
  }
  
  private async handleHelp(args: unknown): Promise<any> {
    const command = (args as any)?.command
    
    if (command) {
      // Provide command-specific help
      const commandHelp: Record<string, string> = {
        'ccp_send_message': '📤 **Send Message**\n\n' +
          'Send a coordination message to other Claude participants.\n\n' +
          '**Required Parameters:**\n' +
          '• `to`: Array of participant IDs (e.g., ["@mobile", "@backend"])\n' +
          '• `type`: Message type (arch, contract, sync, update, q, emergency, broadcast)\n' +
          '• `priority`: Priority level (CRITICAL, H, M, L)\n' +
          '• `subject`: Brief subject line (max 200 chars)\n' +
          '• `content`: Message body\n\n' +
          '**Optional Parameters:**\n' +
          '• `response_required`: Whether response is needed (default: true)\n' +
          '• `expires_in_hours`: Hours until expiry (default: 168)\n' +
          '• `tags`: Array of tags for categorization\n' +
          '• `suggested_approach`: SuperClaude suggestions for recipient',
        
        'ccp_get_messages': '📨 **Get Messages**\n\n' +
          'Retrieve coordination messages with filtering options.\n\n' +
          '**Optional Parameters:**\n' +
          '• `participant`: Filter by participant (defaults to you)\n' +
          '• `status`: Array of statuses to filter\n' +
          '• `type`: Array of message types to filter\n' +
          '• `priority`: Array of priorities to filter\n' +
          '• `since_hours`: Only messages from last N hours\n' +
          '• `thread_id`: Filter by specific thread\n' +
          '• `limit`: Max messages to return (default: 20, max: 100)\n' +
          '• `detail_level`: Level of detail (index, summary, full) - defaults to full',
        
        'ccp_respond_message': '💬 **Respond to Message**\n\n' +
          'Respond to a coordination message.\n\n' +
          '**Required Parameters:**\n' +
          '• `message_id`: ID of message to respond to\n' +
          '• `content`: Your response content\n\n' +
          '**Optional Parameters:**\n' +
          '• `resolution_status`: Status (partial, complete, requires_followup, blocked)',
        
        'ccp_search_messages': '🔍 **Search Messages**\n\n' +
          'Search messages using full-text or semantic search.\n\n' +
          '**Required Parameters:**\n' +
          '• `query`: Search query text\n\n' +
          '**Optional Parameters:**\n' +
          '• `semantic`: Use semantic search (default: true)\n' +
          '• `tags`: Filter by tags\n' +
          '• `date_range`: Filter by date range\n' +
          '• `participants`: Filter by participants\n' +
          '• `limit`: Max results (default: 10, max: 50)',
        
        'ccp_compact_thread': '🗜️ **Compact Thread**\n\n' +
          'Compact a conversation thread to optimize token usage.\n\n' +
          '**Required Parameters:**\n' +
          '• `thread_id`: Thread ID to compact\n\n' +
          '**Optional Parameters:**\n' +
          '• `strategy`: Compaction strategy (summarize, consolidate, archive)\n' +
          '• `preserve_decisions`: Keep decision messages (default: true)\n' +
          '• `preserve_critical`: Keep critical messages (default: true)',
        
        'ccp_archive_resolved': '📁 **Archive Resolved**\n\n' +
          'Archive resolved messages automatically.\n\n' +
          '**Optional Parameters:**\n' +
          '• `older_than_days`: Archive messages older than N days (default: 30)\n' +
          '• `preserve_critical`: Keep critical messages (default: true)\n' +
          '• `create_summary`: Create summary before archiving (default: true)',
        
        'ccp_get_stats': '📊 **Get Statistics**\n\n' +
          'Get coordination system statistics.\n\n' +
          '**Optional Parameters:**\n' +
          '• `participant`: Get stats for specific participant\n' +
          '• `timeframe_days`: Timeframe for statistics (default: 7)'
      }
      
      const help = commandHelp[command]
      if (help) {
        return {
          content: [
            {
              type: 'text',
              text: help
            }
          ]
        }
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Unknown command: ${command}\n\nUse \`ccp_help\` without parameters to see all available commands.`
            }
          ]
        }
      }
    }
    
    // General help
    return {
      content: [
        {
          type: 'text',
          text: '🤝 **Claude Coordination Protocol (CCP) Help**\n\n' +
               'CCP enables efficient communication between Claude instances working on the same project.\n\n' +
               '**Available Commands:**\n\n' +
               '📤 `ccp_send_message` - Send coordination messages\n' +
               '📨 `ccp_get_messages` - Retrieve messages with filters\n' +
               '💬 `ccp_respond_message` - Respond to messages\n' +
               '🔍 `ccp_search_messages` - Search message history\n' +
               '🗜️ `ccp_compact_thread` - Optimize thread token usage\n' +
               '📁 `ccp_archive_resolved` - Archive old messages\n' +
               '📊 `ccp_get_stats` - View system statistics\n' +
               '📝 `ccp_register_participant` - Register new participant\n' +
               '👤 `ccp_whoami` - Show current identity\n' +
               '📚 `ccp_setup_guide` - Setup and configuration guides\n\n' +
               '**Message Types:**\n' +
               '• `arch`: Architecture decisions\n' +
               '• `contract`: API contracts & interfaces\n' +
               '• `sync`: Synchronization requests\n' +
               '• `update`: Status updates\n' +
               '• `q`: Questions needing answers\n' +
               '• `emergency`: Urgent issues\n' +
               '• `broadcast`: Announcements to all\n\n' +
               '**Priority Levels:**\n' +
               '• `CRITICAL`: Immediate action required\n' +
               '• `H`: High priority\n' +
               '• `M`: Medium priority\n' +
               '• `L`: Low priority\n\n' +
               '💡 **Tip:** Use `ccp_help command: <command_name>` for detailed help on any command.'
        }
      ]
    }
  }
  
  private async handleSetupGuide(args: unknown): Promise<any> {
    const topic = (args as any)?.topic || 'quickstart'
    
    const guides: Record<string, string> = {
      'quickstart': '🚀 **Quick Start Guide**\n\n' +
        '**1. Initialize CCP in your project:**\n' +
        '```bash\n' +
        'npx claude-coordination-protocol init --participant-id @your-role\n' +
        '```\n\n' +
        '**2. Verify setup:**\n' +
        '```bash\n' +
        'npx claude-coordination-protocol status\n' +
        '```\n\n' +
        '**3. Configure MCP in Claude Code:**\n' +
        'The init command automatically updates your `.mcp.json`. Restart Claude Code to load CCP.\n\n' +
        '**4. Start using CCP tools:**\n' +
        '• Check your identity: `ccp_whoami`\n' +
        '• Send first message: `ccp_send_message`\n' +
        '• Check messages: `ccp_get_messages`\n\n' +
        '**Example - Send a message:**\n' +
        '```json\n' +
        '{\n' +
        '  "to": ["@backend", "@mobile"],\n' +
        '  "type": "sync",\n' +
        '  "priority": "H",\n' +
        '  "subject": "API endpoint changes",\n' +
        '  "content": "Planning to update user auth endpoints..."\n' +
        '}\n' +
        '```',
      
      'mcp_config': '⚙️ **MCP Configuration Guide**\n\n' +
        '**Auto-generated .mcp.json entry:**\n' +
        '```json\n' +
        '{\n' +
        '  "mcpServers": {\n' +
        '    "claude-coordination-protocol": {\n' +
        '      "command": "ccp",\n' +
        '      "args": ["server"],\n' +
        '      "env": {\n' +
        '        "CCP_CONFIG": ".coordination/config.yaml",\n' +
        '        "CCP_PARTICIPANT_ID": "@your-role"\n' +
        '      }\n' +
        '    }\n' +
        '  }\n' +
        '}\n' +
        '```\n\n' +
        '**Manual Installation:**\n' +
        '1. Install globally: `npm install -g claude-coordination-protocol`\n' +
        '2. Add the above configuration to your `.mcp.json`\n' +
        '3. Restart Claude Code\n\n' +
        '**Environment Variables:**\n' +
        '• `CCP_CONFIG`: Path to config file\n' +
        '• `CCP_PARTICIPANT_ID`: Your participant ID\n' +
        '• `CCP_DATA_DIR`: Override data directory',
      
      'participants': '👥 **Participant Management Guide**\n\n' +
        '**Participant IDs:**\n' +
        '• Must start with `@` (e.g., `@backend`, `@mobile`)\n' +
        '• Use descriptive names for clarity\n' +
        '• Examples: `@api-team`, `@frontend-dev`, `@qa-tester`\n\n' +
        '**Adding Participants (CLI):**\n' +
        '```bash\n' +
        'ccp participant add @mobile --capabilities "mobile,ios,android"\n' +
        'ccp participant add @backend --capabilities "api,database,auth"\n' +
        '```\n\n' +
        '**Capabilities:**\n' +
        'Define what each participant can work on:\n' +
        '• `api` - API development\n' +
        '• `database` - Database management\n' +
        '• `frontend` - Frontend development\n' +
        '• `mobile` - Mobile app development\n' +
        '• `security` - Security & authentication\n' +
        '• `infrastructure` - DevOps & deployment\n' +
        '• `testing` - QA & testing\n' +
        '• `documentation` - Docs & guides\n\n' +
        '**Status Management:**\n' +
        '• `active` - Currently working\n' +
        '• `inactive` - Not available\n' +
        '• `maintenance` - Limited availability',
      
      'messaging': '💬 **Messaging Best Practices**\n\n' +
        '**Message Types Usage:**\n' +
        '• `arch` - Major design decisions affecting multiple teams\n' +
        '• `contract` - API changes, interface definitions\n' +
        '• `sync` - Need to coordinate on shared work\n' +
        '• `update` - Progress reports, status changes\n' +
        '• `q` - Questions needing answers\n' +
        '• `emergency` - Blocking issues, critical bugs\n' +
        '• `broadcast` - Team-wide announcements\n\n' +
        '**Priority Guidelines:**\n' +
        '• `CRITICAL` - Blocking work, production issues\n' +
        '• `H` - Important, needs attention soon\n' +
        '• `M` - Normal workflow, can wait\n' +
        '• `L` - FYI, nice to know\n\n' +
        '**SuperClaude Integration:**\n' +
        'Include suggestions for the recipient:\n' +
        '```json\n' +
        '{\n' +
        '  "suggested_approach": {\n' +
        '    "superclaude_commands": ["/sc:analyze", "/sc:improve"],\n' +
        '    "superclaude_personas": ["--persona-security"],\n' +
        '    "superclaude_flags": ["--think-hard", "--validate"],\n' +
        '    "analysis_focus": ["authentication", "rate-limiting"],\n' +
        '    "tools_recommended": ["Sequential", "Context7"]\n' +
        '  }\n' +
        '}\n' +
        '```\n\n' +
        '**Thread Management:**\n' +
        '• Messages auto-thread by subject similarity\n' +
        '• Use `ccp_compact_thread` to reduce token usage\n' +
        '• Archive resolved threads regularly',
      
      'troubleshooting': '🔧 **Troubleshooting Guide**\n\n' +
        '**CCP not showing in Claude Code:**\n' +
        '1. Check `.mcp.json` exists and has CCP entry\n' +
        '2. Verify `ccp` command works in terminal\n' +
        '3. Restart Claude Code completely\n' +
        '4. Check for error messages in Claude Code logs\n\n' +
        '**"Participant not found" errors:**\n' +
        '1. Run `ccp participant list` to see registered participants\n' +
        '2. Add missing participant: `ccp participant add @missing`\n' +
        '3. Check participant ID format (must start with @)\n\n' +
        '**Permission errors:**\n' +
        '• Only admins can register new participants\n' +
        '• Check file permissions on `.coordination` directory\n' +
        '• Ensure write access to database file\n\n' +
        '**Database locked errors:**\n' +
        '• Another process may be using the database\n' +
        '• Check for zombie CCP processes\n' +
        '• Delete stale lock files in `.coordination/locks`\n\n' +
        '**Message not delivered:**\n' +
        '• Verify recipient participant exists\n' +
        '• Check message expiry time\n' +
        '• Ensure recipient has required capabilities\n\n' +
        '**Reset CCP:**\n' +
        '```bash\n' +
        'rm -rf .coordination\n' +
        'ccp init --participant-id @your-role\n' +
        '```'
    }
    
    const guide = guides[topic]
    if (!guide) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Unknown topic: ${topic}\n\n` +
                 'Available topics:\n' +
                 '• `quickstart` - Getting started quickly\n' +
                 '• `mcp_config` - MCP configuration details\n' +
                 '• `participants` - Managing participants\n' +
                 '• `messaging` - Messaging best practices\n' +
                 '• `troubleshooting` - Common issues and fixes'
          }
        ]
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text: guide + '\n\n📚 **More Help:**\n' +
               '• Other topics: `ccp_setup_guide topic: <topic>`\n' +
               '• Command help: `ccp_help command: <command>`\n' +
               '• CLI help: `ccp --help`'
        }
      ]
    }
  }
  
  private async handleGetStats(args: unknown): Promise<any> {
    try {
      const input = args as { timeframe_days?: number; include_participants?: boolean }
      const timeframeDays = input.timeframe_days || 7
      
      // Get basic statistics
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - timeframeDays)
      
      // Get message statistics - using simple queries instead of JSON path
      const messageStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_messages,
          COUNT(CASE WHEN created_at >= ? THEN 1 END) as recent_messages,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_messages,
          COUNT(CASE WHEN status = 'read' THEN 1 END) as read_messages,
          COUNT(CASE WHEN status = 'responded' THEN 1 END) as responded_messages
        FROM messages
      `).get(cutoffDate.toISOString()) as any
      
      // Get message type distribution
      const typeStats = this.db.prepare(`
        SELECT 
          type,
          COUNT(*) as count
        FROM messages 
        WHERE created_at >= ? 
        GROUP BY type 
        ORDER BY count DESC
      `).all(cutoffDate.toISOString()) as any[]
      
      // Get priority distribution
      const priorityStats = this.db.prepare(`
        SELECT 
          priority,
          COUNT(*) as count
        FROM messages 
        WHERE created_at >= ? 
        GROUP BY priority 
        ORDER BY 
          CASE priority 
            WHEN 'CRITICAL' THEN 1 
            WHEN 'H' THEN 2 
            WHEN 'M' THEN 3 
            WHEN 'L' THEN 4 
          END
      `).all(cutoffDate.toISOString()) as any[]
      
      // Get participant statistics if requested
      let participantStats = []
      if (input.include_participants) {
        participantStats = this.db.prepare(`
          SELECT 
            participant_id,
            status,
            last_seen,
            (SELECT COUNT(*) FROM messages WHERE "from" = participant_id AND created_at >= ?) as messages_sent,
            (SELECT COUNT(*) FROM messages WHERE "to" LIKE '%' || participant_id || '%' AND created_at >= ?) as messages_received
          FROM participants
          ORDER BY last_seen DESC
        `).all(cutoffDate.toISOString(), cutoffDate.toISOString()) as any[]
      }
      
      // Calculate activity metrics
      const totalThreads = this.db.prepare(`
        SELECT COUNT(DISTINCT thread_id) as count FROM messages WHERE created_at >= ?
      `).get(cutoffDate.toISOString()) as any
      
      const avgResponseTime = this.db.prepare(`
        SELECT AVG(
          (julianday(updated_at) - julianday(created_at)) * 24 * 60 * 60
        ) as avg_seconds
        FROM messages 
        WHERE status = 'responded' 
        AND created_at >= ?
      `).get(cutoffDate.toISOString()) as any
      
      // Format results
      const results = {
        timeframe: `${timeframeDays} days`,
        period: `${cutoffDate.toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}`,
        message_statistics: {
          total_messages: messageStats.total_messages,
          recent_messages: messageStats.recent_messages,
          pending_messages: messageStats.pending_messages,
          read_messages: messageStats.read_messages,
          responded_messages: messageStats.responded_messages,
          response_rate: messageStats.recent_messages > 0 
            ? Math.round((messageStats.responded_messages / messageStats.recent_messages) * 100) 
            : 0
        },
        activity_metrics: {
          active_threads: totalThreads.count,
          avg_response_time_hours: avgResponseTime.avg_seconds 
            ? Math.round(avgResponseTime.avg_seconds / 3600 * 100) / 100 
            : null
        },
        message_types: typeStats.map(t => ({ type: t.type, count: t.count })),
        priorities: priorityStats.map(p => ({ priority: p.priority, count: p.count })),
        participants: input.include_participants ? participantStats : undefined
      }
      
      // Format output
      let output = `📊 **Coordination Statistics (${results.timeframe})**\n\n`
      
      output += '**Message Overview:**\n'
      output += `• Total Messages: ${results.message_statistics.total_messages}\n`
      output += `• Recent Messages: ${results.message_statistics.recent_messages}\n`
      output += `• Response Rate: ${results.message_statistics.response_rate}%\n`
      output += `• Active Threads: ${results.activity_metrics.active_threads}\n`
      
      if (results.activity_metrics.avg_response_time_hours) {
        output += `• Avg Response Time: ${results.activity_metrics.avg_response_time_hours}h\n`
      }
      
      output += '\n**Message Types:**\n'
      results.message_types.forEach(t => {
        output += `• ${t.type}: ${t.count}\n`
      })
      
      output += '\n**Priorities:**\n'
      results.priorities.forEach(p => {
        output += `• ${p.priority}: ${p.count}\n`
      })
      
      if (results.participants) {
        output += '\n**Participants:**\n'
        results.participants.forEach((p: any) => {
          const lastSeen = p.last_seen ? new Date(p.last_seen).toLocaleDateString() : 'never'
          output += `• ${p.participant_id} (${p.status}): ${p.messages_sent} sent, ${p.messages_received} received, last seen ${lastSeen}\n`
        })
      }
      
      return {
        content: [
          {
            type: 'text',
            text: output
          }
        ]
      }
      
    } catch (error) {
      throw new DatabaseError(`Failed to get message statistics: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Server Error]', error)
    }
    
    process.on('SIGINT', async () => {
      console.log('\nShutting down MCP server...')
      this.db.close()
      process.exit(0)
    })
  }
  
  private handleToolError(error: unknown): any {
    console.error('[Tool Error]', error)
    
    if (error instanceof CoordinationError) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ **${error.name}**: ${error.message}`
          }
        ],
        isError: true
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `❌ **Unexpected Error**: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ],
      isError: true
    }
  }
  
  async run(): Promise<void> {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    console.error('Claude Coordination Protocol MCP server running on stdio')
  }
}
# Claude Coordination Protocol (CCP)

An inter-Claude communication system for coordinated development workflows using the Model Context Protocol (MCP).

## Overview

The Claude Coordination Protocol enables multiple Claude instances to communicate, coordinate tasks, and share context across different parts of your development workflow. It provides structured messaging, thread management, participant coordination, and comprehensive search capabilities.

## Features

- 🤝 **Multi-Claude Communication** - Seamless messaging between Claude instances
- 🧵 **Thread Management** - Organize conversations and maintain context
- 👥 **Participant Registry** - Manage team members and their capabilities
- 🔍 **Smart Search** - Semantic search across all messages and conversations
- 📦 **Message Compaction** - Intelligent summarization to manage context limits
- 🛡️ **Priority System** - Critical, High, Medium, Low priority levels
- 🗄️ **Database Management** - SQLite-based persistence with migration support
- 🔧 **CLI Tools** - Complete command-line interface for all operations

## Requirements

- **Node.js** >= 18.0.0
- **Claude Code** with MCP support
- **SQLite3** (included via better-sqlite3)

## Installation

### Option 1: NPM Install (Recommended)

```bash
npm install claude-coordination-protocol
```

### Option 2: Global Installation

```bash
npm install -g claude-coordination-protocol
```

### Option 3: Development Installation

```bash
git clone https://github.com/beetoken/claude-coordination-protocol.git
cd claude-coordination-protocol
npm install
npm run build
npm link
```

## Quick Start

### 1. Initialize Coordination System

Create a new coordination system in your project:

```bash
# Initialize with default participant ID
ccp init

# Or specify a custom participant ID
ccp init --participant-id @frontend-dev
```

This creates:

- `.coordination/` directory with database and config
- `.mcp.json` configuration for Claude Code integration
- Default participant registration

### 2. Connect to Existing System

Join an existing coordination system:

```bash
# Connect to shared database
ccp connect --participant-id @backend-dev --db-path ../shared/.coordination/coordination.db
```

### 3. Verify Setup

```bash
# Check system status
ccp status

# Validate configuration and detect issues
ccp validate
```

## Usage Examples

### Sending Messages

```bash
# Send a coordination message
ccp send \
  --to "@backend-dev,@frontend-dev" \
  --type "sync" \
  --priority "H" \
  --subject "API Schema Update" \
  --content "Updated user authentication endpoints. Please review the new schema."

# Send critical notification
ccp send \
  --to "@team-lead" \
  --type "notification" \
  --priority "CRITICAL" \
  --subject "Production Issue" \
  --content "Database connection timeout detected in production."
```

### Viewing Messages

```bash
# List recent messages
ccp list

# Filter by status and priority
ccp list --status pending --priority H --limit 10

# Search messages
ccp search "API authentication"
ccp search "database timeout" --limit 5
```

### Managing Participants

```bash
# Add team member
ccp participant add @qa-engineer \
  --capabilities "testing,quality-assurance,automation" \
  --priority M

# List all participants
ccp participant list

# Update participant capabilities
ccp participant update @frontend-dev \
  --capabilities "react,typescript,ui-design" \
  --status active
```

### Thread Management

```bash
# Compact long conversation thread
ccp compact --thread-id thread_abc123 --strategy summarize
```

## CLI Commands Reference

### Core Commands

| Command    | Description                             | Example                                                         |
| ---------- | --------------------------------------- | --------------------------------------------------------------- |
| `init`     | Initialize new coordination system      | `ccp init --participant-id @dev`                                |
| `connect`  | Connect to existing system              | `ccp connect --db-path ../shared/.coordination/coordination.db` |
| `server`   | Start MCP server (used by Claude Code)  | `ccp server`                                                    |
| `status`   | Show system status and statistics       | `ccp status`                                                    |
| `validate` | Validate setup and detect fragmentation | `ccp validate`                                                  |
| `setup`    | Interactive configuration wizard        | `ccp setup`                                                     |

### Messaging Commands

| Command          | Description                  | Options                                                  |
| ---------------- | ---------------------------- | -------------------------------------------------------- |
| `send`           | Send coordination message    | `--to`, `--type`, `--priority`, `--subject`, `--content` |
| `list`           | List messages with filters   | `--status`, `--type`, `--priority`, `--limit`            |
| `search <query>` | Search messages semantically | `--limit`                                                |
| `compact`        | Compact conversation thread  | `--thread-id`, `--strategy`                              |

### Participant Management

| Command                   | Description             | Options                                    |
| ------------------------- | ----------------------- | ------------------------------------------ |
| `participant add <id>`    | Add new participant     | `--capabilities`, `--priority`             |
| `participant list`        | List all participants   | None                                       |
| `participant update <id>` | Update participant info | `--capabilities`, `--priority`, `--status` |
| `participant remove <id>` | Deactivate participant  | None                                       |

### Database Management

| Command                 | Description                        | Options                                       |
| ----------------------- | ---------------------------------- | --------------------------------------------- |
| `purge`                 | Clean database with various levels | `--level`, `--dry-run`, `--force`, `--before` |
| `restore <backup-path>` | Restore from backup                | None                                          |
| `migrate up`            | Run database migrations            | `--dry-run`                                   |
| `migrate status`        | Show migration status              | None                                          |
| `migrate create <name>` | Create new migration               | None                                          |

### Message Types

- **sync** - Synchronization and coordination
- **notification** - Important alerts and updates
- **task** - Task assignment and tracking
- **question** - Questions requiring responses
- **info** - General information sharing
- **decision** - Decision announcements

### Priority Levels

- **CRITICAL** - Immediate attention required
- **H** (High) - Important, handle soon
- **M** (Medium) - Normal priority (default)
- **L** (Low) - Low priority, handle when convenient

## MCP Integration

The system automatically configures Claude Code integration via `.mcp.json`:

```json
{
  "mcpServers": {
    "claude-coordination-protocol": {
      "command": "ccp",
      "args": ["server"],
      "env": {
        "CCP_CONFIG": "/path/to/.coordination/config.yaml",
        "CCP_PARTICIPANT_ID": "@your-id"
      }
    }
  }
}
```

### Available MCP Tools

When running as an MCP server, these tools are available to Claude:

- **ccp_whoami** - Get current participant identity and configuration
- **ccp_help** - Access built-in help system and documentation
- **ccp_setup_guide** - Interactive setup and troubleshooting guides
- **ccp_send_message** - Send coordination messages with SuperClaude suggestions
- **ccp_get_messages** - Retrieve and filter messages
- **ccp_search_messages** - Semantic search across message history
- **ccp_close_thread** - Mark conversation threads as completed
- **ccp_get_participants** - List all registered participants

## Configuration

### Main Configuration (`.coordination/config.yaml`)

```yaml
participant_id: '@your-id'
data_directory: '.coordination'
archive_days: 30
token_limit: 1000000
auto_compact: true
participants:
  - id: '@your-id'
    capabilities: ['coordination']
    status: 'active'
    default_priority: 'M'
notification_settings:
  enabled: true
  priority_threshold: 'M'
  batch_notifications: true
```

### Environment Variables

- `CCP_CONFIG` - Path to configuration file
- `CCP_PARTICIPANT_ID` - Override participant ID
- `CCP_DATA_DIR` - Override data directory

## Database Purge Levels

| Level        | Description      | What Gets Deleted                                   |
| ------------ | ---------------- | --------------------------------------------------- |
| **soft**     | Light cleanup    | Only archived and resolved messages                 |
| **standard** | Standard cleanup | All messages and conversations (keeps participants) |
| **complete** | Heavy cleanup    | Everything except metadata                          |
| **full**     | Complete reset   | Everything (requires `--force` flag)                |

## Troubleshooting

### Common Issues

**"No configuration file found"**

```bash
# Initialize the system first
ccp init --participant-id @your-id
```

**"Database not found"**

```bash
# Check if database exists
ls .coordination/
# Reinitialize if missing
ccp init
```

**MCP server not loading**

1. Check `.mcp.json` configuration
2. Restart Claude Code completely
3. Verify `ccp` command works: `ccp --version`
4. Test with `ccp_help` in Claude

**Database fragmentation**

```bash
# Check for multiple databases
ccp validate
# Follow recommendations to consolidate
```

### Getting Help

```bash
# Show version
ccp --version

# Show help for any command
ccp help
ccp send --help
ccp participant --help

# Check system status
ccp status

# Interactive setup
ccp setup
```

## Development

### Building from Source

```bash
git clone https://github.com/beetoken/claude-coordination-protocol.git
cd claude-coordination-protocol
npm install
npm run build
```

### Running Tests

```bash
npm test
npm run test:coverage
npm run test:ui
```

### Code Quality

```bash
npm run lint
npm run format
npm run typecheck
npm run quality:check
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

## Related Documentation

- [UPDATE-GUIDE.md](UPDATE-GUIDE.md) - Upgrade instructions
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification

# CCP Update Guide - Version 1.1.0

This guide explains how to update your Claude Coordination Protocol installation to get the latest features.

## What's New in v1.1.0

- **New MCP Tools**: `ccp_whoami`, `ccp_help`, `ccp_setup_guide`
- **SuperClaude Suggestions**: Send command suggestions with messages
- **Enhanced Help System**: Comprehensive documentation built-in

## Update Methods

### Method 1: Global Update (Recommended)

If you installed CCP globally:

```bash
# Update the global package
npm update -g claude-coordination-protocol

# Or reinstall to ensure latest version
npm install -g claude-coordination-protocol@latest

# Verify the version
ccp --version
```

### Method 2: Local Project Update

If CCP is installed in your project:

```bash
# Update in your project directory
cd /path/to/your/project
npm update claude-coordination-protocol

# Or reinstall
npm install claude-coordination-protocol@latest
```

### Method 3: Direct from GitHub

For development or testing:

```bash
# Clone the latest version
git clone https://github.com/beetoken/claude-coordination-protocol.git
cd claude-coordination-protocol

# Install dependencies and build
npm install
npm run build

# Link globally for CLI access
npm link
```

## Post-Update Steps

### 1. Database Migration

The database will automatically migrate when you first use v1.1.0:

```bash
# Check status - this will trigger migration if needed
ccp status
```

You should see: "Migrating database from version 1 to 2"

### 2. Restart Claude Code

After updating, restart Claude Code to reload the MCP server:

1. Close Claude Code completely
2. Reopen Claude Code
3. The new tools should be available

### 3. Verify New Tools

In Claude Code, test the new tools:

```typescript
// Check your identity
await ccp_whoami()

// Get help
await ccp_help()

// View setup guide
await ccp_setup_guide({ topic: "quickstart" })
```

### 4. Test SuperClaude Suggestions

Send a test message with suggestions:

```typescript
await ccp_send_message({
  to: ["@test"],
  type: "sync",
  priority: "M",
  subject: "Testing v1.1.0 features",
  content: "Testing SuperClaude suggestions",
  suggested_approach: {
    superclaude_commands: ["/sc:analyze"],
    superclaude_personas: ["--persona-analyzer"],
    superclaude_flags: ["--think"],
    analysis_focus: ["test-coverage"],
    tools_recommended: ["Sequential"]
  }
})
```

## Troubleshooting

### "Command not found" after update

```bash
# Check if globally installed
npm list -g claude-coordination-protocol

# If not found, install globally
npm install -g claude-coordination-protocol
```

### MCP tools not showing in Claude Code

1. Check `.mcp.json` is properly configured
2. Ensure the `ccp` command works in terminal
3. Restart Claude Code completely
4. Check Claude Code logs for errors

### Database errors

If you see database errors:

```bash
# Backup your data
cp -r .coordination .coordination.backup

# Reset and reinitialize
rm -rf .coordination
ccp init --participant-id @your-role
```

### Version mismatch

Check versions:

```bash
# CLI version
ccp --version

# Package version in project
npm list claude-coordination-protocol

# Global version
npm list -g claude-coordination-protocol
```

## Rolling Back

If you need to rollback to v1.0.0:

```bash
# Global rollback
npm install -g claude-coordination-protocol@1.0.0

# Project rollback
npm install claude-coordination-protocol@1.0.0
```

Note: Database will remain at schema v2, which is backward compatible.

## Getting Help

- Run `ccp help` for CLI help
- Use `ccp_help` in Claude Code for MCP tool help
- Use `ccp_setup_guide` for interactive guides
- Report issues: https://github.com/beetoken/claude-coordination-protocol/issues
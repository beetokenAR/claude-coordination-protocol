# CCP v1.1.0 Deployment Guide

This guide shows how to deploy the updated Claude Coordination Protocol to your Claude instances.

## Distribution Package

✅ **Package Ready**: `claude-coordination-protocol-1.1.0.tgz` (74.1 kB)

## New Features in v1.1.0

1. **Essential MCP Tools**:
   - `ccp_whoami` - Identity and configuration
   - `ccp_help` - Built-in help system  
   - `ccp_setup_guide` - Interactive guides

2. **SuperClaude Integration**:
   - Send command suggestions with messages
   - Support for `/sc:` command syntax
   - Persona and flag recommendations

## Deployment Options

### Option 1: Direct Installation (Recommended)

For each Claude instance project:

```bash
# Navigate to the project directory
cd /path/to/beetoken_app  # or beetoken_service

# Install the new version
npm install /Users/nico/dev/beetoken/ecosystem/claude-coordination-protocol/claude-coordination-protocol-1.1.0.tgz

# Restart Claude Code to load the new version
```

### Option 2: Global Installation

Install globally for system-wide access:

```bash
# Install globally
npm install -g /Users/nico/dev/beetoken/ecosystem/claude-coordination-protocol/claude-coordination-protocol-1.1.0.tgz

# Verify installation
ccp --version
# Should show: 1.1.0
```

### Option 3: Link for Development

For active development with frequent updates:

```bash
cd /Users/nico/dev/beetoken/ecosystem/claude-coordination-protocol

# Link globally
npm link

# In each project that needs CCP
cd /path/to/beetoken_app
npm link claude-coordination-protocol
```

## Deployment Steps

### Step 1: Deploy to beetoken_app

```bash
cd /path/to/beetoken_app

# Install new version
npm install /Users/nico/dev/beetoken/ecosystem/claude-coordination-protocol/claude-coordination-protocol-1.1.0.tgz

# Check .mcp.json exists and is configured
cat .mcp.json

# Restart Claude Code
echo "Restart Claude Code to load the new MCP server"
```

### Step 2: Deploy to beetoken_service

```bash
cd /path/to/beetoken_service

# Install new version
npm install /Users/nico/dev/beetoken/ecosystem/claude-coordination-protocol/claude-coordination-protocol-1.1.0.tgz

# Check .mcp.json exists and is configured
cat .mcp.json

# Restart Claude Code
echo "Restart Claude Code to load the new MCP server"
```

### Step 3: Test New Features

In each Claude Code instance, test the new tools:

```typescript
// Test identity
await ccp_whoami()

// Test help system
await ccp_help()

// Test setup guide
await ccp_setup_guide({ topic: "quickstart" })

// Test SuperClaude suggestions
await ccp_send_message({
  to: ["@other_participant"],
  type: "sync", 
  priority: "M",
  subject: "Testing v1.1.0 features",
  content: "Testing the new SuperClaude suggestions feature",
  suggested_approach: {
    superclaude_commands: ["/sc:analyze"],
    superclaude_personas: ["--persona-analyzer"],
    superclaude_flags: ["--think"],
    analysis_focus: ["testing"],
    tools_recommended: ["Sequential"]
  }
})
```

## Verification Checklist

- [ ] CCP v1.1.0 installed in beetoken_app
- [ ] CCP v1.1.0 installed in beetoken_service  
- [ ] Claude Code restarted for both instances
- [ ] `ccp_whoami` works in both instances
- [ ] `ccp_help` shows all commands
- [ ] `ccp_setup_guide` shows interactive guides
- [ ] Database migrated to schema v2
- [ ] SuperClaude suggestions work in messages
- [ ] Cross-instance messaging still functional

## Database Migration

The database will automatically migrate from v1 to v2 when first used:

```bash
# This will trigger migration
ccp status

# You should see: "Migrating database from version 1 to 2"
# Then: "Database migration completed"
```

## Rollback Plan

If issues occur, rollback to v1.0.0:

```bash
# In each project
npm install claude-coordination-protocol@1.0.0

# Restart Claude Code
```

Note: Database remains at v2 (backward compatible).

## Troubleshooting

### "Module not found" errors
```bash
# Check installation
npm list claude-coordination-protocol

# Reinstall if needed
npm install /path/to/claude-coordination-protocol-1.1.0.tgz
```

### MCP server not loading
1. Check `.mcp.json` configuration
2. Restart Claude Code completely
3. Check terminal for `ccp` command availability
4. Use `ccp_help` to verify tools are loaded

### Database issues
```bash
# Check database status
ccp status

# Force migration if needed
rm .coordination/database.db
ccp init --participant-id @your-role
```

## Support

- **Documentation**: Use `ccp_help` and `ccp_setup_guide`
- **Status**: Run `ccp status` for system info
- **Issues**: Check logs and configuration files

## Distribution Files

- **Package**: `claude-coordination-protocol-1.1.0.tgz`
- **Size**: 74.1 kB
- **Files**: 60 files including dist/, templates/, examples/
- **Documentation**: README.md, CHANGELOG.md, UPDATE-GUIDE.md
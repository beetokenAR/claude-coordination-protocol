# Changelog

All notable changes to Claude Coordination Protocol will be documented in this file.

## [1.1.0] - 2024-01-23

### Added
- **Essential MCP Tools**:
  - `ccp_whoami` - Shows current participant identity and configuration
  - `ccp_help` - Comprehensive help system with command-specific documentation
  - `ccp_setup_guide` - Interactive setup guides for quickstart, configuration, participants, messaging, and troubleshooting

- **SuperClaude Integration**:
  - Added `suggested_approach` field to messages for intelligent command suggestions
  - Support for suggesting SuperClaude commands (`/sc:analyze`, `/sc:implement`, etc.)
  - Support for suggesting personas (`--persona-security`, `--persona-frontend`, etc.)
  - Support for suggesting flags (`--think-hard`, `--validate`, etc.)
  - Support for analysis focus areas and recommended MCP tools
  - Database schema updated to version 2 with migration support

### Changed
- Updated README with new features documentation
- Enhanced message schema to include SuperClaude suggestions
- Improved help documentation with detailed parameter descriptions

### Technical
- Added database migration from schema version 1 to 2
- Updated TypeScript types for suggested_approach support
- Enhanced message creation and retrieval to handle suggestions

## [1.0.0] - 2024-01-22

### Initial Release
- Inter-Claude communication via MCP server
- Message management with priorities and types
- Participant registry with access control
- Token optimization with compaction
- Full-text search with SQLite FTS5
- CLI tools for management
- Comprehensive test coverage (>90%)
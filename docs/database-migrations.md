# Database Migration Guide

## Overview

The Claude Coordination Protocol uses a robust migration system based on `@blackglory/better-sqlite3-migrations`. This ensures database schema changes are tracked, validated, and applied consistently across all environments.

## Migration System Features

- **Version Tracking**: Uses SQLite's built-in `user_version` pragma
- **Up/Down Migrations**: Support for both forward and rollback migrations
- **Validation**: Pre-migration validation to prevent dangerous operations
- **Checksums**: Schema integrity verification to detect unauthorized changes
- **CLI Management**: Built-in commands for migration management

## CLI Commands

### Check Migration Status
```bash
ccp migrate status
```
Shows the current database version and pending migrations.

### Run Migrations
```bash
ccp migrate up
```
Applies all pending migrations to bring the database to the latest version.

### Dry Run
```bash
ccp migrate up --dry-run
```
Shows what migrations would be applied without making changes.

### Create New Migration
```bash
ccp migrate create <name>
```
Creates new migration files with the proper naming convention.

Example:
```bash
ccp migrate create add-index-to-messages
```

This creates:
- `003-up-add-index-to-messages-[timestamp].sql`
- `003-down-add-index-to-messages-[timestamp].sql`

### Validate Migrations
```bash
ccp migrate validate
```
Checks all pending migrations for:
- Syntax errors
- Dangerous operations (DROP TABLE without IF EXISTS, DELETE FROM, TRUNCATE)
- Empty migration scripts

## Migration File Structure

Migrations are stored in `src/database/migrations/` with the naming convention:
```
[version]-[direction]-[name]-[timestamp].sql
```

Example:
```
003-up-add-message-index-2024-01-15T10-30-00.sql
003-down-add-message-index-2024-01-15T10-30-00.sql
```

## Writing Migrations

### Up Migration Example
```sql
-- Migration 3: Add index for message search
-- Created: 2024-01-15T10:30:00.000Z

CREATE INDEX IF NOT EXISTS idx_messages_search 
ON messages(subject, summary);

-- Update metadata
INSERT OR REPLACE INTO metadata (key, value, updated_at) 
VALUES ('index_messages_search', 'true', datetime('now'));
```

### Down Migration Example
```sql
-- Rollback for migration 3: Add index for message search
-- Created: 2024-01-15T10:30:00.000Z

DROP INDEX IF EXISTS idx_messages_search;

DELETE FROM metadata WHERE key = 'index_messages_search';
```

## Schema Integrity

The system includes automatic schema integrity checking:

1. **Checksum Validation**: Each table definition has a SHA-1 checksum
2. **Version Enforcement**: Changes require version bumps and migrations
3. **Test Coverage**: `database-schema.test.ts` verifies schema integrity

### Updating Schema Checksums

When intentionally changing the schema:

1. Update `SCHEMA_VERSION` in `src/database/schema.ts`
2. Create appropriate migration files
3. Update checksums in tests:
   ```bash
   UPDATE_CHECKSUMS=true npm test -- src/test/database-schema.test.ts
   ```
4. Copy the new checksums to `KNOWN_CHECKSUMS` in the test file

## Migration Best Practices

### DO:
- Always use `IF EXISTS` / `IF NOT EXISTS` clauses
- Test migrations on a copy of production data
- Include rollback migrations for every change
- Document the purpose of each migration
- Validate foreign key constraints after migrations

### DON'T:
- Use `DROP TABLE` without `IF EXISTS`
- Delete data without WHERE clauses
- Make irreversible schema changes
- Skip version numbers
- Modify existing migration files

## Validation System

The `MigrationValidator` class provides safety checks:

```typescript
// Pre-migration validation
const validation = MigrationValidator.validateMigration(db, currentVersion, targetVersion)
if (!validation.safe) {
  console.error('Migration unsafe:', validation.errors)
  process.exit(1)
}

// Create checkpoint
await MigrationValidator.createCheckpoint(db)

// Run migration
await migrator.migrate()

// Post-migration validation
const postValidation = MigrationValidator.validatePostMigration(db, targetVersion)
if (!postValidation.success) {
  console.error('Migration failed:', postValidation.issues)
}
```

## Handling Migration Failures

If a migration fails:

1. Check the error message for specific issues
2. Review the migration SQL for syntax errors
3. Ensure foreign key constraints are satisfied
4. Verify the database isn't locked by another process
5. Restore from backup if necessary

## Database Compatibility

The migration system ensures backward compatibility:

- Version 1.1.0 databases can be upgraded to 1.2.0 seamlessly
- No breaking changes to existing data
- Only cosmetic SQL syntax improvements (e.g., JSON path queries)

## Testing Migrations

Always test migrations in development first:

```bash
# Create test database
cp .coordination/coordination.db .coordination/test.db

# Set test environment
export CCP_DATA_DIR=./.coordination-test

# Run migrations
ccp migrate up

# Verify functionality
npm test
```

## Monitoring Schema Changes

The system automatically detects unauthorized schema changes:

```bash
npm test -- src/test/database-schema.test.ts
```

This will fail if:
- Schema changed without version bump
- Checksums don't match expected values
- Required constraints are missing

## Future Migrations

When adding new features:

1. Design the schema changes
2. Create migration files: `ccp migrate create feature-name`
3. Write the up migration (add new structures)
4. Write the down migration (remove structures)
5. Test both directions
6. Update schema version and checksums
7. Document the changes
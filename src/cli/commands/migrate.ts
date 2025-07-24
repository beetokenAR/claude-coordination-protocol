import { Command } from 'commander'
import chalk from 'chalk'
import { CoordinationDatabase } from '../../database/connection.js'
import { DatabaseMigrator } from '../../database/migrator.js'
import inquirer from 'inquirer'
import fs from 'fs'

export function createMigrateCommand(): Command {
  const cmd = new Command('migrate')
    .description('Database migration management')
    .addCommand(
      new Command('up')
        .description('Run all pending migrations')
        .option('--dry-run', 'Show what would be migrated without applying changes')
        .action(async (options) => {
          try {
            const dataDir = process.env.CCP_DATA_DIR || './.coordination'
            const db = new CoordinationDatabase(dataDir)
            const migrator = new DatabaseMigrator(db.getRawDatabase())
            
            const currentVersion = migrator.getCurrentVersion()
            console.log(chalk.blue(`Current database version: ${currentVersion}`))
            
            if (options.dryRun) {
              console.log(chalk.yellow('Dry run mode - no changes will be applied'))
            } else {
              await migrator.migrate()
              const newVersion = migrator.getCurrentVersion()
              console.log(chalk.green(`✓ Database migrated to version ${newVersion}`))
            }
          } catch (error: any) {
            console.error(chalk.red(`Migration failed: ${error.message}`))
            process.exit(1)
          }
        })
    )
    .addCommand(
      new Command('create')
        .description('Create a new migration')
        .argument('<name>', 'Migration name (e.g., add-index-to-messages)')
        .action(async (name) => {
          try {
            const dataDir = process.env.CCP_DATA_DIR || './.coordination'
            const db = new CoordinationDatabase(dataDir)
            const migrator = new DatabaseMigrator(db.getRawDatabase())
            
            const { upPath, downPath } = migrator.createMigration(name)
            
            console.log(chalk.green('✓ Created migration files:'))
            console.log(chalk.gray(`  Up:   ${upPath}`))
            console.log(chalk.gray(`  Down: ${downPath}`))
            console.log('\n' + chalk.yellow('Edit these files to add your migration SQL'))
          } catch (error: any) {
            console.error(chalk.red(`Failed to create migration: ${error.message}`))
            process.exit(1)
          }
        })
    )
    .addCommand(
      new Command('status')
        .description('Show migration status')
        .action(async () => {
          try {
            const dataDir = process.env.CCP_DATA_DIR || './.coordination'
            const db = new CoordinationDatabase(dataDir)
            const migrator = new DatabaseMigrator(db.getRawDatabase())
            
            const currentVersion = migrator.getCurrentVersion()
            console.log(chalk.blue('Database Migration Status'))
            console.log(chalk.gray('------------------------'))
            console.log(`Current version: ${currentVersion}`)
            
            // Show migration validation
            const nextVersion = currentVersion + 1
            const validation = migrator.validateMigration(nextVersion)
            
            if (!validation.valid && validation.errors.includes(`Migration version ${nextVersion} not found`)) {
              console.log(chalk.green('✓ All migrations applied'))
            } else if (!validation.valid) {
              console.log(chalk.yellow('⚠ Next migration has issues:'))
              validation.errors.forEach(err => console.log(chalk.red(`  - ${err}`)))
            } else {
              console.log(chalk.yellow(`→ Migration ${nextVersion} is pending`))
            }
          } catch (error: any) {
            console.error(chalk.red(`Failed to check status: ${error.message}`))
            process.exit(1)
          }
        })
    )
    .addCommand(
      new Command('validate')
        .description('Validate pending migrations')
        .action(async () => {
          try {
            const dataDir = process.env.CCP_DATA_DIR || './.coordination'
            const db = new CoordinationDatabase(dataDir)
            const migrator = new DatabaseMigrator(db.getRawDatabase())
            
            const currentVersion = migrator.getCurrentVersion()
            let hasIssues = false
            
            console.log(chalk.blue('Validating migrations...'))
            
            // Check next few migrations
            for (let v = currentVersion + 1; v <= currentVersion + 5; v++) {
              const validation = migrator.validateMigration(v)
              
              if (validation.errors.includes(`Migration version ${v} not found`)) {
                break // No more migrations
              }
              
              if (!validation.valid) {
                hasIssues = true
                console.log(chalk.red(`\n✗ Migration ${v} has issues:`))
                validation.errors.forEach(err => console.log(chalk.red(`  - ${err}`)))
              } else {
                console.log(chalk.green(`✓ Migration ${v} is valid`))
              }
            }
            
            if (!hasIssues) {
              console.log(chalk.green('\n✓ All migrations are valid'))
            }
          } catch (error: any) {
            console.error(chalk.red(`Validation failed: ${error.message}`))
            process.exit(1)
          }
        })
    )

  return cmd
}
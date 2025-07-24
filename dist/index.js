#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { CoordinationMCPServer } from './mcp/server.js';
import { CoordinationConfig } from './types/index.js';
import { validateInput } from './utils/validation.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function loadConfig() {
    // Try to load config from various locations
    const configPaths = [
        process.env.CCP_CONFIG,
        '.coordination/config.yaml',
        '.coordination/config.yml',
        path.join(process.cwd(), '.coordination', 'config.yaml'),
        path.join(process.cwd(), '.coordination', 'config.yml')
    ].filter(Boolean);
    for (const configPath of configPaths) {
        try {
            if (fs.existsSync(configPath)) {
                const configContent = fs.readFileSync(configPath, 'utf-8');
                const rawConfig = YAML.parse(configContent);
                // Validate and return config
                return validateInput(CoordinationConfig, rawConfig, 'configuration file');
            }
        }
        catch (error) {
            console.error(`Failed to load config from ${configPath}:`, error);
        }
    }
    // Default configuration
    const defaultConfig = {
        participant_id: process.env.CCP_PARTICIPANT_ID || '@claude',
        data_directory: process.env.CCP_DATA_DIR || '.coordination',
        archive_days: parseInt(process.env.CCP_ARCHIVE_DAYS || '30'),
        token_limit: parseInt(process.env.CCP_TOKEN_LIMIT || '1000000'),
        auto_compact: process.env.CCP_AUTO_COMPACT !== 'false',
        participants: [],
        notification_settings: {
            enabled: true,
            priority_threshold: 'M',
            batch_notifications: true
        }
    };
    return validateInput(CoordinationConfig, defaultConfig, 'default configuration');
}
async function main() {
    try {
        const config = await loadConfig();
        console.error(`Starting Claude Coordination Protocol MCP server...`);
        console.error(`Participant ID: ${config.participant_id}`);
        console.error(`Data Directory: ${config.data_directory}`);
        console.error(`Archive Days: ${config.archive_days}`);
        const server = new CoordinationMCPServer(config);
        await server.run();
    }
    catch (error) {
        console.error('Failed to start MCP server:', error);
        process.exit(1);
    }
}
// Handle process signals gracefully
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
    process.exit(1);
});
// Run the server
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map
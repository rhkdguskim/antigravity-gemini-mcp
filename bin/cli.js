#!/usr/bin/env node

/**
 * CLI entry point for antigravity-gemini-mcp
 *
 * Commands:
 *   (default)       Start MCP server
 *   accounts add    Add a Google account via OAuth
 *   accounts list   List configured accounts
 *   accounts remove Remove an account
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

async function main() {
    // Account management commands
    if (command === 'accounts') {
        const { handleAccountsCommand } = await import('../src/cli/accounts.js');
        await handleAccountsCommand(subcommand, args.slice(2));
        return;
    }

    // Help command
    if (command === 'help' || command === '--help' || command === '-h') {
        printHelp();
        return;
    }

    // Version command
    if (command === 'version' || command === '--version' || command === '-v') {
        const pkg = await import('../package.json', { assert: { type: 'json' } });
        console.log(pkg.default.version);
        return;
    }

    // Default: Start MCP server
    await import('../src/index.js');
}

function printHelp() {
    console.log(`
antigravity-gemini-mcp - MCP server for Gemini API

Usage:
  antigravity-gemini-mcp                 Start MCP server
  antigravity-gemini-mcp accounts add    Add a Google account
  antigravity-gemini-mcp accounts list   List configured accounts
  antigravity-gemini-mcp accounts remove Remove an account
  antigravity-gemini-mcp help            Show this help message

Examples:
  # Add your first account
  antigravity-gemini-mcp accounts add

  # Register with Claude Code
  claude mcp add antigravity-gemini -- antigravity-gemini-mcp

Options:
  -h, --help       Show help
  -v, --version    Show version
`);
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});

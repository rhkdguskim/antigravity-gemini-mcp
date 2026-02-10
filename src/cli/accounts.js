/**
 * CLI handler for account management
 */

import readline from 'readline';
import { getAuthorizationUrl, startCallbackServer, completeOAuthFlow } from '../oauth.js';
import { addAccount, removeAccount, listAccounts } from '../accounts.js';
import { ACCOUNTS_CONFIG_PATH, FALLBACK_ACCOUNTS_PATH } from '../constants.js';

/**
 * Handle accounts subcommands
 */
export async function handleAccountsCommand(subcommand, args) {
    switch (subcommand) {
        case 'add':
            await handleAdd();
            break;
        case 'list':
            handleList();
            break;
        case 'remove':
            await handleRemove(args[0]);
            break;
        default:
            console.log(`
Usage: antigravity-gemini-mcp accounts <command>

Commands:
  add     Add a Google account via OAuth
  list    List configured accounts
  remove  Remove an account by email

Examples:
  antigravity-gemini-mcp accounts add
  antigravity-gemini-mcp accounts list
  antigravity-gemini-mcp accounts remove user@gmail.com
`);
    }
}

/**
 * Add a new account via OAuth
 */
async function handleAdd() {
    console.log(`
╔════════════════════════════════════════╗
║   Antigravity Gemini MCP - Add Account ║
╚════════════════════════════════════════╝
`);

    // Generate OAuth URL
    const { url, verifier, state } = getAuthorizationUrl();

    console.log('Opening browser for Google authentication...\n');
    console.log('If browser does not open, visit this URL:\n');
    console.log(url);
    console.log('');

    // Try to open browser
    try {
        const open = (await import('open')).default;
        await open(url);
    } catch (e) {
        // open package not available, user needs to manually open URL
        console.log('(Could not auto-open browser. Please open the URL manually.)\n');
    }

    // Start callback server
    console.log('Waiting for authentication...');
    const { promise, abort } = startCallbackServer(state);

    try {
        const code = await promise;
        console.log('\nAuthentication code received. Exchanging for tokens...');

        const { email, refreshToken } = await completeOAuthFlow(code, verifier);

        // Save account
        const count = addAccount(email, refreshToken);

        console.log(`
✓ Account added successfully!

  Email: ${email}
  Total accounts: ${count}

Config saved to: ${ACCOUNTS_CONFIG_PATH}
`);
    } catch (error) {
        console.error('\nAuthentication failed:', error.message);
        process.exit(1);
    }
}

/**
 * List all configured accounts
 */
function handleList() {
    const { own, fallback, all } = listAccounts();

    console.log(`
╔════════════════════════════════════════╗
║   Antigravity Gemini MCP - Accounts    ║
╚════════════════════════════════════════╝
`);

    if (own.length > 0) {
        console.log(`Own accounts (${own.length}):`);
        own.forEach((acc, i) => {
            const status = acc.enabled === false ? ' (disabled)' : '';
            console.log(`  ${i + 1}. ${acc.email}${status}`);
        });
        console.log(`\nConfig: ${ACCOUNTS_CONFIG_PATH}`);
    } else if (fallback.length > 0) {
        console.log(`Using antigravity-proxy accounts (${fallback.length}):`);
        fallback.forEach((acc, i) => {
            const status = acc.enabled === false ? ' (disabled)' : '';
            console.log(`  ${i + 1}. ${acc.email}${status}`);
        });
        console.log(`\nConfig: ${FALLBACK_ACCOUNTS_PATH}`);
        console.log('\nTip: Run "antigravity-gemini-mcp accounts add" to add your own accounts.');
    } else {
        console.log('No accounts configured.\n');
        console.log('Run "antigravity-gemini-mcp accounts add" to add an account.');
    }

    console.log('');
}

/**
 * Remove an account
 */
async function handleRemove(email) {
    if (!email) {
        // Interactive mode - list and ask which to remove
        const { own } = listAccounts();

        if (own.length === 0) {
            console.log('No accounts to remove.');
            console.log('(Note: Can only remove accounts added via this tool, not antigravity-proxy accounts.)');
            return;
        }

        console.log('\nAccounts:');
        own.forEach((acc, i) => {
            console.log(`  ${i + 1}. ${acc.email}`);
        });

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer = await new Promise(resolve => {
            rl.question('\nEnter account number or email to remove (or "cancel"): ', resolve);
        });
        rl.close();

        if (answer.toLowerCase() === 'cancel') {
            console.log('Cancelled.');
            return;
        }

        // Parse input - number or email
        const num = parseInt(answer);
        if (!isNaN(num) && num >= 1 && num <= own.length) {
            email = own[num - 1].email;
        } else {
            email = answer;
        }
    }

    const success = removeAccount(email);

    if (success) {
        console.log(`\n✓ Removed account: ${email}`);
    } else {
        console.log(`\n✗ Account not found: ${email}`);
        console.log('(Note: Can only remove accounts added via this tool.)');
    }
}

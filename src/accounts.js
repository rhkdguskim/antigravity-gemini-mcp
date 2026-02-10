/**
 * Account management module
 * Handles loading, saving, and managing accounts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { ACCOUNTS_CONFIG_PATH, FALLBACK_ACCOUNTS_PATH, CONFIG_DIR } from './constants.js';

/**
 * Ensure config directory exists
 */
function ensureConfigDir() {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

/**
 * Load accounts from config file
 * Falls back to antigravity-proxy accounts if own config doesn't exist
 */
export function loadAccounts() {
    // Try own config first
    if (existsSync(ACCOUNTS_CONFIG_PATH)) {
        try {
            const data = JSON.parse(readFileSync(ACCOUNTS_CONFIG_PATH, 'utf-8'));
            return data.accounts || [];
        } catch (e) {
            console.error('Error loading accounts:', e.message);
        }
    }

    // Fall back to antigravity-proxy accounts
    if (existsSync(FALLBACK_ACCOUNTS_PATH)) {
        try {
            const data = JSON.parse(readFileSync(FALLBACK_ACCOUNTS_PATH, 'utf-8'));
            const accounts = data.accounts || [];
            if (accounts.length > 0) {
                console.error(`[Info] Using ${accounts.length} account(s) from antigravity-proxy config`);
            }
            return accounts;
        } catch (e) {
            // Ignore fallback errors
        }
    }

    return [];
}

/**
 * Save accounts to config file
 */
export function saveAccounts(accounts) {
    ensureConfigDir();

    const data = {
        accounts,
        settings: {
            version: '1.0.0',
            updatedAt: new Date().toISOString()
        }
    };

    writeFileSync(ACCOUNTS_CONFIG_PATH, JSON.stringify(data, null, 2));
}

/**
 * Add a new account
 */
export function addAccount(email, refreshToken) {
    const accounts = loadAccountsFromOwnConfig();

    // Check if account already exists
    const existingIndex = accounts.findIndex(a => a.email === email);
    if (existingIndex >= 0) {
        // Update existing account
        accounts[existingIndex] = {
            ...accounts[existingIndex],
            refreshToken,
            updatedAt: new Date().toISOString()
        };
    } else {
        // Add new account
        accounts.push({
            email,
            refreshToken,
            source: 'oauth',
            enabled: true,
            addedAt: new Date().toISOString(),
            modelRateLimits: {}
        });
    }

    saveAccounts(accounts);
    return accounts.length;
}

/**
 * Remove an account by email
 */
export function removeAccount(email) {
    const accounts = loadAccountsFromOwnConfig();
    const filtered = accounts.filter(a => a.email !== email);

    if (filtered.length === accounts.length) {
        return false; // Account not found
    }

    saveAccounts(filtered);
    return true;
}

/**
 * List all accounts
 */
export function listAccounts() {
    const ownAccounts = loadAccountsFromOwnConfig();
    const fallbackAccounts = loadFallbackAccounts();

    return {
        own: ownAccounts,
        fallback: fallbackAccounts,
        all: ownAccounts.length > 0 ? ownAccounts : fallbackAccounts
    };
}

/**
 * Load accounts only from own config (not fallback)
 */
function loadAccountsFromOwnConfig() {
    if (!existsSync(ACCOUNTS_CONFIG_PATH)) {
        return [];
    }

    try {
        const data = JSON.parse(readFileSync(ACCOUNTS_CONFIG_PATH, 'utf-8'));
        return data.accounts || [];
    } catch (e) {
        return [];
    }
}

/**
 * Load accounts from fallback (antigravity-proxy)
 */
function loadFallbackAccounts() {
    if (!existsSync(FALLBACK_ACCOUNTS_PATH)) {
        return [];
    }

    try {
        const data = JSON.parse(readFileSync(FALLBACK_ACCOUNTS_PATH, 'utf-8'));
        return data.accounts || [];
    } catch (e) {
        return [];
    }
}

/**
 * Get enabled accounts for API use
 */
export function getEnabledAccounts() {
    const accounts = loadAccounts();
    return accounts.filter(a => a.enabled !== false && !a.isInvalid);
}

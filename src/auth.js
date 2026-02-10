/**
 * Authentication module
 * Handles token management and account selection
 */

import { getEnabledAccounts } from './accounts.js';
import { OAUTH_CONFIG, TOKEN_CACHE_TTL_MS } from './constants.js';

// Token cache: email -> { accessToken, expiresAt }
const tokenCache = new Map();

/**
 * Parse composite refresh token
 * Format: refreshToken|projectId|managedProjectId
 */
export function parseRefreshParts(refresh) {
    const [refreshToken = '', projectId = '', managedProjectId = ''] = (refresh ?? '').split('|');
    return {
        refreshToken,
        projectId: projectId || undefined,
        managedProjectId: managedProjectId || undefined
    };
}

/**
 * Load enabled accounts
 */
export function loadAccounts() {
    const accounts = getEnabledAccounts();
    if (accounts.length === 0) {
        throw new Error('No accounts configured. Run: antigravity-gemini-mcp accounts add');
    }
    return accounts;
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(compositeRefresh) {
    const parts = parseRefreshParts(compositeRefresh);

    const response = await fetch(OAUTH_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: OAUTH_CONFIG.clientId,
            client_secret: OAUTH_CONFIG.clientSecret,
            refresh_token: parts.refreshToken,
            grant_type: 'refresh_token'
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
    }

    const tokens = await response.json();
    return {
        accessToken: tokens.access_token,
        expiresIn: tokens.expires_in
    };
}

/**
 * Get valid access token for an account (with caching)
 */
export async function getAccessToken(account) {
    const cached = tokenCache.get(account.email);
    const now = Date.now();

    // Return cached token if still valid
    if (cached && cached.expiresAt > now) {
        return cached.accessToken;
    }

    // Refresh token
    const { accessToken, expiresIn } = await refreshAccessToken(account.refreshToken);

    // Cache with TTL (use the shorter of expiresIn or our cache TTL)
    const ttl = Math.min((expiresIn - 60) * 1000, TOKEN_CACHE_TTL_MS);
    tokenCache.set(account.email, {
        accessToken,
        expiresAt: now + ttl
    });

    return accessToken;
}

/**
 * Get project ID from account
 */
export function getProjectId(account) {
    // Try to get from composite refresh token
    const parts = parseRefreshParts(account.refreshToken);
    if (parts.managedProjectId) return parts.managedProjectId;
    if (parts.projectId) return parts.projectId;

    // Fallback to account projectId field
    return account.projectId || null;
}

/**
 * Select best available account
 * Simple round-robin for now
 */
let currentIndex = 0;

export function selectAccount(accounts) {
    if (accounts.length === 0) {
        throw new Error('No accounts available');
    }

    const account = accounts[currentIndex % accounts.length];
    currentIndex++;
    return account;
}

/**
 * Clear token cache for an account
 */
export function clearTokenCache(email = null) {
    if (email) {
        tokenCache.delete(email);
    } else {
        tokenCache.clear();
    }
}

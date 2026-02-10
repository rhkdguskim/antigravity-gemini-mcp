/**
 * Constants for Antigravity Gemini MCP Server
 * Based on antigravity-claude-proxy implementation
 */

import { homedir, platform, arch } from 'os';
import { join } from 'path';

// Config directory
export const CONFIG_DIR = join(homedir(), '.config/antigravity-gemini-mcp');

// Accounts config path (own config, with fallback to antigravity-proxy)
export const ACCOUNTS_CONFIG_PATH = join(CONFIG_DIR, 'accounts.json');

// Fallback to antigravity-proxy accounts if own config doesn't exist
export const FALLBACK_ACCOUNTS_PATH = join(
    homedir(),
    '.config/antigravity-proxy/accounts.json'
);

// OAuth callback port
export const OAUTH_CALLBACK_PORT = 51321;

// Cloud Code API endpoints (in fallback order)
export const API_ENDPOINTS = [
    'https://daily-cloudcode-pa.googleapis.com',
    'https://cloudcode-pa.googleapis.com'
];

// OAuth configuration (from Antigravity)
export const OAUTH_CONFIG = {
    clientId: '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
    clientSecret: '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',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v1/userinfo',
    scopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/cclog',
        'https://www.googleapis.com/auth/experimentsandconfigs'
    ]
};

// IDE Type enum
export const IDE_TYPE = {
    UNSPECIFIED: 0,
    JETSKI: 5,
    ANTIGRAVITY: 6,
    PLUGINS: 7
};

// Platform enum
export const PLATFORM = {
    UNSPECIFIED: 0,
    WINDOWS: 1,
    LINUX: 2,
    MACOS: 3
};

// Plugin type enum
export const PLUGIN_TYPE = {
    UNSPECIFIED: 0,
    DUET_AI: 1,
    GEMINI: 2
};

/**
 * Get the platform enum value
 */
function getPlatformEnum() {
    switch (platform()) {
        case 'darwin': return PLATFORM.MACOS;
        case 'win32': return PLATFORM.WINDOWS;
        case 'linux': return PLATFORM.LINUX;
        default: return PLATFORM.UNSPECIFIED;
    }
}

/**
 * Generate platform-specific User-Agent string
 */
function getPlatformUserAgent() {
    const os = platform();
    const architecture = arch();
    return `antigravity/1.16.5 ${os}/${architecture}`;
}

// Client metadata for API requests
export const CLIENT_METADATA = {
    ideType: IDE_TYPE.ANTIGRAVITY,
    platform: getPlatformEnum(),
    pluginType: PLUGIN_TYPE.GEMINI
};

// Request headers
export const API_HEADERS = {
    'User-Agent': getPlatformUserAgent(),
    'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
    'Client-Metadata': JSON.stringify(CLIENT_METADATA)
};

// Token cache TTL (5 minutes)
export const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;

// Default project ID (fallback)
export const DEFAULT_PROJECT_ID = 'rising-fact-p41fc';

// Antigravity system instruction (required for some models)
export const ANTIGRAVITY_SYSTEM_INSTRUCTION = `You are Antigravity, a powerful agentic AI coding assistant designed by the Google Deepmind team working on Advanced Agentic Coding.You are pair programming with a USER to solve their coding task. The task may require creating a new codebase, modifying or debugging an existing codebase, or simply answering a question.**Absolute paths only****Proactiveness**`;

// Default max tokens for generation
export const DEFAULT_MAX_TOKENS = 8192;

// Gemini max output tokens
export const GEMINI_MAX_OUTPUT_TOKENS = 16384;

/**
 * Check if a model supports thinking/reasoning
 */
export function isThinkingModel(modelName) {
    const lower = (modelName || '').toLowerCase();
    if (lower.includes('thinking')) return true;
    // Gemini 3+ models support thinking
    const versionMatch = lower.match(/gemini-(\d+)/);
    if (versionMatch && parseInt(versionMatch[1], 10) >= 3) return true;
    return false;
}

/**
 * Get model family from model name
 */
export function getModelFamily(modelName) {
    const lower = (modelName || '').toLowerCase();
    if (lower.includes('claude')) return 'claude';
    if (lower.includes('gemini')) return 'gemini';
    return 'unknown';
}

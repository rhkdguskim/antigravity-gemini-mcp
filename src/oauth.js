/**
 * OAuth module for Google authentication
 * Based on antigravity-claude-proxy implementation
 */

import crypto from 'crypto';
import http from 'http';
import { OAUTH_CONFIG, OAUTH_CALLBACK_PORT } from './constants.js';

const OAUTH_REDIRECT_URI = `http://localhost:${OAUTH_CALLBACK_PORT}/oauth-callback`;

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64url');
    return { verifier, challenge };
}

/**
 * Generate authorization URL for Google OAuth
 */
export function getAuthorizationUrl() {
    const { verifier, challenge } = generatePKCE();
    const state = crypto.randomBytes(16).toString('hex');

    const params = new URLSearchParams({
        client_id: OAUTH_CONFIG.clientId,
        redirect_uri: OAUTH_REDIRECT_URI,
        response_type: 'code',
        scope: OAUTH_CONFIG.scopes.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: state
    });

    return {
        url: `${OAUTH_CONFIG.authUrl}?${params.toString()}`,
        verifier,
        state
    };
}

/**
 * Start a local server to receive the OAuth callback
 */
export function startCallbackServer(expectedState, timeoutMs = 120000) {
    let server = null;
    let timeoutId = null;

    const promise = new Promise((resolve, reject) => {
        server = http.createServer((req, res) => {
            const url = new URL(req.url, `http://localhost:${OAUTH_CALLBACK_PORT}`);

            if (url.pathname !== '/oauth-callback') {
                res.writeHead(404);
                res.end('Not found');
                return;
            }

            const code = url.searchParams.get('code');
            const state = url.searchParams.get('state');
            const error = url.searchParams.get('error');

            if (error) {
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <html><body style="font-family: system-ui; padding: 40px; text-align: center;">
                        <h1 style="color: #dc3545;">Authentication Failed</h1>
                        <p>Error: ${error}</p>
                    </body></html>
                `);
                server.close();
                reject(new Error(`OAuth error: ${error}`));
                return;
            }

            if (state !== expectedState) {
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <html><body style="font-family: system-ui; padding: 40px; text-align: center;">
                        <h1 style="color: #dc3545;">Authentication Failed</h1>
                        <p>State mismatch</p>
                    </body></html>
                `);
                server.close();
                reject(new Error('State mismatch'));
                return;
            }

            if (!code) {
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <html><body style="font-family: system-ui; padding: 40px; text-align: center;">
                        <h1 style="color: #dc3545;">Authentication Failed</h1>
                        <p>No authorization code</p>
                    </body></html>
                `);
                server.close();
                reject(new Error('No authorization code'));
                return;
            }

            // Success
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
                <html><body style="font-family: system-ui; padding: 40px; text-align: center;">
                    <h1 style="color: #28a745;">Authentication Successful!</h1>
                    <p>You can close this window and return to the terminal.</p>
                    <script>setTimeout(() => window.close(), 2000);</script>
                </body></html>
            `);

            server.close();
            clearTimeout(timeoutId);
            resolve(code);
        });

        server.listen(OAUTH_CALLBACK_PORT, '0.0.0.0', () => {
            console.log(`OAuth callback server listening on port ${OAUTH_CALLBACK_PORT}`);
        });

        server.on('error', (err) => {
            reject(new Error(`Failed to start callback server: ${err.message}`));
        });

        timeoutId = setTimeout(() => {
            server.close();
            reject(new Error('OAuth callback timeout'));
        }, timeoutMs);
    });

    const abort = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (server) server.close();
    };

    return { promise, abort };
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCode(code, verifier) {
    const response = await fetch(OAUTH_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: OAUTH_CONFIG.clientId,
            client_secret: OAUTH_CONFIG.clientSecret,
            code: code,
            code_verifier: verifier,
            grant_type: 'authorization_code',
            redirect_uri: OAUTH_REDIRECT_URI
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens = await response.json();

    if (!tokens.access_token) {
        throw new Error('No access token received');
    }

    return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in
    };
}

/**
 * Get user email from access token
 */
export async function getUserEmail(accessToken) {
    const response = await fetch(OAUTH_CONFIG.userInfoUrl, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.status}`);
    }

    const userInfo = await response.json();
    return userInfo.email;
}

/**
 * Complete OAuth flow
 */
export async function completeOAuthFlow(code, verifier) {
    const tokens = await exchangeCode(code, verifier);
    const email = await getUserEmail(tokens.accessToken);

    return {
        email,
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken
    };
}

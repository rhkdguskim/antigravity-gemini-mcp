#!/usr/bin/env node

/**
 * Antigravity Gemini MCP Server
 * Exposes Gemini API via MCP using Antigravity authentication
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ErrorCode,
    McpError
} from '@modelcontextprotocol/sdk/types.js';

import { loadAccounts, getAccessToken, selectAccount, getProjectId } from './auth.js';
import { generateContent, listModels, getQuota } from './api.js';

// Create MCP server
const server = new Server(
    {
        name: 'antigravity-gemini-mcp',
        version: '1.0.0'
    },
    {
        capabilities: {
            tools: {}
        }
    }
);

// Load accounts on startup
let accounts = [];
try {
    accounts = loadAccounts();
    console.error(`[antigravity-gemini-mcp] Loaded ${accounts.length} account(s)`);
} catch (error) {
    console.error(`[antigravity-gemini-mcp] Warning: ${error.message}`);
}

/**
 * Tool definitions
 */
const TOOLS = [
    {
        name: 'gemini_generate',
        description: 'Generate text using Gemini models via Antigravity authentication. Supports thinking models (gemini-3-pro-high, gemini-3-flash, etc.)',
        inputSchema: {
            type: 'object',
            properties: {
                model: {
                    type: 'string',
                    description: 'Model ID (e.g., gemini-3-pro-high, gemini-3-flash, gemini-2.5-pro)',
                    default: 'gemini-3-flash'
                },
                prompt: {
                    type: 'string',
                    description: 'The prompt to send to the model'
                },
                system: {
                    type: 'string',
                    description: 'Optional system prompt'
                },
                max_tokens: {
                    type: 'number',
                    description: 'Maximum tokens to generate (default: 8192)',
                    default: 8192
                },
                temperature: {
                    type: 'number',
                    description: 'Temperature for generation (0.0-2.0)'
                },
                thinking: {
                    type: 'boolean',
                    description: 'Enable thinking/reasoning output for supported models',
                    default: true
                }
            },
            required: ['prompt']
        }
    },
    {
        name: 'gemini_chat',
        description: 'Multi-turn chat with Gemini models. Maintains conversation context.',
        inputSchema: {
            type: 'object',
            properties: {
                model: {
                    type: 'string',
                    description: 'Model ID',
                    default: 'gemini-3-flash'
                },
                messages: {
                    type: 'array',
                    description: 'Array of message objects with role (user/assistant) and content',
                    items: {
                        type: 'object',
                        properties: {
                            role: { type: 'string', enum: ['user', 'assistant'] },
                            content: { type: 'string' }
                        },
                        required: ['role', 'content']
                    }
                },
                system: {
                    type: 'string',
                    description: 'Optional system prompt'
                },
                max_tokens: {
                    type: 'number',
                    default: 8192
                },
                thinking: {
                    type: 'boolean',
                    default: true
                }
            },
            required: ['messages']
        }
    },
    {
        name: 'gemini_list_models',
        description: 'List available Gemini models and their quota status',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'gemini_get_quota',
        description: 'Get quota/usage information for all Gemini models',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'gemini_list_accounts',
        description: 'List configured Antigravity accounts',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    }
];

/**
 * Handle list tools request
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        // Reload accounts on each request to pick up changes
        try {
            accounts = loadAccounts();
        } catch (e) {
            // Keep existing accounts if reload fails
        }

        if (accounts.length === 0) {
            throw new McpError(
                ErrorCode.InternalError,
                'No Antigravity accounts configured. Run: antigravity-claude-proxy accounts add'
            );
        }

        switch (name) {
            case 'gemini_generate': {
                const account = selectAccount(accounts);
                const token = await getAccessToken(account);
                const projectId = getProjectId(account);

                const result = await generateContent(token, {
                    model: args.model || 'gemini-3-flash',
                    messages: [{ role: 'user', content: args.prompt }],
                    system: args.system,
                    maxTokens: args.max_tokens || 8192,
                    temperature: args.temperature,
                    thinking: args.thinking !== false ? { type: 'enabled' } : undefined
                }, projectId);

                // Format response
                let response = '';
                for (const block of result.content) {
                    if (block.type === 'thinking') {
                        response += `<thinking>\n${block.thinking}\n</thinking>\n\n`;
                    } else if (block.type === 'text') {
                        response += block.text;
                    }
                }

                return {
                    content: [
                        {
                            type: 'text',
                            text: response || '(No response)'
                        }
                    ],
                    metadata: {
                        model: result.model,
                        usage: result.usage,
                        stop_reason: result.stop_reason,
                        account: account.email
                    }
                };
            }

            case 'gemini_chat': {
                const account = selectAccount(accounts);
                const token = await getAccessToken(account);
                const projectId = getProjectId(account);

                const result = await generateContent(token, {
                    model: args.model || 'gemini-3-flash',
                    messages: args.messages,
                    system: args.system,
                    maxTokens: args.max_tokens || 8192,
                    thinking: args.thinking !== false ? { type: 'enabled' } : undefined
                }, projectId);

                // Format response
                let response = '';
                for (const block of result.content) {
                    if (block.type === 'thinking') {
                        response += `<thinking>\n${block.thinking}\n</thinking>\n\n`;
                    } else if (block.type === 'text') {
                        response += block.text;
                    }
                }

                return {
                    content: [
                        {
                            type: 'text',
                            text: response || '(No response)'
                        }
                    ],
                    metadata: {
                        model: result.model,
                        usage: result.usage,
                        stop_reason: result.stop_reason,
                        account: account.email
                    }
                };
            }

            case 'gemini_list_models': {
                const account = selectAccount(accounts);
                const token = await getAccessToken(account);
                const projectId = getProjectId(account);

                const models = await listModels(token, projectId);

                const modelList = models.map(m => {
                    let line = `- ${m.id}`;
                    if (m.name !== m.id) line += ` (${m.name})`;
                    if (m.quota) {
                        const remaining = m.quota.remaining !== null
                            ? `${Math.round(m.quota.remaining * 100)}%`
                            : 'N/A';
                        line += ` [Quota: ${remaining}]`;
                    }
                    return line;
                }).join('\n');

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Available Gemini Models:\n\n${modelList}`
                        }
                    ]
                };
            }

            case 'gemini_get_quota': {
                const account = selectAccount(accounts);
                const token = await getAccessToken(account);
                const projectId = getProjectId(account);

                const quota = await getQuota(token, projectId);

                const lines = Object.entries(quota).map(([model, info]) => {
                    let line = `${model}: ${info.remaining}`;
                    if (info.resetTime) {
                        const reset = new Date(info.resetTime);
                        line += ` (resets: ${reset.toLocaleString()})`;
                    }
                    return line;
                });

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Model Quotas (Account: ${account.email}):\n\n${lines.join('\n')}`
                        }
                    ]
                };
            }

            case 'gemini_list_accounts': {
                const accountList = accounts.map((acc, i) => {
                    return `${i + 1}. ${acc.email}${acc.enabled === false ? ' (disabled)' : ''}`;
                }).join('\n');

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Configured Accounts:\n\n${accountList}\n\nTotal: ${accounts.length} account(s)`
                        }
                    ]
                };
            }

            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
    } catch (error) {
        if (error instanceof McpError) throw error;

        console.error(`[antigravity-gemini-mcp] Error in ${name}:`, error.message);

        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${error.message}`
                }
            ],
            isError: true
        };
    }
});

/**
 * Start the server
 */
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[antigravity-gemini-mcp] Server started');
}

main().catch((error) => {
    console.error('[antigravity-gemini-mcp] Fatal error:', error);
    process.exit(1);
});

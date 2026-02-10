/**
 * Gemini API module
 * Handles Cloud Code API calls
 */

import {
    API_ENDPOINTS,
    API_HEADERS,
    CLIENT_METADATA,
    DEFAULT_MAX_TOKENS,
    GEMINI_MAX_OUTPUT_TOKENS,
    isThinkingModel,
    getModelFamily
} from './constants.js';

/**
 * Build request headers
 */
function buildHeaders(token, acceptType = 'application/json') {
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': acceptType,
        ...API_HEADERS
    };
}

/**
 * Convert messages to Cloud Code format
 */
function convertMessages(messages, systemPrompt = null) {
    const contents = [];

    // Add system prompt as first user message if provided
    if (systemPrompt) {
        contents.push({
            role: 'user',
            parts: [{ text: `[System]: ${systemPrompt}` }]
        });
        contents.push({
            role: 'model',
            parts: [{ text: 'Understood. I will follow these instructions.' }]
        });
    }

    for (const msg of messages) {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        const parts = [];

        if (typeof msg.content === 'string') {
            parts.push({ text: msg.content });
        } else if (Array.isArray(msg.content)) {
            for (const block of msg.content) {
                if (block.type === 'text') {
                    parts.push({ text: block.text });
                } else if (block.type === 'image') {
                    // Handle image content
                    parts.push({
                        inlineData: {
                            mimeType: block.source?.media_type || 'image/png',
                            data: block.source?.data || ''
                        }
                    });
                }
            }
        }

        if (parts.length > 0) {
            contents.push({ role, parts });
        }
    }

    return contents;
}

/**
 * Build Cloud Code request payload
 */
function buildRequest(options) {
    const {
        model,
        messages,
        system,
        maxTokens = DEFAULT_MAX_TOKENS,
        temperature,
        topP,
        topK,
        thinking
    } = options;

    const contents = convertMessages(messages, system);

    const payload = {
        model,
        contents,
        generationConfig: {
            maxOutputTokens: Math.min(maxTokens, GEMINI_MAX_OUTPUT_TOKENS)
        }
    };

    // Add optional parameters
    if (temperature !== undefined) {
        payload.generationConfig.temperature = temperature;
    }
    if (topP !== undefined) {
        payload.generationConfig.topP = topP;
    }
    if (topK !== undefined) {
        payload.generationConfig.topK = topK;
    }

    // Enable thinking for supported models
    if (thinking?.type === 'enabled' && isThinkingModel(model)) {
        payload.generationConfig.thinkingConfig = {
            thinkingBudget: thinking.budget_tokens || 10000
        };
    }

    return payload;
}

/**
 * Parse Cloud Code response to standard format
 */
function parseResponse(data, model) {
    const result = {
        model,
        content: [],
        usage: {
            input_tokens: data.usageMetadata?.promptTokenCount || 0,
            output_tokens: data.usageMetadata?.candidatesTokenCount || 0
        },
        stop_reason: 'end_turn'
    };

    const candidate = data.candidates?.[0];
    if (!candidate) {
        return result;
    }

    // Check finish reason
    if (candidate.finishReason) {
        const reasonMap = {
            'STOP': 'end_turn',
            'MAX_TOKENS': 'max_tokens',
            'SAFETY': 'content_filter',
            'RECITATION': 'content_filter'
        };
        result.stop_reason = reasonMap[candidate.finishReason] || 'end_turn';
    }

    // Parse content parts
    for (const part of candidate.content?.parts || []) {
        if (part.thought) {
            // Thinking block
            result.content.push({
                type: 'thinking',
                thinking: part.thought
            });
        } else if (part.text) {
            // Text block
            result.content.push({
                type: 'text',
                text: part.text
            });
        }
    }

    return result;
}

/**
 * Generate content using Gemini API
 */
export async function generateContent(token, options) {
    const payload = buildRequest(options);
    const model = options.model;
    const useStreaming = isThinkingModel(model);

    let lastError = null;

    for (const endpoint of API_ENDPOINTS) {
        try {
            const url = useStreaming
                ? `${endpoint}/v1internal:streamGenerateContent?alt=sse`
                : `${endpoint}/v1internal:generateContent`;

            const response = await fetch(url, {
                method: 'POST',
                headers: buildHeaders(token, useStreaming ? 'text/event-stream' : 'application/json'),
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                lastError = new Error(`API error ${response.status}: ${errorText}`);

                // Don't retry on 4xx errors (except 429)
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    throw lastError;
                }
                continue;
            }

            if (useStreaming) {
                // Parse SSE response and accumulate
                return await parseSSEResponse(response, model);
            }

            const data = await response.json();
            return parseResponse(data, model);

        } catch (error) {
            lastError = error;
            // Don't retry on client errors
            if (error.message?.includes('400') || error.message?.includes('invalid')) {
                throw error;
            }
        }
    }

    throw lastError || new Error('All endpoints failed');
}

/**
 * Parse SSE streaming response
 */
async function parseSSEResponse(response, model) {
    const text = await response.text();
    const lines = text.split('\n');

    let result = {
        model,
        content: [],
        usage: { input_tokens: 0, output_tokens: 0 },
        stop_reason: 'end_turn'
    };

    let thinkingText = '';
    let responseText = '';

    for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        try {
            const data = JSON.parse(line.slice(6));

            // Update usage
            if (data.usageMetadata) {
                result.usage.input_tokens = data.usageMetadata.promptTokenCount || 0;
                result.usage.output_tokens = data.usageMetadata.candidatesTokenCount || 0;
            }

            // Accumulate content
            const candidate = data.candidates?.[0];
            if (candidate?.content?.parts) {
                for (const part of candidate.content.parts) {
                    if (part.thought) {
                        thinkingText += part.thought;
                    } else if (part.text) {
                        responseText += part.text;
                    }
                }
            }

            // Check finish reason
            if (candidate?.finishReason) {
                const reasonMap = {
                    'STOP': 'end_turn',
                    'MAX_TOKENS': 'max_tokens',
                    'SAFETY': 'content_filter'
                };
                result.stop_reason = reasonMap[candidate.finishReason] || 'end_turn';
            }
        } catch (e) {
            // Skip malformed JSON
        }
    }

    // Build final content
    if (thinkingText) {
        result.content.push({ type: 'thinking', thinking: thinkingText });
    }
    if (responseText) {
        result.content.push({ type: 'text', text: responseText });
    }

    return result;
}

/**
 * List available models
 */
export async function listModels(token, projectId = null) {
    const headers = buildHeaders(token);
    const body = projectId ? { project: projectId } : {};

    for (const endpoint of API_ENDPOINTS) {
        try {
            const response = await fetch(`${endpoint}/v1internal:fetchAvailableModels`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) continue;

            const data = await response.json();
            if (!data.models) continue;

            // Filter to Gemini models only
            const models = Object.entries(data.models)
                .filter(([id]) => getModelFamily(id) === 'gemini')
                .map(([id, info]) => ({
                    id,
                    name: info.displayName || id,
                    quota: info.quotaInfo ? {
                        remaining: info.quotaInfo.remainingFraction ?? null,
                        resetTime: info.quotaInfo.resetTime ?? null
                    } : null
                }));

            return models;
        } catch (error) {
            // Continue to next endpoint
        }
    }

    throw new Error('Failed to fetch models from all endpoints');
}

/**
 * Get quota information for all models
 */
export async function getQuota(token, projectId = null) {
    const models = await listModels(token, projectId);

    return models.reduce((acc, model) => {
        if (model.quota) {
            acc[model.id] = {
                remaining: model.quota.remaining !== null
                    ? `${Math.round(model.quota.remaining * 100)}%`
                    : 'N/A',
                remainingFraction: model.quota.remaining,
                resetTime: model.quota.resetTime
            };
        }
        return acc;
    }, {});
}

/**
 * Gemini API module
 * Handles Cloud Code API calls
 */

import crypto from 'crypto';
import {
    API_ENDPOINTS,
    API_HEADERS,
    DEFAULT_MAX_TOKENS,
    GEMINI_MAX_OUTPUT_TOKENS,
    DEFAULT_PROJECT_ID,
    isThinkingModel,
    getModelFamily
} from './constants.js';

// Antigravity system instruction (minimal version)
const SYSTEM_INSTRUCTION = 'You are a helpful AI assistant.';

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
function convertMessages(messages) {
    const contents = [];

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
 * Build Cloud Code request payload with wrapper
 */
function buildRequest(options, projectId) {
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

    const contents = convertMessages(messages);

    // Build inner request object
    const innerRequest = {
        contents,
        generationConfig: {
            maxOutputTokens: Math.min(maxTokens, GEMINI_MAX_OUTPUT_TOKENS)
        }
    };

    // Add optional parameters
    if (temperature !== undefined) {
        innerRequest.generationConfig.temperature = temperature;
    }
    if (topP !== undefined) {
        innerRequest.generationConfig.topP = topP;
    }
    if (topK !== undefined) {
        innerRequest.generationConfig.topK = topK;
    }

    // Enable thinking for supported models
    if (thinking?.type === 'enabled' && isThinkingModel(model)) {
        innerRequest.generationConfig.thinkingConfig = {
            includeThoughts: true,
            thinkingBudget: thinking.budget_tokens || 16000
        };
    }

    // Build system instruction
    const systemParts = [{ text: SYSTEM_INSTRUCTION }];
    if (system) {
        systemParts.push({ text: system });
    }

    innerRequest.systemInstruction = {
        role: 'user',
        parts: systemParts
    };

    // Wrap in Cloud Code envelope
    const payload = {
        project: projectId || DEFAULT_PROJECT_ID,
        model: model,
        request: innerRequest,
        userAgent: 'antigravity',
        requestType: 'agent',
        requestId: 'agent-' + crypto.randomUUID()
    };

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
            result.content.push({
                type: 'thinking',
                thinking: part.thought
            });
        } else if (part.text) {
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
export async function generateContent(token, options, projectId = null) {
    const payload = buildRequest(options, projectId);
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
                return await parseSSEResponse(response, model);
            }

            const data = await response.json();
            // Unwrap response if wrapped
            const responseData = data.response || data;
            return parseResponse(responseData, model);

        } catch (error) {
            lastError = error;
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
            let data = JSON.parse(line.slice(6));

            // Unwrap response if wrapped
            if (data.response) {
                data = data.response;
            }

            if (data.usageMetadata) {
                result.usage.input_tokens = data.usageMetadata.promptTokenCount || 0;
                result.usage.output_tokens = data.usageMetadata.candidatesTokenCount || 0;
            }

            const candidate = data.candidates?.[0];
            if (candidate?.content?.parts) {
                for (const part of candidate.content.parts) {
                    if (part.thought) {
                        thinkingText += part.thought;
                    } else if (part.text && part.text.length > 0) {
                        responseText += part.text;
                    }
                }
            }

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

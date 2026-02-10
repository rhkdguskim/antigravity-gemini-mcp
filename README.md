# Antigravity Gemini MCP Server

MCP (Model Context Protocol) server that provides access to Google Gemini models using Antigravity authentication.

## Features

- Uses existing Antigravity account configuration (no separate setup needed)
- Multi-account support with automatic rotation
- Supports all Gemini models including thinking models (gemini-3-pro-high, gemini-3-flash, etc.)
- Native MCP integration with Claude Code

## Prerequisites

1. **Antigravity Claude Proxy** must be installed and configured with at least one Google account:

```bash
npm install -g antigravity-claude-proxy
antigravity-claude-proxy accounts add
```

## Installation

### Option 1: Install globally

```bash
npm install -g antigravity-gemini-mcp
```

### Option 2: Install from source

```bash
git clone https://github.com/yourusername/antigravity-gemini-mcp.git
cd antigravity-gemini-mcp
npm install
npm link
```

## Usage with Claude Code

Add to your Claude Code MCP configuration:

```bash
claude mcp add antigravity-gemini -- npx antigravity-gemini-mcp
```

Or if installed globally:

```bash
claude mcp add antigravity-gemini -- antigravity-gemini-mcp
```

## Available Tools

### gemini_generate

Generate text using Gemini models.

```json
{
  "model": "gemini-3-flash",
  "prompt": "Explain quantum computing",
  "system": "You are a helpful assistant",
  "max_tokens": 8192,
  "temperature": 0.7,
  "thinking": true
}
```

### gemini_chat

Multi-turn chat with conversation context.

```json
{
  "model": "gemini-3-pro-high",
  "messages": [
    { "role": "user", "content": "Hello!" },
    { "role": "assistant", "content": "Hi! How can I help?" },
    { "role": "user", "content": "Tell me about AI" }
  ],
  "thinking": true
}
```

### gemini_list_models

List available Gemini models with quota status.

### gemini_get_quota

Get detailed quota information for all models.

### gemini_list_accounts

List configured Antigravity accounts.

## Supported Models

| Model | Description |
|-------|-------------|
| gemini-3-pro-high | High-capacity Gemini 3 Pro (1M context) |
| gemini-3-pro-low | Standard Gemini 3 Pro |
| gemini-3-flash | Fast Gemini 3 model |
| gemini-2.5-pro | Gemini 2.5 Pro |
| gemini-2.5-flash | Gemini 2.5 Flash |
| gemini-2.5-flash-thinking | Gemini 2.5 Flash with thinking |

## Configuration

The MCP server uses the same account configuration as `antigravity-claude-proxy`:

```
~/.config/antigravity-proxy/accounts.json
```

No additional configuration is needed.

## Architecture

```
┌─────────────────────────────────────────────┐
│              Claude Code                     │
│                   │                          │
│                   ▼                          │
│         ┌─────────────────┐                  │
│         │   MCP Protocol  │                  │
│         └────────┬────────┘                  │
│                  │                           │
│                  ▼                           │
│    ┌─────────────────────────┐              │
│    │ antigravity-gemini-mcp  │              │
│    │  ├── auth.js (OAuth)    │              │
│    │  ├── api.js (Gemini)    │              │
│    │  └── index.js (MCP)     │              │
│    └────────────┬────────────┘              │
│                 │                            │
│                 ▼                            │
│    ┌─────────────────────────┐              │
│    │  accounts.json          │              │
│    │  (Antigravity config)   │              │
│    └────────────┬────────────┘              │
│                 │                            │
│                 ▼                            │
│    ┌─────────────────────────┐              │
│    │  Google Cloud Code API  │              │
│    │  (Gemini Models)        │              │
│    └─────────────────────────┘              │
└─────────────────────────────────────────────┘
```

## Comparison with Antigravity Proxy

| Feature | Antigravity Proxy | This MCP Server |
|---------|-------------------|-----------------|
| Protocol | HTTP Proxy | MCP Native |
| Setup | ANTHROPIC_BASE_URL | claude mcp add |
| Port | 8080 (configurable) | None (stdio) |
| Models | Claude + Gemini | Gemini only |
| Integration | Environment vars | MCP tools |

## License

MIT

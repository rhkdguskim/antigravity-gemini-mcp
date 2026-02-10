# Antigravity Gemini MCP Server

MCP (Model Context Protocol) server that provides access to Google Gemini models using Antigravity authentication.

## Features

- **Independent account management** - Add Google accounts directly (no external dependencies)
- **Multi-account support** - Automatic rotation for rate limit handling
- **Supports all Gemini models** - Including thinking models (gemini-3-pro-high, gemini-3-flash, etc.)
- **Native MCP integration** - Works seamlessly with Claude Code
- **Fallback compatibility** - Can use existing antigravity-proxy accounts

## Quick Start

### 1. Install

```bash
npm install -g antigravity-gemini-mcp
```

Or install from source:

```bash
git clone https://github.com/rhkdguskim/antigravity-gemini-mcp.git
cd antigravity-gemini-mcp
npm install
npm link
```

### 2. Add Google Account

```bash
antigravity-gemini-mcp accounts add
```

This will open a browser for Google OAuth authentication.

### 3. Register with Claude Code

```bash
claude mcp add antigravity-gemini -- antigravity-gemini-mcp
```

## CLI Commands

```bash
# Add a Google account (opens browser for OAuth)
antigravity-gemini-mcp accounts add

# List configured accounts
antigravity-gemini-mcp accounts list

# Remove an account
antigravity-gemini-mcp accounts remove [email]

# Start MCP server (used by Claude Code)
antigravity-gemini-mcp

# Show help
antigravity-gemini-mcp help
```

## Multi-Account Support

You can add multiple Google accounts for automatic rotation:

```bash
# Add first account
antigravity-gemini-mcp accounts add
# → user1@gmail.com

# Add second account
antigravity-gemini-mcp accounts add
# → user2@gmail.com

# Add more accounts...
antigravity-gemini-mcp accounts add
# → user3@gmail.com
```

Benefits of multiple accounts:
- Automatic rotation when rate limited
- Higher aggregate quota
- Improved reliability

## Available MCP Tools

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

List configured accounts.

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

Accounts are stored in:
```
~/.config/antigravity-gemini-mcp/accounts.json
```

### Fallback Support

If no accounts are configured, the server will automatically use accounts from `antigravity-claude-proxy` if available:
```
~/.config/antigravity-proxy/accounts.json
```

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
│    │  ├── accounts.js        │              │
│    │  ├── oauth.js           │              │
│    │  ├── auth.js            │              │
│    │  ├── api.js             │              │
│    │  └── index.js (MCP)     │              │
│    └────────────┬────────────┘              │
│                 │                            │
│                 ▼                            │
│    ┌─────────────────────────┐              │
│    │  accounts.json          │              │
│    │  (own config)           │              │
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
| Account Management | Built-in | Built-in |
| Dependencies | None | None |

## Troubleshooting

### "No accounts configured"

Run `antigravity-gemini-mcp accounts add` to add a Google account.

### OAuth fails to open browser

Copy the URL from the terminal and open it manually in your browser.

### Rate limited

Add more Google accounts with `antigravity-gemini-mcp accounts add`.

## License

MIT

# Antigravity Gemini MCP Server

MCP (Model Context Protocol) server that provides access to **Google Gemini models** using Antigravity authentication.

## Features

- **Native MCP integration** - Works with Claude Desktop, Cursor, Claude Code, and more
- **Independent account management** - Add Google accounts directly via OAuth
- **Multi-account support** - Automatic rotation for rate limit handling
- **Supports all Gemini models** - Including thinking models (gemini-3-pro-high, gemini-3-flash, etc.)
- **Streaming output** - Real-time responses for thinking models

---

## Installation

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

---

## MCP Integration Guide

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "gemini": {
      "command": "npx",
      "args": ["-y", "antigravity-gemini-mcp"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "gemini": {
      "command": "antigravity-gemini-mcp"
    }
  }
}
```

Restart Claude Desktop after editing.

---

### Claude Code (CLI)

```bash
# Add MCP server
claude mcp add gemini -- npx -y antigravity-gemini-mcp

# Or if installed globally
claude mcp add gemini -- antigravity-gemini-mcp

# Verify installation
claude mcp list
```

---

### Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "gemini": {
      "command": "npx",
      "args": ["-y", "antigravity-gemini-mcp"]
    }
  }
}
```

Restart Cursor after editing.

---

### Antigravity (VS Code Extension)

Edit `~/.config/antigravity/mcp.json`:

```json
{
  "mcpServers": {
    "gemini": {
      "command": "npx",
      "args": ["-y", "antigravity-gemini-mcp"]
    }
  }
}
```

---

### OpenAI Codex CLI

```bash
codex mcp add gemini -- npx -y antigravity-gemini-mcp
```

Or edit `~/.codex/mcp.json`:

```json
{
  "mcpServers": {
    "gemini": {
      "command": "npx",
      "args": ["-y", "antigravity-gemini-mcp"]
    }
  }
}
```

---

### Google Gemini CLI

Edit `~/.config/gemini/mcp.json`:

```json
{
  "mcpServers": {
    "gemini": {
      "command": "npx",
      "args": ["-y", "antigravity-gemini-mcp"]
    }
  }
}
```

---

## Account Configuration

### Configuration File Location

Account configurations are stored in:

```
~/.config/antigravity-gemini-mcp/accounts.json
```

- **macOS/Linux**: `~/.config/antigravity-gemini-mcp/accounts.json`
- **Windows**: `%USERPROFILE%\.config\antigravity-gemini-mcp\accounts.json`

### Configuration File Format

```json
{
  "accounts": [
    {
      "email": "user1@gmail.com",
      "refreshToken": "1//0e...",
      "source": "oauth",
      "enabled": true,
      "addedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "email": "user2@gmail.com",
      "refreshToken": "1//0f...",
      "source": "oauth",
      "enabled": true,
      "addedAt": "2024-01-02T00:00:00.000Z"
    }
  ],
  "settings": {
    "version": "1.0.0"
  }
}
```

### Adding Accounts

#### Method 1: CLI Command (Recommended)

```bash
# Add a Google account (opens browser for OAuth)
antigravity-gemini-mcp accounts add

# This will:
# 1. Open your browser for Google login
# 2. Request necessary permissions
# 3. Save the account to accounts.json
```

#### Method 2: Use MCP Tool (via AI)

Ask the AI to list accounts, then add manually if needed:

```
You: Gemini 계정 목록을 보여줘

AI: [Uses gemini_list_accounts tool]
    현재 설정된 계정이 없습니다.

    계정을 추가하려면 터미널에서 다음 명령어를 실행하세요:
    antigravity-gemini-mcp accounts add
```

### Managing Accounts

```bash
# List all accounts
antigravity-gemini-mcp accounts list

# Output:
# Configured accounts:
#   1. user1@gmail.com (enabled, oauth)
#   2. user2@gmail.com (enabled, oauth)

# Remove an account
antigravity-gemini-mcp accounts remove user1@gmail.com
```

### Multi-Account Benefits

Adding multiple accounts provides:

| Benefit | Description |
|---------|-------------|
| **Rate Limit Bypass** | Automatic rotation when one account is rate limited |
| **Higher Quota** | Combined quota from all accounts |
| **Reliability** | If one account fails, others are used |

```bash
# Add multiple accounts
antigravity-gemini-mcp accounts add  # → user1@gmail.com
antigravity-gemini-mcp accounts add  # → user2@gmail.com
antigravity-gemini-mcp accounts add  # → user3@gmail.com
```

### Fallback Support

If no accounts are configured, the server automatically uses accounts from `antigravity-claude-proxy` if available:

```
~/.config/antigravity-proxy/accounts.json
```

---

## Available Tools

### gemini_generate

Generate text using a Gemini model.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `model` | Yes | Model name (e.g., "gemini-3-flash") |
| `prompt` | Yes | Text prompt |
| `system` | No | System instruction |
| `max_tokens` | No | Maximum output tokens (default: 8192) |
| `temperature` | No | Sampling temperature (0-2) |
| `thinking` | No | Enable thinking mode (true/false) |

### gemini_chat

Multi-turn conversation with message history.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `model` | Yes | Model name |
| `messages` | Yes | Array of {role, content} messages |
| `system` | No | System instruction |
| `max_tokens` | No | Maximum output tokens |
| `thinking` | No | Enable thinking mode |

### gemini_list_models

List available Gemini models with quota information.

### gemini_get_quota

Get detailed quota status for all models.

### gemini_list_accounts

List configured Google accounts.

---

## Supported Models

| Model | Thinking | Description |
|-------|----------|-------------|
| `gemini-3-pro-high` | Yes | High-capacity Gemini 3 Pro (1M context) |
| `gemini-3-pro-low` | Yes | Standard Gemini 3 Pro |
| `gemini-3-flash` | Yes | Fast Gemini 3 model |
| `gemini-3-pro-image` | Yes | Image generation capable |
| `gemini-2.5-pro` | No | Gemini 2.5 Pro |
| `gemini-2.5-flash` | No | Gemini 2.5 Flash |
| `gemini-2.5-flash-thinking` | Yes | Gemini 2.5 Flash with thinking |
| `gemini-2.5-flash-lite` | No | Lightweight Gemini 2.5 |

---

## Usage Examples

### Example 1: Simple Generation

```
You: Gemini로 "인공지능이란 무엇인가?"에 대해 설명해줘

AI: [Uses gemini_generate tool]
    model: "gemini-3-flash"
    prompt: "인공지능이란 무엇인가?"

    인공지능(AI)은 인간의 학습, 추론, 문제 해결 등의 지적 능력을
    컴퓨터 시스템으로 구현한 기술입니다...
```

### Example 2: With Thinking Mode

```
You: gemini-3-pro-high 모델로 복잡한 수학 문제를 풀어줘. thinking 모드 사용해.

AI: [Uses gemini_generate tool]
    model: "gemini-3-pro-high"
    prompt: "복잡한 수학 문제..."
    thinking: true

    [Thinking]
    먼저 문제를 분석해보면...

    [Response]
    답은 다음과 같습니다...
```

### Example 3: Multi-turn Chat

```
You: Gemini로 대화를 이어가줘

AI: [Uses gemini_chat tool]
    model: "gemini-3-flash"
    messages: [
      {"role": "user", "content": "안녕!"},
      {"role": "assistant", "content": "안녕하세요!"},
      {"role": "user", "content": "오늘 날씨 어때?"}
    ]

    오늘 날씨는 제가 실시간으로 확인할 수 없지만...
```

### Example 4: Check Model Quota

```
You: Gemini 모델들의 할당량을 확인해줘

AI: [Uses gemini_get_quota tool]

    Model Quota Status:
    - gemini-3-pro-high: 100% remaining
    - gemini-3-flash: 100% remaining
    - gemini-2.5-flash: 100% remaining
    - gemini-2.5-pro: N/A (unavailable)
```

### Example 5: List Accounts

```
You: 설정된 Gemini 계정들을 보여줘

AI: [Uses gemini_list_accounts tool]

    Configured accounts:
    1. user1@gmail.com (enabled)
    2. user2@gmail.com (enabled)

    Total: 2 accounts
```

---

## Response Format

### Successful Response

```json
{
  "model": "gemini-3-flash",
  "content": [
    {
      "type": "thinking",
      "thinking": "Let me analyze this..."
    },
    {
      "type": "text",
      "text": "Here is my response..."
    }
  ],
  "usage": {
    "input_tokens": 150,
    "output_tokens": 500
  },
  "stop_reason": "end_turn"
}
```

### Error Response

```json
{
  "error": "Rate limited",
  "code": 429,
  "message": "Quota exceeded for model gemini-3-pro-high"
}
```

---

## CLI Commands

```bash
# Start MCP server (usually not needed - clients start it automatically)
antigravity-gemini-mcp

# Account management
antigravity-gemini-mcp accounts add      # Add Google account (OAuth)
antigravity-gemini-mcp accounts list     # List accounts
antigravity-gemini-mcp accounts remove [email]  # Remove account

# Help
antigravity-gemini-mcp help
```

---

## Troubleshooting

### "No accounts configured"

```bash
# Add a Google account
antigravity-gemini-mcp accounts add
```

### OAuth fails to open browser

Copy the URL from the terminal and open it manually in your browser.

### Rate limited (429 error)

1. Check quota: Ask AI to run `gemini_get_quota`
2. Add more accounts: `antigravity-gemini-mcp accounts add`
3. Wait for quota reset (usually resets daily)

### Model unavailable (503 error)

The model may be temporarily unavailable due to server capacity. Try:
1. Use a different model (e.g., `gemini-3-flash` instead of `gemini-3-pro-high`)
2. Wait and retry later

### MCP server not appearing

1. Restart your AI client
2. Check configuration file path
3. Verify npm/npx is in your PATH
4. Check client logs for errors

### Authentication failed

1. Remove and re-add the account:
   ```bash
   antigravity-gemini-mcp accounts remove user@gmail.com
   antigravity-gemini-mcp accounts add
   ```
2. Make sure you complete the OAuth flow in the browser

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  AI Client (Claude Desktop / Cursor / Claude Code)  │
└────────────────────────┬────────────────────────────┘
                         │ MCP Protocol (stdio)
                         ▼
┌─────────────────────────────────────────────────────┐
│            antigravity-gemini-mcp                    │
│  ┌─────────────────────────────────────────────┐    │
│  │  Tools: gemini_generate, gemini_chat, ...   │    │
│  └─────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────┐    │
│  │  Auth: OAuth tokens, account rotation       │    │
│  └─────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────┐
│          Google Cloud Code API (Gemini)             │
└─────────────────────────────────────────────────────┘
```

---

## Comparison with Antigravity Proxy

| Feature | Antigravity Proxy | This MCP Server |
|---------|-------------------|-----------------|
| Protocol | HTTP Proxy | MCP Native |
| Setup | ANTHROPIC_BASE_URL | `claude mcp add` |
| Port | 8080 (configurable) | None (stdio) |
| Models | Claude + Gemini | Gemini only |
| Account Management | Built-in | Built-in |
| Best for | Claude API replacement | MCP tool integration |

---

## License

MIT

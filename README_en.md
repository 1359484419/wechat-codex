# WeChat Codex

Use WeChat on your phone as a remote control for Codex running on your computer.

Messages sent in WeChat are received by a local Node.js bridge, forwarded to `codex exec --json`, and sent back to WeChat. Your code, files, credentials, and session data stay on your machine.

[中文](README.md)

## What It Does

| Feature | Description |
|---------|-------------|
| WeChat QR binding | Scan once and talk to a bot from WeChat |
| Local Codex execution | Calls `codex exec --json` on your computer |
| Workspace switching | Use `/cwd` to choose which project Codex should work in |
| Image and file input | Downloads WeChat media locally and passes it to Codex |
| File delivery | Pushes common generated file types back to WeChat when paths appear in replies |
| Background daemon | launchd on macOS, systemd or direct mode on Linux |
| Session tools | `/clear`, `/compact`, `/history`, `/undo`, `/stop` |

## Architecture

```text
WeChat on phone
   │
   │  text / images / files
   ▼
ilink Bot API
   │
   │  long polling + HTTP replies
   ▼
Node.js bridge
   │
   │  spawn local Codex CLI
   ▼
codex exec --json
   │
   │  reads and writes local workspace files
   ▼
Your computer
```

The bridge does not perform model reasoning. It only handles WeChat I/O, media transfer, local session state, and daemon management.

## Quick Start

### 1. Requirements

- macOS or Linux
- A personal WeChat account
- Codex CLI installed and authenticated (`codex doctor` should pass)
- Node.js 18+

This repository currently includes a local Node runtime in `.local-node/`. If Node is not installed globally, enter the environment with:

```bash
cd /Users/xiao/projects/wechatcodex
export PATH=/Users/xiao/projects/wechatcodex/.local-node/bin:$PATH
```

### 2. Install

```bash
cd /Users/xiao/projects/wechatcodex
npm install
```

### 3. Bind WeChat

```bash
npm run setup
```

Scan the QR code with WeChat. Account credentials are stored locally under:

```text
~/.wechat-codex/accounts/
```

### 4. Start the daemon

```bash
npm run daemon -- start
npm run daemon -- status
```

On macOS, the daemon is registered as a launchd agent.

## Commands

### Local daemon

```bash
npm run daemon -- status
npm run daemon -- logs
npm run daemon -- restart
npm run daemon -- stop
```

### In WeChat

| Command | Purpose |
|---------|---------|
| `/help` | Show help |
| `/status` | Show cwd, model, and session state |
| `/cwd <path>` | Switch Codex working directory |
| `/model <name>` | Switch Codex model |
| `/prompt <text>` | Set a system prompt |
| `/clear` | Clear the current session |
| `/compact` | Start a new Codex session while keeping chat history |
| `/history [n]` | Show recent chat history |
| `/undo [n]` | Remove recent history entries |
| `/stop` | Stop the current task |
| `/send <path>` | Send a local file from the computer to WeChat |

## Data Directory

```text
~/.wechat-codex/
├── accounts/       # WeChat account credentials
├── config.json     # cwd, model, system prompt
├── sessions/       # session state and chat history
├── pending/        # queued messages when WeChat rate limits sending
└── logs/           # bridge logs and stdout/stderr
```

Do not commit or share files under `~/.wechat-codex/accounts/`.

## Codex Binary

If the daemon cannot find `codex`, set `CODEX_BIN`:

```bash
export CODEX_BIN=/Applications/Codex.app/Contents/Resources/codex
npm run daemon -- restart
```

The daemon script already adds this directory to PATH by default:

```text
/Applications/Codex.app/Contents/Resources
```

## Verify

```bash
npm run build
npm test
```

Then send this in WeChat:

```text
/status
```

If the logs show `Starting Codex CLI query` and `Text message sent`, the bridge is working.

## Notes

This first version focuses on one thing: letting your phone reliably reach local Codex. It keeps the WeChat transport, media handling, queues, and daemon manager, while replacing the original CLI backend with Codex CLI.

License: [MIT](LICENSE)

---
name: wechat-codex
description: 微信消息桥接 - 在微信中与本机 Codex CLI 对话。支持文字、图片、文件、后台守护进程和微信端斜杠命令。
---

# WeChat Codex Bridge

通过个人微信与本机 Codex CLI 进行对话。该项目基于 `Wechat-ggGitHub/wechat-claude-code` 改造，AI 后端已替换为 `codex exec --json`。

## 前置条件

- Node.js >= 18
- 个人微信账号（需扫码绑定）
- 本机已安装并登录 Codex CLI，`codex doctor` 可通过

## 本地使用

```bash
cd /Users/xiao/projects/wechatcodex
npm install
npm run setup
npm run daemon -- start
```

如后台服务找不到 Codex CLI，可设置：

```bash
export CODEX_BIN=/Applications/Codex.app/Contents/Resources/codex
```

## 管理命令

```bash
npm run daemon -- status
npm run daemon -- stop
npm run daemon -- restart
npm run daemon -- logs
```

## 微信端命令

- `/help`：显示帮助
- `/clear`：清除当前会话
- `/stop`：停止当前任务
- `/model <名称>`：切换 Codex 模型
- `/cwd <路径>`：切换工作目录
- `/prompt <内容>`：设置系统提示词
- `/status`：查看状态
- `/history [数量]`：查看历史

## 数据目录

所有运行数据存储在 `~/.wechat-codex/`：

```text
~/.wechat-codex/
├── accounts/
├── config.json
├── sessions/
└── logs/
```

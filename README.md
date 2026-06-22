# WeChat Codex Bridge

<p align="center">
  <strong>Chat with Codex in WeChat, just like texting a friend</strong>
</p>

<p align="center">
  <a href="README_en.md"><img src="https://img.shields.io/badge/Lang-English-lightgrey?style=flat-square" alt="English"></a>
</p>

扫码绑定微信后，你的微信里会多出一个好友。给它发消息，消息会自动转发给你电脑上运行的 Codex，回复也会实时推送到微信。支持文字、图片、语音、文件的收发。

<img width="3018" height="1216" alt="ScreenShot_2026-06-10_211251_410" src="https://github.com/user-attachments/assets/2ba4c53b-9c63-4ffd-bd0a-71935a6eabec" />

## 核心亮点
| | |
|---|---|
| **扫码即用** | 不用注册账号，不用部署服务器。微信扫码绑定，一分钟搞定。数据全在本地，隐私有保障。 |
| **消息不刷屏** | 只推送核心信息——进度、结果、关键决策。工具调用、中间过程等噪音自动过滤，阅读体验清爽。 |
| **"对方正在输入中..."** | Codex 在处理任务时，微信顶部会显示输入状态，随时感知它在干活。 |
| **电脑手机体验一致** | 手机端和电脑端 Codex 行为完全相同——同样的编排逻辑、同样的输出效果。不是两个割裂的 AI。 |
| **文件双向收发** | 发图片、Word、PDF 给 Codex 分析；Codex 生成的文件也会直接推送到微信，不用回到电脑前查看。 |
| **超时安抚** | 任务超过 5 分钟没响应？它会自动发一条消息告诉你还在干，不会让你对着空白聊天框干等。 |

## 快速安装

**本地安装**

```bash
cd /Users/xiao/projects/wechatcodex
npm install
```

## 快速开始

### 1. 扫码绑定

```bash
cd /Users/xiao/projects/wechatcodex
npm run setup
```

弹出二维码，用微信扫码。

### 2. 启动服务

```bash
npm run daemon -- start
```

macOS 下自动注册 launchd，开机自启、崩溃自动重启。

### 3. 开始聊天

打开微信，给你新出现的那个"好友"发条消息试试。

### 管理服务

```bash
npm run daemon -- status   # 查看运行状态
npm run daemon -- stop     # 停止服务
npm run daemon -- restart  # 重启服务（更新代码后使用）
npm run daemon -- logs     # 查看日志
```

## 微信端命令

直接在微信聊天中发送即可：

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助 |
| `/clear` | 清除当前会话，开始新对话 |
| `/stop` | 停止当前任务 |
| `/model <名称>` | 切换 Codex 模型 |
| `/prompt <内容>` | 设置系统提示词（如"用中文回答"） |
| `/cwd <路径>` | 切换工作目录 |
| `/skills` | 查看已安装的 Skill |
| `/status` | 查看当前会话状态 |
| `/history [数量]` | 查看最近对话记录 |
| `/compact` | 压缩上下文，开始新 CLI 会话 |
| `/reset` | 完全重置（包括工作目录等设置） |
| `/undo [数量]` | 撤销最近几条对话 |
| `/<skill> [参数]` | 触发任意已安装的 Skill |

## 工作原理

```
微信（手机） ←→ ilink Bot API ←→ Node.js 守护进程 ←→ Codex CLI（本地）
```

守护进程通过长轮询监听微信消息，转发给本地 `codex exec --json` 处理，回复推送回微信。全程跑在你自己电脑上。

## 后续计划

- **消息队列优化** — 连续发多条指令时，回复容易串。正在研究更好的队列策略，也欢迎讨论。
- **电脑休眠不中断** — 利用 macOS 的 `caffeinate` 命令阻止系统睡眠，合上盖子也能响应微信消息。
- **接续电脑会话** — 在电脑上聊了很久，出门想接着聊。计划支持从当前电脑端的 Codex 会话直接续聊，工作空间和上下文保持一致。

## 前置条件

- Node.js >= 18
- macOS 或 Linux
- 个人微信账号
- 已安装 Codex CLI 并完成认证（本机需能执行 `codex doctor`）

> **提示：** 如果后台服务找不到 Codex CLI，可设置 `CODEX_BIN=/Applications/Codex.app/Contents/Resources/codex`。

## 数据目录

所有数据存储在 `~/.wechat-codex/`：

```
~/.wechat-codex/
├── accounts/       # 微信账号凭证
├── config.json     # 全局配置
├── sessions/       # 会话数据
└── logs/           # 运行日志（每日轮转，保留 30 天）
```

## License

[MIT](LICENSE)

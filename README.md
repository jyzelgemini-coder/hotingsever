# ⚡ Cloud Bot & Server Hosting Platform

A high-performance hosting engine and dashboard for deploying and running **Telegram Bots**, **Discord Bots**, and **Cloud Web Services** 24/7 with live terminal streaming, resource monitoring, and a remote Telegram bot controller.

---

## 🚀 Key Features

- **Match UI Design**: Modern dark-mode hosting portal with glowing card selection for:
  - ✈️ **Telegram Bot Hosting** (Python `aiogram` / `python-telegram-bot`, Node.js `telegraf` / `grammY`)
  - 👾 **Discord Bot Hosting** (Discord.js, Discord.py with Gateway WebSocket connection)
  - 🌐 **Cloud Hosting** (Express APIs, Python microservices, custom backend stacks)
  - 🟩 **Minecraft & Game Hosting** (PaperMC Java/Bedrock, custom games)
- **Dual-Mode Orchestration Engine**:
  - **Docker Container Mode**: Automatically builds and runs isolated containers when Docker is available.
  - **Native Sandbox Process Mode**: Zero-dependency local runtime fallback that executes bots directly in isolated directories with automatic crash detection and auto-restart policy.
- **Real-Time Live Console**:
  - WebSocket-powered terminal streaming `stdout` and `stderr` in real time.
  - Interactive stdin command bar to send instructions directly to the running bot process.
- **Live Resource Metrics**:
  - Real-time CPU (%) usage, Memory (MB) consumption, and uptime tracking for every instance.
- **Embedded File Manager & Code Editor**:
  - Browse, view, and live-edit code files directly from the browser.
- **Cloud VPS & Docker Export**:
  - Automatically generates `Dockerfile` and `docker-compose.yml` for any instance for 1-click VPS export.
- **Remote Telegram Admin Bot**:
  - Manage and monitor your hosting server directly from your phone on Telegram using commands like `/servers`, `/sys`, `/start_srv`, `/stop_srv`, `/restart_srv`, and `/logs`.

---

## 🛠️ Quick Start (Local Run)

### 1. Requirements
- Node.js 18+ (tested on Node.js v24)
- Python 3.10+ (optional, for Python bots)

### 2. Start the Server
```bash
npm start
# or
node server.js
```

The server will launch at:
- **Web Dashboard**: [http://localhost:3000](http://localhost:3000)
- **API Endpoint**: [http://localhost:3000/api](http://localhost:3000/api)

---

## 🐳 Running in Docker (Cloud VPS)

To deploy on any Linux VPS (Ubuntu, Debian, DigitalOcean, Hetzner, AWS):

```bash
docker compose up -d --build
```

Access port `3000` via your server IP or domain reverse proxy (Nginx / Caddy).

---

## 📱 Telegram Remote Bot Controller Setup

1. Message [@BotFather](https://t.me/BotFather) on Telegram and run `/newbot` to create your controller bot.
2. Copy the API token.
3. In the web dashboard, open the **Telegram Bot Controller** tab and paste your token.
4. Open your bot on Telegram and send `/start`.
5. You can now monitor instances, check CPU/RAM, restart services, and read logs from Telegram!

---

## 📁 Project Architecture

```
├── server.js               # Express server + WebSocket terminal multiplexer
├── package.json            # Node.js dependencies
├── Dockerfile              # Dockerfile for cloud VPS deployment
├── docker-compose.yml      # Multi-container orchestration config
├── src/
│   ├── orchestrator/
│   │   ├── index.js        # Unified manager for server lifecycles
│   │   ├── processEngine.js# Native child process runner with live logs & metrics
│   │   ├── dockerEngine.js # Docker container builder & compose generator
│   │   └── templates.js    # Starter presets (Telegram, Discord, Cloud)
│   ├── routes/
│   │   └── api.js          # REST API endpoints
│   ├── db/
│   │   └── storage.js      # Persistent JSON database (data/db.json)
│   ├── utils/
│   │   └── systemStats.js  # Host CPU, RAM, and OS diagnostics
│   └── telegramManager.js  # Remote control Telegram bot client
├── public/
│   ├── index.html          # Sleek dark UI matching hosting provider design
│   ├── css/style.css       # Custom styling, glow cards, terminal theme
│   └── js/app.js           # Client-side state, WebSocket streaming & actions
└── data/
    ├── instances/          # Stored bot code, dependencies & logs
    └── db.json             # Server configurations & metadata
```

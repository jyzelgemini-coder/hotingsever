# ⚡ MadeTH Cloud Bot & Server Hosting Platform

A modern, high-performance hosting platform and interactive **Telegram Bot Application** for ordering, deploying, and managing **Telegram Bots**, **Discord Bots**, **Cloud APIs**, and **Game Servers** 24/7 with zero server hassle.

Built with **Node.js / Express**, **React (Vite + Tailwind CSS)**, and an intelligent **Telegram Hosting Bot Engine**.

---

## 📸 Interface Preview

The Web UI faithfully implements the modern dark-themed card interface:
- **Minecraft Hosting**: Java or Bedrock with high-performance paper engine and green accent glow.
- **Game Hosting**: FiveM, Hytale, Ark, GTA SA-MP, and multi-game server management.
- **Cloud Hosting**: APIs, custom Node/Python stacks, and background workers.
- **Dedicated Bot Hosting**: 
  - 🤖 **Telegram Bot Hosting** (Node.js Telegraf/grammY, Python aiogram with 24/7 long-polling & webhooks).
  - 👾 **Discord Bot Hosting** (Discord.js v14, Pycord with continuous Gateway WebSocket connection).

---

## 🌟 Key Features

### 1. 🤖 Interactive Telegram Hosting Bot
- **Full In-Telegram Control**:
  - `/start` or `/menu`: Main navigation with inline keyboard.
  - `/plans`: Browse all hosting categories and plan tiers (Starter Free, Pro $2.99, Enterprise $5.99).
  - `/deploy`: Guided 4-step deployment wizard directly inside Telegram chat.
  - `/servers`: Real-time list of all instances with status badges (🟢 Running, 🔴 Stopped, ⚠️ Crashed), CPU%, and RAM MB.
  - Inline Action Buttons: Start `▶`, Stop `⏹`, Restart `🔄`, View Logs `📜`, Delete `🗑️`.
  - `/logs <id>`: Fetches latest live terminal output formatted in markdown.
  - `/wallet` & `/balance`: Free $10.00 demo testing credits and transaction history.
  - `/sys` & `/stats`: Real-time Host CPU, RAM, and container statistics.
- **In-Browser Telegram Simulator**:
  - Test the bot directly on the Web UI without needing a Telegram account or token setup.
  - Instant response with working inline keyboard buttons and message bubbles!

### 2. ⚡ Modern React Web Dashboard (Vite + Tailwind CSS)
- **Pixel-Perfect Dark Theme**: Beautiful neon glow borders, radial gradients, and responsive card layouts.
- **Live Terminal & WebSocket Stream**:
  - Real-time `stdout` / `stderr` streaming with color-coded log levels (Online, Errors, System).
  - Interactive stdin command bar to execute instructions on running bots.
- **Embedded File Manager & Editor**:
  - Browse instance files (`bot.js`, `package.json`, `.env`, etc.) and edit code live in the browser.
- **Cloud Docker & VPS Export**:
  - Auto-generates production-ready `Dockerfile` and `docker-compose.yml` configs for 1-click export to AWS, Hetzner, or DigitalOcean.
- **Wallet & Billing System**:
  - Track active servers, renewal status, and claim free demo test balance.

---

## 🚀 Quick Start

### 1. Clone & Install Dependencies
```bash
# Install backend dependencies
npm install

# Install React client dependencies
npm install --prefix client
```

### 2. Build the Frontend
```bash
npm run build
```
*(This compiles the React + Tailwind client into the `public/` directory served by Express)*

### 3. Run the Platform
```bash
npm start
# or
node server.js
```

The service is now live at:
- 🌐 **Web Dashboard & Simulator**: [http://localhost:3000](http://localhost:3000)
- ⚡ **REST API**: [http://localhost:3000/api](http://localhost:3000/api)
- 📡 **Terminal WebSocket**: `ws://localhost:3000/ws/terminal/:id`

---

## 🤖 Connecting Your Real Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the instructions to create your bot.
3. Copy your API token (e.g. `7123456789:ABCdefGhIJK...`).
4. Go to the Web Dashboard at [http://localhost:3000](http://localhost:3000), open the **Telegram Bot Controller** tab, paste the token, and click **Connect**.
5. Open your bot on Telegram and send `/start` to begin hosting and managing servers from your phone!

---

## 📂 Project Structure

```
├── server.js               # Express API & WebSocket terminal multiplexer
├── package.json            # Backend scripts and dependencies
├── client/                 # React frontend (Vite + Tailwind CSS + Lucide Icons)
│   ├── src/
│   │   ├── App.jsx         # Full-featured hosting portal & Telegram simulator
│   │   └── index.css       # Tailwind CSS v4 styling
│   └── vite.config.js      # Proxy & build configuration
├── src/
│   ├── telegramManager.js  # Interactive Telegram bot with order wizard & controls
│   ├── orchestrator/
│   │   ├── index.js        # Server lifecycle orchestrator
│   │   ├── processEngine.js# Native child process runner with live metrics
│   │   ├── dockerEngine.js # Docker & compose generation
│   │   └── templates.js    # Starter presets (Telegram, Discord, Cloud, Minecraft)
│   ├── routes/
│   │   └── api.js          # REST API endpoints (templates, servers, logs, wallet)
│   ├── db/
│   │   └── storage.js      # Persistent JSON database (data/db.json)
│   └── utils/
│       └── systemStats.js  # CPU, RAM, and host diagnostics
├── public/                 # Built production assets served by Express
└── data/                   # Instances directory and persistent database
```

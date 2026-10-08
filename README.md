# ⚡ Apsara Hosting - Cloud & Game Server Hosting Platform

A full-featured hosting platform and interactive **Telegram Bot Application** for ordering, deploying, and managing **Minecraft Servers**, **Game Servers**, **Telegram Bots**, **Discord Bots**, and **Cloud Web APIs** 24/7 with zero server hassle.

Built with **Node.js / Express**, **React (Vite + Tailwind CSS)**, and an automated **Telegram Bot Engine**.

---

## 📸 Pages & Features

1. **Page 1: Choose Your Hosting Type**
   - Apsara Hosting branding with Phnom Penh, Cambodia datacenter footer.
   - 3 Primary Cards:
     - 🟩 **Minecraft Hosting** (green glowing border)
     - 🎮 **Game Hosting** (blue border, FiveM, GTA SA-MP, Ark, Hytale)
     - 🌐 **Cloud Hosting** (cyan border, Telegram & Discord bots, Web APIs)
2. **Page 2: Minecraft Server Hosting**
   - Edition selector: **Java Edition** vs **Bedrock Edition**.
   - 10 Plan tiers: **Family Starter ($1.25)** up to **Max Starter ($40.00)** with RAM, CPU, and Disk metrics.
   - Sticky **YOUR ORDER** sidebar with 1-click **Place order**.
3. **Page 3: Game Server Hosting**
   - **Popular Games**: Minecraft Java, Minecraft Bedrock, FiveM.
   - **More Games**: Hytale, GTA: San Andreas Multiplayer, Ark: Survival Evolved, Ark: Survival Ascended.
4. **Page 4: Generic Hosting / Cloud Hosting**
   - 9 Plan tiers: **Starter Plan ($0.50)** up to **Beast Plan ($24.00)**.
   - **Dedicated Code / Runtime Selector**:
     - 🤖 **Telegram Bot**: Python (`aiogram`, `telebot`), Node.js (`telegraf`, `grammY`), Java (`telegrambots`).
     - 👾 **Discord Bot**: Node.js (`discord.js`), Python (`pycord`), Java (`JDA`).
     - 🌐 **Web Framework / API**: Python (`FastAPI`), Node.js (`Express`), Java (`Spring Boot`), Go, Rust, Docker.
5. **Authentication System**:
   - Google Gmail 1-Click Login.
   - Email & Password account registration with **6-digit verification code sent to Gmail**.
   - Automatic redirect to the hosting selection page upon successful login.
6. **Client Management Dashboard**:
   - Live servers list with Start, Stop, Restart, and Delete controls.
   - Real-time **WebSocket Console Terminal** with live streaming logs and stdin command input.
   - Built-in **Telegram Bot Phone Simulator** for browser testing.

---

## ☁️ Deploying to Vercel

The repository is pre-configured for Vercel deployment:

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Configure Vercel deployment and Apsara Hosting platform"
   git push
   ```
2. **Import into Vercel**:
   - Go to [https://vercel.com/new](https://vercel.com/new)
   - Select your repository.
   - Vercel automatically runs:
     - **Install Command**: `npm install && npm install --prefix client`
     - **Build Command**: `npm install --prefix client && npm run build --prefix client`
     - **Output Directory**: `public`
   - Click **Deploy**!

---

## 🚀 Running Locally

```bash
# 1. Install all dependencies
npm install

# 2. Build the React client
npm run build

# 3. Start the server
npm start
```

Access the platform at:
- 🌐 **Web Portal**: [http://localhost:3000](http://localhost:3000)
- ⚡ **REST API**: [http://localhost:3000/api](http://localhost:3000/api)

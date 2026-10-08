const https = require('https');
const storage = require('./db/storage');
const orchestrator = require('./orchestrator');
const { getSystemInfo } = require('./utils/systemStats');

class TelegramManager {
  constructor() {
    this.token = null;
    this.offset = 0;
    this.polling = false;
    this.pollTimer = null;
    this.sessions = new Map(); // chatId -> session state
  }

  init() {
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      console.log('[TELEGRAM MANAGER] Serverless environment: long polling standby, webhook mode ready.');
      return;
    }
    const settings = storage.getSettings();
    const token = process.env.TELEGRAM_ADMIN_BOT_TOKEN || settings.telegramBotToken;
    if (token && token.trim()) {
      this.start(token.trim());
    } else {
      console.log('[TELEGRAM MANAGER] Standby mode. Enter token in Web Dashboard to connect live Telegram bot.');
    }
  }

  start(token) {
    if (this.polling) this.stop();
    this.token = token.trim();
    this.polling = true;
    console.log('[TELEGRAM MANAGER] Connecting Telegram Bot...');
    this.poll();
  }

  stop() {
    this.polling = false;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    console.log('[TELEGRAM MANAGER] Stopped polling.');
  }

  apiCall(method, body = {}) {
    if (!this.token) return Promise.reject(new Error('No Telegram bot token configured'));
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const url = new URL(`https://api.telegram.org/bot${this.token}/${method}`);
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  async poll() {
    if (!this.polling) return;

    try {
      const res = await this.apiCall('getUpdates', {
        offset: this.offset,
        timeout: 25
      });

      if (res.ok && res.result) {
        for (const update of res.result) {
          this.offset = update.update_id + 1;
          await this.handleUpdate(update);
        }
      }
    } catch (err) {
      await new Promise(r => setTimeout(r, 4000));
    }

    if (this.polling) {
      this.pollTimer = setTimeout(() => this.poll(), 500);
    }
  }

  async sendMessage(chatId, text, extra = {}) {
    return this.apiCall('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      ...extra
    });
  }

  // Handle updates from real Telegram bot webhook or long polling
  async handleUpdate(update) {
    if (update.message && update.message.text) {
      const msg = update.message;
      const text = msg.text.trim();
      const chatId = msg.chat.id;
      const userName = msg.from?.first_name || 'Host Explorer';

      const response = await this.processInput({
        chatId,
        text,
        userName
      });

      if (response && response.text) {
        await this.sendMessage(chatId, response.text, {
          reply_markup: response.reply_markup
        });
      }
    } else if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const data = cb.data;
      const userName = cb.from?.first_name || 'Host Explorer';

      const response = await this.processCallback({
        chatId,
        data,
        userName
      });

      if (response) {
        await this.sendMessage(chatId, response.text, {
          reply_markup: response.reply_markup
        });
      }

      await this.apiCall('answerCallbackQuery', {
        callback_query_id: cb.id,
        text: response?.alertText || 'Done'
      }).catch(() => {});
    }
  }

  // Unified logic processor (Used by both live Telegram bot and Web Simulator)
  async processInput({ chatId, text, userName = 'Host Explorer' }) {
    const session = this.sessions.get(chatId) || {};
    const [cmd, ...args] = text.split(' ');

    // Handle interactive session states (Deploy wizard)
    if (session.state === 'awaiting_server_name') {
      const name = text === '/skip' || text.toLowerCase() === 'skip' ? `${session.template.name} #1` : text;
      session.serverName = name;
      session.state = 'awaiting_token';
      this.sessions.set(chatId, session);

      return {
        text: `🏷️ *Instance Name:* \`${name}\`\n\n` +
              `🔑 *Step 3/3: Bot Token / Secret*\n` +
              `Please enter your Bot Token (e.g. from @BotFather or Discord Developer Portal).\n\n` +
              `_Type \`demo\` or \`skip\` to launch immediately in demo/sandbox mode._`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏩ Skip / Use Demo Token', callback_data: 'deploy_with_demo' }],
            [{ text: '❌ Cancel Deployment', callback_data: 'main_menu' }]
          ]
        }
      };
    }

    if (session.state === 'awaiting_token') {
      const token = (text.toLowerCase() === 'demo' || text.toLowerCase() === 'skip' || text === '/skip') ? 'demo' : text;
      return this.finalizeDeployment(chatId, session, token);
    }

    // Standard commands
    if (cmd === '/start' || cmd === '/menu') {
      this.sessions.delete(chatId);
      return this.getMainMenu(userName);
    }

    if (cmd === '/plans' || cmd === '/hosting') {
      return this.getHostingPlans();
    }

    if (cmd === '/deploy' || cmd === '/order') {
      return this.getDeployWizard();
    }

    if (cmd === '/servers' || cmd === '/list') {
      return this.getServerList();
    }

    if (cmd === '/sys' || cmd === '/stats') {
      return this.getSystemStats();
    }

    if (cmd === '/wallet' || cmd === '/balance') {
      return this.getWalletInfo();
    }

    if (cmd === '/help') {
      return this.getHelpMenu();
    }

    if (cmd === '/start_srv') {
      const id = args[0];
      if (!id) return { text: '⚠️ Usage: `/start_srv <server_id>`' };
      try {
        await orchestrator.startServer(id);
        return { text: `✅ Server \`${id.slice(0, 8)}\` has started!`, reply_markup: this.getBackServersMarkup(id) };
      } catch (e) {
        return { text: `❌ Failed to start: ${e.message}`, reply_markup: this.getBackServersMarkup() };
      }
    }

    if (cmd === '/stop_srv') {
      const id = args[0];
      if (!id) return { text: '⚠️ Usage: `/stop_srv <server_id>`' };
      try {
        await orchestrator.stopServer(id);
        return { text: `⏹ Server \`${id.slice(0, 8)}\` has stopped!`, reply_markup: this.getBackServersMarkup(id) };
      } catch (e) {
        return { text: `❌ Failed to stop: ${e.message}`, reply_markup: this.getBackServersMarkup() };
      }
    }

    if (cmd === '/restart_srv') {
      const id = args[0];
      if (!id) return { text: '⚠️ Usage: `/restart_srv <server_id>`' };
      try {
        await orchestrator.restartServer(id);
        return { text: `🔄 Server \`${id.slice(0, 8)}\` has restarted!`, reply_markup: this.getBackServersMarkup(id) };
      } catch (e) {
        return { text: `❌ Failed to restart: ${e.message}`, reply_markup: this.getBackServersMarkup() };
      }
    }

    if (cmd === '/logs') {
      const id = args[0];
      if (!id) return { text: '⚠️ Usage: `/logs <server_id>`' };
      return this.getServerLogs(id);
    }

    // Default response
    return {
      text: `👋 I received: *${text}*\n\nType /menu or /start to see available cloud hosting options.`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '⚡ Open Main Menu', callback_data: 'main_menu' }]
        ]
      }
    };
  }

  // Callback query dispatcher
  async processCallback({ chatId, data, userName = 'Host Explorer' }) {
    if (data === 'main_menu') {
      this.sessions.delete(chatId);
      return this.getMainMenu(userName);
    }

    if (data === 'browse_plans') {
      return this.getHostingPlans();
    }

    if (data === 'wizard_start') {
      return this.getDeployWizard();
    }

    if (data === 'list_servers') {
      return this.getServerList();
    }

    if (data === 'sys_status') {
      return this.getSystemStats();
    }

    if (data === 'wallet_view') {
      return this.getWalletInfo();
    }

    if (data === 'add_funds_demo') {
      storage.updateWallet(5.00, 'Demo credit top-up');
      const res = await this.getWalletInfo();
      res.alertText = 'Added $5.00 demo credits!';
      return res;
    }

    if (data === 'help_view') {
      return this.getHelpMenu();
    }

    // Quick deploy triggers
    if (data.startsWith('wizard_select_')) {
      const templateId = data.replace('wizard_select_', '');
      const template = orchestrator.getTemplateById(templateId);
      if (!template) return { text: '❌ Invalid template selected.' };

      this.sessions.set(chatId, {
        state: 'awaiting_plan',
        templateId,
        template
      });

      return {
        text: `📦 *Selected Template:* ${template.name}\n` +
              `⚡ *Runtime:* \`${template.runtime}\`\n\n` +
              `Choose your resource plan:`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🟢 Starter (512MB RAM • 0.5 vCPU) - Free', callback_data: 'plan_512' }],
            [{ text: '⚡ Pro (2048MB RAM • 1.0 vCPU) - $2.99/mo', callback_data: 'plan_2048' }],
            [{ text: '🔥 Enterprise (4096MB RAM • 2.0 vCPU) - $5.99/mo', callback_data: 'plan_4096' }],
            [{ text: '« Back', callback_data: 'wizard_start' }]
          ]
        }
      };
    }

    if (data.startsWith('plan_')) {
      const memMb = data.replace('plan_', '');
      const session = this.sessions.get(chatId) || {};
      session.plan = {
        name: memMb === '512' ? 'Starter' : (memMb === '2048' ? 'Pro' : 'Enterprise'),
        memory: `${memMb}MB`,
        cpu: memMb === '512' ? '0.5 vCPU' : (memMb === '2048' ? '1.0 vCPU' : '2.0 vCPU')
      };
      session.state = 'awaiting_server_name';
      this.sessions.set(chatId, session);

      return {
        text: `📋 *Resource Plan:* ${session.plan.name} (${session.plan.memory})\n\n` +
              `🏷️ *Step 2/3: Name your instance*\n` +
              `Please send a name for your bot (e.g. \`My Telegram Bot #1\`), or reply \`skip\` to use default.`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎲 Use Default Name', callback_data: 'use_default_name' }],
            [{ text: '❌ Cancel', callback_data: 'main_menu' }]
          ]
        }
      };
    }

    if (data === 'use_default_name') {
      const session = this.sessions.get(chatId) || {};
      session.serverName = `${session.template?.name || 'Hosted Instance'} #1`;
      session.state = 'awaiting_token';
      this.sessions.set(chatId, session);

      return {
        text: `🏷️ *Instance Name:* \`${session.serverName}\`\n\n` +
              `🔑 *Step 3/3: Bot Token / Secret*\n` +
              `Please send your Bot Token from @BotFather or Discord Developer Portal.\n\n` +
              `_Or click the button below to launch immediately in demo/sandbox mode!_`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏩ Launch in Demo Sandbox Mode', callback_data: 'deploy_with_demo' }],
            [{ text: '❌ Cancel', callback_data: 'main_menu' }]
          ]
        }
      };
    }

    if (data === 'deploy_with_demo') {
      const session = this.sessions.get(chatId) || {};
      return this.finalizeDeployment(chatId, session, 'demo');
    }

    // Server actions
    if (data.startsWith('action_start_')) {
      const id = data.replace('action_start_', '');
      try {
        await orchestrator.startServer(id);
        const res = await this.getServerCard(id);
        res.alertText = 'Server started!';
        return res;
      } catch (e) {
        return { text: `❌ Failed to start: ${e.message}`, reply_markup: this.getBackServersMarkup(id) };
      }
    }

    if (data.startsWith('action_stop_')) {
      const id = data.replace('action_stop_', '');
      try {
        await orchestrator.stopServer(id);
        const res = await this.getServerCard(id);
        res.alertText = 'Server stopped!';
        return res;
      } catch (e) {
        return { text: `❌ Failed to stop: ${e.message}`, reply_markup: this.getBackServersMarkup(id) };
      }
    }

    if (data.startsWith('action_restart_')) {
      const id = data.replace('action_restart_', '');
      try {
        await orchestrator.restartServer(id);
        const res = await this.getServerCard(id);
        res.alertText = 'Server restarted!';
        return res;
      } catch (e) {
        return { text: `❌ Failed to restart: ${e.message}`, reply_markup: this.getBackServersMarkup(id) };
      }
    }

    if (data.startsWith('action_view_')) {
      const id = data.replace('action_view_', '');
      return this.getServerCard(id);
    }

    if (data.startsWith('action_logs_')) {
      const id = data.replace('action_logs_', '');
      return this.getServerLogs(id);
    }

    if (data.startsWith('action_delete_')) {
      const id = data.replace('action_delete_', '');
      try {
        await orchestrator.deleteServer(id);
        const res = await this.getServerList();
        res.alertText = 'Server deleted!';
        return res;
      } catch (e) {
        return { text: `❌ Failed to delete: ${e.message}`, reply_markup: this.getBackServersMarkup() };
      }
    }

    return this.getMainMenu(userName);
  }

  // --- Views and UI Components ---

  getMainMenu(userName) {
    const servers = orchestrator.getServerList();
    const activeCount = servers.filter(s => s.status === 'running').length;
    const wallet = storage.getWallet();

    const text = `🚀 *MadeTH Cloud & Bot Hosting Panel*\n\n` +
      `👋 Welcome, *${userName}*!\n` +
      `Deploy, host, and control Telegram bots, Discord bots, Cloud APIs, and Game servers 24/7 with zero server management.\n\n` +
      `📊 *Dashboard Overview:*\n` +
      `• Active Servers: *${activeCount}* / ${servers.length}\n` +
      `• Wallet Balance: *$${wallet.balance.toFixed(2)} USD*\n` +
      `• Host Engine: \`Online & Healthy 🟢\`\n\n` +
      `What would you like to do?`;

    return {
      text,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📦 Browse Plans', callback_data: 'browse_plans' },
            { text: '⚡ 1-Click Deploy', callback_data: 'wizard_start' }
          ],
          [
            { text: '📋 My Servers (' + servers.length + ')', callback_data: 'list_servers' },
            { text: '⚡ Node Health', callback_data: 'sys_status' }
          ],
          [
            { text: '💰 Wallet & Credits', callback_data: 'wallet_view' },
            { text: '❓ Help & Docs', callback_data: 'help_view' }
          ]
        ]
      }
    };
  }

  getHostingPlans() {
    const text = `📦 *Choose Your Hosting Type:*\n\n` +
      `1️⃣ 🤖 *Telegram Bot Hosting*\n` +
      `• Runtimes: Node.js (Telegraf/grammY) or Python (aiogram)\n` +
      `• 24/7 Long-polling & Webhook endpoints, auto-restart on crash\n` +
      `• *Starter:* Free / 512MB RAM | *Pro:* $2.99 / 2GB RAM\n\n` +
      `2️⃣ 👾 *Discord Bot Hosting*\n` +
      `• Runtimes: Discord.js v14 or Python (Pycord/nextcord)\n` +
      `• Always-on Gateway WebSocket, Slash command support\n` +
      `• *Starter:* Free / 512MB RAM | *Pro:* $2.99 / 2GB RAM\n\n` +
      `3️⃣ 🌐 *Cloud Hosting (Apps & APIs)*\n` +
      `• Runtimes: Node.js Express, Python FastAPI, Docker\n` +
      `• Dedicated port, Healthcheck probe, custom backend stack\n` +
      `• *Starter:* Free / 512MB RAM | *Pro:* $2.99 / 2GB RAM\n\n` +
      `4️⃣ ⛏️ *Minecraft & Game Hosting*\n` +
      `• PaperMC Java & Bedrock, FiveM, GTA SA-MP\n` +
      `• DDoS protection, high tick-rate performance\n` +
      `• *Standard:* $3.99 / 2GB RAM | *Extreme:* $6.99 / 4GB RAM`;

    return {
      text,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🤖 Deploy Telegram Bot (Node.js)', callback_data: 'wizard_select_telegram-bot-node' }],
          [{ text: '🐍 Deploy Telegram Bot (Python)', callback_data: 'wizard_select_telegram-bot-python' }],
          [{ text: '👾 Deploy Discord Bot (Node.js)', callback_data: 'wizard_select_discord-bot-node' }],
          [{ text: '🌐 Deploy Cloud Web API', callback_data: 'wizard_select_cloud-web-node' }],
          [{ text: '⛏️ Deploy Minecraft Server', callback_data: 'wizard_select_game-minecraft-paper' }],
          [{ text: '« Back to Menu', callback_data: 'main_menu' }]
        ]
      }
    };
  }

  getDeployWizard() {
    const text = `⚡ *Server Deployment Wizard*\n\n` +
      `Select a template stack to launch your server:`;

    const templates = orchestrator.getTemplates();
    const keyboard = templates.map(t => ([{
      text: `${t.category === 'game' ? '🎮' : (t.type === 'telegram' ? '🤖' : (t.type === 'discord' ? '👾' : '🌐'))} ${t.name}`,
      callback_data: `wizard_select_${t.id}`
    }]));

    keyboard.push([{ text: '« Back to Menu', callback_data: 'main_menu' }]);

    return {
      text,
      reply_markup: { inline_keyboard: keyboard }
    };
  }

  async finalizeDeployment(chatId, session, tokenValue) {
    const template = session.template || orchestrator.getTemplateById(session.templateId) || orchestrator.getTemplates()[0];
    const name = session.serverName || `${template.name} #1`;
    const plan = session.plan || { name: 'Starter', memory: '512MB', cpu: '0.5 vCPU' };

    const envVars = {};
    if (template.envVars) {
      for (const k of Object.keys(template.envVars)) {
        if (k.includes('TOKEN')) {
          envVars[k] = tokenValue || 'demo';
        } else {
          envVars[k] = template.envVars[k];
        }
      }
    }

    try {
      const server = await orchestrator.createServer({
        name,
        templateId: template.id,
        category: template.category,
        runtime: template.runtime,
        plan,
        envVars
      });

      // Auto start the server
      const startRes = await orchestrator.startServer(server.id);
      this.sessions.delete(chatId);

      const statusIcon = startRes.success ? '🟢' : '⚠️';
      const text = `🎉 *Server Successfully Provisioned & Launched!*\n\n` +
        `• Name: *${server.name}*\n` +
        `• ID: \`${server.id}\`\n` +
        `• Stack: \`${template.name}\` (${template.runtime})\n` +
        `• Status: ${statusIcon} *${startRes.success ? 'RUNNING' : 'STARTING'}*\n` +
        `• Memory: \`${plan.memory}\` | CPU: \`${plan.cpu}\`\n` +
        `• Mode: ${tokenValue === 'demo' ? '🧪 Sandbox Demo Mode' : '🚀 Live Mode'}\n\n` +
        `Use the buttons below to control your live server instance:`;

      return {
        text,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⏹ Stop', callback_data: `action_stop_${server.id}` },
              { text: '🔄 Restart', callback_data: `action_restart_${server.id}` }
            ],
            [
              { text: '📜 Live Logs', callback_data: `action_logs_${server.id}` },
              { text: '📋 All Servers', callback_data: 'list_servers' }
            ],
            [{ text: '« Main Menu', callback_data: 'main_menu' }]
          ]
        }
      };
    } catch (err) {
      this.sessions.delete(chatId);
      return {
        text: `❌ *Deployment Failed:*\n${err.message}`,
        reply_markup: {
          inline_keyboard: [[{ text: 'Try Again', callback_data: 'wizard_start' }]]
        }
      };
    }
  }

  getServerList() {
    const servers = orchestrator.getServerList();
    if (servers.length === 0) {
      return {
        text: `📋 *My Hosted Servers:*\n\n` +
              `ℹ️ You haven't deployed any servers yet!\n` +
              `Click the button below to deploy your first Telegram bot or Discord bot in 30 seconds.`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '⚡ Deploy New Bot / Server', callback_data: 'wizard_start' }],
            [{ text: '« Back to Menu', callback_data: 'main_menu' }]
          ]
        }
      };
    }

    let text = `📋 *My Hosted Servers (${servers.length}):*\n\n`;
    const keyboard = [];

    for (const s of servers) {
      const isRunning = s.status === 'running';
      const isCrashed = s.status === 'crashed';
      const icon = isRunning ? '🟢' : (isCrashed ? '⚠️' : '🔴');

      text += `${icon} *${s.name}*\n`;
      text += `• ID: \`${s.id.slice(0, 8)}\` | ${s.runtime}\n`;
      text += `• Status: *${s.status.toUpperCase()}*`;
      if (isRunning) {
        text += ` (CPU: ${s.stats?.cpu || 0}% | RAM: ${s.stats?.memory || 0}MB)`;
      }
      text += `\n\n`;

      keyboard.push([
        { text: `⚙️ Manage ${s.name.slice(0, 15)}`, callback_data: `action_view_${s.id}` }
      ]);
    }

    keyboard.push([
      { text: '➕ Deploy New Server', callback_data: 'wizard_start' },
      { text: '« Main Menu', callback_data: 'main_menu' }
    ]);

    return {
      text,
      reply_markup: { inline_keyboard: keyboard }
    };
  }

  getServerCard(id) {
    const server = orchestrator.getServerDetails(id);
    if (!server) {
      return {
        text: '❌ Server not found or was deleted.',
        reply_markup: this.getBackServersMarkup()
      };
    }

    const isRunning = server.status === 'running';
    const isCrashed = server.status === 'crashed';
    const statusIcon = isRunning ? '🟢' : (isCrashed ? '⚠️' : '🔴');

    const text = `${statusIcon} *Server Instance: ${server.name}*\n\n` +
      `• Server ID: \`${server.id}\`\n` +
      `• Status: *${server.status.toUpperCase()}*\n` +
      `• Runtime: \`${server.runtime}\` | Category: \`${server.category}\`\n` +
      `• CPU Usage: \`${server.stats?.cpu || 0}%\`\n` +
      `• RAM Usage: \`${server.stats?.memory || 0} MB\`\n` +
      `• Uptime: \`${server.stats?.uptime || 0}s\`\n` +
      `• Plan: \`${server.plan?.name || 'Starter'} (${server.plan?.memory || '512MB'})\`\n\n` +
      `*Control Actions:*`;

    const rowControls = isRunning
      ? [
          { text: '⏹ Stop', callback_data: `action_stop_${id}` },
          { text: '🔄 Restart', callback_data: `action_restart_${id}` }
        ]
      : [
          { text: '▶ Start', callback_data: `action_start_${id}` },
          { text: '🔄 Restart', callback_data: `action_restart_${id}` }
        ];

    return {
      text,
      reply_markup: {
        inline_keyboard: [
          rowControls,
          [
            { text: '📜 View Live Logs', callback_data: `action_logs_${id}` },
            { text: '🗑️ Delete Server', callback_data: `action_delete_${id}` }
          ],
          [
            { text: '« Back to Servers', callback_data: 'list_servers' }
          ]
        ]
      }
    };
  }

  getServerLogs(id) {
    const logs = orchestrator.processEngine.getRecentLogs(id, 15);
    const server = orchestrator.getServerDetails(id);
    const name = server ? server.name : id.slice(0, 8);

    let logText = logs.map(l => l.text).join('\n');
    if (!logText.trim()) {
      logText = '[SYSTEM] Process started. No output lines yet.';
    }

    const trimmed = logText.length > 3000 ? '...' + logText.slice(-3000) : logText;

    const text = `📜 *Console Logs for [${name}]:*\n\n\`\`\`\n${trimmed}\n\`\`\``;

    return {
      text,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Refresh Logs', callback_data: `action_logs_${id}` }],
          [{ text: `⚙️ Manage ${name.slice(0, 15)}`, callback_data: `action_view_${id}` }],
          [{ text: '« Back to Servers', callback_data: 'list_servers' }]
        ]
      }
    };
  }

  async getSystemStats() {
    const sys = await getSystemInfo();
    const servers = orchestrator.getServerList();
    const active = servers.filter(s => s.status === 'running').length;

    const text = `⚡ *Cloud Hosting Node Health:*\n\n` +
      `• Operating System: \`${sys.os.platform} (${sys.os.release})\`\n` +
      `• CPU: \`${sys.cpu.model}\` (${sys.cpu.cores} Cores)\n` +
      `• RAM Used: \`${sys.memory.used} MB\` / \`${sys.memory.total} MB\` (${sys.memory.percent}%)\n` +
      `• Node Engine: \`${sys.docker?.available ? 'Docker Container' : 'Isolated Sandbox'}\`\n` +
      `• Host Uptime: \`${Math.floor(sys.os.uptime / 3600)}h ${Math.floor((sys.os.uptime % 3600) / 60)}m\`\n` +
      `• Active Containers: *${active}* running / *${servers.length}* total\n`;

    return {
      text,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Refresh Stats', callback_data: 'sys_status' }],
          [{ text: '« Back to Menu', callback_data: 'main_menu' }]
        ]
      }
    };
  }

  getWalletInfo() {
    const wallet = storage.getWallet();
    const servers = orchestrator.getServerList();

    const text = `💰 *Hosting Wallet & Balance:*\n\n` +
      `• Current Balance: *$${wallet.balance.toFixed(2)} USD*\n` +
      `• Active Instances: *${servers.length}*\n` +
      `• Current Monthly Cost: *$0.00 / month* (Free Tier Active)\n` +
      `• Renewal Status: \`Active & Verified 🟢\`\n\n` +
      `Need more testing credits for Pro or Extreme plans? Click below to claim $5.00 demo balance.`;

    return {
      text,
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ Add $5.00 Free Demo Credits', callback_data: 'add_funds_demo' }],
          [{ text: '⚡ Deploy New Bot', callback_data: 'wizard_start' }],
          [{ text: '« Back to Menu', callback_data: 'main_menu' }]
        ]
      }
    };
  }

  getHelpMenu() {
    const text = `❓ *MadeTH Cloud Hosting Bot Help*\n\n` +
      `*Commands List:*\n` +
      `• /start or /menu - Main navigation menu\n` +
      `• /plans - Browse available bot & server plans\n` +
      `• /deploy - Launch a new bot or server\n` +
      `• /servers - View all your instances and control them\n` +
      `• /sys - View host node CPU & RAM performance\n` +
      `• /wallet - Check account balance & credits\n` +
      `• /start\\_srv <id> - Start an instance\n` +
      `• /stop\\_srv <id> - Stop an instance\n` +
      `• /restart\\_srv <id> - Restart an instance\n` +
      `• /logs <id> - Fetch latest 15 console lines\n\n` +
      `💡 *Tip:* You can also open the full Web Dashboard from your browser or connect your Telegram BotFather token!`;

    return {
      text,
      reply_markup: {
        inline_keyboard: [
          [{ text: '⚡ Open Main Menu', callback_data: 'main_menu' }]
        ]
      }
    };
  }

  getBackServersMarkup(id) {
    const buttons = [];
    if (id) {
      buttons.push([{ text: '⚙️ Server Details', callback_data: `action_view_${id}` }]);
    }
    buttons.push([{ text: '📋 Back to All Servers', callback_data: 'list_servers' }]);
    return { inline_keyboard: buttons };
  }
}

const telegramManager = new TelegramManager();
module.exports = telegramManager;

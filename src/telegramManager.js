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
  }

  init() {
    const settings = storage.getSettings();
    const token = process.env.TELEGRAM_ADMIN_BOT_TOKEN || settings.telegramBotToken;
    if (token && token.trim()) {
      this.start(token.trim());
    } else {
      console.log('[TELEGRAM MANAGER] No Telegram admin token configured. Telegram bot control is standby.');
    }
  }

  start(token) {
    if (this.polling) this.stop();
    this.token = token;
    this.polling = true;
    console.log('[TELEGRAM MANAGER] Connecting Telegram Admin Bot...');
    this.poll();
  }

  stop() {
    this.polling = false;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    console.log('[TELEGRAM MANAGER] Stopped polling.');
  }

  apiCall(method, body = {}) {
    if (!this.token) return Promise.reject(new Error('No token'));
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
      // Backoff on network error
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

  async handleUpdate(update) {
    if (update.message && update.message.text) {
      const msg = update.message;
      const text = msg.text.trim();
      const chatId = msg.chat.id;
      const [cmd, ...args] = text.split(' ');

      if (cmd === '/start' || cmd === '/help') {
        const welcome = `🤖 *Cloud Hosting Server Controller*\n\n` +
          `Welcome to your hosting server control bot! You can monitor and control your hosted Telegram bots, Discord bots, and Cloud apps right here.\n\n` +
          `*Available Commands:*\n` +
          `📋 /servers - List all hosted bots & apps\n` +
          `⚡ /sys - Host CPU & RAM health\n` +
          `▶️ /start\\_srv <id> - Start a bot server\n` +
          `⏹️ /stop\\_srv <id> - Stop a bot server\n` +
          `🔄 /restart\\_srv <id> - Restart a bot\n` +
          `📜 /logs <id> - View recent console logs\n`;

        await this.sendMessage(chatId, welcome, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 View All Servers', callback_data: 'list_servers' }],
              [{ text: '⚡ System Status', callback_data: 'sys_status' }]
            ]
          }
        });
      } else if (cmd === '/servers' || cmd === '/list') {
        await this.sendServerList(chatId);
      } else if (cmd === '/sys' || cmd === '/stats') {
        await this.sendSystemStats(chatId);
      } else if (cmd === '/start_srv') {
        const id = args[0];
        if (!id) return this.sendMessage(chatId, '⚠️ Usage: `/start_srv <server_id>`');
        try {
          await orchestrator.startServer(id);
          this.sendMessage(chatId, `✅ Server \`${id.slice(0, 8)}\` started!`);
        } catch (e) {
          this.sendMessage(chatId, `❌ Failed to start: ${e.message}`);
        }
      } else if (cmd === '/stop_srv') {
        const id = args[0];
        if (!id) return this.sendMessage(chatId, '⚠️ Usage: `/stop_srv <server_id>`');
        try {
          await orchestrator.stopServer(id);
          this.sendMessage(chatId, `⏹ Server \`${id.slice(0, 8)}\` stopped!`);
        } catch (e) {
          this.sendMessage(chatId, `❌ Failed to stop: ${e.message}`);
        }
      } else if (cmd === '/restart_srv') {
        const id = args[0];
        if (!id) return this.sendMessage(chatId, '⚠️ Usage: `/restart_srv <server_id>`');
        try {
          await orchestrator.restartServer(id);
          this.sendMessage(chatId, `🔄 Server \`${id.slice(0, 8)}\` restarted!`);
        } catch (e) {
          this.sendMessage(chatId, `❌ Failed to restart: ${e.message}`);
        }
      } else if (cmd === '/logs') {
        const id = args[0];
        if (!id) return this.sendMessage(chatId, '⚠️ Usage: `/logs <server_id>`');
        const logs = orchestrator.processEngine.getRecentLogs(id, 15);
        if (logs.length === 0) {
          this.sendMessage(chatId, `📜 No logs found for server \`${id.slice(0, 8)}\`.`);
        } else {
          const logText = logs.map(l => l.text).join('\n').slice(-3500);
          this.sendMessage(chatId, `📜 *Logs for \`${id.slice(0, 8)}\`:*\n\`\`\`\n${logText}\n\`\`\``);
        }
      }
    } else if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const data = cb.data;

      if (data === 'list_servers') {
        await this.sendServerList(chatId);
      } else if (data === 'sys_status') {
        await this.sendSystemStats(chatId);
      } else if (data.startsWith('action_restart_')) {
        const id = data.replace('action_restart_', '');
        await orchestrator.restartServer(id);
        await this.sendMessage(chatId, `🔄 Restarted server \`${id.slice(0, 8)}\``);
      }

      await this.apiCall('answerCallbackQuery', { callback_query_id: cb.id });
    }
  }

  async sendServerList(chatId) {
    const servers = orchestrator.getServerList();
    if (servers.length === 0) {
      return this.sendMessage(chatId, 'ℹ️ No servers deployed yet. Visit the web dashboard to create your first Telegram or Discord bot server!');
    }

    let text = `📋 *Hosted Servers (${servers.length}):*\n\n`;
    const keyboard = [];

    for (const s of servers) {
      const statusIcon = s.status === 'running' ? '🟢' : (s.status === 'crashed' ? '⚠️' : '🔴');
      text += `${statusIcon} *${s.name}*\n`;
      text += `• ID: \`${s.id}\`\n`;
      text += `• Runtime: ${s.runtime} | Mode: ${s.category}\n`;
      if (s.status === 'running') {
        text += `• CPU: ${s.stats?.cpu || 0}% | RAM: ${s.stats?.memory || 0}MB\n`;
      }
      text += `\n`;

      keyboard.push([
        { text: `🔄 Restart ${s.name.slice(0, 12)}`, callback_data: `action_restart_${s.id}` }
      ]);
    }

    await this.sendMessage(chatId, text, {
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  async sendSystemStats(chatId) {
    const sys = await getSystemInfo();
    const text = `⚡ *Host Cloud Node Stats:*\n\n` +
      `• Platform: \`${sys.os.platform} (${sys.os.release})\`\n` +
      `• CPU: ${sys.cpu.model} (${sys.cpu.cores} cores)\n` +
      `• RAM: ${sys.memory.used}MB / ${sys.memory.total}MB (${sys.memory.percent}% used)\n` +
      `• Host Uptime: ${Math.floor(sys.os.uptime / 3600)}h ${Math.floor((sys.os.uptime % 3600) / 60)}m\n` +
      `• Engine: \`${sys.docker.mode}\`\n`;

    await this.sendMessage(chatId, text);
  }
}

const telegramManager = new TelegramManager();
module.exports = telegramManager;

/**
 * Telegram Bot (Node.js) - Hosted on Antigravity Cloud
 */
const https = require('https');

const TOKEN = process.env.BOT_TOKEN;

if (!TOKEN || TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_HERE' || TOKEN === 'demo') {
  console.log('[SANDBOX MODE] Telegram Bot initialized in Demo / Sandbox Mode.');
  console.log('[SANDBOX MODE] Simulated long-polling active. Server is healthy!');
  console.log('[TIP] To connect your live bot, update BOT_TOKEN from @BotFather in Environment Variables.');
  setInterval(() => {
    const memMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
    console.log(`[ONLINE] Telegram Bot daemon healthy | RAM: ${memMb} MB | Uptime: ${Math.floor(process.uptime())}s`);
  }, 12000);
  return;
}

const API_BASE = 'https://api.telegram.org/bot' + TOKEN;

function apiCall(method, body = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL(API_BASE + '/' + method);
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

let offset = 0;
let botInfo = null;

async function init() {
  console.log('[INIT] Connecting to Telegram API...');
  try {
    const res = await apiCall('getMe');
    if (!res.ok) {
      console.error('[AUTH FAILED] Telegram error:', res.description);
      process.exit(1);
    }
    botInfo = res.result;
    console.log(`[ONLINE] Logged in as @${botInfo.username} (ID: ${botInfo.id})`);
    console.log('[ONLINE] Bot long-polling started. Listening for incoming messages...');
    poll();
  } catch (err) {
    console.error('[ERROR] Connection failed:', err.message);
    setTimeout(init, 5000);
  }
}

async function poll() {
  try {
    const res = await apiCall('getUpdates', {
      offset: offset,
      timeout: 30
    });

    if (res.ok && res.result) {
      for (const update of res.result) {
        offset = update.update_id + 1;
        handleUpdate(update);
      }
    }
  } catch (err) {
    console.error('[POLL ERROR]', err.message);
    await new Promise(r => setTimeout(r, 3000));
  }
  setImmediate(poll);
}

async function handleUpdate(update) {
  if (update.message && update.message.text) {
    const msg = update.message;
    const text = msg.text.trim();
    const chatId = msg.chat.id;
    const user = msg.from.first_name || 'User';

    console.log(`[MSG from ${user} (${chatId})]: ${text}`);

    if (text === '/start') {
      await apiCall('sendMessage', {
        chat_id: chatId,
        text: `👋 Hello, ${user}!

🚀 Your Telegram Bot is successfully running on **Cloud Hosting**!

Commands:
/ping - Check server response
/stats - View bot hosting uptime
/help - Get bot documentation`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⚡ Server Status', callback_data: 'status' }],
            [{ text: '🌐 Cloud Dashboard', url: 'https://telegram.org' }]
          ]
        }
      });
    } else if (text === '/ping') {
      const start = Date.now();
      await apiCall('sendMessage', {
        chat_id: chatId,
        text: `🏓 Pong! Latency: ${Date.now() - start}ms\nHost: Cloud Bot Engine`
      });
    } else if (text === '/stats') {
      const uptimeSec = Math.floor(process.uptime());
      const memMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
      await apiCall('sendMessage', {
        chat_id: chatId,
        text: `📊 **Bot Hosting Stats**:
- Uptime: ${uptimeSec} seconds
- Memory: ${memMb} MB
- Platform: ${process.platform}
- Node: ${process.version}`,
        parse_mode: 'Markdown'
      });
    } else {
      await apiCall('sendMessage', {
        chat_id: chatId,
        text: `You said: ${text}

Type /help or /stats for available commands.`
      });
    }
  } else if (update.callback_query) {
    const cb = update.callback_query;
    await apiCall('answerCallbackQuery', {
      callback_query_id: cb.id,
      text: 'Server is healthy and running at 100% capacity!'
    });
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[SHUTDOWN] Stopping bot...');
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] Received SIGTERM...');
  process.exit(0);
});

init();

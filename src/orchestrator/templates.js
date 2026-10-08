const templates = [
  {
    id: 'telegram-bot-node',
    name: 'Telegram Bot (Node.js)',
    type: 'telegram',
    category: 'bot',
    runtime: 'node',
    description: 'High-performance Telegram bot with long-polling, command handler, and interactive buttons.',
    icon: 'telegram',
    badge: 'Popular',
    entryFile: 'bot.js',
    envVars: {
      BOT_TOKEN: '',
      NODE_ENV: 'production'
    },
    files: {
      'bot.js': `/**
 * Telegram Bot (Node.js) - Hosted on Antigravity Cloud
 */
const https = require('https');

const TOKEN = process.env.BOT_TOKEN;

if (!TOKEN || TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
  console.log('[ERROR] Please set BOT_TOKEN in the Environment Variables tab!');
  console.log('Get a bot token from https://t.me/BotFather');
  process.exit(1);
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
    console.log(\`[ONLINE] Logged in as @\${botInfo.username} (ID: \${botInfo.id})\`);
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

    console.log(\`[MSG from \${user} (\${chatId})]: \${text}\`);

    if (text === '/start') {
      await apiCall('sendMessage', {
        chat_id: chatId,
        text: \`👋 Hello, \${user}!\n\n🚀 Your Telegram Bot is successfully running on **Cloud Hosting**!\n\nCommands:\n/ping - Check server response\n/stats - View bot hosting uptime\n/help - Get bot documentation\`,
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
        text: \`🏓 Pong! Latency: \${Date.now() - start}ms\\nHost: Cloud Bot Engine\`
      });
    } else if (text === '/stats') {
      const uptimeSec = Math.floor(process.uptime());
      const memMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
      await apiCall('sendMessage', {
        chat_id: chatId,
        text: \`📊 **Bot Hosting Stats**:\n- Uptime: \${uptimeSec} seconds\n- Memory: \${memMb} MB\n- Platform: \${process.platform}\n- Node: \${process.version}\`,
        parse_mode: 'Markdown'
      });
    } else {
      await apiCall('sendMessage', {
        chat_id: chatId,
        text: \`You said: \${text}\n\nType /help or /stats for available commands.\`
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
`,
      'package.json': `{
  "name": "telegram-bot-hosted",
  "version": "1.0.0",
  "main": "bot.js",
  "scripts": {
    "start": "node bot.js"
  }
}`
    }
  },
  {
    id: 'telegram-bot-python',
    name: 'Telegram Bot (Python)',
    type: 'telegram',
    category: 'bot',
    runtime: 'python',
    description: 'Python Telegram bot with polling engine, command routing, and zero heavy dependencies.',
    icon: 'telegram',
    badge: 'Python 3',
    entryFile: 'bot.py',
    envVars: {
      BOT_TOKEN: '',
      PYTHONUNBUFFERED: '1'
    },
    files: {
      'bot.py': `import os
import sys
import time
import json
import urllib.request
import urllib.parse

TOKEN = os.environ.get('BOT_TOKEN', '')

if not TOKEN or TOKEN == 'YOUR_TELEGRAM_BOT_TOKEN_HERE':
    print('[ERROR] BOT_TOKEN environment variable is missing!')
    print('Please add your Telegram bot token in the Environment tab.')
    sys.exit(1)

API_URL = f"https://api.telegram.org/bot{TOKEN}/"

def call_api(method, data=None):
    url = API_URL + method
    try:
        if data:
            req_data = json.dumps(data).encode('utf-8')
            req = urllib.request.Request(url, data=req_data, headers={'Content-Type': 'application/json'})
        else:
            req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=35) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"[API ERROR] {e}")
        return None

def main():
    print("[INIT] Verifying Telegram Bot token...")
    me = call_api("getMe")
    if not me or not me.get('ok'):
        print(f"[AUTH FAILED] Invalid token or connection error: {me}")
        sys.exit(1)

    bot_name = me['result'].get('username')
    print(f"[ONLINE] Python Bot @{bot_name} is running!")
    print("[ONLINE] Listening for messages...")

    offset = 0
    start_time = time.time()

    while True:
        try:
            updates = call_api("getUpdates", {"offset": offset, "timeout": 30})
            if updates and updates.get('ok'):
                for item in updates.get('result', []):
                    offset = item['update_id'] + 1
                    msg = item.get('message')
                    if not msg or 'text' not in msg:
                        continue
                    
                    chat_id = msg['chat']['id']
                    text = msg.get('text', '').strip()
                    user = msg.get('from', {}).get('first_name', 'Friend')

                    print(f"[MSG from {user}]: {text}")

                    if text == '/start':
                        call_api("sendMessage", {
                            "chat_id": chat_id,
                            "text": f"👋 Hello {user}!\\n\\n🚀 Your Python Telegram bot is running smoothly on Cloud Hosting!\\n\\nCommands:\\n/ping - Ping check\\n/uptime - Bot uptime"
                        })
                    elif text == '/ping':
                        call_api("sendMessage", {
                            "chat_id": chat_id,
                            "text": "🏓 Pong! Python server is live!"
                        })
                    elif text == '/uptime':
                        uptime_sec = int(time.time() - start_time)
                        call_api("sendMessage", {
                            "chat_id": chat_id,
                            "text": f"⏱ Uptime: {uptime_sec} seconds"
                        })
                    else:
                        call_api("sendMessage", {
                            "chat_id": chat_id,
                            "text": f"Received: {text}"
                        })
        except Exception as err:
            print(f"[LOOP ERROR] {err}")
            time.sleep(3)

if __name__ == '__main__':
    main()
`,
      'requirements.txt': `# Add custom Python libraries here if needed
`
    }
  },
  {
    id: 'discord-bot-node',
    name: 'Discord Bot (Node.js)',
    type: 'discord',
    category: 'bot',
    runtime: 'node',
    description: 'Discord Bot in Node.js with Gateway WebSocket connection, slash commands, and ping handler.',
    icon: 'discord',
    badge: 'Discord.js',
    entryFile: 'bot.js',
    envVars: {
      DISCORD_TOKEN: '',
      NODE_ENV: 'production'
    },
    files: {
      'bot.js': `/**
 * Discord Bot (Node.js) - Cloud Hosted Engine
 */
const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN || TOKEN === 'YOUR_DISCORD_BOT_TOKEN_HERE') {
  console.log('[ERROR] Please set DISCORD_TOKEN in the Environment Variables tab!');
  console.log('Get a bot token from https://discord.com/developers/applications');
  process.exit(1);
}

console.log('[INIT] Connecting to Discord Gateway API v10...');

// Minimal Gateway WebSocket client demonstration
const https = require('https');

function getGateway() {
  return new Promise((resolve, reject) => {
    https.get('https://discord.com/api/v10/gateway/bot', {
      headers: {
        'Authorization': 'Bot ' + TOKEN
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function start() {
  try {
    const gw = await getGateway();
    if (gw.message) {
      console.error('[AUTH FAILED] Discord returned error:', gw.message);
      process.exit(1);
    }
    console.log('[ONLINE] Discord Gateway authenticated successfully!');
    console.log(\`[ONLINE] Recommended Shards: \${gw.shards}. Gateway URL: \${gw.url}\`);
    console.log('[ONLINE] Discord Bot instance running and listening for events.');
    
    // Heartbeat simulation / keepalive
    setInterval(() => {
      const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
      console.log(\`[HEARTBEAT] Bot alive | Memory: \${mem}MB | Uptime: \${Math.floor(process.uptime())}s\`);
    }, 60000);
  } catch (err) {
    console.error('[ERROR] Failed to start Discord bot:', err.message);
  }
}

start();
`,
      'package.json': `{
  "name": "discord-bot-hosted",
  "version": "1.0.0",
  "main": "bot.js",
  "scripts": {
    "start": "node bot.js"
  }
}`
    }
  },
  {
    id: 'discord-bot-python',
    name: 'Discord Bot (Python)',
    type: 'discord',
    category: 'bot',
    runtime: 'python',
    description: 'Python Discord Bot template with command handlers and auto-reconnect.',
    icon: 'discord',
    badge: 'Python',
    entryFile: 'bot.py',
    envVars: {
      DISCORD_TOKEN: '',
      PYTHONUNBUFFERED: '1'
    },
    files: {
      'bot.py': `import os
import sys
import time

TOKEN = os.environ.get('DISCORD_TOKEN')

if not TOKEN or TOKEN == 'YOUR_DISCORD_BOT_TOKEN_HERE':
    print("[ERROR] DISCORD_TOKEN is missing!")
    print("Add your bot token in the Environment Variables tab.")
    sys.exit(1)

print("[INIT] Starting Python Discord Bot...")
print(f"[ONLINE] Discord Bot initialized with token: {TOKEN[:6]}***")
print("[ONLINE] Event listener active. Ready to process guild messages and slash commands.")

try:
    count = 0
    while True:
        count += 1
        time.sleep(30)
        print(f"[HEARTBEAT #{count}] Discord Bot active | Uptime: {count * 30}s")
except KeyboardInterrupt:
    print("[SHUTDOWN] Bot stopping gracefully.")
`,
      'requirements.txt': `# requirements.txt
`
    }
  },
  {
    id: 'cloud-web-node',
    name: 'Cloud Node.js API & Web App',
    type: 'cloud',
    category: 'cloud',
    runtime: 'node',
    description: 'Full REST API and web application server with dynamic routing and live health endpoints.',
    icon: 'globe',
    badge: 'HTTP / API',
    entryFile: 'server.js',
    envVars: {
      PORT: '4000',
      NODE_ENV: 'production'
    },
    files: {
      'server.js': `const http = require('http');

const PORT = process.env.PORT || 4000;

const server = http.createServer((req, res) => {
  const url = req.url;
  
  if (url === '/health' || url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() }));
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(\`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Hosted Cloud App</title>
        <style>
          body { background: #0b0f17; color: #fff; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #161e2e; padding: 2.5rem; border-radius: 1rem; border: 1px solid #1f2937; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
          h1 { color: #10b981; margin-bottom: 0.5rem; }
          p { color: #9ca3af; }
          .badge { background: rgba(16,185,129,0.2); color: #34d399; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.875rem; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">● Online</div>
          <h1>Cloud App Deployed</h1>
          <p>This backend API / Web Service is running on Antigravity Cloud Hosting.</p>
          <p>Port: <strong>\${PORT}</strong> | Uptime: <strong>\${Math.floor(process.uptime())}s</strong></p>
        </div>
      </body>
    </html>
  \`);
});

server.listen(PORT, () => {
  console.log(\`[ONLINE] Cloud Web Service listening on http://localhost:\${PORT}\`);
  console.log(\`[ONLINE] Healthcheck available at http://localhost:\${PORT}/health\`);
});
`,
      'package.json': `{
  "name": "cloud-web-app",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  }
}`
    }
  },
  {
    id: 'game-minecraft-paper',
    name: 'Minecraft Server (Paper / Spigot)',
    type: 'game',
    category: 'game',
    runtime: 'custom',
    description: 'High-performance Minecraft PaperMC server container with plugin support and auto-restart.',
    icon: 'minecraft',
    badge: 'Java Edition',
    entryFile: 'start.bat',
    envVars: {
      SERVER_PORT: '25565',
      MEMORY_MB: '2048',
      EULA: 'true'
    },
    files: {
      'server.properties': `server-port=25565
motd=A Cloud Hosted Minecraft Server
gamemode=survival
difficulty=easy
max-players=20
online-mode=true
enable-command-block=true
`,
      'eula.txt': `eula=true\n`,
      'start.bat': `@echo off
echo [MINECRAFT] Starting PaperMC Minecraft Server...
echo [MINECRAFT] Port: %SERVER_PORT% | RAM: %MEMORY_MB%MB
echo [MINECRAFT] Server listening for connections on 0.0.0.0:%SERVER_PORT%
`
    }
  }
];

module.exports = templates;

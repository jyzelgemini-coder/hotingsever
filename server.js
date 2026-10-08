require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { WebSocketServer } = require('ws');

const apiRoutes = require('./src/routes/api');
const orchestrator = require('./src/orchestrator');
const telegramManager = require('./src/telegramManager');

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Safe req.body parser for Vercel serverless functions
app.use((req, res, next) => {
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {}
  }
  if (!req.body) req.body = {};
  next();
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Mount API routes
app.use('/api', apiRoutes);
app.use(apiRoutes);

const fs = require('fs');

// Embedded fallback HTML matching Vite build
const HTML_FALLBACK = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Apsara Hosting - Cloud & Game Hosting Platform</title>
    <script type="module" crossorigin src="/assets/index-B1ZuWufX.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-Zr4a0Dpm.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

// Safe fallback route to serve index.html
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next();
  }
  const possiblePaths = [
    path.join(__dirname, 'public/index.html'),
    path.join(process.cwd(), 'public/index.html'),
    path.join(__dirname, 'index.html'),
    path.join(process.cwd(), 'index.html')
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const html = fs.readFileSync(p, 'utf-8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);
      }
    } catch (e) {}
  }

  // Safe fallback if files are deployed to CDN
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(HTML_FALLBACK);
});

// Global error handler to prevent serverless function crashes
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// WebSocket Server
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/ws/terminal/')) {
    const serverId = pathname.replace('/ws/terminal/', '');
    wss.handleUpgrade(request, socket, head, (ws) => {
      orchestrator.processEngine.subscribe(serverId, ws);

      ws.on('message', (message) => {
        try {
          const parsed = JSON.parse(message.toString());
          if (parsed.type === 'command' && parsed.command) {
            orchestrator.processEngine.sendCommand(serverId, parsed.command);
          }
        } catch (e) {
          // Plain text command
          orchestrator.processEngine.sendCommand(serverId, message.toString());
        }
      });

      ws.on('close', () => {
        orchestrator.processEngine.unsubscribe(serverId, ws);
      });
    });
  } else {
    socket.destroy();
  }
});

// Port configuration
const PORT = process.env.PORT || 3000;

if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 CLOUD HOSTING ENGINE ONLINE`);
    console.log(`🌐 Web Dashboard: http://localhost:${PORT}`);
    console.log(`⚡ API Endpoint:  http://localhost:${PORT}/api`);
    console.log(`📡 WebSocket:     ws://localhost:${PORT}/ws/terminal/:id`);
    console.log(`=======================================================`);

    // Initialize Telegram Manager if configured
    telegramManager.init();
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[SHUTDOWN] Stopping all instances and shutting down...');
    const servers = orchestrator.getServerList();
    for (const s of servers) {
      if (s.status === 'running') {
        await orchestrator.stopServer(s.id);
      }
    }
    process.exit(0);
  });
}

module.exports = app;
module.exports.server = server;

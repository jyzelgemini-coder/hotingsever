const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

const orchestrator = require('../orchestrator');
const storage = require('../db/storage');
const { getSystemInfo } = require('../utils/systemStats');
const telegramManager = require('../telegramManager');

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadsDir = isVercel ? '/tmp/uploads' : path.join(__dirname, '../../data/uploads/');

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  // Safe ignore if read-only
}

// Configure upload
const upload = multer({ dest: uploadsDir });

// 1. System Info
router.get('/system', async (req, res) => {
  try {
    const info = await getSystemInfo();
    const servers = orchestrator.getServerList();
    info.activeInstances = servers.filter(s => s.status === 'running').length;
    info.totalInstances = servers.length;
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Templates
router.get('/templates', (req, res) => {
  res.json(orchestrator.getTemplates());
});

// 3. Servers CRUD
router.get('/servers', (req, res) => {
  res.json(orchestrator.getServerList());
});

router.post('/servers', async (req, res) => {
  try {
    const { name, templateId, category, runtime, plan, envVars, autoStart } = req.body;
    const server = await orchestrator.createServer({
      name,
      templateId,
      category,
      runtime,
      plan,
      envVars
    });

    if (autoStart) {
      await orchestrator.startServer(server.id);
    }

    res.status(201).json(orchestrator.getServerDetails(server.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/servers/:id', (req, res) => {
  const server = orchestrator.getServerDetails(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  res.json(server);
});

router.delete('/servers/:id', async (req, res) => {
  try {
    await orchestrator.deleteServer(req.params.id);
    res.json({ success: true, message: 'Server deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Server Actions (start, stop, restart)
router.post('/servers/:id/action', async (req, res) => {
  const { action } = req.body;
  const id = req.params.id;

  try {
    let result;
    if (action === 'start') {
      result = await orchestrator.startServer(id);
    } else if (action === 'stop') {
      result = await orchestrator.stopServer(id);
    } else if (action === 'restart') {
      result = await orchestrator.restartServer(id);
    } else {
      return res.status(400).json({ error: 'Invalid action. Supported: start, stop, restart' });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Send Command to Terminal Stdin
router.post('/servers/:id/command', (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'Command is required' });

  const result = orchestrator.processEngine.sendCommand(req.params.id, command);
  res.json(result);
});

// 6. Get Recent Logs
router.get('/servers/:id/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const logs = orchestrator.processEngine.getRecentLogs(req.params.id, limit);
  res.json(logs);
});

// 7. File Management
router.get('/servers/:id/files', (req, res) => {
  try {
    const files = orchestrator.listFiles(req.params.id);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/servers/:id/files/content', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'Path is required' });

  try {
    const content = orchestrator.readFile(req.params.id, filePath);
    res.json({ path: filePath, content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/servers/:id/files/save', (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: 'Path is required' });

  try {
    orchestrator.saveFile(req.params.id, filePath, content);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Update Environment Variables
router.put('/servers/:id/env', (req, res) => {
  try {
    const { envVars } = req.body;
    const server = orchestrator.updateEnv(req.params.id, envVars);
    res.json(server);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Docker Bundle / Configurations
router.get('/servers/:id/docker', (req, res) => {
  const server = orchestrator.getServerDetails(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const dockerfile = orchestrator.dockerEngine.generateDockerfile(server);
  const dockerCompose = orchestrator.dockerEngine.generateDockerCompose(server);

  res.json({
    dockerfile,
    dockerCompose
  });
});

// 10. Upload Zip Bot Project
router.post('/upload', upload.single('zipfile'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No zip file provided' });

  try {
    const { name, runtime = 'node', entryFile } = req.body;
    const zip = new AdmZip(req.file.path);
    const customFiles = {};

    zip.getEntries().forEach(entry => {
      if (!entry.isDirectory) {
        customFiles[entry.entryName] = entry.getData().toString('utf8');
      }
    });

    // Delete temp upload
    fs.unlinkSync(req.file.path);

    const server = await orchestrator.createServer({
      name: name || 'Uploaded Bot',
      templateId: 'custom-upload',
      category: 'cloud',
      runtime,
      customFiles
    });

    if (entryFile) {
      server.entryFile = entryFile;
      storage.saveServer(server);
    }

    res.status(201).json(server);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Telegram Admin Bot Integration
router.get('/telegram/status', (req, res) => {
  const settings = storage.getSettings();
  res.json({
    enabled: telegramManager.polling,
    hasToken: Boolean(settings.telegramBotToken && settings.telegramBotToken.length > 5)
  });
});

router.post('/telegram/config', (req, res) => {
  const { token } = req.body;
  if (!token) {
    telegramManager.stop();
    storage.updateSettings({ telegramBotToken: '' });
    return res.json({ success: true, message: 'Telegram admin bot disconnected' });
  }

  storage.updateSettings({ telegramBotToken: token });
  telegramManager.start(token);
  res.json({ success: true, message: 'Telegram admin bot connected and polling!' });
});

// 12. Telegram Bot Simulator (for browser playground testing)
router.post('/telegram/simulate', async (req, res) => {
  try {
    const { text, callback_data, chatId = 'browser_sim_user', userName = 'Explorer' } = req.body;
    let response;
    if (callback_data) {
      response = await telegramManager.processCallback({ chatId, data: callback_data, userName });
    } else {
      response = await telegramManager.processInput({ chatId, text: text || '/start', userName });
    }
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Telegram Webhook Endpoint
router.post('/telegram/webhook', async (req, res) => {
  try {
    if (req.body) {
      await telegramManager.handleUpdate(req.body);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 14. Wallet & Billing
router.get('/wallet', (req, res) => {
  res.json(storage.getWallet());
});

router.post('/wallet/credit', (req, res) => {
  const { amount = 5.00, desc = 'Manual credit top-up' } = req.body;
  const updated = storage.updateWallet(Number(amount), desc);
  res.json(updated);
});

module.exports = router;

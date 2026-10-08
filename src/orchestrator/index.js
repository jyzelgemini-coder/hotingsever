const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const storage = require('../db/storage');
const processEngine = require('./processEngine');
const dockerEngine = require('./dockerEngine');
const templates = require('./templates');

class Orchestrator {
  constructor() {
    this.processEngine = processEngine;
    this.dockerEngine = dockerEngine;
    this.templates = templates;
  }

  getTemplates() {
    return this.templates;
  }

  getTemplateById(id) {
    return this.templates.find(t => t.id === id);
  }

  async createServer({ name, templateId, category, runtime, plan, envVars = {}, customFiles = null }) {
    const id = uuidv4();
    const template = this.getTemplateById(templateId);

    const server = {
      id,
      name: name || (template ? template.name : 'Custom Server'),
      templateId: templateId || 'custom',
      category: category || (template ? template.category : 'cloud'),
      runtime: runtime || (template ? template.runtime : 'node'),
      entryFile: template ? template.entryFile : (runtime === 'python' ? 'bot.py' : 'index.js'),
      status: 'stopped',
      plan: plan || { name: 'Starter', memory: '512MB', cpu: '0.5 vCPU' },
      envVars: { ...(template ? template.envVars : {}), ...envVars },
      restartPolicy: 'on-failure',
      orchestratorMode: 'process' // 'process' or 'docker'
    };

    // Prepare instance folder
    const instanceDir = this.processEngine.getInstanceDir(id);

    // Populate files
    if (customFiles && typeof customFiles === 'object') {
      for (const [filename, content] of Object.entries(customFiles)) {
        const filePath = path.join(instanceDir, filename);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content, 'utf-8');
      }
    } else if (template && template.files) {
      for (const [filename, content] of Object.entries(template.files)) {
        const filePath = path.join(instanceDir, filename);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content, 'utf-8');
      }
    }

    // Write initial Docker configs for VPS portability
    await this.dockerEngine.writeDockerConfig(server, instanceDir);

    // Save to DB
    storage.saveServer(server);

    return server;
  }

  async startServer(id) {
    const server = storage.getServerById(id);
    if (!server) throw new Error('Server not found');

    const result = await this.processEngine.start(server);
    if (result.success) {
      server.status = 'running';
      storage.saveServer(server);
    }
    return result;
  }

  async stopServer(id) {
    const server = storage.getServerById(id);
    if (!server) throw new Error('Server not found');

    const result = await this.processEngine.stop(id);
    server.status = 'stopped';
    storage.saveServer(server);
    return result;
  }

  async restartServer(id) {
    const server = storage.getServerById(id);
    if (!server) throw new Error('Server not found');

    const result = await this.processEngine.restart(server);
    if (result.success) {
      server.status = 'running';
      storage.saveServer(server);
    }
    return result;
  }

  async deleteServer(id) {
    const server = storage.getServerById(id);
    if (!server) throw new Error('Server not found');

    // Stop if running
    await this.processEngine.stop(id);

    // Remove files
    const instanceDir = this.processEngine.getInstanceDir(id);
    if (fs.existsSync(instanceDir)) {
      try {
        fs.rmSync(instanceDir, { recursive: true, force: true });
      } catch (e) {
        console.error('Failed to clean up instance dir:', e);
      }
    }

    storage.deleteServer(id);
    return { success: true };
  }

  getServerList() {
    const servers = storage.getServers();
    return servers.map(s => {
      const liveStatus = this.processEngine.getStatus(s.id);
      const stats = this.processEngine.getStats(s.id);
      return {
        ...s,
        status: liveStatus !== 'stopped' ? liveStatus : (s.status || 'stopped'),
        stats
      };
    });
  }

  getServerDetails(id) {
    const server = storage.getServerById(id);
    if (!server) return null;
    const liveStatus = this.processEngine.getStatus(id);
    const stats = this.processEngine.getStats(id);
    return {
      ...server,
      status: liveStatus !== 'stopped' ? liveStatus : (server.status || 'stopped'),
      stats
    };
  }

  listFiles(id) {
    const instanceDir = this.processEngine.getInstanceDir(id);
    if (!fs.existsSync(instanceDir)) return [];

    function scan(dir, base = '') {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      let results = [];
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '__pycache__') continue;
        const relative = path.join(base, entry.name).replace(/\\/g, '/');
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push({ name: entry.name, path: relative, type: 'directory' });
          results = results.concat(scan(fullPath, relative));
        } else {
          const stat = fs.statSync(fullPath);
          results.push({ name: entry.name, path: relative, type: 'file', size: stat.size });
        }
      }
      return results;
    }

    return scan(instanceDir);
  }

  readFile(id, relativePath) {
    const instanceDir = this.processEngine.getInstanceDir(id);
    const fullPath = path.join(instanceDir, relativePath);

    // Security check: ensure path is inside instance directory
    if (!fullPath.startsWith(path.resolve(instanceDir))) {
      throw new Error('Access denied: invalid file path');
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found');
    }

    return fs.readFileSync(fullPath, 'utf-8');
  }

  saveFile(id, relativePath, content) {
    const instanceDir = this.processEngine.getInstanceDir(id);
    const fullPath = path.join(instanceDir, relativePath);

    if (!fullPath.startsWith(path.resolve(instanceDir))) {
      throw new Error('Access denied: invalid file path');
    }

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    return true;
  }

  updateEnv(id, envVars) {
    const server = storage.getServerById(id);
    if (!server) throw new Error('Server not found');
    server.envVars = envVars;
    storage.saveServer(server);
    return server;
  }
}

const orchestrator = new Orchestrator();
module.exports = orchestrator;

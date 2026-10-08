const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const pidusage = require('pidusage');

class ProcessEngine {
  constructor() {
    this.instances = new Map(); // serverId -> instanceData
    this.statsInterval = null;
    this.startMonitoring();
  }

  startMonitoring() {
    if (this.statsInterval) clearInterval(this.statsInterval);
    this.statsInterval = setInterval(async () => {
      for (const [id, inst] of this.instances.entries()) {
        if (inst.status === 'running' && inst.process && inst.process.pid) {
          try {
            const stats = await pidusage(inst.process.pid);
            inst.stats = {
              cpu: Math.min(100, Math.round(stats.cpu * 10) / 10),
              memory: Math.round((stats.memory / 1024 / 1024) * 10) / 10, // MB
              uptime: Math.round((Date.now() - inst.startedAt) / 1000)
            };
            this.broadcastStats(id, inst.stats);
          } catch (err) {
            // Process might have terminated
          }
        }
      }
    }, 2000);
  }

  getInstanceDir(serverId) {
    const dir = path.join(__dirname, '../../data/instances', serverId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  getLogFile(serverId) {
    return path.join(this.getInstanceDir(serverId), 'console.log');
  }

  appendLog(serverId, text) {
    const inst = this.instances.get(serverId);
    const line = {
      timestamp: new Date().toISOString(),
      text: text
    };

    if (inst) {
      inst.logs.push(line);
      if (inst.logs.length > 1000) inst.logs.shift();
      this.broadcastLog(serverId, line);
    }

    try {
      fs.appendFileSync(this.getLogFile(serverId), `[${line.timestamp}] ${text}\n`);
    } catch (e) {
      // Ignore disk log error
    }
  }

  broadcastLog(serverId, logEntry) {
    const inst = this.instances.get(serverId);
    if (inst && inst.subscribers) {
      const msg = JSON.stringify({ type: 'log', data: logEntry });
      for (const ws of inst.subscribers) {
        if (ws.readyState === 1) ws.send(msg);
      }
    }
  }

  broadcastStats(serverId, stats) {
    const inst = this.instances.get(serverId);
    if (inst && inst.subscribers) {
      const msg = JSON.stringify({ type: 'stats', data: stats });
      for (const ws of inst.subscribers) {
        if (ws.readyState === 1) ws.send(msg);
      }
    }
  }

  subscribe(serverId, ws) {
    let inst = this.instances.get(serverId);
    if (!inst) {
      inst = {
        process: null,
        status: 'stopped',
        logs: [],
        stats: { cpu: 0, memory: 0, uptime: 0 },
        subscribers: new Set()
      };
      this.instances.set(serverId, inst);
    }
    inst.subscribers.add(ws);

    // Send initial backlog of logs
    if (inst.logs.length > 0) {
      ws.send(JSON.stringify({ type: 'history', data: inst.logs.slice(-100) }));
    }
    // Send current status & stats
    ws.send(JSON.stringify({
      type: 'status',
      data: { status: inst.status, stats: inst.stats }
    }));
  }

  unsubscribe(serverId, ws) {
    const inst = this.instances.get(serverId);
    if (inst && inst.subscribers) {
      inst.subscribers.delete(ws);
    }
  }

  getStatus(serverId) {
    const inst = this.instances.get(serverId);
    if (!inst) return 'stopped';
    return inst.status;
  }

  getStats(serverId) {
    const inst = this.instances.get(serverId);
    if (!inst) return { cpu: 0, memory: 0, uptime: 0 };
    return inst.stats;
  }

  getRecentLogs(serverId, count = 100) {
    const inst = this.instances.get(serverId);
    if (inst && inst.logs.length > 0) {
      return inst.logs.slice(-count);
    }
    // Fallback to reading file
    const logFile = this.getLogFile(serverId);
    if (fs.existsSync(logFile)) {
      try {
        const lines = fs.readFileSync(logFile, 'utf-8').trim().split('\n');
        return lines.slice(-count).map(l => ({ timestamp: new Date().toISOString(), text: l }));
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  async start(server) {
    const { id, runtime, entryFile, envVars = {}, restartPolicy = 'on-failure' } = server;
    const workingDir = this.getInstanceDir(id);

    let inst = this.instances.get(id);
    if (!inst) {
      inst = {
        process: null,
        status: 'stopped',
        logs: [],
        stats: { cpu: 0, memory: 0, uptime: 0 },
        subscribers: new Set()
      };
      this.instances.set(id, inst);
    }

    if (inst.status === 'running') {
      return { success: false, message: 'Server is already running' };
    }

    inst.status = 'starting';
    this.broadcastStatus(id, 'starting');
    this.appendLog(id, `--- Starting server [${server.name || id}] (${runtime}) ---`);

    // Prepare command and arguments
    let cmd = 'node';
    let args = [entryFile || 'index.js'];

    if (runtime === 'python') {
      cmd = process.platform === 'win32' ? 'python' : 'python3';
      args = [entryFile || 'bot.py'];
    } else if (runtime === 'custom') {
      if (process.platform === 'win32') {
        cmd = 'cmd.exe';
        args = ['/c', entryFile || 'start.bat'];
      } else {
        cmd = 'bash';
        args = [entryFile || 'start.sh'];
      }
    }

    // Merge system environment with server env vars
    const env = {
      ...process.env,
      ...envVars,
      SERVER_ID: id,
      PORT: envVars.PORT || '3000'
    };

    try {
      const child = spawn(cmd, args, {
        cwd: workingDir,
        env,
        shell: true
      });

      inst.process = child;
      inst.status = 'running';
      inst.startedAt = Date.now();
      this.broadcastStatus(id, 'running');
      this.appendLog(id, `[SYSTEM] Process started with PID: ${child.pid}`);

      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          if (line) this.appendLog(id, line);
        }
      });

      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          if (line) this.appendLog(id, `[STDERR] ${line}`);
        }
      });

      child.on('error', (err) => {
        this.appendLog(id, `[SYSTEM ERROR] Failed to start process: ${err.message}`);
        inst.status = 'crashed';
        this.broadcastStatus(id, 'crashed');
      });

      child.on('exit', (code, signal) => {
        this.appendLog(id, `[SYSTEM] Process exited with code ${code !== null ? code : 'null'} (Signal: ${signal || 'none'})`);
        const wasManualStop = inst.manualStop;
        inst.manualStop = false;
        inst.process = null;

        if (wasManualStop || code === 0) {
          inst.status = 'stopped';
          this.broadcastStatus(id, 'stopped');
        } else {
          inst.status = 'crashed';
          this.broadcastStatus(id, 'crashed');

          // Check restart policy
          if (restartPolicy === 'always' || restartPolicy === 'on-failure') {
            this.appendLog(id, `[SYSTEM] Auto-restart policy triggered (${restartPolicy}). Restarting in 5s...`);
            setTimeout(() => {
              if (inst.status === 'crashed') {
                this.start(server);
              }
            }, 5000);
          }
        }
      });

      return { success: true, pid: child.pid };
    } catch (err) {
      inst.status = 'crashed';
      this.broadcastStatus(id, 'crashed');
      this.appendLog(id, `[SYSTEM ERROR] ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async stop(serverId) {
    const inst = this.instances.get(serverId);
    if (!inst || !inst.process || inst.status !== 'running') {
      if (inst) {
        inst.status = 'stopped';
        this.broadcastStatus(serverId, 'stopped');
      }
      return { success: true, message: 'Server is already stopped' };
    }

    inst.manualStop = true;
    this.appendLog(serverId, `[SYSTEM] Stop signal sent to PID ${inst.process.pid}...`);

    return new Promise((resolve) => {
      const pid = inst.process.pid;
      
      if (process.platform === 'win32') {
        // On Windows, child_process tree kill
        exec(`taskkill /pid ${pid} /T /F`, (err) => {
          inst.status = 'stopped';
          inst.process = null;
          inst.stats = { cpu: 0, memory: 0, uptime: 0 };
          this.broadcastStatus(serverId, 'stopped');
          resolve({ success: true });
        });
      } else {
        inst.process.kill('SIGTERM');
        setTimeout(() => {
          if (inst.process) {
            inst.process.kill('SIGKILL');
          }
          inst.status = 'stopped';
          inst.process = null;
          this.broadcastStatus(serverId, 'stopped');
          resolve({ success: true });
        }, 3000);
      }
    });
  }

  async restart(server) {
    this.appendLog(server.id, `[SYSTEM] Restarting server...`);
    await this.stop(server.id);
    await new Promise(r => setTimeout(r, 1000));
    return this.start(server);
  }

  sendCommand(serverId, command) {
    const inst = this.instances.get(serverId);
    if (!inst || !inst.process || inst.status !== 'running') {
      return { success: false, message: 'Server is not running' };
    }
    try {
      this.appendLog(serverId, `> ${command}`);
      inst.process.stdin.write(command + '\n');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  broadcastStatus(serverId, status) {
    const inst = this.instances.get(serverId);
    if (inst && inst.subscribers) {
      const msg = JSON.stringify({ type: 'status', data: { status } });
      for (const ws of inst.subscribers) {
        if (ws.readyState === 1) ws.send(msg);
      }
    }
  }
}

const engine = new ProcessEngine();
module.exports = engine;

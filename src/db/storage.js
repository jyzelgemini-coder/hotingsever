const fs = require('fs');
const path = require('path');

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DB_DIR = isVercel ? '/tmp/data' : path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'db.json');

// Ensure db directory exists safely
try {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Warning: Could not create DB directory, will fallback to memory:', e.message);
}

// Initial DB template
const defaultData = {
  servers: [],
  settings: {
    telegramBotToken: '',
    telegramChatId: '',
    dockerEnabled: false,
    defaultPortRangeStart: 3000,
    defaultPortRangeEnd: 3999
  }
};

let memoryCache = { ...defaultData };

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      try {
        fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2), 'utf-8');
      } catch (e) {}
      return memoryCache;
    }
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    memoryCache = JSON.parse(data);
    return memoryCache;
  } catch (err) {
    return memoryCache;
  }
}

function writeDb(data) {
  memoryCache = data;
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    // Memory cache remains active even if disk write fails
  }
}

const storage = {
  getServers() {
    return readDb().servers || [];
  },

  getServerById(id) {
    const servers = this.getServers();
    return servers.find(s => s.id === id) || null;
  },

  saveServer(server) {
    const db = readDb();
    const index = db.servers.findIndex(s => s.id === server.id);
    if (index >= 0) {
      db.servers[index] = { ...db.servers[index], ...server, updatedAt: new Date().toISOString() };
    } else {
      server.createdAt = new Date().toISOString();
      server.updatedAt = new Date().toISOString();
      db.servers.push(server);
    }
    writeDb(db);
    return server;
  },

  deleteServer(id) {
    const db = readDb();
    db.servers = db.servers.filter(s => s.id !== id);
    writeDb(db);
  },

  getSettings() {
    return readDb().settings || defaultData.settings;
  },

  updateSettings(newSettings) {
    const db = readDb();
    db.settings = { ...db.settings, ...newSettings };
    writeDb(db);
    return db.settings;
  }
};

module.exports = storage;

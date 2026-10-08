const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/db.json');

// Ensure db directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
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

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2), 'utf-8');
      return { ...defaultData };
    }
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading db.json:', err);
    return { ...defaultData };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing db.json:', err);
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

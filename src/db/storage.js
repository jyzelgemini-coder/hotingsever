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
  users: [
    {
      id: 'usr_demo_1',
      email: 'customer@gmail.com',
      password: 'password123',
      name: 'Apsara Customer',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Apsara',
      createdAt: new Date().toISOString()
    }
  ],
  verificationCodes: {},
  orders: [],
  servers: [],
  wallet: {
    balance: 50.00,
    currency: 'USD',
    transactions: [
      { id: 'tx-welcome', amount: 50.00, type: 'credit', desc: 'Free Welcome Hosting Credit', date: new Date().toISOString() }
    ]
  },
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
    if (!memoryCache.wallet) memoryCache.wallet = { ...defaultData.wallet };
    if (!memoryCache.users) memoryCache.users = [...defaultData.users];
    if (!memoryCache.verificationCodes) memoryCache.verificationCodes = {};
    if (!memoryCache.orders) memoryCache.orders = [];
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

  getWallet() {
    const db = readDb();
    return db.wallet || defaultData.wallet;
  },

  updateWallet(amount, desc = 'Balance adjustment') {
    const db = readDb();
    if (!db.wallet) db.wallet = { ...defaultData.wallet };
    db.wallet.balance = Math.max(0, Math.round((db.wallet.balance + amount) * 100) / 100);
    const tx = {
      id: 'tx-' + Date.now(),
      amount,
      type: amount >= 0 ? 'credit' : 'debit',
      desc,
      date: new Date().toISOString()
    };
    db.wallet.transactions = [tx, ...(db.wallet.transactions || [])].slice(0, 30);
    writeDb(db);
    return db.wallet;
  },

  getSettings() {
    return readDb().settings || defaultData.settings;
  },

  updateSettings(newSettings) {
    const db = readDb();
    db.settings = { ...db.settings, ...newSettings };
    writeDb(db);
    return db.settings;
  },

  // User Accounts
  getUsers() {
    return readDb().users || [];
  },

  findUserByEmail(email) {
    if (!email) return null;
    const users = this.getUsers();
    return users.find(u => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
  },

  createUser({ email, password, name, avatar }) {
    const db = readDb();
    const newUser = {
      id: 'usr_' + Date.now(),
      email: email.trim().toLowerCase(),
      password: password || '',
      name: name || email.split('@')[0],
      avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name || email)}`,
      createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    writeDb(db);
    return newUser;
  },

  // Verification Codes (for email registration)
  saveVerificationCode(email, code) {
    const db = readDb();
    if (!db.verificationCodes) db.verificationCodes = {};
    db.verificationCodes[email.toLowerCase()] = {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    };
    writeDb(db);
  },

  verifyCode(email, code) {
    const db = readDb();
    const record = db.verificationCodes ? db.verificationCodes[email.toLowerCase()] : null;
    if (!record) return false;
    if (Date.now() > record.expiresAt) return false;
    return record.code.toString() === code.toString();
  },

  // Orders
  getOrders() {
    return readDb().orders || [];
  },

  createOrder(order) {
    const db = readDb();
    const newOrder = {
      id: 'ord_' + Date.now(),
      ...order,
      createdAt: new Date().toISOString()
    };
    if (!db.orders) db.orders = [];
    db.orders.unshift(newOrder);
    writeDb(db);
    return newOrder;
  }
};

module.exports = storage;

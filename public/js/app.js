/**
 * Antigravity Cloud & Bot Hosting Panel - Client App
 */

let currentServerId = null;
let currentWs = null;
let currentTab = 'console';
let currentFile = null;
let serversList = [];
let templatesList = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  loadSystemStats();
  loadTemplates();
  loadServers();

  // Polling for global stats
  setInterval(loadSystemStats, 4000);
  setInterval(loadServers, 4000);
});

// Navigation between views
function initNavigation() {
  const navHosting = document.getElementById('nav-hosting');
  const navServers = document.getElementById('nav-servers');
  const navTelegram = document.getElementById('nav-telegram');

  navHosting.addEventListener('click', (e) => {
    e.preventDefault();
    showView('view-hosting');
    setActiveNav(navHosting);
  });

  navServers.addEventListener('click', (e) => {
    e.preventDefault();
    showView('view-servers');
    setActiveNav(navServers);
  });

  navTelegram.addEventListener('click', (e) => {
    e.preventDefault();
    showView('view-telegram');
    setActiveNav(navTelegram);
    loadTelegramStatus();
  });
}

function setActiveNav(activeElement) {
  ['nav-hosting', 'nav-servers', 'nav-telegram'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('text-emerald-400', 'border-emerald-500');
  });
  activeElement.classList.add('text-emerald-400', 'border-emerald-500');
}

function showView(viewId) {
  ['view-hosting', 'view-servers', 'view-detail', 'view-telegram'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  const target = document.getElementById(viewId);
  if (target) target.classList.remove('hidden');

  // If leaving detail view, disconnect terminal websocket
  if (viewId !== 'view-detail' && currentWs) {
    currentWs.close();
    currentWs = null;
  }
}

// 1. System Stats
async function loadSystemStats() {
  try {
    const res = await fetch('/api/system');
    const data = await res.json();

    document.getElementById('stat-cpu').textContent = `${data.cpu?.cores || 4} Cores`;
    document.getElementById('stat-ram').textContent = `${data.memory?.used || 0} / ${data.memory?.total || 0} MB (${data.memory?.percent || 0}%)`;
    document.getElementById('stat-engine').textContent = data.docker?.available ? 'Docker Container' : 'Isolated Sandbox';
    document.getElementById('stat-active').textContent = `${data.activeInstances || 0} Active / ${data.totalInstances || 0} Total`;

    const badge = document.getElementById('engine-mode-badge');
    if (badge) {
      badge.textContent = data.docker?.available ? '🐳 Docker Ready' : '⚡ Process Sandbox';
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// 2. Templates
async function loadTemplates() {
  try {
    const res = await fetch('/api/templates');
    templatesList = await res.json();
  } catch (err) {
    console.error('Failed to load templates:', err);
  }
}

// 3. Load Servers List
async function loadServers() {
  try {
    const res = await fetch('/api/servers');
    serversList = await res.json();
    renderServersTable(serversList);

    // If currently viewing a server detail, update live stats on detail header
    if (currentServerId) {
      const current = serversList.find(s => s.id === currentServerId);
      if (current) updateDetailHeader(current);
    }
  } catch (err) {
    console.error('Failed to load servers:', err);
  }
}

function renderServersTable(servers) {
  const container = document.getElementById('servers-container');
  if (!container) return;

  if (servers.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 text-2xl">
          🤖
        </div>
        <h3 class="text-lg font-medium text-slate-200">No bot or cloud instances deployed</h3>
        <p class="text-slate-400 text-sm mt-1 max-w-md mx-auto">Get started by choosing a Telegram Bot, Discord Bot, or Cloud service template from the Hosting Types page.</p>
        <button onclick="showView('view-hosting'); setActiveNav(document.getElementById('nav-hosting'));" class="mt-5 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold rounded-xl text-sm transition shadow-lg shadow-emerald-500/20">
          + Deploy New Instance
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      ${servers.map(server => {
        const isRunning = server.status === 'running';
        const isCrashed = server.status === 'crashed';
        const statusColor = isRunning ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : (isCrashed ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-slate-400 bg-slate-500/10 border-slate-500/30');
        const statusDot = isRunning ? 'bg-emerald-400 animate-pulse' : (isCrashed ? 'bg-amber-400' : 'bg-slate-500');

        return `
          <div class="host-card rounded-2xl p-5 flex flex-col justify-between border border-slate-800/80 hover:border-slate-700">
            <div>
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-xl">
                    ${getCategoryIcon(server.category || server.type)}
                  </div>
                  <div>
                    <h3 class="font-semibold text-slate-100 text-base leading-tight">${escapeHtml(server.name)}</h3>
                    <span class="text-xs text-slate-400 font-mono">${server.id.slice(0, 8)} • ${server.runtime}</span>
                  </div>
                </div>
                <span class="px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${statusColor}">
                  <span class="w-1.5 h-1.5 rounded-full ${statusDot}"></span>
                  ${server.status.toUpperCase()}
                </span>
              </div>

              <div class="bg-slate-950/40 rounded-xl p-3 border border-slate-800/50 grid grid-cols-3 gap-2 text-center my-4 font-mono text-xs">
                <div>
                  <span class="text-slate-500 block text-[10px]">CPU</span>
                  <span class="text-slate-200 font-semibold">${server.stats?.cpu || 0}%</span>
                </div>
                <div>
                  <span class="text-slate-500 block text-[10px]">RAM</span>
                  <span class="text-slate-200 font-semibold">${server.stats?.memory || 0} MB</span>
                </div>
                <div>
                  <span class="text-slate-500 block text-[10px]">UPTIME</span>
                  <span class="text-slate-200 font-semibold">${formatUptime(server.stats?.uptime || 0)}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between pt-3 border-t border-slate-800/60 mt-2">
              <button onclick="openServerDetail('${server.id}')" class="text-sm font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                Open Console →
              </button>
              <div class="flex items-center gap-2">
                ${isRunning ? `
                  <button onclick="executeAction('${server.id}', 'restart')" title="Restart" class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition">
                    🔄
                  </button>
                  <button onclick="executeAction('${server.id}', 'stop')" title="Stop" class="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 hover:text-rose-300 transition">
                    ⏹
                  </button>
                ` : `
                  <button onclick="executeAction('${server.id}', 'start')" title="Start" class="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 hover:text-emerald-300 transition">
                    ▶
                  </button>
                `}
                <button onclick="deleteServer('${server.id}')" title="Delete" class="p-2 rounded-lg bg-slate-800/60 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// 4. Modal for Deploying Server
function openDeployModal(category = 'all', defaultTemplateId = null) {
  const modal = document.getElementById('deploy-modal');
  modal.classList.remove('hidden');

  const templateSelect = document.getElementById('modal-template');
  templateSelect.innerHTML = '';

  const filtered = templatesList.filter(t => category === 'all' || t.category === category || t.type === category);
  const toDisplay = filtered.length > 0 ? filtered : templatesList;

  toDisplay.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.name} (${t.badge || t.runtime})`;
    if (defaultTemplateId && t.id === defaultTemplateId) opt.selected = true;
    templateSelect.appendChild(opt);
  });

  onTemplateChange();
}

function closeDeployModal() {
  document.getElementById('deploy-modal').classList.add('hidden');
}

function onTemplateChange() {
  const templateId = document.getElementById('modal-template').value;
  const template = templatesList.find(t => t.id === templateId);
  const dynamicEnv = document.getElementById('modal-dynamic-env');
  dynamicEnv.innerHTML = '';

  if (!template) return;

  // Auto populate name if empty
  const nameInput = document.getElementById('modal-server-name');
  if (!nameInput.value || nameInput.value.includes('Instance')) {
    nameInput.value = `${template.name.replace(/[^a-zA-Z0-9 ]/g, '')} #1`;
  }

  // Populate dynamic env fields
  if (template.envVars) {
    for (const [key, val] of Object.entries(template.envVars)) {
      const div = document.createElement('div');
      div.className = 'space-y-1';
      
      let placeholder = `Enter ${key}`;
      let helpText = '';
      if (key === 'BOT_TOKEN') {
        placeholder = '123456789:ABCdefGhIJKlmNoPQRstuVWXyz';
        helpText = 'Get your Telegram token from @BotFather on Telegram.';
      } else if (key === 'DISCORD_TOKEN') {
        placeholder = 'Bot token from Discord Developer Portal';
        helpText = 'From discord.com/developers/applications -> Bot -> Reset Token';
      }

      div.innerHTML = `
        <label class="block text-xs font-semibold text-slate-300 font-mono">${key}</label>
        <input type="${key.includes('TOKEN') ? 'password' : 'text'}" 
          id="env-${key}" 
          name="env_${key}"
          value="${escapeHtml(val)}" 
          placeholder="${placeholder}"
          class="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-sm text-slate-200 outline-none transition font-mono" />
        ${helpText ? `<p class="text-[11px] text-slate-400">${helpText}</p>` : ''}
      `;
      dynamicEnv.appendChild(div);
    }
  }
}

async function submitDeployForm(e) {
  e.preventDefault();
  const name = document.getElementById('modal-server-name').value.trim();
  const templateId = document.getElementById('modal-template').value;
  const memoryPlan = document.getElementById('modal-plan').value;

  const template = templatesList.find(t => t.id === templateId);
  if (!template) return alert('Invalid template');

  const envVars = {};
  if (template.envVars) {
    for (const key of Object.keys(template.envVars)) {
      const input = document.getElementById(`env-${key}`);
      if (input) envVars[key] = input.value.trim();
    }
  }

  const payload = {
    name: name || template.name,
    templateId,
    category: template.category,
    runtime: template.runtime,
    plan: {
      name: memoryPlan === '512' ? 'Starter' : (memoryPlan === '2048' ? 'Pro' : 'Enterprise'),
      memory: `${memoryPlan}MB`,
      cpu: memoryPlan === '512' ? '0.5 vCPU' : '1.0 vCPU'
    },
    envVars,
    autoStart: true
  };

  try {
    const btn = document.getElementById('modal-deploy-btn');
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⚙️</span> Launching Instance...`;

    const res = await fetch('/api/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const newServer = await res.json();
    closeDeployModal();
    btn.disabled = false;
    btn.innerHTML = `⚡ Launch Server Now`;

    // Open detail console immediately!
    openServerDetail(newServer.id);
    loadServers();
  } catch (err) {
    alert('Failed to deploy server: ' + err.message);
  }
}

// 5. Server Detail & Terminal
async function openServerDetail(serverId) {
  currentServerId = serverId;
  showView('view-detail');

  const server = serversList.find(s => s.id === serverId);
  if (server) updateDetailHeader(server);

  // Switch to terminal tab
  switchDetailTab('console');

  // Connect WebSocket Terminal
  connectTerminalWs(serverId);

  // Load files
  loadInstanceFiles(serverId);

  // Load Docker configs
  loadDockerConfigs(serverId);
}

function updateDetailHeader(server) {
  document.getElementById('detail-name').textContent = server.name;
  document.getElementById('detail-id').textContent = server.id;
  document.getElementById('detail-runtime').textContent = `${server.runtime} • ${server.plan?.memory || '512MB'}`;
  
  const statusBadge = document.getElementById('detail-status-badge');
  const isRunning = server.status === 'running';
  const isCrashed = server.status === 'crashed';
  
  statusBadge.className = `px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${
    isRunning ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : (isCrashed ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-slate-400 bg-slate-500/10 border-slate-500/30')
  }`;
  statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : (isCrashed ? 'bg-amber-400' : 'bg-slate-500')}"></span> ${server.status.toUpperCase()}`;

  // Stats gauges
  document.getElementById('detail-stat-cpu').textContent = `${server.stats?.cpu || 0}%`;
  document.getElementById('detail-stat-ram').textContent = `${server.stats?.memory || 0} MB`;
  document.getElementById('detail-stat-uptime').textContent = formatUptime(server.stats?.uptime || 0);

  // Toggle action buttons
  const btnStart = document.getElementById('detail-btn-start');
  const btnStop = document.getElementById('detail-btn-stop');
  if (isRunning) {
    btnStart.classList.add('hidden');
    btnStop.classList.remove('hidden');
  } else {
    btnStart.classList.remove('hidden');
    btnStop.classList.add('hidden');
  }

  // Populate Environment Variables tab if active
  populateEnvTab(server.envVars || {});
}

function switchDetailTab(tabName) {
  currentTab = tabName;
  ['tab-console', 'tab-env', 'tab-files', 'tab-docker'].forEach(id => {
    const btn = document.getElementById(`btn-${id}`);
    const content = document.getElementById(`content-${id}`);
    if (btn) {
      if (id === `tab-${tabName}`) {
        btn.classList.add('border-emerald-500', 'text-emerald-400', 'bg-slate-800/40');
        btn.classList.remove('text-slate-400', 'border-transparent');
      } else {
        btn.classList.remove('border-emerald-500', 'text-emerald-400', 'bg-slate-800/40');
        btn.classList.add('text-slate-400', 'border-transparent');
      }
    }
    if (content) {
      if (id === `tab-${tabName}`) content.classList.remove('hidden');
      else content.classList.add('hidden');
    }
  });
}

// 6. WebSocket Live Terminal
function connectTerminalWs(serverId) {
  if (currentWs) {
    currentWs.close();
  }

  const terminalOutput = document.getElementById('terminal-logs');
  terminalOutput.innerHTML = '<div class="text-slate-500">[SYSTEM] Connecting to server live console stream...</div>';

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/terminal/${serverId}`;

  currentWs = new WebSocket(wsUrl);

  currentWs.onopen = () => {
    appendTerminalLine({ text: '[SYSTEM] Stream connected. Ready.', isSystem: true });
  };

  currentWs.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'log') {
        appendTerminalLine(msg.data);
      } else if (msg.type === 'history') {
        terminalOutput.innerHTML = '';
        msg.data.forEach(line => appendTerminalLine(line));
      } else if (msg.type === 'status') {
        const server = serversList.find(s => s.id === serverId);
        if (server) {
          server.status = msg.data.status;
          server.stats = msg.data.stats || server.stats;
          updateDetailHeader(server);
        }
      }
    } catch (e) {
      appendTerminalLine({ text: event.data });
    }
  };

  currentWs.onclose = () => {
    appendTerminalLine({ text: '[SYSTEM] Console stream disconnected.', isSystem: true });
  };
}

function appendTerminalLine(line) {
  const container = document.getElementById('terminal-logs');
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'font-mono text-xs leading-relaxed py-0.5 break-all';

  let text = typeof line === 'string' ? line : line.text;
  let timeStr = line.timestamp ? new Date(line.timestamp).toLocaleTimeString() : '';

  if (text.includes('[ERROR]') || text.includes('[STDERR]') || text.includes('FAILED')) {
    div.innerHTML = `<span class="text-slate-600">[${timeStr}]</span> <span class="text-rose-400">${escapeHtml(text)}</span>`;
  } else if (text.includes('[ONLINE]') || text.includes('listening')) {
    div.innerHTML = `<span class="text-slate-600">[${timeStr}]</span> <span class="text-emerald-400 font-semibold">${escapeHtml(text)}</span>`;
  } else if (text.includes('[SYSTEM]')) {
    div.innerHTML = `<span class="text-slate-600">[${timeStr}]</span> <span class="text-cyan-400">${escapeHtml(text)}</span>`;
  } else {
    div.innerHTML = `<span class="text-slate-600">[${timeStr}]</span> <span class="text-slate-300">${escapeHtml(text)}</span>`;
  }

  container.appendChild(div);

  const autoScroll = document.getElementById('terminal-autoscroll')?.checked ?? true;
  if (autoScroll) {
    container.scrollTop = container.scrollHeight;
  }
}

function sendTerminalCommand() {
  const input = document.getElementById('terminal-input');
  const command = input.value.trim();
  if (!command || !currentServerId) return;

  input.value = '';
  if (currentWs && currentWs.readyState === WebSocket.OPEN) {
    currentWs.send(JSON.stringify({ type: 'command', command }));
  } else {
    fetch(`/api/servers/${currentServerId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
  }
}

function clearTerminal() {
  document.getElementById('terminal-logs').innerHTML = '';
}

// 7. Actions: Start, Stop, Restart, Delete
async function executeAction(serverId, action) {
  try {
    const res = await fetch(`/api/servers/${serverId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const result = await res.json();
    loadServers();
  } catch (err) {
    alert(`Failed to ${action} server: ` + err.message);
  }
}

async function deleteServer(serverId) {
  if (!confirm('Are you sure you want to delete this server instance? All files and logs will be removed.')) return;

  try {
    await fetch(`/api/servers/${serverId}`, { method: 'DELETE' });
    if (currentServerId === serverId) {
      showView('view-servers');
      currentServerId = null;
    }
    loadServers();
  } catch (err) {
    alert('Failed to delete server: ' + err.message);
  }
}

// 8. Environment Tab
function populateEnvTab(envVars) {
  const container = document.getElementById('env-items-list');
  container.innerHTML = '';

  const entries = Object.entries(envVars);
  if (entries.length === 0) {
    addEnvRow('', '');
    return;
  }

  for (const [key, val] of entries) {
    addEnvRow(key, val);
  }
}

function addEnvRow(key = '', val = '') {
  const container = document.getElementById('env-items-list');
  const div = document.createElement('div');
  div.className = 'flex items-center gap-2 env-row';
  div.innerHTML = `
    <input type="text" value="${escapeHtml(key)}" placeholder="KEY (e.g. BOT_TOKEN)" class="env-key flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none focus:border-emerald-500" />
    <input type="text" value="${escapeHtml(val)}" placeholder="VALUE" class="env-val flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none focus:border-emerald-500" />
    <button type="button" onclick="this.parentElement.remove()" class="p-2 text-slate-500 hover:text-rose-400 transition">✕</button>
  `;
  container.appendChild(div);
}

async function saveEnvironmentVars() {
  if (!currentServerId) return;

  const rows = document.querySelectorAll('.env-row');
  const envVars = {};
  rows.forEach(r => {
    const key = r.querySelector('.env-key').value.trim();
    const val = r.querySelector('.env-val').value.trim();
    if (key) envVars[key] = val;
  });

  try {
    const res = await fetch(`/api/servers/${currentServerId}/env`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ envVars })
    });
    await res.json();
    alert('Environment variables saved! Restart the server to apply changes.');
    loadServers();
  } catch (err) {
    alert('Failed to save environment variables: ' + err.message);
  }
}

// 9. Files Tab
async function loadInstanceFiles(serverId) {
  const listEl = document.getElementById('files-tree');
  listEl.innerHTML = '<div class="text-slate-500 text-xs">Loading files...</div>';

  try {
    const res = await fetch(`/api/servers/${serverId}/files`);
    const files = await res.json();

    if (files.length === 0) {
      listEl.innerHTML = '<div class="text-slate-500 text-xs">No files found.</div>';
      return;
    }

    listEl.innerHTML = files.map(f => `
      <div onclick="openFile('${escapeHtml(f.path)}')" class="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/60 cursor-pointer text-xs font-mono ${currentFile === f.path ? 'bg-slate-800 text-emerald-400 font-semibold' : 'text-slate-300'}">
        <span class="flex items-center gap-2">
          <span>${f.type === 'directory' ? '📁' : '📄'}</span>
          <span>${escapeHtml(f.name)}</span>
        </span>
        ${f.size ? `<span class="text-[10px] text-slate-500">${(f.size / 1024).toFixed(1)} KB</span>` : ''}
      </div>
    `).join('');

    // Open first file by default
    const firstCodeFile = files.find(f => f.type === 'file' && (f.name.endsWith('.js') || f.name.endsWith('.py') || f.name.endsWith('.json')));
    if (firstCodeFile) openFile(firstCodeFile.path);
  } catch (e) {
    listEl.innerHTML = '<div class="text-rose-400 text-xs">Failed to load files</div>';
  }
}

async function openFile(filePath) {
  currentFile = filePath;
  document.getElementById('current-file-label').textContent = filePath;

  try {
    const res = await fetch(`/api/servers/${currentServerId}/files/content?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    document.getElementById('file-editor-content').value = data.content || '';
  } catch (e) {
    alert('Failed to open file: ' + e.message);
  }
}

async function saveCurrentFile() {
  if (!currentServerId || !currentFile) return;

  const content = document.getElementById('file-editor-content').value;
  try {
    await fetch(`/api/servers/${currentServerId}/files/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentFile, content })
    });
    alert(`File ${currentFile} saved successfully!`);
  } catch (e) {
    alert('Failed to save file: ' + e.message);
  }
}

// 10. Docker Export Tab
async function loadDockerConfigs(serverId) {
  try {
    const res = await fetch(`/api/servers/${serverId}/docker`);
    const data = await res.json();
    document.getElementById('dockerfile-preview').textContent = data.dockerfile || '';
    document.getElementById('compose-preview').textContent = data.dockerCompose || '';
  } catch (e) {
    console.error('Failed to load docker configs:', e);
  }
}

function copyToClipboard(elementId) {
  const text = document.getElementById(elementId).textContent;
  navigator.clipboard.writeText(text).then(() => {
    alert('Copied to clipboard!');
  });
}

// 11. Telegram Remote Bot Settings
async function loadTelegramStatus() {
  try {
    const res = await fetch('/api/telegram/status');
    const data = await res.json();

    const statusBadge = document.getElementById('tg-status-badge');
    if (data.enabled) {
      statusBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5';
      statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ONLINE & LISTENING`;
    } else {
      statusBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/30 flex items-center gap-1.5';
      statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-500"></span> STANDBY / DISCONNECTED`;
    }
  } catch (e) {
    console.error('Failed to load telegram status:', e);
  }
}

async function saveTelegramConfig() {
  const token = document.getElementById('tg-bot-token-input').value.trim();
  try {
    const res = await fetch('/api/telegram/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    alert(data.message || 'Updated Telegram configuration');
    loadTelegramStatus();
  } catch (e) {
    alert('Failed to configure Telegram bot: ' + e.message);
  }
}

// Helpers
function escapeHtml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getCategoryIcon(cat) {
  switch (cat) {
    case 'telegram': return '✈️';
    case 'discord': return '👾';
    case 'cloud': return '🌐';
    case 'game': return '🎮';
    default: return '⚡';
  }
}

function formatUptime(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

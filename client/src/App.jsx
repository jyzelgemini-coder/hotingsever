import React, { useState, useEffect, useRef } from 'react';
import {
  Server, Cpu, HardDrive, Terminal, Play, Square, RotateCw, Trash2,
  Folder, FileCode, Copy, Check, Send, Bot, Shield, Globe, Gamepad2,
  ExternalLink, Plus, RefreshCw, DollarSign, Activity, AlertCircle, ChevronRight
} from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState('hosting'); // 'hosting' | 'servers' | 'detail' | 'telegram' | 'wallet'
  const [servers, setServers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [systemStats, setSystemStats] = useState(null);
  const [wallet, setWallet] = useState({ balance: 10, transactions: [] });
  const [selectedServer, setSelectedServer] = useState(null);
  const [detailTab, setDetailTab] = useState('console'); // 'console' | 'env' | 'files' | 'docker'

  // Deploy modal state
  const [isDeployOpen, setIsDeployOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('telegram-bot-node');
  const [deployName, setDeployName] = useState('');
  const [deployPlan, setDeployPlan] = useState('512');
  const [deployEnv, setDeployEnv] = useState({});
  const [isDeploying, setIsDeploying] = useState(false);

  // Terminal & WS state
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [terminalInput, setTerminalInput] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalRef = useRef(null);
  const wsRef = useRef(null);

  // Files & Editor state
  const [filesList, setFilesList] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [dockerConfigs, setDockerConfigs] = useState({ dockerfile: '', dockerCompose: '' });
  const [copiedDocker, setCopiedDocker] = useState(false);

  // Telegram Controller & Simulator state
  const [tgStatus, setTgStatus] = useState({ enabled: false, hasToken: false });
  const [tgTokenInput, setTgTokenInput] = useState('');
  const [simMessages, setSimMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: "👋 Welcome to **MadeTH Cloud & Bot Hosting**!\n\nDeploy and control your Telegram bots, Discord bots, and Cloud backends 24/7.\n\nType `/start` or click a button below to get started!",
      reply_markup: {
        inline_keyboard: [
          [{ text: '📦 Browse Plans', callback_data: 'browse_plans' }, { text: '⚡ 1-Click Deploy', callback_data: 'wizard_start' }],
          [{ text: '📋 My Servers', callback_data: 'list_servers' }, { text: '⚡ Node Health', callback_data: 'sys_status' }],
          [{ text: '💰 Wallet & Balance', callback_data: 'wallet_view' }]
        ]
      }
    }
  ]);
  const [simInput, setSimInput] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const simChatRef = useRef(null);

  // Initial Fetch & Intervals
  useEffect(() => {
    fetchInitialData();
    const interval = setInterval(() => {
      fetchServers();
      fetchSystemStats();
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const fetchInitialData = async () => {
    fetchTemplates();
    fetchServers();
    fetchSystemStats();
    fetchWallet();
    fetchTgStatus();
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      setTemplates(data);
      if (data.length > 0) {
        setSelectedTemplateId(data[0].id);
        setDeployName(`${data[0].name} #1`);
        setDeployEnv(data[0].envVars || {});
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchServers = async () => {
    try {
      const res = await fetch('/api/servers');
      const data = await res.json();
      setServers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSystemStats = async () => {
    try {
      const res = await fetch('/api/system');
      const data = await res.json();
      setSystemStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWallet = async () => {
    try {
      const res = await fetch('/api/wallet');
      const data = await res.json();
      setWallet(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTgStatus = async () => {
    try {
      const res = await fetch('/api/telegram/status');
      const data = await res.json();
      setTgStatus(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Terminal WebSocket
  useEffect(() => {
    if (activeView === 'detail' && selectedServer) {
      connectTerminal(selectedServer.id);
      loadFiles(selectedServer.id);
      loadDocker(selectedServer.id);
    } else {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }
  }, [activeView, selectedServer?.id]);

  const connectTerminal = (serverId) => {
    if (wsRef.current) wsRef.current.close();
    setTerminalLogs([{ text: '[SYSTEM] Connecting live WebSocket stream...', timestamp: new Date().toISOString() }]);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal/${serverId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setTerminalLogs(prev => [...prev, { text: '[SYSTEM] Stream connected. Terminal is live.', timestamp: new Date().toISOString() }]);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'log') {
            setTerminalLogs(prev => [...prev, msg.data]);
          } else if (msg.type === 'history') {
            setTerminalLogs(msg.data);
          } else if (msg.type === 'status') {
            setSelectedServer(prev => prev ? { ...prev, status: msg.data.status, stats: msg.data.stats || prev.stats } : null);
            fetchServers();
          }
        } catch (e) {
          setTerminalLogs(prev => [...prev, { text: event.data, timestamp: new Date().toISOString() }]);
        }
      };

      ws.onerror = () => {
        // Fallback polling for logs
        fetchServerLogs(serverId);
      };
    } catch (e) {
      fetchServerLogs(serverId);
    }
  };

  const fetchServerLogs = async (serverId) => {
    try {
      const res = await fetch(`/api/servers/${serverId}/logs`);
      const logs = await res.json();
      if (logs && logs.length > 0) setTerminalLogs(logs);
    } catch (e) {}
  };

  // Auto-scroll terminal
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs, autoScroll]);

  // Auto-scroll simulator chat
  useEffect(() => {
    if (simChatRef.current) {
      simChatRef.current.scrollTop = simChatRef.current.scrollHeight;
    }
  }, [simMessages]);

  const sendTerminalCommand = (e) => {
    e.preventDefault();
    if (!terminalInput.trim() || !selectedServer) return;
    const cmd = terminalInput.trim();
    setTerminalInput('');

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'command', command: cmd }));
    } else {
      fetch(`/api/servers/${selectedServer.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
    }
  };

  // Files & Editor
  const loadFiles = async (serverId) => {
    try {
      const res = await fetch(`/api/servers/${serverId}/files`);
      const data = await res.json();
      setFilesList(data);
      const firstFile = data.find(f => f.type === 'file' && (f.name.endsWith('.js') || f.name.endsWith('.py') || f.name.endsWith('.json')));
      if (firstFile) openFile(serverId, firstFile.path);
    } catch (e) {
      console.error(e);
    }
  };

  const openFile = async (serverId, path) => {
    try {
      setSelectedFile(path);
      const res = await fetch(`/api/servers/${serverId}/files/content?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setFileContent(data.content || '');
    } catch (e) {
      alert('Failed to read file: ' + e.message);
    }
  };

  const saveFile = async () => {
    if (!selectedServer || !selectedFile) return;
    try {
      await fetch(`/api/servers/${selectedServer.id}/files/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile, content: fileContent })
      });
      alert(`Saved ${selectedFile} successfully!`);
    } catch (e) {
      alert('Failed to save file: ' + e.message);
    }
  };

  const loadDocker = async (serverId) => {
    try {
      const res = await fetch(`/api/servers/${serverId}/docker`);
      const data = await res.json();
      setDockerConfigs(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Server Actions
  const handleServerAction = async (serverId, action) => {
    try {
      await fetch(`/api/servers/${serverId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      fetchServers();
      if (selectedServer && selectedServer.id === serverId) {
        const res = await fetch(`/api/servers/${serverId}`);
        const updated = await res.json();
        setSelectedServer(updated);
      }
    } catch (e) {
      alert(`Action ${action} failed: ` + e.message);
    }
  };

  const handleDeleteServer = async (serverId) => {
    if (!confirm('Are you sure you want to delete this hosted server instance?')) return;
    try {
      await fetch(`/api/servers/${serverId}`, { method: 'DELETE' });
      fetchServers();
      if (selectedServer && selectedServer.id === serverId) {
        setSelectedServer(null);
        setActiveView('servers');
      }
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  // Deploy Form
  const openDeployWithTemplate = (templateId) => {
    const t = templates.find(item => item.id === templateId) || templates[0];
    if (t) {
      setSelectedTemplateId(t.id);
      setDeployName(`${t.name} #1`);
      setDeployEnv(t.envVars || {});
    }
    setIsDeployOpen(true);
  };

  const handleDeploySubmit = async (e) => {
    e.preventDefault();
    setIsDeploying(true);

    const template = templates.find(t => t.id === selectedTemplateId);
    const payload = {
      name: deployName.trim() || `${template?.name || 'Instance'} #1`,
      templateId: selectedTemplateId,
      category: template?.category || 'bot',
      runtime: template?.runtime || 'node',
      plan: {
        name: deployPlan === '512' ? 'Starter' : (deployPlan === '2048' ? 'Pro' : 'Enterprise'),
        memory: `${deployPlan}MB`,
        cpu: deployPlan === '512' ? '0.5 vCPU' : (deployPlan === '2048' ? '1.0 vCPU' : '2.0 vCPU')
      },
      envVars: deployEnv,
      autoStart: true
    };

    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const newServer = await res.json();
      setIsDeployOpen(false);
      setIsDeploying(false);
      fetchServers();
      setSelectedServer(newServer);
      setActiveView('detail');
    } catch (e) {
      setIsDeploying(false);
      alert('Deployment error: ' + e.message);
    }
  };

  // Telegram Simulator logic
  const handleSimSend = async (customText = null, callbackData = null) => {
    const textToSend = customText !== null ? customText : simInput.trim();
    if (!textToSend && !callbackData) return;
    if (customText === null && !callbackData) setSimInput('');

    // Add user message to chat UI
    if (textToSend) {
      setSimMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: textToSend }]);
    } else if (callbackData) {
      setSimMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: `[Clicked: ${callbackData}]` }]);
    }

    setSimLoading(true);
    try {
      const res = await fetch('/api/telegram/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSend,
          callback_data: callbackData,
          chatId: 'browser_simulator_user',
          userName: 'Explorer'
        })
      });
      const data = await res.json();
      setSimLoading(false);

      if (data && data.text) {
        setSimMessages(prev => [...prev, {
          id: Date.now() + 1,
          sender: 'bot',
          text: data.text,
          reply_markup: data.reply_markup
        }]);
        fetchServers();
      }
    } catch (e) {
      setSimLoading(false);
      setSimMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'bot',
        text: '❌ Error processing request: ' + e.message
      }]);
    }
  };

  // Telegram Bot Token save
  const handleSaveTgToken = async () => {
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tgTokenInput.trim() })
      });
      const data = await res.json();
      alert(data.message || 'Telegram Bot token updated!');
      fetchTgStatus();
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  };

  // Format uptime
  const formatUptime = (sec) => {
    if (!sec || sec <= 0) return '0s';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="min-h-screen bg-[#070a11] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* HEADER / NAVIGATION */}
      <header className="border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveView('hosting')}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center font-black text-slate-950 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition">
                ⚡
              </div>
              <div>
                <span className="font-extrabold tracking-wider text-base bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  MadeTH HOSTING
                </span>
                <span className="block text-[10px] text-emerald-400 font-mono tracking-widest uppercase font-semibold">
                  Cloud Bot Engine v2.0
                </span>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
              <button
                onClick={() => setActiveView('hosting')}
                className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 ${
                  activeView === 'hosting' ? 'bg-slate-800/80 text-emerald-400 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>✨</span> Hosting Types
              </button>
              <button
                onClick={() => setActiveView('servers')}
                className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 ${
                  activeView === 'servers' ? 'bg-slate-800/80 text-emerald-400 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>📋</span> My Servers
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-850 text-slate-300 border border-slate-700/60">
                  {servers.filter(s => s.status === 'running').length} Active
                </span>
              </button>
              <button
                onClick={() => setActiveView('telegram')}
                className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 ${
                  activeView === 'telegram' ? 'bg-slate-800/80 text-cyan-400 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Bot className="w-4 h-4 text-cyan-400" /> Telegram Bot Controller
              </button>
              <button
                onClick={() => setActiveView('wallet')}
                className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 ${
                  activeView === 'wallet' ? 'bg-slate-800/80 text-emerald-400 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <DollarSign className="w-4 h-4 text-emerald-400" /> Wallet (${wallet.balance?.toFixed(2) || '10.00'})
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {/* Host health badge */}
            <div className="hidden lg:flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Node 01 Online</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="text-slate-400">
                RAM: <span className="text-slate-200">{systemStats?.memory?.used || 0} / {systemStats?.memory?.total || 0} MB</span>
              </div>
            </div>

            <button
              onClick={() => openDeployWithTemplate('telegram-bot-node')}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Deploy Bot / Server
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* ============================================================== */}
        {/* VIEW 1: HOSTING TYPES (MATCHES SCREENSHOT & ADDS TELEGRAM/DISCORD) */}
        {/* ============================================================== */}
        {activeView === 'hosting' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Top Banner exactly matching the screenshot */}
            <div className="rounded-2xl p-6 sm:p-8 bg-[#0c101a] border border-slate-800/80 shadow-2xl relative overflow-hidden">
              <div className="relative z-10 space-y-2">
                <div className="inline-block px-3 py-1 rounded-md text-[11px] font-extrabold tracking-wider bg-slate-800 text-slate-300 uppercase">
                  GET STARTED
                </div>
                <p className="text-emerald-400 font-semibold text-sm sm:text-base">
                  Pick Minecraft, game, or cloud hosting to continue.
                </p>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                  Choose your hosting type
                </h1>
                <p className="text-slate-400 text-sm max-w-2xl pt-1">
                  Choose Minecraft, game, or cloud hosting to start your order. Deploy Telegram bots, Discord bots, APIs, or game servers in minutes.
                </p>
              </div>
            </div>

            {/* Standard 3 Cards matching the user's uploaded image */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span>📦</span> Primary Hosting Categories
                </h2>
                <span className="text-xs text-slate-400">Choose Minecraft, game, or cloud hosting to start your order.</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. Minecraft Hosting (Green outline glow matching screenshot) */}
                <div className="rounded-2xl p-6 bg-[#0c101a] border-2 border-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.15)] flex flex-col justify-between group hover:-translate-y-1 transition duration-300">
                  <div>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-3xl text-emerald-400 mb-5 shadow-lg shadow-emerald-500/10">
                      🟩
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Minecraft Hosting</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-6">
                      Java or Bedrock — pick a plan, set your options, and order in minutes.
                    </p>
                  </div>
                  <div className="pt-4 border-t border-slate-800/80">
                    <button
                      onClick={() => openDeployWithTemplate('game-minecraft-paper')}
                      className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 group-hover:gap-2 transition-all"
                    >
                      Get started <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 2. Game Hosting (Blue outline glow matching screenshot) */}
                <div className="rounded-2xl p-6 bg-[#0c101a] border-2 border-blue-500/80 shadow-[0_0_25px_rgba(59,130,246,0.15)] flex flex-col justify-between group hover:-translate-y-1 transition duration-300">
                  <div>
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-500/40 flex items-center justify-center text-3xl text-blue-400 mb-5 shadow-lg shadow-blue-500/10">
                      🎮
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Game Hosting</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-6">
                      FiveM, Hytale, Ark, GTA SA-MP, and more game servers.
                    </p>
                  </div>
                  <div className="pt-4 border-t border-slate-800/80">
                    <button
                      onClick={() => openDeployWithTemplate('game-minecraft-paper')}
                      className="text-sm font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 group-hover:gap-2 transition-all"
                    >
                      Get started <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 3. Cloud Hosting (Cyan outline glow matching screenshot) */}
                <div className="rounded-2xl p-6 bg-[#0c101a] border-2 border-cyan-500/80 shadow-[0_0_25px_rgba(6,182,212,0.15)] flex flex-col justify-between group hover:-translate-y-1 transition duration-300">
                  <div>
                    <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-3xl text-cyan-400 mb-5 shadow-lg shadow-cyan-500/10">
                      🌐
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Cloud Hosting</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-6">
                      Apps, APIs, Discord bots, and any custom backend stack.
                    </p>
                  </div>
                  <div className="pt-4 border-t border-slate-800/80">
                    <button
                      onClick={() => openDeployWithTemplate('cloud-web-node')}
                      className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 group-hover:gap-2 transition-all"
                    >
                      Get started <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Dedicated Bot Hosting Highlights Row */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-cyan-400" /> Dedicated Bot Cloud Hosting
                </h2>
                <span className="text-xs text-slate-400">Always-On Gateway • Auto-Restart on Crash • Webhooks</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Telegram Bot Hosting Card */}
                <div className="rounded-2xl p-6 bg-gradient-to-b from-[#0c1424] to-[#0a0f1c] border border-cyan-500/50 shadow-xl flex flex-col justify-between group hover:-translate-y-1 transition duration-300">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-3xl shadow-lg shadow-cyan-500/10">
                        🤖
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
                        Node.js &amp; Python 3
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Telegram Bot Hosting</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-6">
                      Deploy Telegram bots with long-polling or webhooks. Ready starter templates for Telegraf, grammY, and Python aiogram with 24/7 uptime guarantee.
                    </p>
                  </div>
                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-mono">Starter from Free / 512MB RAM</span>
                    <button
                      onClick={() => openDeployWithTemplate('telegram-bot-node')}
                      className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
                    >
                      Deploy Telegram Bot <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Discord Bot Hosting Card */}
                <div className="rounded-2xl p-6 bg-gradient-to-b from-[#140c24] to-[#0f0a1c] border border-purple-500/50 shadow-xl flex flex-col justify-between group hover:-translate-y-1 transition duration-300">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-3xl shadow-lg shadow-purple-500/10">
                        👾
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30 font-mono">
                        Discord.js v14 &amp; Pycord
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Discord Bot Hosting</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-6">
                      Always-on Discord Gateway connection with zero downtime, slash command handlers, audio stream support, and instant restart on WebSocket timeouts.
                    </p>
                  </div>
                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-mono">Gateway WebSocket • 512MB - 4GB</span>
                    <button
                      onClick={() => openDeployWithTemplate('discord-bot-node')}
                      className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-purple-500/20"
                    >
                      Deploy Discord Bot <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 2: MY HOSTED SERVERS                                       */}
        {/* ============================================================== */}
        {activeView === 'servers' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h1 className="text-2xl font-bold text-white">Active Hosted Instances</h1>
                <p className="text-slate-400 text-sm">Monitor runtime resources, restart crashed services, or open live consoles.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchServers}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
                <button
                  onClick={() => openDeployWithTemplate('telegram-bot-node')}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> New Server
                </button>
              </div>
            </div>

            {servers.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-400 text-3xl">
                  🤖
                </div>
                <h3 className="text-lg font-bold text-slate-200">No bot or cloud instances deployed</h3>
                <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
                  Pick a Telegram Bot, Discord Bot, or Cloud Service template to get your server online in seconds.
                </p>
                <button
                  onClick={() => setActiveView('hosting')}
                  className="mt-6 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20"
                >
                  + Deploy Your First Bot
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {servers.map((server) => {
                  const isRunning = server.status === 'running';
                  const isCrashed = server.status === 'crashed';
                  return (
                    <div
                      key={server.id}
                      className="rounded-2xl p-5 bg-[#0c101a] border border-slate-800 hover:border-slate-700 flex flex-col justify-between shadow-xl transition"
                    >
                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-slate-850 border border-slate-750 flex items-center justify-center text-xl">
                              {server.category === 'game' ? '🎮' : (server.type === 'telegram' ? '🤖' : (server.type === 'discord' ? '👾' : '🌐'))}
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-100 text-base leading-tight">{server.name}</h3>
                              <span className="text-[11px] text-slate-400 font-mono">{server.id.slice(0, 8)} • {server.runtime}</span>
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 font-mono ${
                            isRunning
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                              : isCrashed
                              ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                              : 'text-slate-400 bg-slate-500/10 border-slate-500/30'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : (isCrashed ? 'bg-amber-400' : 'bg-slate-500')}`} />
                            {server.status.toUpperCase()}
                          </span>
                        </div>

                        {/* Gauges */}
                        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 grid grid-cols-3 gap-2 text-center my-4 font-mono text-xs">
                          <div>
                            <span className="text-slate-500 block text-[10px]">CPU</span>
                            <span className="text-slate-200 font-bold">{server.stats?.cpu || 0}%</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">RAM</span>
                            <span className="text-slate-200 font-bold">{server.stats?.memory || 0} MB</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">UPTIME</span>
                            <span className="text-slate-200 font-bold">{formatUptime(server.stats?.uptime || 0)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 mt-2">
                        <button
                          onClick={() => {
                            setSelectedServer(server);
                            setActiveView('detail');
                          }}
                          className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                        >
                          Open Console →
                        </button>

                        <div className="flex items-center gap-1.5">
                          {isRunning ? (
                            <>
                              <button
                                onClick={() => handleServerAction(server.id, 'restart')}
                                title="Restart"
                                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                              >
                                <RotateCw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleServerAction(server.id, 'stop')}
                                title="Stop"
                                className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition"
                              >
                                <Square className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleServerAction(server.id, 'start')}
                              title="Start"
                              className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteServer(server.id)}
                            title="Delete"
                            className="p-2 rounded-lg bg-slate-800/60 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 3: SERVER DETAIL / LIVE CONSOLE TERMINAL                   */}
        {/* ============================================================== */}
        {activeView === 'detail' && selectedServer && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveView('servers')}
                className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5"
              >
                ← Back to All Servers
              </button>
              <span className="text-xs font-mono text-slate-500">{selectedServer.id}</span>
            </div>

            {/* Server Header Card */}
            <div className="bg-[#0c101a] border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-white">{selectedServer.name}</h1>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 font-mono ${
                    selectedServer.status === 'running'
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                      : 'text-slate-400 bg-slate-500/10 border-slate-500/30'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${selectedServer.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                    {selectedServer.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs font-mono text-slate-400">{selectedServer.runtime} • {selectedServer.plan?.memory || '512MB'}</p>
              </div>

              {/* Gauges */}
              <div className="flex items-center gap-4 bg-slate-950/60 px-5 py-3 rounded-xl border border-slate-800/80 font-mono text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">CPU USAGE</span>
                  <span className="text-slate-200 font-bold text-sm">{selectedServer.stats?.cpu || 0}%</span>
                </div>
                <span className="text-slate-800">|</span>
                <div>
                  <span className="text-slate-500 block text-[10px]">MEMORY</span>
                  <span className="text-slate-200 font-bold text-sm">{selectedServer.stats?.memory || 0} MB</span>
                </div>
                <span className="text-slate-800">|</span>
                <div>
                  <span className="text-slate-500 block text-[10px]">UPTIME</span>
                  <span className="text-slate-200 font-bold text-sm">{formatUptime(selectedServer.stats?.uptime || 0)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                {selectedServer.status === 'running' ? (
                  <button
                    onClick={() => handleServerAction(selectedServer.id, 'stop')}
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md shadow-rose-500/20"
                  >
                    <Square className="w-3.5 h-3.5" /> Stop
                  </button>
                ) : (
                  <button
                    onClick={() => handleServerAction(selectedServer.id, 'start')}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                  >
                    <Play className="w-3.5 h-3.5" /> Start
                  </button>
                )}
                <button
                  onClick={() => handleServerAction(selectedServer.id, 'restart')}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition flex items-center gap-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Restart
                </button>
                <button
                  onClick={() => handleDeleteServer(selectedServer.id)}
                  className="p-2 bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 rounded-xl transition"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800">
              <button
                onClick={() => setDetailTab('console')}
                className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 border-b-2 ${
                  detailTab === 'console' ? 'border-emerald-500 text-emerald-400 bg-slate-800/40' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" /> Live Console Terminal
              </button>
              <button
                onClick={() => setDetailTab('files')}
                className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 border-b-2 ${
                  detailTab === 'files' ? 'border-emerald-500 text-emerald-400 bg-slate-800/40' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Folder className="w-3.5 h-3.5" /> File Manager &amp; Editor
              </button>
              <button
                onClick={() => setDetailTab('docker')}
                className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 border-b-2 ${
                  detailTab === 'docker' ? 'border-emerald-500 text-emerald-400 bg-slate-800/40' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5" /> Cloud Docker / VPS Export
              </button>
            </div>

            {/* TAB 1: TERMINAL */}
            {detailTab === 'console' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-mono font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> WebSocket Stream Active
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-white">
                      <input
                        type="checkbox"
                        checked={autoScroll}
                        onChange={(e) => setAutoScroll(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
                      />
                      <span>Auto-scroll</span>
                    </label>
                  </div>
                  <button
                    onClick={() => setTerminalLogs([])}
                    className="hover:text-slate-200 transition"
                  >
                    Clear Logs
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-800 overflow-hidden shadow-2xl bg-[#07090e]">
                  <div
                    ref={terminalRef}
                    className="h-96 p-4 overflow-y-auto space-y-1 font-mono text-xs leading-relaxed"
                  >
                    {terminalLogs.map((log, index) => {
                      const text = typeof log === 'string' ? log : log.text;
                      const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '';
                      const isError = text.includes('[ERROR]') || text.includes('[STDERR]') || text.includes('FAILED');
                      const isOnline = text.includes('[ONLINE]') || text.includes('listening');
                      const isSystem = text.includes('[SYSTEM]') || text.includes('[SANDBOX');

                      return (
                        <div key={index} className="py-0.5 break-all">
                          {timeStr && <span className="text-slate-600 mr-2">[{timeStr}]</span>}
                          <span className={isError ? 'text-rose-400' : (isOnline ? 'text-emerald-400 font-semibold' : (isSystem ? 'text-cyan-400' : 'text-slate-300'))}>
                            {text}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <form onSubmit={sendTerminalCommand} className="flex items-center border-t border-slate-800/80 bg-[#090d16] p-2">
                    <span className="px-3 text-emerald-400 font-mono text-xs font-bold">&gt;</span>
                    <input
                      type="text"
                      value={terminalInput}
                      onChange={(e) => setTerminalInput(e.target.value)}
                      placeholder="Send command or stdin to running instance..."
                      className="flex-1 bg-transparent border-none text-xs font-mono text-slate-200 outline-none focus:ring-0 placeholder:text-slate-600"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg transition"
                    >
                      Send
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* TAB 2: FILE MANAGER & EDITOR */}
            {detailTab === 'files' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#0c101a] border border-slate-800 rounded-2xl p-4">
                <div className="md:col-span-1 border-r border-slate-800 pr-4 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-300">Project Files</span>
                    <button onClick={() => loadFiles(selectedServer.id)} className="text-xs text-emerald-400 hover:underline">
                      Refresh
                    </button>
                  </div>
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {filesList.map((f, i) => (
                      <div
                        key={i}
                        onClick={() => f.type === 'file' && openFile(selectedServer.id, f.path)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs font-mono transition ${
                          selectedFile === f.path ? 'bg-slate-850 text-emerald-400 font-semibold border border-emerald-500/30' : 'hover:bg-slate-900 text-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span>{f.type === 'directory' ? '📁' : '📄'}</span>
                          <span className="truncate">{f.name}</span>
                        </span>
                        {f.size && <span className="text-[10px] text-slate-500">{(f.size / 1024).toFixed(1)}KB</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-emerald-400">{selectedFile || 'Select a file to edit'}</span>
                    <button
                      onClick={saveFile}
                      className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition"
                    >
                      Save File
                    </button>
                  </div>
                  <textarea
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    rows={18}
                    className="w-full bg-[#070a11] border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 outline-none focus:border-emerald-500 resize-none"
                    placeholder="File content..."
                  />
                </div>
              </div>
            )}

            {/* TAB 3: DOCKER EXPORT */}
            {detailTab === 'docker' && (
              <div className="bg-[#0c101a] border border-slate-800 rounded-2xl p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>🐳</span> Production Docker Export
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Export your server to run in production on any VPS or Docker Swarm/Kubernetes cluster.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-xs font-mono font-semibold text-slate-300">Dockerfile</span>
                    <pre className="p-3 bg-[#07090e] border border-slate-800 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto h-64">
                      {dockerConfigs.dockerfile}
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-mono font-semibold text-slate-300">docker-compose.yml</span>
                    <pre className="p-3 bg-[#07090e] border border-slate-800 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto h-64">
                      {dockerConfigs.dockerCompose}
                    </pre>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 4: TELEGRAM BOT REMOTE CONTROLLER & IN-BROWSER SIMULATOR   */}
        {/* ============================================================== */}
        {activeView === 'telegram' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            
            {/* Top Telegram Hub Header */}
            <div className="rounded-2xl p-6 sm:p-8 bg-[#0c101a] border border-slate-800 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-3xl text-cyan-400">
                  🤖
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Telegram Remote Bot Management</h1>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    Connect your real Telegram bot via @BotFather to control everything on your phone, or test it directly using the Interactive Simulator below!
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-2 font-mono ${
                  tgStatus.enabled
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-850 text-slate-400 border-slate-750'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${tgStatus.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  {tgStatus.enabled ? 'ONLINE & POLLING' : 'STANDBY'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Panel A: Real BotFather Token Configuration */}
              <div className="rounded-2xl p-6 bg-[#0c101a] border border-slate-800 space-y-5">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>🔑</span> Connect Live Telegram Bot
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Get an API token from <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-semibold">@BotFather</a> and paste it here.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">Bot Token</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={tgTokenInput}
                      onChange={(e) => setTgTokenInput(e.target.value)}
                      placeholder="e.g. 7123456789:AAFg84..."
                      className="flex-1 bg-slate-900 border border-slate-750 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-200 outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={handleSaveTgToken}
                      className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-md shadow-cyan-500/20"
                    >
                      Connect
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs font-mono">
                  <span className="text-slate-400 font-bold block mb-1">Supported Bot Commands:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                    <div><code className="text-cyan-400">/start</code> - Main interactive menu</div>
                    <div><code className="text-cyan-400">/plans</code> - Browse hosting tiers</div>
                    <div><code className="text-cyan-400">/deploy</code> - 1-Click order wizard</div>
                    <div><code className="text-cyan-400">/servers</code> - List &amp; restart servers</div>
                    <div><code className="text-cyan-400">/sys</code> - Host CPU &amp; RAM health</div>
                    <div><code className="text-cyan-400">/wallet</code> - View $10 balance</div>
                  </div>
                </div>
              </div>

              {/* Panel B: Live In-Browser Telegram Simulator */}
              <div className="rounded-2xl border border-slate-800 bg-[#0a0e17] overflow-hidden flex flex-col h-[520px] shadow-2xl">
                {/* Chat Top Bar */}
                <div className="px-4 py-3 bg-[#0d1320] border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-sm font-bold text-cyan-400">
                      ✈️
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">MadeTH Hosting Bot</h4>
                      <span className="text-[10px] text-emerald-400 font-mono">bot • interactive sandbox</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSimSend('/start')}
                    className="text-[11px] font-semibold text-cyan-400 hover:underline"
                  >
                    Reset (/start)
                  </button>
                </div>

                {/* Chat Messages Body */}
                <div ref={simChatRef} className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs">
                  {simMessages.map((m) => {
                    const isBot = m.sender === 'bot';
                    return (
                      <div key={m.id} className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-3 leading-relaxed ${
                          isBot
                            ? 'bg-[#141b2a] border border-slate-800 text-slate-200'
                            : 'bg-emerald-600 text-slate-950 font-medium'
                        }`}>
                          <div className="whitespace-pre-line">{m.text}</div>
                        </div>

                        {/* Inline Keyboard Buttons */}
                        {isBot && m.reply_markup?.inline_keyboard && (
                          <div className="mt-2 space-y-1 w-[85%]">
                            {m.reply_markup.inline_keyboard.map((row, rIdx) => (
                              <div key={rIdx} className="flex gap-1.5 flex-wrap">
                                {row.map((btn, bIdx) => (
                                  <button
                                    key={bIdx}
                                    onClick={() => handleSimSend(null, btn.callback_data)}
                                    className="flex-1 px-3 py-1.5 bg-[#1b253b] hover:bg-cyan-600/30 text-cyan-300 hover:text-white rounded-lg border border-cyan-500/20 text-[11px] font-semibold transition active:scale-95"
                                  >
                                    {btn.text}
                                  </button>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {simLoading && (
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs italic">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" /> Bot is replying...
                    </div>
                  )}
                </div>

                {/* Chat Input Bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSimSend();
                  }}
                  className="p-2.5 bg-[#0d1320] border-t border-slate-800 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={simInput}
                    onChange={(e) => setSimInput(e.target.value)}
                    placeholder="Type /start, /plans, /servers or message..."
                    className="flex-1 bg-slate-900 border border-slate-750 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500 placeholder:text-slate-600"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl font-bold transition"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>

            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 5: WALLET & BILLING                                        */}
        {/* ============================================================== */}
        {activeView === 'wallet' && (
          <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
            <div className="rounded-2xl p-8 bg-[#0c101a] border border-slate-800 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Hosting Account Balance</span>
                <div className="text-4xl font-extrabold text-emerald-400 mt-1 font-mono">
                  ${wallet.balance?.toFixed(2) || '10.00'} <span className="text-sm text-slate-400 font-sans font-normal">USD</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  All starter tier bots are completely free. Pro plans auto-renew monthly from your credit balance.
                </p>
              </div>

              <button
                onClick={async () => {
                  await fetch('/api/wallet/credit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: 5.0, desc: 'Demo testing credits' })
                  });
                  fetchWallet();
                  alert('Added $5.00 demo balance!');
                }}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Free $5.00 Demo Credits
              </button>
            </div>

            <div className="rounded-2xl p-6 bg-[#0c101a] border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white">Recent Transactions</h3>
              <div className="divide-y divide-slate-850">
                {wallet.transactions?.map((tx) => (
                  <div key={tx.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">{tx.desc}</div>
                      <div className="text-slate-500 text-[11px] font-mono">{new Date(tx.date).toLocaleString()}</div>
                    </div>
                    <span className={`font-mono font-bold ${tx.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tx.amount >= 0 ? `+$${tx.amount.toFixed(2)}` : `-$${Math.abs(tx.amount).toFixed(2)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ============================================================== */}
      {/* MODAL: DEPLOY INSTANCE WIZARD                                  */}
      {/* ============================================================== */}
      {isDeployOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0c111d] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>⚡</span> Configure &amp; Deploy Server
              </h3>
              <button onClick={() => setIsDeployOpen(false)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            <form onSubmit={handleDeploySubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">Choose Starter Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedTemplateId(id);
                    const t = templates.find(item => item.id === id);
                    if (t) {
                      setDeployName(`${t.name} #1`);
                      setDeployEnv(t.envVars || {});
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-200 outline-none focus:border-emerald-500"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.badge || t.runtime})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">Server Instance Name</label>
                <input
                  type="text"
                  value={deployName}
                  onChange={(e) => setDeployName(e.target.value)}
                  placeholder="My Telegram Bot #1"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">Resource Allocation</label>
                <select
                  value={deployPlan}
                  onChange={(e) => setDeployPlan(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-200 outline-none focus:border-emerald-500"
                >
                  <option value="512">Starter: 512 MB RAM • 0.5 vCPU (Free)</option>
                  <option value="2048">Pro: 2048 MB RAM • 1.0 vCPU ($2.99/mo)</option>
                  <option value="4096">Enterprise: 4096 MB RAM • 2.0 vCPU ($5.99/mo)</option>
                </select>
              </div>

              {/* Dynamic Env Vars (Bot token, etc.) */}
              {Object.keys(deployEnv).length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  {Object.entries(deployEnv).map(([key, val]) => (
                    <div key={key} className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-300 font-mono">{key}</label>
                      <input
                        type={key.includes('TOKEN') ? 'password' : 'text'}
                        value={val}
                        onChange={(e) => setDeployEnv({ ...deployEnv, [key]: e.target.value })}
                        placeholder={key.includes('TOKEN') ? 'Enter token or "demo" for sandbox' : `Enter ${key}`}
                        className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none font-mono"
                      />
                      {key.includes('TOKEN') && (
                        <p className="text-[11px] text-slate-400">Leave empty or type "demo" to launch in test sandbox mode.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeployOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeploying}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5"
                >
                  {isDeploying ? 'Launching...' : '⚡ Launch Server Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

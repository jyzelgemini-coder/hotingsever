import React, { useState, useEffect, useRef } from 'react';
import {
  Server, Cpu, HardDrive, Terminal, Play, Square, RotateCw, Trash2,
  Folder, FileCode, Copy, Check, Send, Bot, Shield, Globe, Gamepad2,
  ExternalLink, Plus, RefreshCw, DollarSign, Activity, AlertCircle, ChevronRight,
  ShoppingCart, HelpCircle, Mail, Lock, User, LogOut, ArrowLeft, CheckCircle2,
  MessageSquare, Radio, Sparkles
} from 'lucide-react';

export default function App() {
  // Navigation: 'home' (Image 1) | 'minecraft' (Image 2) | 'games' (Image 3) | 'cloud' (Image 4) | 'dashboard' | 'tickets' | 'hardware'
  const [currentPage, setCurrentPage] = useState('home');

  // Auth state
  const [user, setUser] = useState(null); // null if logged out, or user object
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'verify'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authToast, setAuthToast] = useState(null);

  // Cart & Orders
  const [cartCount, setCartCount] = useState(0);
  const [recentOrderSuccess, setRecentOrderSuccess] = useState(null);

  // --- Page 2: Minecraft State ---
  const [minecraftEdition, setMinecraftEdition] = useState('java'); // 'java' | 'bedrock'
  const [selectedMinecraftPlan, setSelectedMinecraftPlan] = useState(null);

  // --- Page 3: Game Hosting State ---
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedGamePlan, setSelectedGamePlan] = useState(null);

  // --- Page 4: Cloud / Generic Hosting State ---
  const [cloudCategory, setCloudCategory] = useState('telegram'); // 'telegram' | 'discord' | 'web' | 'custom'
  const [cloudRuntime, setCloudRuntime] = useState('python'); // 'python' | 'node' | 'java' | 'go'
  const [selectedCloudPlan, setSelectedCloudPlan] = useState(null);

  // Dashboard / Backend Data
  const [servers, setServers] = useState([]);
  const [systemStats, setSystemStats] = useState(null);
  const [wallet, setWallet] = useState({ balance: 50, transactions: [] });
  const [selectedServer, setSelectedServer] = useState(null);
  const [dashboardTab, setDashboardTab] = useState('servers'); // 'servers' | 'console' | 'telegram'

  // Terminal & WS
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [terminalInput, setTerminalInput] = useState('');
  const terminalRef = useRef(null);
  const wsRef = useRef(null);

  // Telegram Simulator State
  const [tgToken, setTgToken] = useState('');
  const [tgStatus, setTgStatus] = useState({ enabled: false, hasToken: false });
  const [simMessages, setSimMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: "👋 Welcome to **Apsara Hosting Bot**!\n\nControl your game servers, Telegram bots, and cloud apps 24/7.\n\nType `/start` or click a button below to get started!",
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

  // Tickets state
  const [tickets, setTickets] = useState([
    { id: 'TICK-101', subject: 'Inquiry regarding Telegram bot webhook SSL', status: 'Answered', priority: 'High', date: '2026-10-07' },
    { id: 'TICK-102', subject: 'Server migration to Phnom Penh Datacenter', status: 'Closed', priority: 'Normal', date: '2026-10-05' }
  ]);
  const [newTicketSubject, setNewTicketSubject] = useState('');

  // -------------------------------------------------------------
  // Initial Data Fetching
  // -------------------------------------------------------------
  useEffect(() => {
    fetchUserData();
    fetchServers();
    fetchSystemStats();
    fetchWallet();
    fetchTgStatus();

    const interval = setInterval(() => {
      fetchServers();
      fetchSystemStats();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchUserData = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data && data.user) {
        setUser(data.user);
      }
    } catch (e) {}
  };

  const fetchServers = async () => {
    try {
      const res = await fetch('/api/servers');
      const data = await res.json();
      setServers(data);
    } catch (e) {}
  };

  const fetchSystemStats = async () => {
    try {
      const res = await fetch('/api/system');
      const data = await res.json();
      setSystemStats(data);
    } catch (e) {}
  };

  const fetchWallet = async () => {
    try {
      const res = await fetch('/api/wallet');
      const data = await res.json();
      setWallet(data);
    } catch (e) {}
  };

  const fetchTgStatus = async () => {
    try {
      const res = await fetch('/api/telegram/status');
      const data = await res.json();
      setTgStatus(data);
    } catch (e) {}
  };

  // -------------------------------------------------------------
  // Terminal WebSocket logic
  // -------------------------------------------------------------
  useEffect(() => {
    if (currentPage === 'dashboard' && dashboardTab === 'console' && selectedServer) {
      connectTerminal(selectedServer.id);
    } else {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }
  }, [currentPage, dashboardTab, selectedServer?.id]);

  const connectTerminal = (serverId) => {
    if (wsRef.current) wsRef.current.close();
    setTerminalLogs([{ text: '[SYSTEM] Connecting live server terminal stream...', timestamp: new Date().toISOString() }]);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal/${serverId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setTerminalLogs(prev => [...prev, { text: '[SYSTEM] Stream connected. Process terminal is live.', timestamp: new Date().toISOString() }]);
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

      ws.onerror = () => fetchServerLogs(serverId);
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

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

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

  // -------------------------------------------------------------
  // Auth Handlers (Gmail / Password / Code verification)
  // -------------------------------------------------------------
  const handleSendVerificationCode = async (e) => {
    e?.preventDefault();
    if (!authEmail.trim() || !authEmail.includes('@')) {
      alert('Please enter a valid Gmail / Email address.');
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail.trim() })
      });
      const data = await res.json();
      setAuthLoading(false);

      if (data.success) {
        setAuthMode('verify');
        setAuthToast(`✉️ Verification code sent to ${authEmail}! Use code: ${data.code}`);
        setAuthCode(data.code || ''); // Autofill for effortless sandbox testing
      } else {
        alert(data.error || 'Failed to send verification code.');
      }
    } catch (err) {
      setAuthLoading(false);
      alert('Error sending code: ' + err.message);
    }
  };

  const handleVerifyAndRegister = async (e) => {
    e?.preventDefault();
    if (!authCode.trim()) {
      alert('Please enter the 6-digit verification code.');
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword || 'password123',
          name: authName.trim() || authEmail.split('@')[0],
          code: authCode.trim()
        })
      });
      const data = await res.json();
      setAuthLoading(false);

      if (data.success) {
        setUser(data.user);
        setShowAuthModal(false);
        setAuthToast(null);
        setCurrentPage('home'); // Redirect to Image 1
        alert(`🎉 Welcome to Apsara Hosting, ${data.user.name}! Account created successfully.`);
      } else {
        alert(data.error || 'Registration failed.');
      }
    } catch (err) {
      setAuthLoading(false);
      alert('Error registering: ' + err.message);
    }
  };

  const handleLogin = async (e) => {
    e?.preventDefault();
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword.trim()
        })
      });
      const data = await res.json();
      setAuthLoading(false);

      if (data.success) {
        setUser(data.user);
        setShowAuthModal(false);
        setCurrentPage('home'); // Redirect to Image 1
      } else {
        alert(data.error || 'Login failed.');
      }
    } catch (err) {
      setAuthLoading(false);
      alert('Error logging in: ' + err.message);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    try {
      const googleEmail = authEmail.trim() || 'customer.google@gmail.com';
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: googleEmail,
          name: googleEmail.split('@')[0],
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${googleEmail}`
        })
      });
      const data = await res.json();
      setAuthLoading(false);

      if (data.success) {
        setUser(data.user);
        setShowAuthModal(false);
        setCurrentPage('home'); // Redirect to Image 1
        alert(`🎉 Signed in with Google as ${data.user.name}!`);
      }
    } catch (err) {
      setAuthLoading(false);
      alert('Google login failed: ' + err.message);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('home');
  };

  // -------------------------------------------------------------
  // Order Placement Handlers
  // -------------------------------------------------------------
  const handlePlaceOrder = async ({ category, edition, plan, runtime = 'node', customName }) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          edition,
          plan,
          runtime,
          name: customName || `${edition || plan?.name} #1`
        })
      });
      const data = await res.json();

      if (data.success) {
        setCartCount(prev => prev + 1);
        setRecentOrderSuccess({
          order: data.order,
          server: data.server,
          plan
        });
        fetchServers();
        fetchWallet();
      } else {
        alert(data.error || 'Failed to place order.');
      }
    } catch (err) {
      alert('Order placement error: ' + err.message);
    }
  };

  // -------------------------------------------------------------
  // Server Management Actions
  // -------------------------------------------------------------
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
      alert(`Action failed: ${e.message}`);
    }
  };

  const handleDeleteServer = async (serverId) => {
    if (!confirm('Are you sure you want to terminate this hosted server instance?')) return;
    try {
      await fetch(`/api/servers/${serverId}`, { method: 'DELETE' });
      fetchServers();
      if (selectedServer && selectedServer.id === serverId) {
        setSelectedServer(null);
      }
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  // -------------------------------------------------------------
  // Telegram Bot Simulator logic
  // -------------------------------------------------------------
  const handleSimSend = async (customText = null, callbackData = null) => {
    const textToSend = customText !== null ? customText : simInput.trim();
    if (!textToSend && !callbackData) return;
    if (customText === null && !callbackData) setSimInput('');

    if (textToSend) {
      setSimMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: textToSend }]);
    } else if (callbackData) {
      setSimMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: `[Action: ${callbackData}]` }]);
    }

    setSimLoading(true);
    try {
      const res = await fetch('/api/telegram/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSend,
          callback_data: callbackData,
          chatId: user ? user.id : 'web_guest',
          userName: user ? user.name : 'Apsara Guest'
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
    }
  };

  // -------------------------------------------------------------
  // DATA PRESETS MATCHING SCREENSHOTS EXACTLY
  // -------------------------------------------------------------
  
  // Page 2: Minecraft Plans (10 plans matching Image 2)
  const minecraftPlans = [
    { id: 'mc-family', name: 'Family Starter', price: '$1.25', ram: '1 GB', cpu: '1 vCPU', disk: '10 GB' },
    { id: 'mc-basic', name: 'Basic Starter', price: '$2.50', ram: '2 GB', cpu: '1 vCPU', disk: '20 GB' },
    { id: 'mc-standard', name: 'Standard Starter', price: '$3.75', ram: '3 GB', cpu: '1.5 vCPU', disk: '30 GB' },
    { id: 'mc-advanced', name: 'Advanced Starter', price: '$5.00', ram: '4 GB', cpu: '2 vCPU', disk: '40 GB' },
    { id: 'mc-advanced-plus', name: 'Advanced Plus Starter', price: '$7.50', ram: '6 GB', cpu: '3 vCPU', disk: '60 GB' },
    { id: 'mc-premium', name: 'Premium Starter', price: '$10.00', ram: '8 GB', cpu: '3.5 vCPU', disk: '80 GB' },
    { id: 'mc-ultimate', name: 'Ultimate Starter', price: '$13.00', ram: '10 GB', cpu: '4 vCPU', disk: '100 GB' },
    { id: 'mc-elite', name: 'Elite Starter', price: '$20.00', ram: '16 GB', cpu: '4 vCPU', disk: '160 GB' },
    { id: 'mc-super-elite', name: 'Super Elite Starter', price: '$30.00', ram: '24 GB', cpu: '4.5 vCPU', disk: '240 GB' },
    { id: 'mc-max', name: 'Max Starter', price: '$40.00', ram: '32 GB', cpu: '4.5 vCPU', disk: '320 GB' },
  ];

  // Page 3: Popular & More Games (matching Image 3)
  const popularGames = [
    { id: 'game-mc-java', name: 'Minecraft Java', startingPrice: '$1.25', icon: '⛏️', cover: 'https://images.unsplash.com/photo-1627856014754-2907e2355d54?w=500&auto=format&fit=crop&q=60' },
    { id: 'game-mc-bedrock', name: 'Minecraft Bedrock', startingPrice: '$1.25', icon: '🟩', cover: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&auto=format&fit=crop&q=60' },
    { id: 'game-fivem', name: 'Fivem', startingPrice: '$5.00', icon: '🚗', cover: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=500&auto=format&fit=crop&q=60' },
  ];

  const moreGames = [
    { id: 'game-hytale', name: 'Hytale', startingPrice: '$1.25', icon: '🛡️', cover: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=500&auto=format&fit=crop&q=60' },
    { id: 'game-samp', name: 'GTA: San Andreas Multiplayer', startingPrice: '$2.50', icon: '🌴', cover: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=500&auto=format&fit=crop&q=60' },
    { id: 'game-ark-se', name: 'Ark: Survival Evolved', startingPrice: '$7.50', icon: '🦖', cover: 'https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?w=500&auto=format&fit=crop&q=60' },
    { id: 'game-ark-sa', name: 'Ark: Survival Ascended', startingPrice: '$7.50', icon: '🌋', cover: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=500&auto=format&fit=crop&q=60' },
  ];

  // Page 4: Cloud / Generic Hosting Plans (9 plans matching Image 4)
  const cloudPlans = [
    { id: 'cloud-starter', name: 'Starter Plan', price: '$0.50', ram: '0.5 GB', cpu: '1 vCPU', disk: '5 GB' },
    { id: 'cloud-standard', name: 'Standard Plan', price: '$1.00', ram: '1 GB', cpu: '1 vCPU', disk: '10 GB' },
    { id: 'cloud-advanced', name: 'Advanced Plan', price: '$2.00', ram: '2 GB', cpu: '1 vCPU', disk: '20 GB' },
    { id: 'cloud-premium', name: 'Premium Plan', price: '$4.00', ram: '4 GB', cpu: '2 vCPU', disk: '40 GB' },
    { id: 'cloud-elite', name: 'Elite Plan', price: '$6.00', ram: '6 GB', cpu: '2 vCPU', disk: '60 GB' },
    { id: 'cloud-ultimate', name: 'Ultimate Plan', price: '$8.00', ram: '8 GB', cpu: '3 vCPU', disk: '80 GB' },
    { id: 'cloud-titan', name: 'Titan Plan', price: '$12.00', ram: '12 GB', cpu: '3 vCPU', disk: '120 GB' },
    { id: 'cloud-enterprise', name: 'Enterprise Plan', price: '$16.00', ram: '16 GB', cpu: '3.5 vCPU', disk: '160 GB' },
    { id: 'cloud-beast', name: 'Beast Plan', price: '$24.00', ram: '24 GB', cpu: '4 vCPU', disk: '240 GB' },
  ];

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      
      {/* ============================================================== */}
      {/* GLOBAL NAVBAR: APSARA HOSTING (MATCHES SCREENSHOT HEADER)      */}
      {/* ============================================================== */}
      <header className="border-b border-slate-800/80 bg-[#080c15]/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-8">
            <div
              onClick={() => setCurrentPage('home')}
              className="flex items-center gap-2.5 cursor-pointer group select-none"
            >
              {/* Geometric 'A' Logo matching screenshot */}
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center font-black text-emerald-400 group-hover:scale-105 transition">
                <span className="text-lg leading-none font-mono">/|</span>
              </div>
              <div>
                <span className="font-extrabold tracking-wide text-sm text-white flex items-center gap-1.5">
                  Apsara Hosting
                </span>
                <span className="block text-[9px] text-emerald-400 font-bold tracking-wider uppercase">
                  GAME HOSTING
                </span>
              </div>
            </div>

            {/* Navigation links matching screenshot */}
            <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
              <button
                onClick={() => setCurrentPage('home')}
                className={`transition ${currentPage === 'home' ? 'text-emerald-400' : 'hover:text-white'}`}
              >
                Hosting
              </button>
              <button
                onClick={() => setCurrentPage('tickets')}
                className={`transition ${currentPage === 'tickets' ? 'text-emerald-400' : 'hover:text-white'}`}
              >
                Tickets
              </button>
              <button
                onClick={() => setCurrentPage('hardware')}
                className={`transition ${currentPage === 'hardware' ? 'text-emerald-400' : 'hover:text-white'}`}
              >
                Hardware
              </button>
            </nav>
          </div>

          {/* Right Controls: Language, Cart, Dashboard, User */}
          <div className="flex items-center gap-3">
            {/* Language Selector matching screenshot */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>US</span>
              <span className="text-[10px] text-slate-500">▼</span>
            </div>

            {/* Shopping Cart Button */}
            <div
              onClick={() => {
                if (recentOrderSuccess) setRecentOrderSuccess(null);
                setCurrentPage('dashboard');
              }}
              className="relative p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer transition"
              title="Cart / Orders"
            >
              <ShoppingCart className="w-4 h-4" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </div>

            {/* Cyan Dashboard Button matching screenshot */}
            <button
              onClick={() => {
                if (!user) setShowAuthModal(true);
                else setCurrentPage('dashboard');
              }}
              className="px-4 py-2 bg-[#64e4b6] hover:bg-[#52d4a6] text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-teal-500/20 transition flex items-center gap-1.5"
            >
              Dashboard
            </button>

            {/* User Profile or Sign In */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-7 h-7 rounded-full bg-slate-800 border border-emerald-500/40"
                />
                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthMode('login');
                  setShowAuthModal(true);
                }}
                className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                Sign In
              </button>
            )}
          </div>

        </div>
      </header>

      {/* ============================================================== */}
      {/* MAIN CONTAINER BODY (PAGE ROUTER)                              */}
      {/* ============================================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* ------------------------------------------------------------ */}
        {/* PAGE 1: CHOOSE YOUR HOSTING TYPE (EXACT MATCH IMAGE 1)       */}
        {/* ------------------------------------------------------------ */}
        {currentPage === 'home' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            
            {/* Top Banner Box matching Image 1 */}
            <div className="rounded-2xl p-6 sm:p-8 bg-[#0b0f19] border border-slate-800/80 shadow-2xl relative overflow-hidden">
              <div className="relative z-10 space-y-2">
                <div className="inline-block px-3 py-1 rounded-md text-[11px] font-extrabold tracking-wider bg-slate-850 text-slate-300 uppercase">
                  GET STARTED
                </div>
                <p className="text-emerald-400 font-semibold text-sm sm:text-base">
                  Pick Minecraft, game, or cloud hosting to continue.
                </p>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                  Choose your hosting type
                </h1>
              </div>
            </div>

            {/* Subtitle & 3 Main Cards */}
            <div className="space-y-4">
              <p className="text-slate-400 text-xs sm:text-sm">
                Choose Minecraft, game, or cloud hosting to start your order.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. Minecraft Hosting (Green outline glow matching Image 1) */}
                <div
                  onClick={() => setCurrentPage('minecraft')}
                  className="rounded-2xl p-6 bg-[#0b101c] border-2 border-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.12)] flex flex-col justify-between group hover:-translate-y-1 transition duration-300 cursor-pointer"
                >
                  <div>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-3xl text-emerald-400 mb-5 shadow-lg shadow-emerald-500/10">
                      🟩
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Minecraft Hosting</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
                      Java or Bedrock — pick a plan, set your options, and order in minutes.
                    </p>
                  </div>
                  <div className="pt-4 border-t border-slate-800/80">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 group-hover:gap-2 transition-all">
                      Get started <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>

                {/* 2. Game Hosting (Blue outline glow matching Image 1) */}
                <div
                  onClick={() => setCurrentPage('games')}
                  className="rounded-2xl p-6 bg-[#0b101c] border-2 border-blue-500/80 shadow-[0_0_25px_rgba(59,130,246,0.12)] flex flex-col justify-between group hover:-translate-y-1 transition duration-300 cursor-pointer"
                >
                  <div>
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-500/40 flex items-center justify-center text-3xl text-blue-400 mb-5 shadow-lg shadow-blue-500/10">
                      🎮
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Game Hosting</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
                      FiveM, Hytale, Ark, GTA SA-MP, and more game servers.
                    </p>
                  </div>
                  <div className="pt-4 border-t border-slate-800/80">
                    <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5 group-hover:gap-2 transition-all">
                      Get started <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>

                {/* 3. Cloud Hosting (Cyan outline glow matching Image 1) */}
                <div
                  onClick={() => setCurrentPage('cloud')}
                  className="rounded-2xl p-6 bg-[#0b101c] border-2 border-cyan-500/80 shadow-[0_0_25px_rgba(6,182,212,0.12)] flex flex-col justify-between group hover:-translate-y-1 transition duration-300 cursor-pointer"
                >
                  <div>
                    <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-3xl text-cyan-400 mb-5 shadow-lg shadow-cyan-500/10">
                      🌐
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Cloud Hosting</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
                      Apps, APIs, Discord bots, and any custom backend stack.
                    </p>
                  </div>
                  <div className="pt-4 border-t border-slate-800/80">
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 group-hover:gap-2 transition-all">
                      Get started <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* Dedicated Bots & Quick Access highlight */}
            <div className="rounded-2xl p-6 bg-gradient-to-r from-[#0d1627] via-[#0b1220] to-[#0d1627] border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-2xl text-cyan-400">
                  🤖
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Host Telegram Bots &amp; Discord Bots</h3>
                  <p className="text-xs text-slate-400">Run Python, Node.js, and Java bots 24/7 with zero downtime and automatic crash recovery.</p>
                </div>
              </div>
              <button
                onClick={() => setCurrentPage('cloud')}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition whitespace-nowrap"
              >
                Configure Bot Stack →
              </button>
            </div>

          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* PAGE 2: MINECRAFT SERVER HOSTING (EXACT MATCH IMAGE 2)       */}
        {/* ------------------------------------------------------------ */}
        {currentPage === 'minecraft' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            
            {/* Top Banner Box matching Image 2 */}
            <div className="rounded-2xl p-6 sm:p-8 bg-[#0b0f19] border border-slate-800/80 shadow-2xl relative">
              <div className="space-y-2">
                <div className="inline-block px-3 py-1 rounded-md text-[11px] font-extrabold tracking-wider bg-slate-850 text-slate-300 uppercase">
                  GET STARTED
                </div>
                <p className="text-emerald-400 font-semibold text-sm">
                  Choose Java or Bedrock, pick a plan, configure your server, and place your order.
                </p>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                  Minecraft Server Hosting
                </h1>
              </div>
            </div>

            {/* Back link */}
            <button
              onClick={() => setCurrentPage('home')}
              className="text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1"
            >
              ← All hosting types
            </button>

            {/* Section 1: Choose your edition matching Image 2 */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Choose your edition</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Java Edition Card (Selected with green glow) */}
                <div
                  onClick={() => setMinecraftEdition('java')}
                  className={`rounded-2xl p-6 bg-[#0b101c] border-2 cursor-pointer transition ${
                    minecraftEdition === 'java'
                      ? 'border-emerald-500/90 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-2xl text-emerald-400 mb-4">
                    🟩
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                    MINECRAFT
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1 mb-2">Minecraft Hosting (Java)</h3>
                  <p className="text-slate-400 text-xs">
                    Mods, plugins, and full server control for PC players.
                  </p>
                </div>

                {/* Bedrock Edition Card */}
                <div
                  onClick={() => setMinecraftEdition('bedrock')}
                  className={`rounded-2xl p-6 bg-[#0b101c] border-2 cursor-pointer transition ${
                    minecraftEdition === 'bedrock'
                      ? 'border-emerald-500/90 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-2xl mb-4">
                    🧱
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                    MINECRAFT
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1 mb-2">Minecraft Bedorck</h3>
                  <p className="text-slate-400 text-xs">
                    Mobile, console, and Windows Bedrock cross-play.
                  </p>
                </div>

              </div>
            </div>

            {/* Section 2: Select your plan + Right Sidebar Order Box */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Plans Grid (2 Columns on large, matching Image 2) */}
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Select your plan</h2>
                  <p className="text-xs text-slate-400">Compare price, RAM, CPU, and storage — pick the plan that fits.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {minecraftPlans.map(plan => {
                    const isSelected = selectedMinecraftPlan?.id === plan.id;
                    return (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedMinecraftPlan(plan)}
                        className={`rounded-xl p-4 bg-[#0a0f1a] border cursor-pointer transition flex flex-col justify-between ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-950/20 shadow-md shadow-emerald-500/10'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-semibold text-slate-300 block">{plan.name}</span>
                          <span className="text-xl font-extrabold text-emerald-400 font-mono mt-1 block">
                            {plan.price}
                          </span>
                        </div>

                        <div className="pt-4 border-t border-slate-800/80 mt-4 space-y-1.5 text-[11px] font-mono text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">RAM:</span> <span className="text-slate-200 font-semibold">{plan.ram}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">CPU:</span> <span className="text-slate-200 font-semibold">{plan.cpu}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">DISK:</span> <span className="text-slate-200 font-semibold">{plan.disk}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Sidebar: YOUR ORDER box matching Image 2 */}
              <div className="lg:col-span-1">
                <div className="rounded-2xl p-6 bg-[#0a0f1a] border border-slate-800 sticky top-24 space-y-5">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase block">
                    YOUR ORDER
                  </span>

                  {selectedMinecraftPlan ? (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{selectedMinecraftPlan.name}</span>
                          <span className="text-xs font-bold text-emerald-400 font-mono">{selectedMinecraftPlan.price}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 block font-mono">
                          Edition: Minecraft {minecraftEdition === 'java' ? 'Java' : 'Bedrock'}
                        </span>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {selectedMinecraftPlan.ram} RAM • {selectedMinecraftPlan.cpu} • {selectedMinecraftPlan.disk}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between font-mono">
                        <span className="text-sm font-bold text-slate-300">Total</span>
                        <span className="text-xl font-extrabold text-emerald-400">{selectedMinecraftPlan.price}</span>
                      </div>

                      <button
                        onClick={() => handlePlaceOrder({
                          category: 'minecraft',
                          edition: `Minecraft ${minecraftEdition === 'java' ? 'Java' : 'Bedrock'}`,
                          plan: selectedMinecraftPlan
                        })}
                        className="w-full py-3 bg-[#428073] hover:bg-[#346b60] text-white font-bold text-xs rounded-xl shadow-lg transition"
                      >
                        Place order
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Select a plan to continue
                      </p>
                      <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300">Total</span>
                        <span className="text-slate-600 font-mono">—</span>
                      </div>
                      <button
                        disabled
                        className="w-full py-3 bg-[#428073]/40 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed"
                      >
                        Place order
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* PAGE 3: GAME SERVER HOSTING (EXACT MATCH IMAGE 3)            */}
        {/* ------------------------------------------------------------ */}
        {currentPage === 'games' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            
            {/* Top Banner Box matching Image 3 */}
            <div className="rounded-2xl p-6 sm:p-8 bg-[#0b0f19] border border-slate-800/80 shadow-2xl relative">
              <div className="space-y-2">
                <div className="inline-block px-3 py-1 rounded-md text-[11px] font-extrabold tracking-wider bg-slate-850 text-slate-300 uppercase">
                  GET STARTED
                </div>
                <p className="text-emerald-400 font-semibold text-sm">
                  Choose your game to see available plans.
                </p>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                  Game Server Hosting
                </h1>
              </div>
            </div>

            {/* Back link */}
            <button
              onClick={() => setCurrentPage('home')}
              className="text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1"
            >
              ← All hosting types
            </button>

            {/* Popular Games Section with Badge matching Image 3 */}
            <div className="rounded-2xl p-6 bg-[#090d16] border border-emerald-500/40 relative space-y-4">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-[#50d7a7] text-slate-950 shadow-md">
                  POPULAR GAMES
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                {popularGames.map(game => (
                  <div
                    key={game.id}
                    onClick={() => {
                      if (game.id.includes('mc')) setCurrentPage('minecraft');
                      else {
                        setSelectedGame(game);
                        setSelectedGamePlan(minecraftPlans[1]); // default $2.50 or $5.00
                      }
                    }}
                    className="rounded-2xl overflow-hidden bg-[#0c111e] border border-slate-800 hover:border-emerald-500/80 group cursor-pointer transition shadow-xl"
                  >
                    <div className="h-44 w-full overflow-hidden relative">
                      <img
                        src={game.cover}
                        alt={game.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0c111e] via-transparent to-transparent" />
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-white text-base">{game.name}</h3>
                      <span className="text-xs text-slate-400 mt-1 block">
                        Starting from <strong className="text-emerald-400 font-mono">{game.startingPrice}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* More Games Section matching Image 3 */}
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                MORE GAMES
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                {moreGames.map(game => (
                  <div
                    key={game.id}
                    onClick={() => {
                      setSelectedGame(game);
                      setSelectedGamePlan(minecraftPlans[2]);
                    }}
                    className="rounded-2xl overflow-hidden bg-[#0c111e] border border-slate-800 hover:border-blue-500/80 group cursor-pointer transition shadow-xl"
                  >
                    <div className="h-36 w-full overflow-hidden relative">
                      <img
                        src={game.cover}
                        alt={game.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0c111e] via-transparent to-transparent" />
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-white text-sm truncate">{game.name}</h3>
                      <span className="text-xs text-slate-400 mt-1 block">
                        Starting from <strong className="text-emerald-400 font-mono">{game.startingPrice}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Confirmation Drawer if game is selected */}
            {selectedGame && (
              <div className="rounded-2xl p-6 bg-[#0a0f1a] border border-emerald-500/60 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-white">Deploy {selectedGame.name} Server</h3>
                  <button onClick={() => setSelectedGame(null)} className="text-xs text-slate-400 hover:text-white">✕ Close</button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 text-xs">
                    <span className="text-slate-300 font-semibold block">Configured Spec:</span>
                    <span className="text-emerald-400 font-mono">{selectedGamePlan?.ram || '2 GB'} RAM • {selectedGamePlan?.cpu || '1 vCPU'} • {selectedGamePlan?.disk || '20 GB'}</span>
                  </div>
                  <button
                    onClick={() => handlePlaceOrder({
                      category: 'game',
                      edition: selectedGame.name,
                      plan: selectedGamePlan || { name: 'Standard Game Plan', price: selectedGame.startingPrice, ram: '2 GB', cpu: '1 vCPU', disk: '20 GB' }
                    })}
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition"
                  >
                    Place order ({selectedGame.startingPrice}) →
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* PAGE 4: CLOUD HOSTING & BOT RUNTIME (EXACT MATCH IMAGE 4)    */}
        {/* ------------------------------------------------------------ */}
        {currentPage === 'cloud' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            
            {/* Top Banner Box matching Image 4 */}
            <div className="rounded-2xl p-6 sm:p-8 bg-[#0b0f19] border border-slate-800/80 shadow-2xl relative">
              <div className="space-y-2">
                <div className="inline-block px-3 py-1 rounded-md text-[11px] font-extrabold tracking-wider bg-slate-850 text-slate-300 uppercase">
                  PRODUCTS
                </div>
                <p className="text-emerald-400 font-semibold text-xs sm:text-sm max-w-4xl">
                  With our 42 hours Money Back Guarantee, You Can't Go Wrong! Experience high-quality Any Web Framework, Backend, Discord Bot, Hosting with no risk. Get started today!
                </p>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white pt-1">
                  Generic Hosting
                </h1>
              </div>
            </div>

            {/* Back link */}
            <button
              onClick={() => setCurrentPage('home')}
              className="text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1"
            >
              ← All hosting types
            </button>

            {/* SPECIAL USER REQUEST: CODE STACK SELECTOR FOR TELEGRAM & DISCORD BOTS */}
            <div className="rounded-2xl p-6 bg-[#0a0f1b] border border-cyan-500/40 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Bot className="w-5 h-5 text-cyan-400" /> Select Application / Bot Type to Run
                  </h3>
                  <p className="text-xs text-slate-400">Choose what you want to host: Telegram bot, Discord bot, or Web Backend.</p>
                </div>
                <span className="text-[11px] font-mono text-cyan-400 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30">
                  24/7 Background Runner
                </span>
              </div>

              {/* Step 1: Application Category Tabs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => {
                    setCloudCategory('telegram');
                    setCloudRuntime('python');
                  }}
                  className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
                    cloudCategory === 'telegram'
                      ? 'border-cyan-500 bg-cyan-950/20 text-white'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-2xl">🤖</span>
                  <div>
                    <strong className="block text-xs font-bold text-white">Telegram Bot</strong>
                    <span className="text-[10px] text-slate-400">Long-polling &amp; Webhooks</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setCloudCategory('discord');
                    setCloudRuntime('node');
                  }}
                  className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
                    cloudCategory === 'discord'
                      ? 'border-purple-500 bg-purple-950/20 text-white'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-2xl">👾</span>
                  <div>
                    <strong className="block text-xs font-bold text-white">Discord Bot</strong>
                    <span className="text-[10px] text-slate-400">Gateway WebSocket</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setCloudCategory('web');
                    setCloudRuntime('node');
                  }}
                  className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
                    cloudCategory === 'web'
                      ? 'border-emerald-500 bg-emerald-950/20 text-white'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-2xl">🌐</span>
                  <div>
                    <strong className="block text-xs font-bold text-white">Web API &amp; Backend</strong>
                    <span className="text-[10px] text-slate-400">REST APIs &amp; Microservices</span>
                  </div>
                </button>
              </div>

              {/* Step 2: Language / Code Runtime Selector */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-semibold text-slate-300 block">
                  Select Code Language / Runtime:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCloudRuntime('python')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      cloudRuntime === 'python'
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>🐍</span> Python (aiogram / telebot / fastapi)
                  </button>

                  <button
                    onClick={() => setCloudRuntime('node')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      cloudRuntime === 'node'
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>🟢</span> Node.js (Telegraf / discord.js / express)
                  </button>

                  <button
                    onClick={() => setCloudRuntime('java')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      cloudRuntime === 'java'
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>☕</span> Java (JDA / telegram-bot-api / spring)
                  </button>

                  <button
                    onClick={() => setCloudRuntime('custom')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      cloudRuntime === 'custom'
                        ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                        : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>🐳</span> Custom Docker / Any Stack
                  </button>
                </div>
              </div>
            </div>

            {/* Plans Grid + Sticky Order Sidebar matching Image 4 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Plans Grid (9 plans matching Image 4) */}
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Select your plan</h2>
                  <p className="text-xs text-slate-400">Compare price, RAM, CPU, and storage — pick the plan that fits.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {cloudPlans.map(plan => {
                    const isSelected = selectedCloudPlan?.id === plan.id;
                    return (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedCloudPlan(plan)}
                        className={`rounded-xl p-4 bg-[#0a0f1a] border cursor-pointer transition flex flex-col justify-between ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-950/20 shadow-md shadow-emerald-500/10'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-semibold text-slate-300 block">{plan.name}</span>
                          <span className="text-xl font-extrabold text-emerald-400 font-mono mt-1 block">
                            {plan.price}
                          </span>
                        </div>

                        <div className="pt-4 border-t border-slate-800/80 mt-4 space-y-1.5 text-[11px] font-mono text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">RAM:</span> <span className="text-slate-200 font-semibold">{plan.ram}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">CPU:</span> <span className="text-slate-200 font-semibold">{plan.cpu}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">DISK:</span> <span className="text-slate-200 font-semibold">{plan.disk}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Sidebar: YOUR ORDER box matching Image 4 */}
              <div className="lg:col-span-1">
                <div className="rounded-2xl p-6 bg-[#0a0f1a] border border-slate-800 sticky top-24 space-y-5">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase block">
                    YOUR ORDER
                  </span>

                  {selectedCloudPlan ? (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{selectedCloudPlan.name}</span>
                          <span className="text-xs font-bold text-emerald-400 font-mono">{selectedCloudPlan.price}</span>
                        </div>
                        <span className="text-[11px] text-cyan-400 block font-mono">
                          Runtime: {cloudCategory.toUpperCase()} • {cloudRuntime.toUpperCase()}
                        </span>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {selectedCloudPlan.ram} RAM • {selectedCloudPlan.cpu} • {selectedCloudPlan.disk}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between font-mono">
                        <span className="text-sm font-bold text-slate-300">Total</span>
                        <span className="text-xl font-extrabold text-emerald-400">{selectedCloudPlan.price}</span>
                      </div>

                      <button
                        onClick={() => handlePlaceOrder({
                          category: cloudCategory,
                          edition: `${cloudCategory.toUpperCase()} (${cloudRuntime})`,
                          plan: selectedCloudPlan,
                          runtime: cloudRuntime === 'python' ? 'python' : 'node'
                        })}
                        className="w-full py-3 bg-[#428073] hover:bg-[#346b60] text-white font-bold text-xs rounded-xl shadow-lg transition"
                      >
                        Place order
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Select a plan to continue
                      </p>
                      <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300">Total</span>
                        <span className="text-slate-600 font-mono">—</span>
                      </div>
                      <button
                        disabled
                        className="w-full py-3 bg-[#428073]/40 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed"
                      >
                        Place order
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* DASHBOARD: MY SERVERS, CONSOLE TERMINAL & TELEGRAM CONTROLLER */}
        {/* ------------------------------------------------------------ */}
        {currentPage === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h1 className="text-2xl font-bold text-white">Client Management Dashboard</h1>
                <p className="text-xs text-slate-400 mt-1">Manage your active hosted bots, game servers, live terminal consoles, and Telegram bot controller.</p>
              </div>

              {/* Navigation tabs */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDashboardTab('servers')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    dashboardTab === 'servers' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  Active Servers ({servers.length})
                </button>
                <button
                  onClick={() => setDashboardTab('telegram')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                    dashboardTab === 'telegram' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" /> Telegram Controller
                </button>
              </div>
            </div>

            {/* TAB: SERVERS LIST */}
            {dashboardTab === 'servers' && (
              <div className="space-y-6">
                {servers.length === 0 ? (
                  <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl bg-slate-900/40 space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-3xl">
                      🚀
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">No active servers yet</h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        Choose a hosting plan from Minecraft, Game Hosting, or Cloud Hosting to launch your server.
                      </p>
                    </div>
                    <button
                      onClick={() => setCurrentPage('home')}
                      className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition"
                    >
                      Browse Hosting Plans →
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {servers.map(server => {
                      const isRunning = server.status === 'running';
                      return (
                        <div
                          key={server.id}
                          className="rounded-2xl p-5 bg-[#0b0f1a] border border-slate-800 flex flex-col justify-between shadow-xl"
                        >
                          <div>
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="font-bold text-white text-base leading-tight">{server.name}</h3>
                                <span className="text-[11px] font-mono text-slate-500">{server.id.slice(0, 8)} • {server.runtime}</span>
                              </div>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                                isRunning ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-slate-400 bg-slate-500/10 border-slate-500/30'
                              }`}>
                                {server.status.toUpperCase()}
                              </span>
                            </div>

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
                                <span className="text-slate-200 font-bold">{server.stats?.uptime || 0}s</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                            <button
                              onClick={() => {
                                setSelectedServer(server);
                                setDashboardTab('console');
                              }}
                              className="text-xs font-bold text-emerald-400 hover:text-emerald-300"
                            >
                              Open Console →
                            </button>
                            <div className="flex items-center gap-1.5">
                              {isRunning ? (
                                <>
                                  <button
                                    onClick={() => handleServerAction(server.id, 'restart')}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                                    title="Restart"
                                  >
                                    <RotateCw className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleServerAction(server.id, 'stop')}
                                    className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                                    title="Stop"
                                  >
                                    <Square className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleServerAction(server.id, 'start')}
                                  className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                  title="Start"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteServer(server.id)}
                                className="p-1.5 rounded-lg bg-slate-800/60 hover:text-rose-400 text-slate-500"
                                title="Delete"
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

            {/* TAB: LIVE CONSOLE TERMINAL */}
            {dashboardTab === 'console' && selectedServer && (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setDashboardTab('servers')}
                      className="text-xs font-bold text-slate-400 hover:text-white"
                    >
                      ← Back
                    </button>
                    <span className="text-slate-700">|</span>
                    <h3 className="font-bold text-white text-sm">{selectedServer.name}</h3>
                    <span className="text-xs font-mono text-emerald-400 font-semibold">{selectedServer.status.toUpperCase()}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedServer.status === 'running' ? (
                      <button
                        onClick={() => handleServerAction(selectedServer.id, 'stop')}
                        className="px-3 py-1 bg-rose-500 text-white font-bold text-xs rounded-lg"
                      >
                        Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => handleServerAction(selectedServer.id, 'start')}
                        className="px-3 py-1 bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg"
                      >
                        Start
                      </button>
                    )}
                    <button
                      onClick={() => handleServerAction(selectedServer.id, 'restart')}
                      className="px-3 py-1 bg-slate-800 text-slate-200 font-bold text-xs rounded-lg"
                    >
                      Restart
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#07090e] overflow-hidden shadow-2xl">
                  <div
                    ref={terminalRef}
                    className="h-96 p-4 overflow-y-auto space-y-1 font-mono text-xs leading-relaxed"
                  >
                    {terminalLogs.map((log, index) => {
                      const text = typeof log === 'string' ? log : log.text;
                      const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '';
                      const isError = text.includes('[ERROR]') || text.includes('[STDERR]') || text.includes('FAILED');
                      const isOnline = text.includes('[ONLINE]') || text.includes('listening');

                      return (
                        <div key={index} className="py-0.5 break-all">
                          {timeStr && <span className="text-slate-600 mr-2">[{timeStr}]</span>}
                          <span className={isError ? 'text-rose-400' : (isOnline ? 'text-emerald-400 font-semibold' : 'text-slate-300')}>
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
                      placeholder="Send stdin command to process..."
                      className="flex-1 bg-transparent border-none text-xs font-mono text-slate-200 outline-none placeholder:text-slate-600"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg"
                    >
                      Send
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* TAB: TELEGRAM CONTROLLER & SIMULATOR */}
            {dashboardTab === 'telegram' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Connect Real Token */}
                <div className="rounded-2xl p-6 bg-[#0a0f1b] border border-slate-800 space-y-4">
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <Bot className="w-5 h-5 text-cyan-400" /> Telegram Remote Controller
                  </h3>
                  <p className="text-xs text-slate-400">
                    Control and restart your servers straight from Telegram on your phone! Get a bot token from <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-semibold">@BotFather</a>.
                  </p>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300 block">Telegram Bot Token</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={tgToken}
                        onChange={(e) => setTgToken(e.target.value)}
                        placeholder="7123456789:AAFg84..."
                        className="flex-1 bg-slate-900 border border-slate-750 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 outline-none"
                      />
                      <button
                        onClick={async () => {
                          const res = await fetch('/api/telegram/config', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token: tgToken.trim() })
                          });
                          const data = await res.json();
                          alert(data.message || 'Updated token');
                          fetchTgStatus();
                        }}
                        className="px-4 py-2 bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl"
                      >
                        Connect
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs space-y-1.5 text-slate-400">
                    <strong className="text-slate-300 block mb-1">Bot Commands:</strong>
                    <div><span className="text-cyan-400">/start</span> - Main Menu</div>
                    <div><span className="text-cyan-400">/servers</span> - List &amp; Restart instances</div>
                    <div><span className="text-cyan-400">/deploy</span> - 1-Click deploy wizard</div>
                    <div><span className="text-cyan-400">/sys</span> - CPU &amp; RAM health</div>
                  </div>
                </div>

                {/* Interactive Telegram Phone Simulator */}
                <div className="rounded-2xl border border-slate-800 bg-[#090d16] overflow-hidden flex flex-col h-[480px] shadow-2xl">
                  <div className="px-4 py-3 bg-[#0d1320] border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-sm font-bold text-cyan-400">
                        🤖
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Apsara Bot Simulator</h4>
                        <span className="text-[10px] text-emerald-400 font-mono">Live Sandbox Playground</span>
                      </div>
                    </div>
                    <button onClick={() => handleSimSend('/start')} className="text-[11px] text-cyan-400 hover:underline">
                      Reset
                    </button>
                  </div>

                  <div ref={simChatRef} className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs">
                    {simMessages.map(m => (
                      <div key={m.id} className={`flex flex-col ${m.sender === 'bot' ? 'items-start' : 'items-end'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-3 leading-relaxed ${
                          m.sender === 'bot' ? 'bg-[#141b2a] border border-slate-800 text-slate-200' : 'bg-emerald-600 text-slate-950 font-medium'
                        }`}>
                          <div className="whitespace-pre-line">{m.text}</div>
                        </div>

                        {m.sender === 'bot' && m.reply_markup?.inline_keyboard && (
                          <div className="mt-2 space-y-1 w-[85%]">
                            {m.reply_markup.inline_keyboard.map((row, rIdx) => (
                              <div key={rIdx} className="flex gap-1.5 flex-wrap">
                                {row.map((btn, bIdx) => (
                                  <button
                                    key={bIdx}
                                    onClick={() => handleSimSend(null, btn.callback_data)}
                                    className="flex-1 px-3 py-1.5 bg-[#1b253b] hover:bg-cyan-600/30 text-cyan-300 hover:text-white rounded-lg border border-cyan-500/20 text-[11px] font-semibold transition"
                                  >
                                    {btn.text}
                                  </button>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {simLoading && <div className="text-slate-500 text-xs italic">Bot typing...</div>}
                  </div>

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
                      placeholder="Type /start, /plans, or /servers..."
                      className="flex-1 bg-slate-900 border border-slate-750 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none"
                    />
                    <button type="submit" className="p-2 bg-cyan-500 text-slate-950 rounded-xl font-bold">
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>

              </div>
            )}

          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* TICKETS PAGE                                                 */}
        {/* ------------------------------------------------------------ */}
        {currentPage === 'tickets' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h1 className="text-2xl font-bold text-white">Support Tickets</h1>
                <p className="text-xs text-slate-400 mt-1">24/7 technical support from our engineering team in Phnom Penh.</p>
              </div>
            </div>

            {/* Create Ticket Form */}
            <div className="rounded-2xl p-6 bg-[#0a0f1b] border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white">Open a Support Ticket</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTicketSubject}
                  onChange={(e) => setNewTicketSubject(e.target.value)}
                  placeholder="Describe your issue or request..."
                  className="flex-1 bg-slate-900 border border-slate-750 rounded-xl px-4 py-2 text-xs text-slate-200 outline-none"
                />
                <button
                  onClick={() => {
                    if (!newTicketSubject.trim()) return;
                    setTickets(prev => [
                      { id: `TICK-${Date.now().toString().slice(-3)}`, subject: newTicketSubject.trim(), status: 'Open', priority: 'Normal', date: new Date().toLocaleDateString() },
                      ...prev
                    ]);
                    setNewTicketSubject('');
                    alert('Support ticket created! An engineer will reply shortly.');
                  }}
                  className="px-5 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl"
                >
                  Submit
                </button>
              </div>
            </div>

            {/* Ticket List */}
            <div className="rounded-2xl bg-[#0a0f1b] border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
              {tickets.map(t => (
                <div key={t.id} className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono text-emerald-400 font-bold mr-2">{t.id}</span>
                    <strong className="text-white">{t.subject}</strong>
                    <span className="text-[11px] text-slate-500 block mt-0.5">{t.date} • Priority: {t.priority}</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    t.status === 'Open' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* HARDWARE PAGE                                                */}
        {/* ------------------------------------------------------------ */}
        {currentPage === 'hardware' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
            <div className="pb-4 border-b border-slate-800">
              <h1 className="text-2xl font-bold text-white">Hardware &amp; Infrastructure</h1>
              <p className="text-xs text-slate-400 mt-1">Enterprise-grade servers, low latency fiber network, and high tick-rate performance.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-2xl p-6 bg-[#0a0f1b] border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-emerald-400 font-mono uppercase">Compute Nodes</span>
                <h3 className="text-lg font-bold text-white">AMD Ryzen 9 &amp; Intel Xeon E-2388G</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  High clock speed up to 5.4 GHz ensuring zero tick drops in Minecraft and instant response times for Telegram and Discord bot webhooks.
                </p>
              </div>

              <div className="rounded-2xl p-6 bg-[#0a0f1b] border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-cyan-400 font-mono uppercase">Storage &amp; Network</span>
                <h3 className="text-lg font-bold text-white">Gen4 NVMe SSDs • 10 Gbps Uplink</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Blazing-fast read/write operations with automated DDoS mitigation up to 1.2 Tbps protecting against multi-vector floods.
                </p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ============================================================== */}
      {/* ORDER SUCCESS MODAL                                            */}
      {/* ============================================================== */}
      {recentOrderSuccess && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b101c] border border-emerald-500/80 rounded-2xl w-full max-w-md p-6 space-y-5 text-center animate-in zoom-in-95 duration-200 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto text-3xl">
              ✓
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Order Confirmed!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Your server has been automatically provisioned on Apsara Hosting Cloud.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-left font-mono text-xs space-y-1.5">
              <div><span className="text-slate-500">Instance:</span> <span className="text-white font-bold">{recentOrderSuccess.server?.name}</span></div>
              <div><span className="text-slate-500">Plan:</span> <span className="text-emerald-400 font-bold">{recentOrderSuccess.order?.planName}</span></div>
              <div><span className="text-slate-500">Status:</span> <span className="text-emerald-400">🟢 ONLINE &amp; RUNNING</span></div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedServer(recentOrderSuccess.server);
                  setRecentOrderSuccess(null);
                  setCurrentPage('dashboard');
                  setDashboardTab('console');
                }}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition"
              >
                Open Live Console →
              </button>
              <button
                onClick={() => setRecentOrderSuccess(null)}
                className="px-4 py-2.5 bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl hover:text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* AUTH MODAL: GOOGLE / GMAIL LOGIN & VERIFY CODE                 */}
      {/* ============================================================== */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b101c] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">/|</span>
                <span className="font-bold text-sm text-white">Apsara Hosting Account</span>
              </div>
              <button onClick={() => setShowAuthModal(false)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            <div className="p-6 space-y-5">
              
              {/* Google 1-Click Login Button */}
              <button
                onClick={handleGoogleLogin}
                disabled={authLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs transition flex items-center justify-center gap-2 shadow"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Continue with Google Gmail
              </button>

              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">or email &amp; password</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              {/* Toast info if code sent */}
              {authToast && (
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-xs font-mono">
                  {authToast}
                </div>
              )}

              {/* Mode 1: Login Form */}
              {authMode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 block">Gmail / Email</label>
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="name@gmail.com"
                      required
                      className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 block">Password</label>
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition"
                  >
                    {authLoading ? 'Signing in...' : 'Sign In'}
                  </button>

                  <div className="pt-2 text-center text-xs text-slate-400">
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('register')}
                      className="text-emerald-400 font-bold hover:underline"
                    >
                      Create an account
                    </button>
                  </div>
                </form>
              )}

              {/* Mode 2: Register Form (triggers Gmail verification code) */}
              {authMode === 'register' && (
                <form onSubmit={handleSendVerificationCode} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 block">Full Name</label>
                    <input
                      type="text"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="Sophea Chea"
                      className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 block">Gmail Address</label>
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="yourname@gmail.com"
                      required
                      className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 block">Password</label>
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-1.5"
                  >
                    <Mail className="w-4 h-4" />
                    {authLoading ? 'Sending code...' : 'Send Verification Code to Gmail'}
                  </button>

                  <div className="pt-2 text-center text-xs text-slate-400">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className="text-emerald-400 font-bold hover:underline"
                    >
                      Sign In
                    </button>
                  </div>
                </form>
              )}

              {/* Mode 3: 6-Digit Code Verification Screen */}
              {authMode === 'verify' && (
                <form onSubmit={handleVerifyAndRegister} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 block">Enter 6-Digit Verification Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value)}
                      placeholder="123456"
                      required
                      className="w-full bg-slate-900 border border-slate-750 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-widest text-emerald-400 outline-none focus:border-emerald-500"
                    />
                    <p className="text-[11px] text-slate-400 text-center pt-1">
                      Check your Gmail inbox ({authEmail}) for the 6-digit confirmation code.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {authLoading ? 'Verifying...' : 'Verify &amp; Create Account'}
                  </button>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                    <button
                      type="button"
                      onClick={() => setAuthMode('register')}
                      className="text-slate-400 hover:text-white"
                    >
                      ← Change Email
                    </button>
                    <button
                      type="button"
                      onClick={handleSendVerificationCode}
                      className="text-cyan-400 hover:underline"
                    >
                      Resend Code
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* GLOBAL FOOTER: APSARA HOSTING (MATCHES SCREENSHOT EXACTLY)     */}
      {/* ============================================================== */}
      <footer className="border-t border-slate-800/80 bg-[#080c14] mt-16 pt-12 pb-8 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            
            {/* Column 1: Apsara Hosting Brand & Cambodia Location */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-xs font-mono font-bold text-emerald-400">
                  /|
                </div>
                <span className="font-extrabold text-sm text-white">Apsara Hosting</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-xs max-w-sm">
                The cheapest and most reliable hosting provider. Specializing in game servers with 24/7 support starting from $0.50/month.
              </p>
              
              <div className="space-y-1 text-xs pt-1 text-slate-400">
                <div className="flex items-center gap-2">
                  <span>📍</span> <span>Phnom Penh, Cambodia</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>✉️</span> <a href="mailto:support@apsarahosting.com" className="hover:text-emerald-400">Contact Support</a>
                </div>
              </div>

              {/* Follow Us Social Icons matching Image 1 */}
              <div className="pt-2 space-y-2">
                <span className="text-[11px] font-bold text-slate-300 block">Follow Us</span>
                <div className="flex items-center gap-2">
                  <a href="https://discord.gg" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center hover:text-white transition">
                    👾
                  </a>
                  <a href="https://t.me" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center hover:text-white transition">
                    ✈️
                  </a>
                  <a href="https://facebook.com" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center hover:text-white transition">
                    📘
                  </a>
                  <a href="https://youtube.com" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center hover:text-white transition">
                    ▶️
                  </a>
                  <a href="https://tiktok.com" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center hover:text-white transition">
                    🎵
                  </a>
                </div>
              </div>
            </div>

            {/* Column 2: Products matching Image 1 */}
            <div className="space-y-2.5">
              <span className="font-bold text-white block">Products</span>
              <ul className="space-y-2">
                <li><button onClick={() => { setMinecraftEdition('java'); setCurrentPage('minecraft'); }} className="hover:text-emerald-400">Minecraft Hosting (Java)</button></li>
                <li><button onClick={() => { setMinecraftEdition('bedrock'); setCurrentPage('minecraft'); }} className="hover:text-emerald-400">Minecraft Bedorck</button></li>
                <li><button onClick={() => setCurrentPage('games')} className="hover:text-emerald-400">Hytale</button></li>
                <li><button onClick={() => setCurrentPage('games')} className="hover:text-emerald-400">Fivem Hosting</button></li>
                <li><button onClick={() => setCurrentPage('games')} className="hover:text-emerald-400">GTA: San Andreas Multiplayer</button></li>
              </ul>
            </div>

            {/* Column 3: Support matching Image 1 */}
            <div className="space-y-2.5">
              <span className="font-bold text-white block">Support</span>
              <ul className="space-y-2">
                <li><button onClick={() => setCurrentPage('tickets')} className="hover:text-emerald-400">Support Tickets</button></li>
                <li><button onClick={() => setCurrentPage('tickets')} className="hover:text-emerald-400">Create Ticket</button></li>
              </ul>
            </div>

            {/* Column 4: Company matching Image 1 */}
            <div className="space-y-2.5">
              <span className="font-bold text-white block">Company</span>
              <ul className="space-y-2">
                <li><button onClick={() => setCurrentPage('home')} className="hover:text-emerald-400">Home</button></li>
                <li><a href="#" className="hover:text-emerald-400">Terms of Service</a></li>
                <li><a href="#" className="hover:text-emerald-400">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-emerald-400">Fair Usage Policy</a></li>
              </ul>
            </div>

          </div>

          {/* Bottom Copyright bar matching Image 1 */}
          <div className="pt-6 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-500 text-[11px]">
            <div>© 2026 Apsara Hosting. All rights reserved.</div>
            <div className="flex gap-4">
              <a href="#" className="hover:underline">Terms</a>
              <span>•</span>
              <a href="#" className="hover:underline">Privacy</a>
              <span>•</span>
              <a href="#" className="hover:underline">Fair Use</a>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}

/**
 * global.js - Global Cyber Quant Framework
 * Handles HUD injection, live telemetry (PST Clock & Ping), 
 * and Canvas Performance Throttling for Xiaoxian Wang's portfolio.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Add background grid overlay & scanline if not present
  if (!document.querySelector('.cyber-grid-bg')) {
    const grid = document.createElement('div');
    grid.className = 'cyber-grid-bg';
    document.body.prepend(grid);
  }
  if (!document.querySelector('.scanline')) {
    const line = document.createElement('div');
    line.className = 'scanline';
    document.body.prepend(line);
  }

  // 2. Inject Uniform High-Tech HUD Header
  injectHUDHeader();

  // 3. Initialize Live Telemetry (Clock & Ping)
  initTelemetry();
});

/**
 * Injects a futuristic, responsive WorldQuant-inspired HUD header at the top of the body.
 */
function injectHUDHeader() {
  const currentPath = window.location.pathname;
  const pageName = currentPath.substring(currentPath.lastIndexOf('/') + 1) || 'index.html';

  const header = document.createElement('header');
  header.className = 'hud-nav';
  
  // Calculate active states
  const isActive = (target) => pageName.includes(target) ? 'active' : '';
  const isHomeActive = (pageName === 'index.html' || pageName === '') ? 'active' : '';

  header.innerHTML = `
    <nav class="container mx-auto flex flex-col md:flex-row justify-between items-center py-3 px-6 gap-4">
      <div class="flex items-center gap-4">
        <a href="index.html" class="text-2xl font-bold flex items-center gap-2 group transition-colors">
          <span class="hud-nav-logo font-black">[XW]</span>
          <span class="hidden sm:inline text-[9px] font-mono text-cyan-400/60 border border-cyan-400/20 px-1.5 py-0.5 rounded tracking-widest uppercase">SYS: ACTIVE</span>
        </a>
      </div>
      
      <ul class="flex items-center space-x-1 sm:space-x-4">
        <li><a href="index.html" class="hud-nav-item ${isHomeActive}">HOME</a></li>
        <li><a href="about.html" class="hud-nav-item ${isActive('about')}">ABOUT</a></li>
        <li><a href="projects.html" class="hud-nav-item ${isActive('projects')}">PROJECTS</a></li>
        <li><a href="investment.html" class="hud-nav-item ${isActive('investment')}">INVESTMENT</a></li>
        <li><a href="contact.html" class="hud-nav-item ${isActive('contact')}">CONTACT</a></li>
      </ul>

      <div class="hud-telemetry hidden lg:flex items-center gap-6 border-l border-white/10 pl-6">
        <div class="telemetry-item">
          <span class="text-gray-600">LOC // </span>
          <span class="telemetry-val text-white uppercase tracking-wider font-semibold">YVR_PST</span>
        </div>
        <div class="telemetry-item">
          <span class="text-gray-600">TIME // </span>
          <span id="pst-clock" class="telemetry-val text-white">00:00:00 PST</span>
        </div>
        <div class="telemetry-item">
          <span class="telemetry-dot pinging"></span>
          <span class="text-gray-600">PING // </span>
          <span id="ping-val" class="telemetry-val font-bold text-green-400">18ms</span>
        </div>
      </div>
    </nav>
  `;

  // Inject header as first element in body
  const existingHeader = document.querySelector('header');
  if (existingHeader) {
    existingHeader.replaceWith(header);
  } else {
    document.body.prepend(header);
  }
}

/**
 * Starts the live Vancouver local clock and HFT network ping telemetry modules.
 */
function initTelemetry() {
  const clockEl = document.getElementById('pst-clock');
  const pingEl = document.getElementById('ping-val');
  const pingDot = document.querySelector('.telemetry-dot');

  // Time formatter for PST (Vancouver)
  const formatPST = () => {
    const options = {
      timeZone: 'America/Vancouver',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    try {
      const formatter = new Intl.DateTimeFormat('en-US', options);
      return formatter.format(new Date()) + ' PST';
    } catch (e) {
      // Fallback
      const d = new Date();
      return d.toTimeString().split(' ')[0] + ' LCL';
    }
  };

  // Clock Update Interval
  if (clockEl) {
    clockEl.textContent = formatPST();
    setInterval(() => {
      clockEl.textContent = formatPST();
    }, 1000);
  }

  // Realistic HFT Network Ping simulator
  if (pingEl) {
    let lastPing = 18;
    setInterval(() => {
      // Simulate typical low-latency jitter
      const diff = (Math.random() - 0.5) * 4;
      let currentPing = Math.round(lastPing + diff);
      
      // Clamp between 10ms and 35ms for standard HFT simulator vibe
      currentPing = Math.max(10, Math.min(35, currentPing));
      lastPing = currentPing;
      
      pingEl.textContent = `${currentPing}ms`;

      // Visual ping flash
      if (pingDot) {
        pingDot.style.background = '#10b981';
        pingDot.style.boxShadow = '0 0 8px #10b981';
        setTimeout(() => {
          pingDot.style.boxShadow = 'none';
        }, 150);
      }
    }, 2000 + Math.random() * 2000);
  }
}

/**
 * High-DPI Canvas context scaling helper.
 * Adjusts logical dimensions to match physical pixels, solving blurry canvas rendering.
 */
window.scaleCanvasForDPI = function(canvas, ctx, width, height) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5); // Cap to 2.5 for performance
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return dpr;
};

/**
 * Universal Canvas Manager with Visibility Throttling
 * Prevents animation ticks from firing when the window/tab is in the background,
 * reducing CPU usage to absolute zero.
 */
window.CanvasRegistry = {
  activeCanvases: new Map(),

  register(id, initFn, drawFrameFn, resizeFn) {
    const entry = {
      init: initFn,
      draw: drawFrameFn,
      resize: resizeFn,
      running: true,
      rafId: null
    };
    this.activeCanvases.set(id, entry);
    
    // Initial resize & startup
    if (resizeFn) resizeFn();
    if (initFn) initFn();
    this.start(id);
    
    return entry;
  },

  start(id) {
    const entry = this.activeCanvases.get(id);
    if (!entry || !entry.running) return;

    let lastTime = performance.now();
    const tick = (timestamp) => {
      if (!entry.running) return;
      
      const elapsed = timestamp - lastTime;
      // Force frame ticks
      entry.draw(timestamp, elapsed);
      lastTime = timestamp;
      entry.rafId = requestAnimationFrame(tick);
    };
    entry.rafId = requestAnimationFrame(tick);
  },

  stop(id) {
    const entry = this.activeCanvases.get(id);
    if (entry) {
      entry.running = false;
      if (entry.rafId) cancelAnimationFrame(entry.rafId);
    }
  },

  stopAll() {
    this.activeCanvases.forEach((entry, id) => {
      entry.running = false;
      if (entry.rafId) cancelAnimationFrame(entry.rafId);
    });
  },

  resumeAll() {
    this.activeCanvases.forEach((entry, id) => {
      if (!entry.running) {
        entry.running = true;
        this.start(id);
      }
    });
  }
};

// Document visibility observer
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    window.CanvasRegistry.stopAll();
  } else {
    window.CanvasRegistry.resumeAll();
  }
});

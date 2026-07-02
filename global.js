/**
 * global.js — NEURAQUANT Framework v2
 * HUD nav · market ticker · telemetry · page transitions
 * Three.js WebGL backgrounds · GSAP scroll animations · card tilt
 *
 * Page opts (set on <body>):
 *   data-bg="surface|particles|globe|cubes|warp|none"   WebGL scene
 *   data-accent="cyan|gold|green"                        scene accent
 */

/* ---------------------------------------------------------- utils */
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Relative prefix so nav/links work from /projects/ subpages too
const PATH_PREFIX = window.location.pathname.replace(/\\/g, '/').includes('/projects/') ? '../' : '';
const SITE_ROOT = new URL(PATH_PREFIX, window.location.href).href;
const siteHref = (page) => new URL(page, SITE_ROOT).href;

window.scaleCanvasForDPI = function (canvas, ctx, width, height) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return dpr;
};

/* ------------------------------------------- canvas frame registry */
window.CanvasRegistry = {
  activeCanvases: new Map(),
  register(id, initFn, drawFrameFn, resizeFn) {
    const entry = { init: initFn, draw: drawFrameFn, resize: resizeFn, running: true, rafId: null };
    this.activeCanvases.set(id, entry);
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
      entry.draw(timestamp, timestamp - lastTime);
      lastTime = timestamp;
      entry.rafId = requestAnimationFrame(tick);
    };
    entry.rafId = requestAnimationFrame(tick);
  },
  stop(id) {
    const e = this.activeCanvases.get(id);
    if (e) { e.running = false; if (e.rafId) cancelAnimationFrame(e.rafId); }
  },
  stopAll() { this.activeCanvases.forEach((e) => { e.running = false; if (e.rafId) cancelAnimationFrame(e.rafId); }); },
  resumeAll() { this.activeCanvases.forEach((e, id) => { if (!e.running) { e.running = true; this.start(id); } }); }
};

document.addEventListener('visibilitychange', () => {
  document.hidden ? window.CanvasRegistry.stopAll() : window.CanvasRegistry.resumeAll();
});

/* ---------------------------------------------------------- boot */
document.addEventListener('DOMContentLoaded', () => {
  injectAtmosphere();
  injectHUDHeader();
  injectTicker();
  initTelemetry();
  initWebGLBackground();
  initGSAP();
  initTilt();
  initPageTransitions();
  requestAnimationFrame(() => document.body.classList.add('page-ready'));
});

/* ----------------------------------------- atmosphere layers */
function injectAtmosphere() {
  ['grid-overlay', 'vignette-overlay', 'noise-overlay', 'scanline'].forEach((cls) => {
    if (!document.querySelector('.' + cls)) {
      const el = document.createElement('div');
      el.className = cls;
      document.body.prepend(el);
    }
  });
  if (!document.getElementById('webgl-bg')) {
    const c = document.createElement('canvas');
    c.id = 'webgl-bg';
    c.setAttribute('aria-hidden', 'true');
    document.body.prepend(c);
  }
}

/* ----------------------------------------------------- HUD header */
function injectHUDHeader() {
  const currentPath = window.location.pathname;
  const pageName = currentPath.substring(currentPath.lastIndexOf('/') + 1) || 'index.html';
  const inProjects = PATH_PREFIX !== '';

  const isActive = (t) => (pageName.includes(t) || (t === 'projects' && inProjects)) ? 'active' : '';
  const isHomeActive = (!inProjects && (pageName === 'index.html' || pageName === '')) ? 'active' : '';
  const header = document.createElement('header');
  header.className = 'hud-nav';
  header.innerHTML = `
    <nav class="container mx-auto flex flex-col md:flex-row justify-between items-center py-3 px-6 gap-3">
      <div class="flex items-center gap-4">
        <a href="${siteHref('index.html')}" class="text-2xl font-bold flex items-center gap-2 group transition-colors">
          <span class="hud-nav-logo font-black">[XW]</span>
          <span class="hidden sm:inline text-[9px] font-mono text-cyan-400/60 border border-cyan-400/20 px-1.5 py-0.5 rounded tracking-widest uppercase">SYS: ACTIVE</span>
        </a>
      </div>
      <ul class="flex items-center space-x-1 sm:space-x-4 list-none p-0 m-0">
        <li><a href="${siteHref('index.html')}" class="hud-nav-item ${isHomeActive}">HOME</a></li>
        <li><a href="${siteHref('about.html')}" class="hud-nav-item ${isActive('about')}">ABOUT</a></li>
        <li><a href="${siteHref('projects.html')}" class="hud-nav-item ${isActive('projects')}">PROJECTS</a></li>
        <li><a href="${siteHref('investment.html')}" class="hud-nav-item ${isActive('investment')}">INVESTMENT</a></li>
        <li><a href="${siteHref('contact.html')}" class="hud-nav-item ${isActive('contact')}">CONTACT</a></li>
      </ul>
      <div class="hud-telemetry hidden lg:flex items-center gap-6 border-l border-white/10 pl-6">
        <div class="telemetry-item">
          <span class="text-gray-600">LOC //&nbsp;</span>
          <span class="telemetry-val text-white uppercase tracking-wider font-semibold">YVR_PST</span>
        </div>
        <div class="telemetry-item">
          <span class="text-gray-600">TIME //&nbsp;</span>
          <span id="pst-clock" class="telemetry-val text-white">00:00:00 PST</span>
        </div>
        <div class="telemetry-item">
          <span class="telemetry-dot pinging"></span>
          <span class="text-gray-600">PING //&nbsp;</span>
          <span id="ping-val" class="telemetry-val font-bold text-green-400">18ms</span>
        </div>
      </div>
    </nav>
  `;
  const existing = document.querySelector('header');
  existing ? existing.replaceWith(header) : document.body.prepend(header);
}

/* ------------------------------------------------- market ticker */
function injectTicker() {
  if (document.querySelector('.ticker-tape')) return;
  const header = document.querySelector('.hud-nav');
  if (!header) return;
  const storageKey = 'neuraquantTickerState';
  const saved = (() => {
    try { return JSON.parse(sessionStorage.getItem(storageKey)); }
    catch (e) { return null; }
  })();

  const symbols = [
    ['SPX', 6120], ['NDX', 22240], ['VIX', 14.2], ['BTC', 97400], ['ETH', 3420],
    ['SOL', 172], ['BNB', 615], ['MSFT', 448], ['NVDA', 1180], ['JPM', 224],
    ['GOLD', 2660], ['WTI', 71.4], ['US10Y', 4.21], ['EURUSD', 1.062], ['DXY', 106.1]
  ];
  const fallbackState = symbols.map(([s, p]) => ({ s, p, chg: (Math.random() - 0.42) * 3 }));
  const state = Array.isArray(saved?.state) && saved.state.length === symbols.length ? saved.state : fallbackState;
  const startedAt = Number(saved?.startedAt) || Date.now();

  const saveTicker = () => {
    try { sessionStorage.setItem(storageKey, JSON.stringify({ startedAt, state })); }
    catch (e) {}
  };

  const renderItems = () => state.map(({ s, p, chg }) => {
    const up = chg >= 0;
    const arrow = up ? '▲' : '▼';
    const cls = up ? 'tk-up' : 'tk-down';
    const px = p >= 1000 ? p.toLocaleString(undefined, { maximumFractionDigits: 0 })
                         : p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `<span><span class="tk-sym">${s}</span> ${px} <span class="${cls}">${arrow} ${Math.abs(chg).toFixed(2)}%</span></span>`;
  }).join('');

  const tape = document.createElement('div');
  tape.className = 'ticker-tape';
  tape.innerHTML = `<div class="ticker-track" id="ticker-track">${renderItems()}${renderItems()}</div>`;
  const track = tape.querySelector('.ticker-track');
  track.style.animationDelay = `-${((Date.now() - startedAt) % 42000) / 1000}s`;
  header.appendChild(tape);
  saveTicker();

  // decorative micro-ticks
  setInterval(() => {
    const i = Math.floor(Math.random() * state.length);
    const item = state[i];
    item.p = Math.max(0.01, item.p + (Math.random() - 0.5) * item.p * 0.0012);
    item.chg += (Math.random() - 0.5) * 0.06;
    const track = document.getElementById('ticker-track');
    if (track) track.innerHTML = renderItems() + renderItems();
    saveTicker();
  }, 4000);
}

/* --------------------------------------------------- telemetry */
function initTelemetry() {
  const clockEl = document.getElementById('pst-clock');
  const pingEl = document.getElementById('ping-val');
  const pingDot = document.querySelector('.telemetry-dot');

  const formatPST = () => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(new Date()) + ' PST';
    } catch (e) {
      return new Date().toTimeString().split(' ')[0] + ' LCL';
    }
  };

  if (clockEl) {
    clockEl.textContent = formatPST();
    setInterval(() => { clockEl.textContent = formatPST(); }, 1000);
  }

  if (pingEl) {
    let lastPing = 18;
    setInterval(() => {
      lastPing = Math.max(10, Math.min(35, Math.round(lastPing + (Math.random() - 0.5) * 4)));
      pingEl.textContent = `${lastPing}ms`;
      if (pingDot) {
        pingDot.style.boxShadow = '0 0 8px #00ff88';
        setTimeout(() => { pingDot.style.boxShadow = 'none'; }, 150);
      }
    }, 2000 + Math.random() * 2000);
  }
}

/* ----------------------------------------- Three.js backgrounds */
function initWebGLBackground() {
  const mode = document.body.dataset.bg || 'particles';
  if (mode === 'none' || typeof THREE === 'undefined') return;

  const canvas = document.getElementById('webgl-bg');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (e) { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.0016);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 4000);

  const ACCENTS = {
    cyan: [0x00f0ff, 0x0066ff, 0xffffff],
    gold: [0xffaa00, 0xff5500, 0x00f0ff],
    green: [0x00ff88, 0x00f0ff, 0xffffff]
  };
  const accent = ACCENTS[document.body.dataset.accent || 'cyan'] || ACCENTS.cyan;

  const mouse = { x: 0, y: 0 };
  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  let update; // per-scene animation fn

  /* -- scene builders ------------------------------------------- */
  function buildSurface() {
    // Animated wireframe "volatility surface"
    camera.position.set(0, 42, 120);
    const geo = new THREE.PlaneGeometry(560, 560, 88, 88);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: accent[0], wireframe: true, transparent: true, opacity: 0.14 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = -26;
    scene.add(mesh);

    const pGeo = new THREE.BufferGeometry();
    const N = 900, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 700;
      pos[i * 3 + 1] = Math.random() * 190 - 30;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 700;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(pGeo, new THREE.PointsMaterial({
      color: accent[1], size: 1.5, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    scene.add(stars);

    const basePos = geo.attributes.position.array.slice();
    update = (t) => {
      const p = geo.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) {
        const x = basePos[i], z = basePos[i + 2];
        p[i + 1] = Math.sin(x * 0.022 + t * 0.7) * Math.cos(z * 0.018 + t * 0.55) * 9
                 + Math.sin((x + z) * 0.008 + t * 0.3) * 13;
      }
      geo.attributes.position.needsUpdate = true;
      stars.rotation.y = t * 0.014;
      camera.position.x += (mouse.x * 26 - camera.position.x) * 0.03;
      camera.position.y += (42 - mouse.y * 16 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);
    };
  }

  function buildParticles() {
    camera.position.z = 150;
    const groups = [];
    accent.forEach((color, gi) => {
      const N = gi === 0 ? 1100 : 550;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 560;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 360;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 460;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({
        color, size: gi === 0 ? 1.6 : 1.1, transparent: true, opacity: gi === 0 ? 0.75 : 0.45,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      scene.add(pts);
      groups.push(pts);
    });
    update = (t) => {
      groups.forEach((g, i) => {
        g.rotation.y = t * (0.02 + i * 0.012);
        g.rotation.x = Math.sin(t * 0.05 + i) * 0.1;
      });
      camera.position.x += (mouse.x * 22 - camera.position.x) * 0.03;
      camera.position.y += (-mouse.y * 16 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);
    };
  }

  function buildGlobe() {
    camera.position.z = 220;
    const group = new THREE.Group();
    // point-cloud sphere
    const N = 1500, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const phi = Math.acos(2 * Math.random() - 1), theta = Math.random() * Math.PI * 2, r = 78;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    group.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: accent[0], size: 1.4, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false
    })));
    // wireframe shell + rings
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(78, 24, 24),
      new THREE.MeshBasicMaterial({ color: accent[1], wireframe: true, transparent: true, opacity: 0.06 })
    ));
    [96, 116].forEach((r, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.3, 8, 120),
        new THREE.MeshBasicMaterial({ color: accent[i], transparent: true, opacity: 0.18 })
      );
      ring.rotation.x = Math.PI / 2 + (i ? 0.5 : -0.25);
      group.add(ring);
    });
    // ambient dust
    const dN = 600, dGeo = new THREE.BufferGeometry(), dPos = new Float32Array(dN * 3);
    for (let i = 0; i < dN; i++) {
      dPos[i * 3] = (Math.random() - 0.5) * 900;
      dPos[i * 3 + 1] = (Math.random() - 0.5) * 500;
      dPos[i * 3 + 2] = (Math.random() - 0.5) * 500;
    }
    dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    scene.add(new THREE.Points(dGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 1, transparent: true, opacity: 0.3, depthWrite: false
    })));
    scene.add(group);
    update = (t) => {
      group.rotation.y = t * 0.09;
      group.rotation.x = Math.sin(t * 0.11) * 0.12;
      camera.position.x += (mouse.x * 30 - camera.position.x) * 0.03;
      camera.position.y += (-mouse.y * 20 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);
    };
  }

  function buildCubes() {
    camera.position.set(0, 26, 150);
    const group = new THREE.Group();
    const cubes = [];
    const GRID = 9, SPACING = 34;
    for (let x = 0; x < GRID; x++) {
      for (let z = 0; z < GRID; z++) {
        const h = 4 + Math.random() * 26;
        const geo = new THREE.BoxGeometry(5, h, 5);
        const isUp = Math.random() > 0.45;
        const mat = new THREE.MeshBasicMaterial({
          color: isUp ? accent[0] : 0xff3b5c, wireframe: true, transparent: true,
          opacity: 0.16 + Math.random() * 0.14
        });
        const cube = new THREE.Mesh(geo, mat);
        cube.position.set((x - GRID / 2) * SPACING, h / 2 - 40, (z - GRID / 2) * SPACING);
        cube.userData = { baseH: h, phase: Math.random() * Math.PI * 2, speed: 0.4 + Math.random() * 0.8 };
        group.add(cube);
        cubes.push(cube);
      }
    }
    scene.add(group);
    // dust
    const dN = 700, dGeo = new THREE.BufferGeometry(), dPos = new Float32Array(dN * 3);
    for (let i = 0; i < dN; i++) {
      dPos[i * 3] = (Math.random() - 0.5) * 800;
      dPos[i * 3 + 1] = Math.random() * 260 - 40;
      dPos[i * 3 + 2] = (Math.random() - 0.5) * 800;
    }
    dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    scene.add(new THREE.Points(dGeo, new THREE.PointsMaterial({
      color: accent[1], size: 1.2, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false
    })));
    update = (t) => {
      cubes.forEach((c) => {
        const s = 1 + Math.sin(t * c.userData.speed + c.userData.phase) * 0.35;
        c.scale.y = s;
        c.position.y = (c.userData.baseH * s) / 2 - 40;
      });
      group.rotation.y = t * 0.03;
      camera.position.x += (mouse.x * 30 - camera.position.x) * 0.03;
      camera.position.y += (26 - mouse.y * 14 - camera.position.y) * 0.03;
      camera.lookAt(0, -10, 0);
    };
  }

  function buildWarp() {
    camera.position.z = 1;
    const N = 1400, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 600;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 400;
      pos[i * 3 + 2] = -Math.random() * 900;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color: accent[0], size: 1.7, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    scene.add(pts);
    update = () => {
      const p = geo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        p[i * 3 + 2] += 1.6;
        if (p[i * 3 + 2] > 10) p[i * 3 + 2] = -900;
      }
      geo.attributes.position.needsUpdate = true;
      camera.rotation.y += (mouse.x * 0.05 - camera.rotation.y) * 0.02;
      camera.rotation.x += (-mouse.y * 0.05 - camera.rotation.x) * 0.02;
    };
  }

  ({ surface: buildSurface, particles: buildParticles, globe: buildGlobe, cubes: buildCubes, warp: buildWarp }[mode] || buildParticles)();

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  let t = 0;
  window.CanvasRegistry.register('webglBG', null, () => {
    if (!REDUCED_MOTION) t += 0.008;
    update(t);
    renderer.render(scene, camera);
  }, resize);

  if (REDUCED_MOTION) {
    // render a single static frame then halt
    update(2.5);
    renderer.render(scene, camera);
    window.CanvasRegistry.stop('webglBG');
  }
}

function resetWebGLBackground() {
  window.CanvasRegistry.stop('webglBG');
  window.CanvasRegistry.activeCanvases.delete('webglBG');
  const canvas = document.getElementById('webgl-bg');
  if (canvas) canvas.remove();
  injectAtmosphere();
  initWebGLBackground();
}

/* ------------------------------------------------------ GSAP */
function initGSAP() {
  if (typeof gsap === 'undefined' || REDUCED_MOTION) {
    document.querySelectorAll('[data-animate]').forEach((el) => { el.style.opacity = 1; });
    return;
  }
  if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

  // Scroll-triggered reveals
  document.querySelectorAll('[data-animate]').forEach((el) => {
    const type = el.dataset.animate || 'up';
    const delay = parseFloat(el.dataset.delay || 0);
    const playNow = el.getBoundingClientRect().top < window.innerHeight * 0.95;
    const from = { opacity: 0 };
    if (type === 'up') from.y = 44;
    if (type === 'down') from.y = -44;
    if (type === 'left') from.x = -60;
    if (type === 'right') from.x = 60;
    if (type === 'scale') { from.scale = 0.9; from.y = 20; }
    gsap.fromTo(el, from, {
      opacity: 1, x: 0, y: 0, scale: 1, duration: 1, ease: 'power3.out', delay,
      scrollTrigger: !playNow && typeof ScrollTrigger !== 'undefined'
        ? { trigger: el, start: 'top 88%', toggleActions: 'play none none none' } : undefined
    });
  });

  // Numeric counters: <span data-counter="94.2" data-suffix="%">0</span>
  document.querySelectorAll('[data-counter]').forEach((el) => {
    const target = parseFloat(el.dataset.counter);
    const decimals = (el.dataset.counter.split('.')[1] || '').length;
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target, duration: 2, ease: 'power2.out',
      scrollTrigger: typeof ScrollTrigger !== 'undefined'
        ? { trigger: el, start: 'top 92%' } : undefined,
      onUpdate: () => { el.textContent = prefix + obj.v.toFixed(decimals) + suffix; }
    });
  });

  // Text scramble decode: <h1 data-scramble>NEURAQUANT</h1>
  document.querySelectorAll('[data-scramble]').forEach((el) => scrambleText(el));
}

function scrambleText(el) {
  const chars = '!<>-_\\/[]{}—=+*^?#01';
  const finalText = el.textContent;
  const duration = 1100;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const reveal = Math.floor(p * finalText.length);
    let out = '';
    for (let i = 0; i < finalText.length; i++) {
      out += i < reveal ? finalText[i]
        : (finalText[i] === ' ' ? ' ' : chars[Math.floor(Math.random() * chars.length)]);
    }
    el.textContent = out;
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = finalText;
  };
  requestAnimationFrame(tick);
}

/* --------------------------------------------------- 3D tilt */
function initTilt() {
  if (REDUCED_MOTION || !window.matchMedia('(hover: hover)').matches) return;
  document.querySelectorAll('[data-tilt]').forEach((card) => {
    const strength = 7;
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - 0.5) * -strength;
      const ry = ((e.clientX - r.left) / r.width - 0.5) * strength;
      card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
}

/* ----------------------------------------- page fade transitions */
let isNavigating = false;

function initPageTransitions() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || a.target === '_blank') return;

    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;

    e.preventDefault();
    navigateTo(url);
  });

  window.addEventListener('popstate', () => {
    navigateTo(new URL(window.location.href), false);
  });
}

async function navigateTo(url, push = true) {
  if (isNavigating) return;
  isNavigating = true;
  let swapped = false;
  const currentPage = document.querySelector('main, .hero');
  if (currentPage) {
    currentPage.style.opacity = '0';
    currentPage.style.pointerEvents = 'none';
  }

  try {
    const response = await fetch(url.href);
    if (!response.ok) throw new Error(response.statusText);
    const nextDoc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const nextPage = nextDoc.querySelector('main, .hero');
    if (!nextPage) throw new Error('Missing page content');

    await new Promise((resolve) => setTimeout(resolve, 180));
    syncPageStyles(nextDoc);
    document.title = nextDoc.title;
    document.body.className = nextDoc.body.className;
    document.body.classList.add('page-ready');
    document.body.dataset.bg = nextDoc.body.dataset.bg || '';
    document.body.dataset.accent = nextDoc.body.dataset.accent || '';
    resetWebGLBackground();
    if (push) history.pushState({}, '', url.href);

    const importedPage = document.importNode(nextPage, true);
    currentPage ? currentPage.replaceWith(importedPage) : document.body.appendChild(importedPage);
    swapped = true;
    const insertedPage = document.querySelector('main, .hero');
    insertedPage.style.opacity = '0';
    insertedPage.style.pointerEvents = '';
    window.scrollTo(0, 0);

    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    }
    initGSAP();
    initTilt();
    updateHUDActiveState();
    await runPageScripts(nextDoc);
    showPageContent(insertedPage);
    requestAnimationFrame(() => { insertedPage.style.opacity = '1'; });
  } catch (e) {
    if (!swapped) {
      window.location.href = url.href;
      return;
    }
    console.warn('Page script failed after partial navigation:', e);
    const page = document.querySelector('main, .hero');
    if (page) page.style.opacity = '1';
  } finally {
    isNavigating = false;
  }
}

function showPageContent(root) {
  root.querySelectorAll('[data-animate]').forEach((el) => {
    if (typeof gsap !== 'undefined') gsap.killTweensOf(el);
    el.style.opacity = '1';
    el.style.transform = '';
  });
}

function syncPageStyles(nextDoc) {
  document.head.querySelectorAll('style[data-page-style]').forEach((style) => style.remove());
  nextDoc.head.querySelectorAll('style').forEach((style) => {
    const clone = document.importNode(style, true);
    clone.dataset.pageStyle = 'true';
    document.head.appendChild(clone);
  });
}

async function runPageScripts(nextDoc) {
  document.body.querySelectorAll('script[data-page-script]').forEach((script) => script.remove());
  const scripts = Array.from(nextDoc.body.querySelectorAll('script'));
  const addEventListener = document.addEventListener.bind(document);
  document.addEventListener = (type, listener, options) => {
    if (type === 'DOMContentLoaded') {
      setTimeout(() => {
        if (typeof listener === 'function') listener.call(document, new Event('DOMContentLoaded'));
        else if (listener && typeof listener.handleEvent === 'function') listener.handleEvent(new Event('DOMContentLoaded'));
      }, 0);
      return;
    }
    addEventListener(type, listener, options);
  };

  try {
    for (const script of scripts) {
      await new Promise((resolve, reject) => {
        const clone = document.createElement('script');
        Array.from(script.attributes).forEach((attr) => clone.setAttribute(attr.name, attr.value));
        clone.dataset.pageScript = 'true';
        clone.async = false;
        if (script.src) {
          clone.onload = resolve;
          clone.onerror = resolve;
          clone.src = script.src;
        } else {
          clone.textContent = script.textContent;
          resolve();
        }
        document.body.appendChild(clone);
      });
    }
  } finally {
    document.addEventListener = addEventListener;
  }
}

function updateHUDActiveState() {
  const path = window.location.pathname.replace(/\\/g, '/');
  const pageName = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
  const inProjects = path.includes('/projects/');
  document.querySelectorAll('.hud-nav-item').forEach((link) => {
    const label = link.textContent.trim().toLowerCase();
    const active = label === 'home'
      ? !inProjects && pageName === 'index.html'
      : label === 'projects'
        ? inProjects || pageName === 'projects.html'
        : pageName.includes(label);
    link.classList.toggle('active', active);
  });
}
/* END OF FILE */

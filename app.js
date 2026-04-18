/* ═══════════════════════════════════════════════════════════
   Jewellabs.ai — Vanilla JS
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Constants ──
  const CAL_URL = 'https://cal.com/soham-jariwala-4fvbkw/15min';

  const services = [
    { 
      num: '01', 
      ico: '<svg viewBox="0 0 40 40" width="28" height="28"><rect x="5" y="8" width="30" height="24" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 14 h30" stroke="currentColor" stroke-width="1.2"/><circle cx="9" cy="11" r="0.8" fill="currentColor"/><circle cx="12" cy="11" r="0.8" fill="currentColor"/></svg>', 
      title: 'Websites', 
      desc: 'Hand-built digital storefronts. Three-dimensional product viewers, configurators, secure checkout via Stripe, PayPal, Coinbase and NOWPayments.', 
      tags: ['Storefront', '3D Viewers', 'Stripe · Crypto'] 
    },
    { 
      num: '02', 
      ico: '<svg viewBox="0 0 40 40" width="28" height="28"><path d="M20 6 v18" stroke="currentColor" stroke-width="1.2"/><rect x="16" y="6" width="8" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M10 20 a10 10 0 0 0 20 0 M14 34 h12" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>', 
      title: 'AI Voice Agents', 
      desc: 'Twilio routes inbound calls to a real-time LLM. Whisper transcribes, the agent qualifies the lead, ElevenLabs speaks. Summary in your inbox when relevant.', 
      tags: ['Twilio', 'Whisper · GPT', 'ElevenLabs'] 
    },
    { 
      num: '03', 
      ico: '<svg viewBox="0 0 40 40" width="28" height="28"><path d="M10 6 h16 l6 6 v22 a2 2 0 0 1 -2 2 h-20 a2 2 0 0 1 -2 -2 v-26 a2 2 0 0 1 2 -2 z" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M26 6 v6 h6" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M14 22 h12 M14 27 h12 M14 32 h8" stroke="currentColor" stroke-width="1"/></svg>', 
      title: 'G7 DDS Engine', 
      desc: 'From January 2026, diamonds over 0.5 carats entering G7 markets require a Due Diligence Statement. Forward invoices. We generate the legal PDF. Every time.', 
      tags: ['Gmail · IMAP', 'OCR · Field extract', 'Legal PDF'] 
    },
    { 
      num: '04', 
      ico: '<svg viewBox="0 0 40 40" width="28" height="28"><polygon points="20,4 34,14 28,34 12,34 6,14" fill="none" stroke="currentColor" stroke-width="1.2"/><polygon points="20,14 26,18 24,28 16,28 14,18" fill="currentColor" opacity="0.25"/></svg>', 
      title: 'Design AI', 
      desc: 'Describe the piece. Receive a photo-grade render, bench specs, and channel-ready copy. Trained on your archive. Your IP never leaves your tenancy.', 
      tags: ['Prompt to render', 'Bench specs', 'Private model'] 
    }
  ];

  // ── DOM References ──
  const bookModal = document.getElementById('book-demo-modal');
  const servicesModal = document.getElementById('services-modal');
  const servicesGrid = document.getElementById('services-grid');

  // All buttons that open the Book Demo modal
  const bookDemoOpeners = [
    document.getElementById('nav-book-btn'),
    document.getElementById('hero-open-studio'),
    document.getElementById('hero-demo-render'),
    document.getElementById('studio-render-cta'),
    document.getElementById('studio-compliance-cta'),
    document.getElementById('footer-pricing-btn'),
  ];

  // All buttons that open the Services modal
  const servicesOpeners = [
    document.getElementById('nav-services-btn'),
    document.getElementById('cta-services-btn'),
  ];

  // Close buttons
  const bookCloseBtn = document.getElementById('book-demo-close');
  const servicesCloseBtn = document.getElementById('services-close');

  // ── Modal Helpers ──
  function openModal(modal) {
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  // ── Populate Services Grid ──
  function renderServiceCards() {
    if (!servicesGrid) return;
    services.forEach(function (svc, i) {
      const card = document.createElement('div');
      card.className = 'pillar anim-fade-up';
      card.style.animationDelay = (i * 60) + 'ms';
      // Fallback if animation observer is not ready
      card.classList.add('is-visible');

      const tagsHTML = svc.tags.map(function (t) {
        return '<li>' + t + '</li>';
      }).join('');

      card.innerHTML =
        '<div class="pillar__num">' + svc.num + '</div>' +
        '<div class="pillar__ico" aria-hidden="true">' + svc.ico + '</div>' +
        '<h3 class="pillar__title">' + svc.title + '</h3>' +
        '<p class="pillar__body">' + svc.desc + '</p>' +
        '<ul class="pillar__tags">' + tagsHTML + '</ul>';

      servicesGrid.appendChild(card);
    });
  }

  // ── Bind Events ──
  bookDemoOpeners.forEach(function (btn) {
    if (btn) btn.addEventListener('click', function () { openModal(bookModal); });
  });

  servicesOpeners.forEach(function (btn) {
    if (btn) btn.addEventListener('click', function () { openModal(servicesModal); });
  });

  if (bookCloseBtn) bookCloseBtn.addEventListener('click', function () { closeModal(bookModal); });
  if (servicesCloseBtn) servicesCloseBtn.addEventListener('click', function () { closeModal(servicesModal); });

  // Click backdrop to close
  [bookModal, servicesModal].forEach(function (modal) {
    if (!modal) return;
    modal.querySelector('.modal-backdrop').addEventListener('click', function () {
      closeModal(modal);
    });
  });

  // Escape key to close
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeModal(bookModal);
      closeModal(servicesModal);
    }
  });

  // ── Intersection Observer — scroll animations ──
  var animEls = document.querySelectorAll('[data-anim]');
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var delay = parseInt(entry.target.getAttribute('data-delay') || '0', 10);
          setTimeout(function () {
            entry.target.classList.add('is-visible');
          }, delay);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    animEls.forEach(function (el) { observer.observe(el); });
  } else {
    // Fallback — just show everything
    animEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  // ── Canvas Animation (Necklace Explosion) ──
  const canvas = document.getElementById('hero-canvas');
  if (canvas) {
    const context = canvas.getContext('2d');
    const frameCount = 240;
    const images = [];
    const sequence = { frame: 0 };

    // Set canvas dimensions
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      render();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Preload images
    let loadedCount = 0;
    for (let i = 1; i <= frameCount; i++) {
      const img = new Image();
      const frameNum = i.toString().padStart(3, '0');
      img.src = `public/sequence/ezgif-frame-${frameNum}.jpg`;
      img.onload = () => {
        loadedCount++;
        if (loadedCount === 1) render(); // Show first frame immediately
        if (loadedCount === frameCount) startAnimation();
      };
      images.push(img);
    }

    function render() {
      if (!images[sequence.frame] || !images[sequence.frame].complete) return;
      
      const img = images[sequence.frame];
      const canvasAspect = canvas.width / canvas.height;
      const imgAspect = img.width / img.height;
      
      let drawWidth, drawHeight, offsetX, offsetY;
      
      if (canvasAspect > imgAspect) {
        drawWidth = canvas.width;
        drawHeight = canvas.width / imgAspect;
        offsetX = 0;
        offsetY = (canvas.height - drawHeight) / 2;
      } else {
        drawHeight = canvas.height;
        drawWidth = canvas.height * imgAspect;
        offsetX = (canvas.width - drawWidth) / 2;
        offsetY = 0;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    }

    function startAnimation() {
      let targetFrame = 0;
      let currentDrawFrame = 30; // Start slightly advanced to settle smoothly on load
      let mouseX = 0;
      let isHovering = false;
      const heroEl = document.getElementById('hero');

      function updateTarget() {
        const scrollTop = window.pageYOffset;
        const maxScroll = window.innerHeight;
        const scrollFraction = Math.min(Math.max(scrollTop / maxScroll, 0), 1);
        
        let hoverFraction = 0;
        if (isHovering && scrollFraction < 1) {
          // Use mouse X position to scrub the animation
          hoverFraction = mouseX / window.innerWidth;
        }

        // Use the maximum of scroll or hover fraction
        const finalFraction = Math.min(Math.max(scrollFraction, hoverFraction), 1);
        targetFrame = finalFraction * (frameCount - 1);
      }

      // Listen to scroll
      window.addEventListener('scroll', updateTarget, { passive: true });
      
      // Listen to mouse movement over the hero section
      if (heroEl) {
        heroEl.addEventListener('mousemove', (e) => {
          isHovering = true;
          mouseX = e.clientX;
          updateTarget();
        }, { passive: true });
        
        heroEl.addEventListener('mouseleave', () => {
          isHovering = false;
          updateTarget();
        }, { passive: true });
      }

      // Smooth render loop (RAF)
      function tick() {
        // Interpolate current frame towards target frame (lerp)
        // 0.05 factor for slower, more cinematic motion
        currentDrawFrame += (targetFrame - currentDrawFrame) * 0.05; 
        
        const frameIndex = Math.min(Math.max(Math.round(currentDrawFrame), 0), frameCount - 1);
        
        if (sequence.frame !== frameIndex) {
          sequence.frame = frameIndex;
          render();
        }
        requestAnimationFrame(tick);
      }
      
      // Initial trigger
      updateTarget();
      tick();
    }
  }

  // ── Polyhedron / Three.js Diamond Hero (from view folder) ──
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let globalMouseX = window.innerWidth / 2;
  let globalMouseY = window.innerHeight / 2;
  window.addEventListener("pointermove", (e) => {
    globalMouseX = e.clientX;
    globalMouseY = e.clientY;
  }, { passive: true });

  function initDiamond() {
    if (typeof THREE === "undefined") return;
    const stage = qs("#heroStage");
    if (!stage) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, stage.clientWidth / stage.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    renderer.setClearColor(0x000000, 0);
    stage.appendChild(renderer.domElement);

    const diamondGroup = new THREE.Group();

    // Main diamond · octahedron
    const geo = new THREE.OctahedronGeometry(1.4, 1);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xf4e6c2,
      metalness: 0.2,
      roughness: 0.08,
      transmission: 0.85,
      thickness: 1.2,
      ior: 2.4,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.85,
    });
    const matFallback = new THREE.MeshStandardMaterial({
      color: 0xf4e6c2,
      metalness: 0.6,
      roughness: 0.15,
      transparent: true,
      opacity: 0.95,
    });

    const useHeavy = window.innerWidth > 900 && !prefersReducedMotion;
    const diamond = new THREE.Mesh(geo, useHeavy ? mat : matFallback);
    diamondGroup.add(diamond);

    // Wireframe overlay · edges
    const edges = new THREE.EdgesGeometry(geo);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xe8d49b,
      transparent: true,
      opacity: 0.55,
    });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    diamondGroup.add(wireframe);

    // Inner glow octahedron
    const innerGeo = new THREE.OctahedronGeometry(0.6, 0);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xc9a84c,
      transparent: true,
      opacity: 0.35,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    diamondGroup.add(inner);

    scene.add(diamondGroup);

    // Orbit particles
    const particleCount = prefersReducedMotion ? 40 : 160;
    const particlesGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const r = 2.5 + Math.random() * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    particlesGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particlesMat = new THREE.PointsMaterial({
      color: 0xe8d49b,
      size: 0.025,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particles);

    // Lights
    const ambient = new THREE.AmbientLight(0x2a1f12, 1.2);
    scene.add(ambient);

    const keyLight = new THREE.PointLight(0xe8d49b, 2.5, 20);
    keyLight.position.set(4, 3, 5);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0xffffff, 1.0, 15);
    rimLight.position.set(-4, -2, 3);
    scene.add(rimLight);

    const accentLight = new THREE.PointLight(0xc9a84c, 1.5, 12);
    accentLight.position.set(0, -3, 2);
    scene.add(accentLight);

    function resize() {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", resize);

    const svgEl = qs("#studio-svg");
    
    // Anchors mapped to the callout positions
    const cvTl = new THREE.Vector3(-1.2, 1.2, 0.5);
    const cvTr = new THREE.Vector3(1.2, 1.2, -0.5);
    const cvMl = new THREE.Vector3(-1.4, -0.8, 0);
    const cvMr = new THREE.Vector3(1.4, -0.8, 0);

    const calloutTargets = [
      { el: qs('.callout--tl'), v: cvTl },
      { el: qs('.callout--tr'), v: cvTr },
      { el: qs('.callout--ml'), v: cvMl },
      { el: qs('.callout--mr'), v: cvMr },
    ];

    // Pre-create SVG elements for performance
    if (svgEl) {
      svgEl.innerHTML = calloutTargets.map(() => `
        <path class="studio-string" fill="none" stroke-linecap="round" />
        <circle class="studio-dot" />
      `).join('');
    }
    const stringPaths = qsa('.studio-string', svgEl);
    const stringDots = qsa('.studio-dot', svgEl);

    const state = { targetX: 0, targetY: 0, x: 0, y: 0 };
    let frameId;

    function animate() {
      const rect = stage.getBoundingClientRect();
      const nx = (globalMouseX - rect.left) / rect.width;
      const ny = (globalMouseY - rect.top) / rect.height;
      
      // User interaction scaling: slightly more responsive for "maximum user interaction"
      state.targetX = (ny - 0.5) * 2.0; 
      state.targetY = (nx - 0.5) * 3.0; 
      state.x = lerp(state.x, state.targetX, 0.08);
      state.y = lerp(state.y, state.targetY, 0.08);

      diamondGroup.rotation.x = state.x;
      diamondGroup.rotation.y = state.y + performance.now() * 0.0002;

      inner.rotation.x = -state.x * 2;
      inner.rotation.y = -state.y * 2 + performance.now() * 0.0005;

      particles.rotation.y += 0.0008;
      particles.rotation.x += 0.0003;

      keyLight.position.x = 4 + (nx - 0.5) * 4;
      keyLight.position.y = 3 - (ny - 0.5) * 4;

      renderer.render(scene, camera);

      // Performant SVG update: attribute setting instead of innerHTML
      if (svgEl) {
        const hw = stage.clientWidth / 2;
        const hh = stage.clientHeight / 2;
        const pRect = stage.getBoundingClientRect();

        diamondGroup.updateMatrixWorld();
        
        calloutTargets.forEach((target, i) => {
          if (!target.el) return;
          const btnRect = target.el.getBoundingClientRect();
          
          const lx = btnRect.left - pRect.left + (i % 2 === 0 ? btnRect.width : 0);
          const ly = btnRect.top - pRect.top + btnRect.height / 2;

          const vec = target.v.clone();
          vec.applyMatrix4(diamondGroup.matrixWorld);
          vec.project(camera);
          
          const tx = (vec.x * hw) + hw;
          const ty = -(vec.y * hh) + hh;

          const ctrlX = (lx + tx) / 2;
          const ctrlY = ty - 40;
          
          const opacity = clamp(1 - (vec.z * 1.5), 0.1, 0.6);
          const isHover = target.el.classList.contains('is-active');
          const goldColor = isHover ? 'rgba(201, 168, 76, 0.9)' : `rgba(201, 168, 76, ${opacity})`;
          
          const path = stringPaths[i];
          const dot = stringDots[i];
          
          if (path) {
            path.setAttribute('d', `M ${lx} ${ly} Q ${ctrlX} ${ctrlY} ${tx} ${ty}`);
            path.setAttribute('stroke', goldColor);
            path.setAttribute('stroke-width', isHover ? 1.5 : 1);
          }
          if (dot) {
            dot.setAttribute('cx', tx);
            dot.setAttribute('cy', ty);
            dot.setAttribute('r', isHover ? 3 : 2);
            dot.setAttribute('fill', goldColor);
          }
        });
      }

      frameId = requestAnimationFrame(animate);
    }
    animate();

    const vizObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { if (!frameId) animate(); } 
        else { if (frameId) { cancelAnimationFrame(frameId); frameId = null; } }
      });
    }, { threshold: 0 });
    vizObserver.observe(stage);
  }

  function waitForThree(cb, attempts = 0) {
    if (typeof THREE !== "undefined") return cb();
    if (attempts > 50) return;
    setTimeout(() => waitForThree(cb, attempts + 1), 100);
  }
  waitForThree(initDiamond);

  // ── Callout detail dock ──
  const DETAIL_DATA = {
    websites: { eyebrow: "01 · Websites", title: "Bespoke storefronts", body: "Hand-built digital presences. Three-dimensional product viewers, bespoke configurators, secure checkout. Your storefront is not a template." },
    voice: { eyebrow: "02 · Voice Agents", title: "Pick up every call", body: "Twilio routes inbound lines to a real-time conversational agent. Whisper transcribes live, the LLM qualifies the caller, ElevenLabs replies." },
    dds: { eyebrow: "03 · G7 DDS Engine", title: "Compliance, automated", body: "From January 2026, the G7 framework requires a Due Diligence Statement for every diamond over 0.5 carats. We OCR the fields, validate against the framework, and return a signed PDF." },
    design: { eyebrow: "04 · Design AI", title: "Unlimited, private", body: "Describe the piece. Receive a studio-grade render, a full manufacturing specification, and channel-ready marketing copy. Trained on your own archive." },
  };

  const dock = qs("#detailDock");
  const dockInner = qs("#detailDockInner");
  const callouts = qsa(".callout");
  let activeCallout = null;

  function showDetail(key) {
    const data = DETAIL_DATA[key];
    if (!data || !dockInner || !dock) return;
    dockInner.innerHTML = `
      <p class="detail-dock__eyebrow">${data.eyebrow}</p>
      <h3 class="detail-dock__title">${data.title}</h3>
      <p class="detail-dock__body">${data.body}</p>
    `;
    dock.classList.add("is-visible");
  }

  function hideDetail() {
    if (!dock) return;
    dock.classList.remove("is-visible");
  }

  callouts.forEach((btn) => {
    const target = btn.dataset.target;
    btn.addEventListener("mouseenter", () => {
      activeCallout = btn;
      callouts.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      showDetail(target);
    });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      showDetail(target);
      btn.classList.add("is-active");
    });
  });

  const hStage = qs("#studio-container");
  if (hStage) {
    hStage.addEventListener("mouseleave", () => {
      callouts.forEach((b) => b.classList.remove("is-active"));
      hideDetail();
      activeCallout = null;
    });
  }

  // ── Optimized Ambient Square Flares (Behind Cursor) ──
  const bgCanvas = document.getElementById('flares-canvas');
  if (bgCanvas) {
    const ctx = bgCanvas.getContext('2d');
    let width, height;
    const motes = [];
    const MOTE_COUNT = 30; // Reduced count for performance

    function sizeBG() {
      width = bgCanvas.width = window.innerWidth * (window.devicePixelRatio || 1);
      height = bgCanvas.height = window.innerHeight * (window.devicePixelRatio || 1);
    }
    sizeBG();
    window.addEventListener("resize", sizeBG);

    for (let i = 0; i < MOTE_COUNT; i++) {
      motes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: (1 + Math.random() * 2) * (window.devicePixelRatio || 1),
        vx: (Math.random() - 0.5) * 0.2,
        vy: -0.1 - Math.random() * 0.2,
        baseO: 0.1 + Math.random() * 0.4,
        o: 0,
      });
    }

    function drawBG() {
      ctx.clearRect(0, 0, width, height);
      const dpr = window.devicePixelRatio || 1;
      const targetMx = globalMouseX * dpr;
      const targetMy = globalMouseY * dpr;

      motes.forEach((m) => {
        const dx = targetMx - m.x;
        const dy = targetMy - m.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // Slightly more subtle "gold behind cursor" pull
        let cursorInfluenceX = 0;
        let cursorInfluenceY = 0;
        if (dist < 300 * dpr) {
           const force = (300 * dpr - dist) / (300 * dpr);
           cursorInfluenceX = (dx / dist) * force * 0.2;
           cursorInfluenceY = (dy / dist) * force * 0.2;
        }

        m.x += m.vx + cursorInfluenceX;
        m.y += m.vy + cursorInfluenceY;
        
        if (m.y < -10) { m.y = height + 10; m.x = Math.random() * width; }
        if (m.x < -10) m.x = width + 10;
        if (m.x > width + 10) m.x = -10;

        m.o = m.baseO + Math.sin(Date.now() * 0.001 + m.x) * 0.1;
        
        // Performance fix: avoid expensive shadowBlur, use opacity and fill
        ctx.fillStyle = `rgba(201, 168, 76, ${Math.max(0, m.o)})`;
        ctx.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
      });

      requestAnimationFrame(drawBG);
    }
    drawBG();
  }

  // ── Cursor Glow Animation ──
  const cursorGlow = document.getElementById('cursor-glow');
  window.addEventListener('mousemove', (e) => {
    if (cursorGlow) {
      cursorGlow.style.left = e.clientX + 'px';
      cursorGlow.style.top = e.clientY + 'px';
    }
  }, { passive: true });

  // ── Init ──
  if (typeof renderServiceCards === 'function') {
      renderServiceCards();
  }
})();


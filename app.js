/* ═══════════════════════════════════════════════════════════
   Jewellabs — Vanilla JS
   Stage: particles gather from all sides → diamond → spin →
   golden movie-title reveal → travel → solid white word
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var qs  = function (s, r) { return (r || document).querySelector(s); };
  var qsa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };
  var easeInOut = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 2D diamond mark (the flat logo) — outer + inner rhombus + facet hints
  var MARK = [
    [[0, -1], [1, 0]], [[1, 0], [0, 1]], [[0, 1], [-1, 0]], [[-1, 0], [0, -1]],
    [[0, -0.46], [0.46, 0]], [[0.46, 0], [0, 0.46]], [[0, 0.46], [-0.46, 0]], [[-0.46, 0], [0, -0.46]],
    [[0, -1], [0, -0.46]], [[1, 0], [0.46, 0]], [[0, 1], [0, 0.46]], [[-1, 0], [-0.46, 0]]
  ];

  // octahedron faces (8 triangles) — a filled diamond gem for the 3D spin
  var OFACES = [];
  [1, -1].forEach(function (sx) { [1, -1].forEach(function (sy) { [1, -1].forEach(function (sz) {
    OFACES.push([[sx, 0, 0], [0, sy, 0], [0, 0, sz]]);
  }); }); });
  function onFace(f) {
    var u = Math.random(), v = Math.random(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    return {
      x: f[0][0] + (f[1][0] - f[0][0]) * u + (f[2][0] - f[0][0]) * v,
      y: f[0][1] + (f[1][1] - f[0][1]) * u + (f[2][1] - f[0][1]) * v,
      z: f[0][2] + (f[1][2] - f[0][2]) * u + (f[2][2] - f[0][2]) * v
    };
  }

  var globalMouseX = window.innerWidth / 2, globalMouseY = window.innerHeight / 2;
  window.addEventListener('pointermove', function (e) { globalMouseX = e.clientX; globalMouseY = e.clientY; }, { passive: true });

  // ═══════════════════════════════════════════════════════════
  // STAGE ENGINE
  // ═══════════════════════════════════════════════════════════
  (function () {
    var canvas = qs('#stage-canvas');
    var intro = qs('#intro');
    var label = qs('.intro__label');
    var heroWord = qs('#hero-word');
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, scrollY = window.pageYOffset;
    var N = 0, parts = [], spin3D = [], mark2D = [], textPts = [], box = null, solidFS = 14;
    var finished = false, rafId = 0;

    // hand the headline to a real DOM element, then tear down every intro layer
    // so nothing keeps repainting over the page on scroll (fixes the ghosting).
    function revealWord() {
      if (heroWord) heroWord.style.opacity = '1';   // size is handled by CSS (72cqh)
    }
    function teardown() {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(rafId);
      revealWord();
      if (ctx) ctx.clearRect(0, 0, W, H);
      if (tctx) tctx.clearRect(0, 0, W, H);
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      if (textCanvas && textCanvas.parentNode) textCanvas.parentNode.removeChild(textCanvas);
      if (useGL && renderer && renderer.dispose) { try { renderer.dispose(); } catch (e) {} }
      if (intro && intro.parentNode) { intro.parentNode.removeChild(intro); intro = null; }
      document.body.classList.remove('intro-lock');
    }

    // WebGL (karalabs-style GPU particles) with a 2D fallback
    var useGL = (typeof THREE !== 'undefined');
    var renderer, scene, camera, geo, posAttr, colAttr, posArr, colArr, points;
    var ctx = useGL ? null : canvas.getContext('2d');

    // thin 2D overlay just for the crisp solid word
    var textCanvas = document.createElement('canvas');
    textCanvas.setAttribute('aria-hidden', 'true');
    textCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;';
    document.body.appendChild(textCanvas);
    var tctx = textCanvas.getContext('2d');

    function makeDotTexture() {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var g = c.getContext('2d');
      var grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.96)');
      grd.addColorStop(0.8, 'rgba(255,255,255,0.28)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(32, 32, 32, 0, Math.PI * 2); g.fill();
      var t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
    }
    function setupGL() {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 1000);
      camera.position.z = 100;
    }

    window.addEventListener('scroll', function () { scrollY = window.pageYOffset; }, { passive: true });

    // logo/gem size as a fraction of the viewport — phone ~30%, laptop ~90% (gem peak)
    function logoFrac() {
      var vw = window.innerWidth;
      if (vw >= 1024) return 0.13;     // karalabs-size: elegant, centred diamond
      if (vw <= 600) return 0.17;      // a touch larger so it reads on phones
      return 0.17 + (0.13 - 0.17) * (vw - 600) / 424;
    }
    function measureBox() {
      var el = qs('#hero-headline'); if (!el) return;
      var r = el.getBoundingClientRect(); if (r.width < 10) return;
      box = { x: r.left, y: r.top + window.pageYOffset, w: r.width, h: r.height };
    }
    function sampleText() {
      if (!box) return [];
      var bw = Math.max(2, Math.round(box.w * dpr)), bh = Math.max(2, Math.round(box.h * dpr));
      var off = document.createElement('canvas'); off.width = bw; off.height = bh;
      var o = off.getContext('2d');
      o.textAlign = 'left'; o.textBaseline = 'middle';
      var fs = Math.floor(bh * 0.72);
      o.font = '500 ' + fs + 'px Geist, Inter, system-ui, sans-serif';
      while (o.measureText('Jewel Labs').width > bw * 0.98 && fs > 10) { fs -= 2; o.font = '500 ' + fs + 'px Geist, Inter, system-ui, sans-serif'; }
      solidFS = fs; // reuse exact size for the solid text
      o.fillStyle = '#fff'; o.fillText('Jewel Labs', 4, bh * 0.5);
      var data = o.getImageData(0, 0, bw, bh).data;
      var step = Math.max(2, Math.round(bh / 70));
      var pts = [];
      for (var y = 0; y < bh; y += step) for (var x = 0; x < bw; x += step) { if (data[(y * bw + x) * 4 + 3] > 128) pts.push({ lx: x, ly: y }); }
      return pts;
    }
    function build() {
      if (finished) return;
      W = window.innerWidth * dpr; H = window.innerHeight * dpr;
      if (useGL) {
        renderer.setSize(W, H, false);
        camera.left = 0; camera.right = W; camera.top = 0; camera.bottom = H; camera.updateProjectionMatrix();
      } else { canvas.width = W; canvas.height = H; }
      textCanvas.width = W; textCanvas.height = H;
      measureBox();
      var text = sampleText();
      var CAP = (window.innerWidth < 700) ? 1000 : 1700;
      if (text.length > CAP) { var stride = text.length / CAP, sub = []; for (var s = 0; s < CAP; s++) sub.push(text[Math.floor(s * stride)]); text = sub; }
      textPts = text;
      N = text.length > 30 ? text.length : 360;
      spin3D = []; mark2D = [];
      var mcx = W / 2, mcy = H * 0.46, mscale = Math.min(W, H) * logoFrac();
      for (var i = 0; i < N; i++) {
        spin3D.push(onFace(OFACES[(Math.random() * 8) | 0]));
        var seg = MARK[i % MARK.length], mt = Math.random();
        mark2D.push({ x: mcx + lerp(seg[0][0], seg[1][0], mt) * mscale, y: mcy + lerp(seg[0][1], seg[1][1], mt) * mscale });
      }
      var prev = parts; parts = [];
      for (var k = 0; k < N; k++) {
        // start scattered far on ALL sides (1.5× viewport) → gather inward
        parts.push(prev[k] || {
          x: W * 0.5 + (Math.random() - 0.5) * W * 1.55,
          y: H * 0.5 + (Math.random() - 0.5) * H * 1.55,
          ph: Math.random() * Math.PI * 2, g: Math.random()
        });
      }
      if (useGL) {
        posArr = new Float32Array(N * 3); colArr = new Float32Array(N * 3);
        if (points) { scene.remove(points); points.geometry.dispose(); }
        geo = new THREE.BufferGeometry();
        posAttr = new THREE.BufferAttribute(posArr, 3); colAttr = new THREE.BufferAttribute(colArr, 3);
        posAttr.setUsage(THREE.DynamicDrawUsage); colAttr.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('position', posAttr); geo.setAttribute('color', colAttr);
        var mat = new THREE.PointsMaterial({
          size: 2.5 * dpr, map: makeDotTexture(), vertexColors: true, transparent: true,
          depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false
        });
        points = new THREE.Points(geo, mat);
        scene.add(points);
      }
    }

    function drawSolid(solidT) {
      tctx.clearRect(0, 0, W, H);
      if (solidT > 0 && box) {
        var fy = (box.y - scrollY) * dpr + (box.h * dpr) * 0.5;
        tctx.font = '500 ' + solidFS + 'px Geist, Inter, system-ui, sans-serif';
        tctx.textAlign = 'left'; tctx.textBaseline = 'middle';
        tctx.fillStyle = 'rgba(248,249,251,' + easeInOut(solidT).toFixed(3) + ')';
        tctx.fillText('Jewel Labs', box.x * dpr + 4, fy);
      }
    }

    // reduced motion — no particles, just the crisp DOM headline
    if (prefersReduced) {
      measureBox();
      finished = true;
      revealWord();
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      if (textCanvas && textCanvas.parentNode) textCanvas.parentNode.removeChild(textCanvas);
      if (intro && intro.parentNode) { intro.parentNode.removeChild(intro); intro = null; }
      document.body.classList.remove('intro-lock');
      return;
    }

    if (useGL) setupGL();
    document.body.classList.add('intro-lock');
    requestAnimationFrame(function () { build(); });
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(build, 200); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { build(); });

    // timeline (ms)
    var A = 2200;          // slow gather from all sides → flat 2D logo forms
    var SNAP = A + 400;    // hold the logo static & solid (~0.4s), then snap to 3D
    var B = SNAP + 1400;   // 3D rests / spins (label reveals)
    var C = B + 1500;      // travel into the word
    var t0 = performance.now();
    var unlocked = false;
    var skipAfter = t0 + 1000;

    // never trap the visitor: click / keypress skips, and a hard timeout fails open
    function trySkip() { if (!finished && performance.now() >= skipAfter) { measureBox(); teardown(); } }
    window.addEventListener('pointerdown', trySkip, { passive: true });
    window.addEventListener('keydown', function (e) { if (e.key !== 'Tab') trySkip(); });
    setTimeout(function () { if (!finished) { measureBox(); teardown(); } }, 8000);

    function project(p, rotY, rotX, scale) {
      var cosX = Math.cos(rotX), sinX = Math.sin(rotX), cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      var y2 = p.y * cosX - p.z * sinX, z2 = p.y * sinX + p.z * cosX;
      var x3 = p.x * cosY + z2 * sinY, z3 = -p.x * sinY + z2 * cosY;
      var f = 4, s = f / (f - z3);
      return { x: W / 2 + x3 * scale * s, y: H * 0.46 + y2 * scale * s };
    }

    (function frame(now) {
      if (finished) return;
      var el = now - t0;
      if (el > B - 400) measureBox();
      if (ctx) { ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter'; }

      var assembleE = easeOutCubic(clamp(el / A, 0, 1));
      var spinScale = Math.min(W, H) * logoFrac();
      var rotY = el < SNAP ? 0 : (el - SNAP) * 0.0013; // flat 2D logo holds static, then snaps to 3D + spins
      var rotX = 0.52 + Math.sin(el * 0.0006) * 0.08;
      var travelT = clamp((el - B) / (C - B), 0, 1), tE = easeInOut(travelT);
      var cp = clamp((el - (C + 300)) / 1200, 0, 1);      // light-yellow → white
      var solidT = clamp((el - (C + 1500)) / 700, 0, 1);   // crisp-in fast (no faint ghost phase)
      var navClip = 60 * dpr;

      // golden bottom label — reveals from centre, expands like a movie title
      if (label) {
        var lp = clamp((el - 1500) / 1500, 0, 1);
        var lo = lp; if (el > B - 200) lo *= clamp(1 - (el - (B - 200)) / 700, 0, 1);
        var wipe = easeOutCubic(lp);              // smooth reveal, left → right
        label.style.opacity = lo.toFixed(3);
        label.style.transform = 'translateX(-50%)';
        label.style.letterSpacing = '0.12em';
        var clip = 'inset(0 ' + ((1 - wipe) * 100).toFixed(2) + '% 0 0)';
        label.style.clipPath = clip; label.style.webkitClipPath = clip;
      }
      // pitch-black screen fades as particles travel into the word
      if (intro) {
        var io = el < B ? 1 : clamp(1 - (el - B) / (C - B) * 1.15, 0, 1);
        intro.style.opacity = io.toFixed(3);
        if (io <= 0.01) intro.style.pointerEvents = 'none';
      }
      if (!unlocked && el > C - 250) { unlocked = true; document.body.classList.remove('intro-lock'); canvas.classList.add('settled'); }

      // particles fade out exactly as the solid text fades in (same place)
      if (solidT < 1) {
        for (var i = 0; i < N; i++) {
          var p = parts[i];
          var gx, gy;
          if (el < SNAP) { gx = mark2D[i].x; gy = mark2D[i].y; } // form the flat 2D logo, then hold it static & solid
          else {
          var sp = project(spin3D[i], rotY, rotX, spinScale); // then snap to 3D + spin
          if (travelT <= 0) { gx = sp.x; gy = sp.y; }
          else {
            var tp = textPts.length ? textPts[i % textPts.length] : { lx: 0, ly: 0 };
            var bx = box ? box.x * dpr + tp.lx : W * 0.16;
            var by = box ? (box.y - scrollY) * dpr + tp.ly : H * 0.4;
            var amp = tE * 1.7 * dpr * (1 - solidT);
            bx += Math.sin(el * 0.0007 + p.ph) * amp;
            by += Math.cos(el * 0.00058 + p.ph * 1.3) * amp;
            gx = lerp(sp.x, bx, tE); gy = lerp(sp.y, by, tE);
          }
          }
          var follow = el < A ? (0.02 + 0.05 * assembleE) : (travelT > 0 && travelT < 1 ? 0.14 : lerp(0.3, 0.5, solidT));
          p.x = lerp(p.x, gx, follow); p.y = lerp(p.y, gy, follow);
          var ix = i * 3;
          var clipped = (travelT >= 1 && p.y < navClip);
          var shimmer = 0.6 + 0.4 * Math.sin(el * 0.0026 + p.ph);
          var alpha = clipped ? 0 : (0.66 * (0.7 + 0.3 * shimmer)) * Math.max(assembleE, el < A ? 0 : 0.6) * (1 - solidT);
          var lyR = 228 - 14 * p.g, lyG = 225 - 16 * p.g, lyB = 200 - 26 * p.g; // icy muted yellow (not bright cheap gold)
          var r = lerp(lyR, 248, cp), g = lerp(lyG, 249, cp), b = lerp(lyB, 251, cp);
          if (useGL) {
            posArr[ix] = p.x; posArr[ix + 1] = p.y; posArr[ix + 2] = 0;
            colArr[ix] = (r / 255) * alpha; colArr[ix + 1] = (g / 255) * alpha; colArr[ix + 2] = (b / 255) * alpha;
          } else if (!clipped) {
            var sz = (1.0 + 0.35 * shimmer) * dpr;
            ctx.fillStyle = 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + alpha.toFixed(3) + ')';
            ctx.fillRect(p.x - sz, p.y - sz, sz * 2, sz * 2);
          }
        }
      } else if (useGL && colArr) {
        for (var z = 0; z < colArr.length; z++) colArr[z] = 0; // particles gone; solid text remains
      }

      if (useGL && posAttr) {
        posAttr.needsUpdate = true; colAttr.needsUpdate = true;
        renderer.render(scene, camera);
      } else if (ctx) { ctx.globalCompositeOperation = 'source-over'; }

      // crisp solid word on the 2D overlay (in-place, same spot, same moment)
      drawSolid(solidT);

      // handoff complete → swap to the DOM headline and remove every intro layer
      if (solidT >= 1) { teardown(); return; }

      if (intro && unlocked && el > C + 600) { if (intro.parentNode) { intro.parentNode.removeChild(intro); intro = null; } }
      rafId = requestAnimationFrame(frame);
    })(t0);
  })();

  // ═══════════════════════════════════════════════════════════
  // NECKLACE — scroll-down + drag scrub (smooth)
  // ═══════════════════════════════════════════════════════════
  (function () {
    var canvas = qs('#hero-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var FRAMES = 240, images = [], seq = { frame: 0 };
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; render(); }
    window.addEventListener('resize', resize);
    var painted = false;
    function render() {
      var img = images[seq.frame]; if (!img || !img.complete || !img.naturalWidth) return false;
      var ca = canvas.width / canvas.height, ia = img.width / img.height, dw, dh, ox, oy;
      if (ca > ia) { dw = canvas.width; dh = canvas.width / ia; ox = 0; oy = (canvas.height - dh) / 2; }
      else { dh = canvas.height; dw = canvas.height * ia; ox = (canvas.width - dw) / 2; oy = 0; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, ox, oy, dw, dh);
      painted = true;
      return true;
    }
    // progressive: begin as soon as the first frame is ready (don't wait for all 240)
    var loaded = 0, started = false;
    function boot() { if (!started) { started = true; start(); } }
    for (var i = 1; i <= FRAMES; i++) {
      var img = new Image();
      img.decoding = 'async';
      img.fetchPriority = 'low';   // stream the necklace in the background; never block the intro or fonts
      var num = i.toString(); while (num.length < 3) num = '0' + num;
      img.src = 'ezgif-frame-' + num + '.jpg';
      img.onload = function () { loaded++; if (loaded === 1) { resize(); boot(); } };
      images.push(img);
    }
    resize();

    function heroVisible(hero) {
      if (!hero) return true;
      var r = hero.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    }
    function start() {
      var target = 0, current = 0, dragFrames = 0, dragging = false, running = false, tickId = 0;
      var hero = qs('#hero');
      function update() { var sf = clamp(window.pageYOffset / window.innerHeight, 0, 1); target = clamp(sf * (FRAMES - 1) + dragFrames, 0, FRAMES - 1); }
      window.addEventListener('scroll', update, { passive: true });
      if (hero) { hero.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch' || e.target.closest('a, button')) return; dragging = true; hero.classList.add('is-grabbing'); }); }
      window.addEventListener('pointerup', function () { dragging = false; if (hero) hero.classList.remove('is-grabbing'); });
      window.addEventListener('pointermove', function (e) { if (!dragging) return; dragFrames = clamp(dragFrames + (e.movementX + e.movementY) * 0.22, 0, FRAMES - 1); update(); }, { passive: true });
      function tick() {
        if (!running) return;
        current += (target - current) * 0.055;
        var idx = clamp(Math.round(current), 0, FRAMES - 1);
        // redraw on frame change, and keep retrying until the very first frame lands
        if (seq.frame !== idx || !painted) { seq.frame = idx; render(); }
        tickId = requestAnimationFrame(tick);
      }
      function play() { if (!running) { running = true; tick(); } }
      function pause() { running = false; cancelAnimationFrame(tickId); }
      update();
      play();
      // idle the scrub loop when the hero scrolls away or the tab is hidden
      if ('IntersectionObserver' in window && hero) {
        new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? play() : pause(); }); }, { threshold: 0 }).observe(hero);
      }
      document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else if (heroVisible(hero)) play(); });
    }
  })();

  // ═══════════════════════════════════════════════════════════
  // SCROLL REVEALS
  // ═══════════════════════════════════════════════════════════
  (function () {
    var els = qsa('[data-anim]');
    if (prefersReduced || !('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('is-visible'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var delay = parseInt(entry.target.getAttribute('data-delay') || '0', 10);
        setTimeout(function () { entry.target.classList.add('is-visible'); }, delay);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.16 });
    els.forEach(function (el) { io.observe(el); });
  })();

  // ═══════════════════════════════════════════════════════════
  // CURSOR GLOW
  // ═══════════════════════════════════════════════════════════
  (function () {
    var glow = qs('#cursor-glow'); if (!glow || prefersReduced || !window.matchMedia('(hover: hover)').matches) return;
    var tx = window.innerWidth / 2, ty = window.innerHeight / 2, x = tx, y = ty;
    window.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function tick() { x += (tx - x) * 0.12; y += (ty - y) * 0.12; glow.style.left = x + 'px'; glow.style.top = y + 'px'; requestAnimationFrame(tick); })();
  })();

  // ═══════════════════════════════════════════════════════════
  // NANO PARTICLES (neutral, no blue tint)
  // ═══════════════════════════════════════════════════════════
  (function () {
    var canvas = qs('#flares-canvas'); if (!canvas || prefersReduced) return;
    var ctx = canvas.getContext('2d');
    var w, h, motes = [], COUNT = 34, dpr = window.devicePixelRatio || 1;
    function size() { w = canvas.width = window.innerWidth * dpr; h = canvas.height = window.innerHeight * dpr; }
    size(); window.addEventListener('resize', size);
    for (var i = 0; i < COUNT; i++) motes.push({ x: Math.random() * w, y: Math.random() * h, r: (0.7 + Math.random() * 1.7) * dpr, vx: (Math.random() - 0.5) * 0.1, vy: -0.05 - Math.random() * 0.11, baseO: 0.1 + Math.random() * 0.26 });
    (function draw() {
      if (document.hidden) { requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, w, h);
      var mx = globalMouseX * dpr, my = globalMouseY * dpr;
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i], dx = mx - m.x, dy = my - m.y, dist = Math.sqrt(dx * dx + dy * dy), ix = 0, iy = 0;
        if (dist < 320 * dpr) { var f = (320 * dpr - dist) / (320 * dpr); ix = (dx / dist) * f * 0.18; iy = (dy / dist) * f * 0.18; }
        m.x += m.vx + ix; m.y += m.vy + iy;
        if (m.y < -10) { m.y = h + 10; m.x = Math.random() * w; }
        if (m.x < -10) m.x = w + 10; if (m.x > w + 10) m.x = -10;
        var o = m.baseO + Math.sin(Date.now() * 0.001 + m.x) * 0.07;
        ctx.fillStyle = 'rgba(208, 208, 212, ' + Math.max(0, o) + ')';
        ctx.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
      }
      requestAnimationFrame(draw);
    })();
  })();

  // ═══════════════════════════════════════════════════════════
  // STUDIO — interactive comb gem
  // ═══════════════════════════════════════════════════════════
  function initStudio() {
    if (typeof THREE === 'undefined') return;
    var stage = qs('#heroStage'); if (!stage) return;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, stage.clientWidth / stage.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 6);
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    renderer.setClearColor(0x000000, 0);
    stage.appendChild(renderer.domElement);

    var group = new THREE.Group();
    var ico = new THREE.IcosahedronGeometry(1.7, 0), pa = ico.attributes.position, tris = [];
    for (var i = 0; i < pa.count; i += 3) tris.push([new THREE.Vector3().fromBufferAttribute(pa, i), new THREE.Vector3().fromBufferAttribute(pa, i + 1), new THREE.Vector3().fromBufferAttribute(pa, i + 2)]);
    function onTri(t) { var u = Math.random(), v = Math.random(); if (u + v > 1) { u = 1 - u; v = 1 - v; } return new THREE.Vector3().addScaledVector(t[1].clone().sub(t[0]), u).addScaledVector(t[2].clone().sub(t[0]), v).add(t[0]); }
    var GEMN = prefersReduced ? 500 : 1400, gpos = new Float32Array(GEMN * 3);
    for (var g = 0; g < GEMN; g++) { var pt = onTri(tris[(Math.random() * tris.length) | 0]); gpos[g * 3] = pt.x; gpos[g * 3 + 1] = pt.y; gpos[g * 3 + 2] = pt.z; }
    var gemGeo = new THREE.BufferGeometry(); gemGeo.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
    group.add(new THREE.Points(gemGeo, new THREE.PointsMaterial({ color: 0xeef1f6, size: 0.03, transparent: true, opacity: 0.92, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    group.add(new THREE.LineSegments(new THREE.EdgesGeometry(ico), new THREE.LineBasicMaterial({ color: 0xb8bcc4, transparent: true, opacity: 0.2 })));
    scene.add(group);

    var ON = prefersReduced ? 40 : 150, opos = new Float32Array(ON * 3);
    for (var o = 0; o < ON; o++) { var r = 3 + Math.random() * 3, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1); opos[o * 3] = r * Math.sin(ph) * Math.cos(th); opos[o * 3 + 1] = r * Math.sin(ph) * Math.sin(th); opos[o * 3 + 2] = r * Math.cos(ph); }
    var orbGeo = new THREE.BufferGeometry(); orbGeo.setAttribute('position', new THREE.BufferAttribute(opos, 3));
    var orbit = new THREE.Points(orbGeo, new THREE.PointsMaterial({ color: 0xb8bcc4, size: 0.02, transparent: true, opacity: 0.5, sizeAttenuation: true, blending: THREE.AdditiveBlending }));
    scene.add(orbit);

    window.addEventListener('resize', function () { var w = stage.clientWidth, h = stage.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); });
    var st = { tx: 0, ty: 0, x: 0, y: 0 }, frameId;
    function animate() {
      var rect = stage.getBoundingClientRect();
      var nx = (globalMouseX - rect.left) / rect.width, ny = (globalMouseY - rect.top) / rect.height;
      st.tx = (ny - 0.5) * 2.0; st.ty = (nx - 0.5) * 3.0;
      st.x = lerp(st.x, st.tx, 0.04); st.y = lerp(st.y, st.ty, 0.04);
      group.rotation.x = st.x; group.rotation.y = st.y + performance.now() * 0.00012;
      orbit.rotation.y += 0.0005; orbit.rotation.x += 0.0002;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }
    animate();
    new IntersectionObserver(function (entries) { entries.forEach(function (e) { if (e.isIntersecting) { if (!frameId) animate(); } else if (frameId) { cancelAnimationFrame(frameId); frameId = null; } }); }, { threshold: 0 }).observe(stage);
  }
  (function waitThree(n) { n = n || 0; if (typeof THREE !== 'undefined') return initStudio(); if (n > 50) return; setTimeout(function () { waitThree(n + 1); }, 100); })();

})();

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
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, scrollY = window.pageYOffset;
    var N = 0, parts = [], spin3D = [], mark2D = [], textPts = [], box = null, solidFS = 14;

    window.addEventListener('scroll', function () { scrollY = window.pageYOffset; }, { passive: true });

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
      W = canvas.width = window.innerWidth * dpr;
      H = canvas.height = window.innerHeight * dpr;
      measureBox();
      var text = sampleText();
      var CAP = (window.innerWidth < 700) ? 1000 : 1700;
      if (text.length > CAP) { var stride = text.length / CAP, sub = []; for (var s = 0; s < CAP; s++) sub.push(text[Math.floor(s * stride)]); text = sub; }
      textPts = text;
      N = text.length > 30 ? text.length : 360;
      spin3D = []; mark2D = [];
      var mcx = W / 2, mcy = H * 0.46, mscale = Math.min(W, H) * 0.15;
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
    }

    // reduced motion — paint the white word once, hide intro
    if (prefersReduced) {
      if (intro) intro.style.display = 'none';
      requestAnimationFrame(function () {
        W = canvas.width = window.innerWidth * dpr; H = canvas.height = window.innerHeight * dpr;
        measureBox(); var text = sampleText();
        ctx.fillStyle = 'rgba(248,249,251,0.95)';
        text.forEach(function (p) { ctx.fillRect(box.x * dpr + p.lx, (box.y - window.pageYOffset) * dpr + p.ly, dpr, dpr); });
      });
      return;
    }

    document.body.classList.add('intro-lock');
    requestAnimationFrame(function () { build(); });
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(build, 200); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { build(); });

    // timeline (ms)
    var A = 2600;   // slow gather from all sides → diamond
    var B = 4000;   // diamond rests / spins (label reveals)
    var C = 5500;   // travel into the word
    var t0 = performance.now();
    var unlocked = false;

    function project(p, rotY, rotX, scale) {
      var cosX = Math.cos(rotX), sinX = Math.sin(rotX), cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      var y2 = p.y * cosX - p.z * sinX, z2 = p.y * sinX + p.z * cosX;
      var x3 = p.x * cosY + z2 * sinY, z3 = -p.x * sinY + z2 * cosY;
      var f = 4, s = f / (f - z3);
      return { x: W / 2 + x3 * scale * s, y: H * 0.46 + y2 * scale * s };
    }

    (function frame(now) {
      var el = now - t0;
      if (el > B - 400) measureBox();
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      var assembleE = easeOutCubic(clamp(el / A, 0, 1));
      var spinScale = Math.min(W, H) * 0.16;
      var rotY = el < A ? 0 : (el - A) * 0.0016; // flat 2D logo until A, then snap to 3D + spin
      var rotX = 0.52 + Math.sin(el * 0.0006) * 0.08;
      var travelT = clamp((el - B) / (C - B), 0, 1), tE = easeInOut(travelT);
      var cp = clamp((el - (C + 300)) / 1500, 0, 1);      // light-yellow → white
      var solidT = clamp((el - (C + 2300)) / 1200, 0, 1);  // ~2s after color: tighten to solid
      var navClip = 60 * dpr;

      // golden bottom label — reveals from centre, expands like a movie title
      if (label) {
        var lp = clamp((el - 1500) / 1500, 0, 1);
        var lo = lp; if (el > B - 200) lo *= clamp(1 - (el - (B - 200)) / 700, 0, 1);
        var sc = lerp(0.72, 1, easeOutCubic(lp));
        var ls = lerp(0.08, 0.2, lp);
        label.style.opacity = lo.toFixed(3);
        label.style.transform = 'translateX(-50%) scale(' + sc.toFixed(3) + ')';
        label.style.letterSpacing = ls.toFixed(3) + 'em';
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
          if (el < A) { gx = mark2D[i].x; gy = mark2D[i].y; } // particles form the flat 2D logo first
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
          if (travelT >= 1 && p.y < navClip) continue;
          var shimmer = 0.6 + 0.4 * Math.sin(el * 0.0026 + p.ph);
          var alpha = (0.66 * (0.7 + 0.3 * shimmer)) * Math.max(assembleE, el < A ? 0 : 0.6) * (1 - solidT);
          var lyR = 242 - 18 * p.g, lyG = 233 - 22 * p.g, lyB = 190 - 38 * p.g;
          var r = lerp(lyR, 248, cp) | 0, g = lerp(lyG, 249, cp) | 0, b = lerp(lyB, 251, cp) | 0;
          var sz = (1.0 + 0.35 * shimmer) * dpr;
          ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha.toFixed(3) + ')';
          ctx.fillRect(p.x - sz, p.y - sz, sz * 2, sz * 2);
        }
      }
      ctx.globalCompositeOperation = 'source-over';

      // convert in-place to crisp solid text — same canvas, same spot, same moment
      if (solidT > 0 && box) {
        var fy = (box.y - scrollY) * dpr + (box.h * dpr) * 0.5;
        ctx.font = '500 ' + solidFS + 'px Geist, Inter, system-ui, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(248,249,251,' + easeInOut(solidT).toFixed(3) + ')';
        ctx.fillText('Jewel Labs', box.x * dpr + 4, fy);
      }

      if (intro && unlocked && el > C + 600) { if (intro.parentNode) { intro.parentNode.removeChild(intro); intro = null; } }
      requestAnimationFrame(frame);
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
    function render() {
      var img = images[seq.frame]; if (!img || !img.complete) return;
      var ca = canvas.width / canvas.height, ia = img.width / img.height, dw, dh, ox, oy;
      if (ca > ia) { dw = canvas.width; dh = canvas.width / ia; ox = 0; oy = (canvas.height - dh) / 2; }
      else { dh = canvas.height; dw = canvas.height * ia; ox = (canvas.width - dw) / 2; oy = 0; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, ox, oy, dw, dh);
    }
    var loaded = 0;
    for (var i = 1; i <= FRAMES; i++) {
      var img = new Image();
      var num = i.toString(); while (num.length < 3) num = '0' + num;
      img.src = 'ezgif-frame-' + num + '.jpg';
      img.onload = function () { loaded++; if (loaded === 1) resize(); if (loaded === FRAMES) start(); };
      images.push(img);
    }
    resize();
    function start() {
      var target = 0, current = 0, dragFrames = 0, dragging = false;
      var hero = qs('#hero');
      function update() { var sf = clamp(window.pageYOffset / window.innerHeight, 0, 1); target = clamp(sf * (FRAMES - 1) + dragFrames, 0, FRAMES - 1); }
      window.addEventListener('scroll', update, { passive: true });
      if (hero) { hero.addEventListener('pointerdown', function (e) { if (e.target.closest('a, button')) return; dragging = true; hero.classList.add('is-grabbing'); }); }
      window.addEventListener('pointerup', function () { dragging = false; if (hero) hero.classList.remove('is-grabbing'); });
      window.addEventListener('pointermove', function (e) { if (!dragging) return; dragFrames = clamp(dragFrames + (e.movementX + e.movementY) * 0.22, 0, FRAMES - 1); update(); }, { passive: true });
      (function tick() { current += (target - current) * 0.055; var idx = clamp(Math.round(current), 0, FRAMES - 1); if (seq.frame !== idx) { seq.frame = idx; render(); } requestAnimationFrame(tick); })();
      update();
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
    var glow = qs('#cursor-glow'); if (!glow || prefersReduced) return;
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

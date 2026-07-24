'use strict';
/* ═══════════════════════════════════════════════════════════
   JEWEL LABS STUDIO  |  agent-demo.js
   The Agent Theater engine (index.html only).
   Plays the live inbox demos: emails arrive in a Gmail-style
   inbox, the agent console narrates, ticks land on each row,
   and a finale artifact compiles over the frame.

   The compliance scenario is engine-backed: every email body
   in js/demo-data.js is parsed and assessed by the real DDS
   engine (JL.dds, exported from js/compliance.js), and the
   final statement is real certificateHTML output. `expect`
   in the data is only the fallback if the engine is absent.

   Fails open: any error leaves the static section usable.
   ═══════════════════════════════════════════════════════════ */
(function () {
  if (!window.JL || !window.JL_DEMO) return;

  const D = window.JL_DEMO;
  const $ = JL.$, esc = JL.esc;
  const I = D.icons;
  const LABELS = { quote: 'Quotes' };
  const DEFAULT = 'quote';

  /* ═══════════════════════════════════════════════════════════
     A2A layer — a faithful in-browser client of the open A2A
     (Agent2Agent) protocol. Messages are real JSON-RPC 2.0
     `message/send` requests carrying A2A Message objects; agents
     advertise Agent Cards; the work is an A2A Task with the real
     lifecycle states; the run is a scheduled execution instance.
     Spec: https://a2a-protocol.org  ·  JSON-RPC 2.0
     ═══════════════════════════════════════════════════════════ */
  const A2A_PROTO = '0.3.0';
  // Wasi's three agents. Each advertises an Agent Card (served at
  // /.well-known/agent-card.json by convention). Quoting orchestrates; it runs
  // the inbox, the price model and the owner update itself, and hands the stone
  // plan to Cut and the origin check to Compliance over A2A.
  const AGENTS = [
    { id: 'quoting', name: 'Quoting', ico: 'diamond', card: {
      name: 'Quoting Agent', description: 'Runs the desk: reads the inbox, prices back of Rap, builds the quote, notifies the owner.',
      url: 'https://studio.jewellabs.org/a2a/quoting', version: '2.0.1', protocolVersion: A2A_PROTO,
      preferredTransport: 'JSONRPC', capabilities: { streaming: true, pushNotifications: true, stateTransitionHistory: true },
      skills: [{ id: 'compose-quote', name: 'Compose quote', tags: ['render', 'price', 'quote'] }] } },
    { id: 'cut', name: 'Cut', ico: 'cut', card: {
      name: 'Rough-Cut Planning Agent', description: 'Plans the rough stone: yield, make, and cut layout, trained on scan data.',
      url: 'https://studio.jewellabs.org/a2a/cut', version: '1.3.0', protocolVersion: A2A_PROTO,
      preferredTransport: 'JSONRPC', capabilities: { streaming: true, pushNotifications: false, stateTransitionHistory: true },
      skills: [{ id: 'plan-rough', name: 'Plan rough', tags: ['rough-cut', 'yield'] }] } },
    { id: 'compliance', name: 'Compliance', ico: 'shield', card: {
      name: 'Compliance Agent', description: 'Cross-checks stones against grading-lab records, verifies origin, produces the G7 Due Diligence Statement.',
      url: 'https://studio.jewellabs.org/a2a/compliance', version: '2.1.0', protocolVersion: A2A_PROTO,
      preferredTransport: 'JSONRPC', capabilities: { streaming: true, pushNotifications: true, stateTransitionHistory: true },
      skills: [{ id: 'g7-dds', name: 'G7 Due Diligence Statement', tags: ['compliance', 'origin', 'g7'] }] } },
  ];
  const AGENT = {}; AGENTS.forEach((a) => { AGENT[a.id] = a; });
  AGENT.scheduler = { id: 'scheduler', name: 'Scheduler' }; // the cron trigger (not an agent)

  let _uid = 0;
  function uid(p) { _uid += 1; return p + '-' + _uid.toString(36).padStart(4, '0'); }

  // the scheduled run (Trigger.dev / Temporal 'run' object) and the A2A Task the agents share
  let RUN = null;
  let TASK = null;
  function newRun() { return { id: uid('run'), trigger: { type: 'schedule', cron: '0 2 * * *', timezone: 'UTC', source: 'inbox.poll' }, status: 'EXECUTING', a2a: 0 }; }
  function newTask() { return { kind: 'task', id: uid('task'), contextId: uid('ctx'), status: { state: 'submitted', timestamp: '2026-01-19T02:00:04Z' }, history: [], artifacts: [] }; }
  function setTaskState(state) { if (TASK) { TASK.status = { state: state, timestamp: '2026-01-19T02:00:04Z' }; renderRun(); } }

  // build a real A2A message/send request (JSON-RPC 2.0)
  function a2aRequest(fromId, toId, intent, text, data) {
    // A2A role marks the RPC side, not the speaker: every message/send request is
    // client-sent, so role is always 'user'; role 'agent' only appears in
    // server-generated messages (responses/streams).
    const parts = [{ kind: 'text', text: text }];
    if (data) parts.push({ kind: 'data', data: data });
    return {
      jsonrpc: '2.0', id: uid('req'), method: 'message/send',
      params: { message: {
        role: 'user', kind: 'message', messageId: uid('msg'),
        taskId: TASK ? TASK.id : null, contextId: TASK ? TASK.contextId : null,
        parts: parts,
        metadata: { 'a2a/from': fromId, 'a2a/to': toId, 'a2a/intent': intent },
      } },
    };
  }
  // The multiplayer workspace, like Google Docs for the desk: several people and
  // the agents share ONE live session. Kept deliberately small — a couple of
  // people and three agents, not a stream — so it reads at a glance.
  // People facepile: You are always here; Wasi joins live.
  let people = [];
  function resetPeople() { people = [{ id: 'you', initial: 'Y', tone: 'you', name: 'You' }]; }
  function renderPeople() {
    if (!els.people) return;
    // the last-added face is 'fresh' so only the newcomer pops in
    els.people.innerHTML = people.map((p, i) =>
      '<span class="ac-face2' + (i === people.length - 1 ? ' is-fresh' : '') + '" data-tone="' + p.tone + '" title="' + esc(p.name) + '">' + esc(p.initial) + '</span>').join('');
  }

  // a brief "someone joined" toast, the way a shared doc announces presence
  let toastTimer = null;
  function showToast(text) {
    if (!els.toast) return;
    els.toast.textContent = text;
    els.toast.classList.remove('show'); void els.toast.offsetWidth; els.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { if (els.toast) els.toast.classList.remove('show'); }, 2300);
  }
  function hideToast() { if (els.toast) els.toast.classList.remove('show'); }

  // The three agents in the workspace and who is driving them right now.
  const presence = { wasi: false, agents: false, active: null, done: {}, painted: false };
  function resetPresence() { presence.wasi = false; presence.agents = false; presence.active = null; presence.done = {}; presence.painted = false; }
  function wasiJoin() {
    if (presence.wasi) return;
    presence.wasi = true;
    people.push({ id: 'wasi', initial: 'W', tone: 'wasi', name: 'Wasi' });
    renderPeople(); renderPresence();
    addHumanLine('Wasi', 'joined the workspace');
    showToast('Wasi joined the workspace');
  }
  // a second teammate joins the same workspace and works the same shared agents
  function priyaJoin() {
    if (people.some(function (p) { return p.id === 'priya'; })) return;
    people.push({ id: 'priya', initial: 'P', tone: 'priya', name: 'Priya' });
    renderPeople();
    addHumanLine('Priya', 'joined the workspace');
    showToast('Priya joined the workspace');
  }
  function agentsJoin() {
    if (presence.agents) return;
    presence.agents = true;
    renderPresence();          // the three agents pop in, staggered
    presence.painted = true;   // later state changes repaint without re-popping
    addLine('Quoting, Cut and Compliance joined the workspace', 'spawn');
    showToast('3 agents joined the workspace');
  }
  function activate(id) { presence.active = id; renderPresence(); }
  function markDone(id) { presence.done[id] = true; if (presence.active === id) presence.active = null; renderPresence(); }
  function agentsDone() { AGENTS.forEach((a) => { presence.done[a.id] = true; }); presence.active = null; renderPresence(); }

  // the bus: dispatch a real message and let the UI observe genuine traffic.
  const busListeners = [];
  function busSend(req) {
    if (RUN) { RUN.a2a += 1; renderRun(); }
    if (TASK) TASK.history.push(req.params.message);
    busListeners.forEach((l) => { try { l(req); } catch (e) {} });
    return req;
  }
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let els = null;
  let apps = null;
  let active = DEFAULT;
  let finished = false;
  let running = false;     // a live timeline is in flight (guards against stray replays)
  let done = {};           // emailId -> processed (controls reply visibility)
  let unread = 0;

  /* ── timeline scheduler: absolute offsets + a run token so a
     cancelled timeline can never touch the stage again.
     PACE slows the whole demo uniformly so a viewer can follow it. ── */
  const PACE = 1.55;
  const seq = {
    timers: [], token: 0,
    at(ms, fn) {
      const tok = this.token;
      this.timers.push(setTimeout(() => { if (tok === this.token) { try { fn(); } catch (e) {} } }, ms * PACE));
    },
    cancel() { this.token++; this.timers.forEach(clearTimeout); this.timers = []; },
  };

  /* ═══════ engine wiring (compliance only) ═══════ */
  function computeVerdicts(sc) {
    if (sc.key !== 'compliance' || !JL.dds) return null;
    try {
      const map = {};
      sc.emails.forEach((e) => {
        const a = JL.dds.assess(JL.dds.parse(e.body), e.body);
        map[e.id] = a;
        const wantBlocked = e.expect === 'blocked';
        const gotBlocked = a.verdict === 'CANNOT_CERTIFY';
        if (wantBlocked !== gotBlocked) console.warn('[agent-demo] engine drift on', e.id, a.verdict);
      });
      return map;
    } catch (e) { console.warn('[agent-demo] engine unavailable', e); return null; }
  }

  function isBlocked(e, verdicts) {
    if (verdicts && verdicts[e.id]) return verdicts[e.id].verdict === 'CANNOT_CERTIFY';
    return e.expect === 'blocked';
  }

  /* ═══════ DOM builders ═══════ */
  function rowHTML(e) {
    const att = (e.attachments && e.attachments.length)
      ? '<span class="gm-att">' + I.clip + esc(e.attachments[0].name) + '</span>' : '';
    return '<button class="gm-row is-hidden unread" type="button" data-id="' + esc(e.id) + '">' +
      '<span class="gm-cb" aria-hidden="true"></span>' +
      '<span class="gm-star" aria-hidden="true">' + I.star + '</span>' +
      '<span class="gm-sender">' + esc(e.from.name) + '</span>' +
      '<span class="gm-line"><span class="gm-subj">' + esc(e.subject) + '</span>' +
      '<span class="gm-sep">&middot;</span><span class="gm-snip">' + esc(e.snippet) + '</span>' + att + '</span>' +
      '<span class="gm-slot"></span>' +
      '<span class="gm-time">' + esc(e.time) + '</span>' +
      '</button>';
  }

  function chipHTML(bad, label) {
    return '<span class="gm-chip ' + (bad ? 'bad' : 'ok') + '">' +
      (bad ? I.blockx : I.check) + esc(label) + '</span>';
  }

  function emptyHTML() {
    return '<div class="gm-empty">' + I.inbox +
      '<span>Nothing new yet. The agent is watching this inbox.</span></div>';
  }

  function specRowsHTML(rows) {
    return '<div class="gm-reply-spec">' + rows.map((r) =>
      '<div><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>').join('') + '</div>';
  }

  function priceBasisHTML(rows) {
    if (!rows || !rows.length) return '';
    return '<div class="gm-price">' +
      '<div class="gm-price-head">' + I.price + '<span>Priced, not guessed</span></div>' +
      rows.map((r) => '<div class="gm-price-row"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>').join('') +
      '</div>';
  }

  function replyThreadHTML(e, sc) {
    if (!done[e.id] || !e.reply) return '';
    const r = e.reply;
    const img = r.img
      ? '<div class="gm-reply-photo"><img src="' + r.img + '" loading="lazy" alt="Render, ' + esc(e.subject) + '"><span class="gm-reply-tag">' + I.diamond + 'Render composed by the agent</span></div>'
      : '';
    const inner = '<p>' + esc(r.intro) + '</p>' + img + priceBasisHTML(r.priceBasis) + specRowsHTML(r.spec) +
      '<p class="gm-reply-note">Indicative. The final quote uses live metal prices and the confirmed stone.</p>';
    return '<div class="gm-reply">' +
      '<div class="gm-read-head">' +
      '<span class="gm-read-ava">' + I.diamond + '</span>' +
      '<div class="gm-read-who"><div class="gm-read-name">' + esc(sc.agentName) +
      ' <small>&lt;' + esc(sc.account) + '&gt;</small></div>' +
      '<div class="gm-read-to">to ' + esc(e.from.name) + '</div></div>' +
      '<span class="gm-read-when">moments later</span></div>' +
      '<div class="gm-read-body">' + inner + '</div></div>';
  }

  function readHTML(e, sc) {
    const ava = 'style="background:hsl(' + (e.from.hue || 210) + ',45%,45%)"';
    const body = '<p>' + esc(e.body) + '</p>';
    const atts = (e.attachments || []).map((a) =>
      '<span class="gm-read-att">' + I.clip + esc(a.name) + '</span>').join('');
    return '<div class="gm-read-bar">' +
      '<button class="gm-iconbtn" id="gmBack" type="button" aria-label="Back to inbox">' + I.back + '</button>' +
      '<span class="gm-iconbtn" aria-hidden="true">' + I.archive + '</span>' +
      '<span class="gm-iconbtn" aria-hidden="true">' + I.trash + '</span>' +
      '<span class="gm-iconbtn" aria-hidden="true">' + I.dots + '</span>' +
      '</div>' +
      '<div class="gm-read-scroll">' +
      '<h4 class="gm-read-subject">' + esc(e.subject) + '<span class="gm-read-tag">Inbox</span></h4>' +
      '<div class="gm-read-head">' +
      '<span class="gm-read-ava" ' + ava + '>' + esc(e.from.initial) + '</span>' +
      '<div class="gm-read-who"><div class="gm-read-name">' + esc(e.from.name) +
      ' <small>&lt;' + esc(e.from.email) + '&gt;</small></div>' +
      '<div class="gm-read-to">to ' + esc(sc.account) + '</div></div>' +
      '<span class="gm-read-when">' + esc(e.time) + '</span>' +
      '</div>' +
      '<div class="gm-read-body">' + body + '</div>' +
      (atts ? '<div class="gm-read-atts">' + atts + '</div>' : '') +
      replyThreadHTML(e, sc) +
      '</div>';
  }

  function spotPackHTML(sc) {
    const sp = sc.spotCheck;
    if (!sp) return '';
    return '<div class="spot-pack">' +
      '<div class="sp-head"><span class="sp-badge">Audit vault</span>' +
      '<div class="sp-title">' + esc(sp.title) + '</div>' +
      '<div class="sp-sub">' + esc(sp.sub) + '</div></div>' +
      '<ul class="sp-list">' + sp.items.map((it) =>
        '<li>' + I.check + '<span>' + esc(it) + '</span></li>').join('') + '</ul>' +
      '<div class="sp-foot">' + esc(sp.retention) + '</div>' +
      '</div>';
  }

  function darkFinaleHTML(f) {
    return '<div class="finale-dark">' +
      '<p class="finale-kicker">Queue cleared</p>' +
      '<h4 class="finale-title">' + esc(f.title) + '</h4>' +
      '<div class="finale-stat">' + esc(f.stat) + '</div>' +
      '<p class="finale-stat-l">' + esc(f.statLabel) + '</p>' +
      '<div class="finale-rows">' + f.rows.map((r) =>
        '<div><span>' + esc(r[0]) + '</span><b>' + esc(String(r[1]).replace('{a2a}', RUN ? RUN.a2a : 0)) + '</b></div>').join('') + '</div>' +
      '<p class="finale-note">' + esc(f.note) + '</p>' +
      '</div>';
  }

  function finaleHTML(sc, verdicts) {
    if (sc.key === 'compliance') {
      try {
        if (JL.dds && verdicts) {
          const ok = sc.emails.filter((e) => verdicts[e.id] && verdicts[e.id].verdict !== 'CANNOT_CERTIFY');
          if (ok.length) {
            const items = [];
            ok.forEach((e) => { items.push.apply(items, verdicts[e.id].items); });
            const parsed = {
              supplier: sc.merged.supplier,
              invoiceRef: sc.merged.invoiceRef,
              invoiceDate: sc.merged.invoiceDate,
              items: items,
            };
            const raw = ok.map((e) => e.body).join('\n\n');
            const a = JL.dds.assess(parsed, raw);
            return '<div class="finale-doc">' +
              '<div class="cert-mini">' + JL.dds.certificateHTML(a, sc.meta) + '</div>' +
              spotPackHTML(sc) +
              '</div>';
          }
        }
      } catch (e) { console.warn('[agent-demo] finale fallback', e); }
      return darkFinaleHTML({
        title: 'Due diligence statement prepared',
        stat: '9 of 10',
        statLabel: 'Invoices certified, 1 blocked',
        rows: [['In scope', '16 lines, 22.20 ct'], ['Blocked', 'BG-8890, Russian origin'], ['Status', 'Ready for signature']],
        note: 'Staged demo. The tool page runs the same engine on your own invoice.',
      });
    }
    return darkFinaleHTML(sc.finale);
  }

  /* ═══════ console helpers ═══════ */
  function addLine(text, cls, withIcon) {
    const div = document.createElement('div');
    div.className = 'ac-line' + (cls ? ' ' + cls : '');
    const icon = withIcon ? (cls === 'bad' ? I.blockx : I.check) : '';
    div.innerHTML = icon + '<span>' + esc(text) + '</span>';
    els.log.appendChild(div);
    els.log.scrollTop = els.log.scrollHeight;
  }

  function addTyping() {
    removeTyping();
    const t = document.createElement('div');
    t.className = 'ac-typing';
    t.id = 'acTyping';
    t.innerHTML = '<span></span><span></span><span></span>';
    els.log.appendChild(t);
    els.log.scrollTop = els.log.scrollHeight;
  }

  function removeTyping() { const t = $('acTyping'); if (t) t.remove(); }
  // a person acting in the shared session (join, watch, redirect, hand off)
  function addHumanLine(name, text) {
    const div = document.createElement('div');
    div.className = 'ac-line human';
    div.innerHTML = '<span class="ac-line-face">' + esc(String(name).charAt(0)) + '</span><span><b>' + esc(name) + '</b> ' + esc(text) + '</span>';
    els.log.appendChild(div);
    els.log.scrollTop = els.log.scrollHeight;
  }
  function setState(s) { els.state.textContent = s; }
  function setFoot() { /* status now lives in a single line under the workspace bar */ }
  function setCount() { els.count.textContent = unread > 0 ? String(unread) : ''; }

  /* ═══════ multi-agent orchestration (A2A) ═══════ */
  // render a real A2A message off the bus, with the raw JSON-RPC payload inspectable
  function renderA2A(req) {
    if (!els || !els.log) return;
    const m = req.params.message, md = m.metadata || {};
    const fromId = md['a2a/from'], toId = md['a2a/to'], intent = md['a2a/intent'];
    const f = AGENT[fromId] || { name: fromId }, to = AGENT[toId] || { name: toId };
    const gloss = (m.parts.filter((p) => p.kind === 'text')[0] || {}).text || '';
    const div = document.createElement('div');
    div.className = 'a2a';
    div.innerHTML =
      '<div class="a2a-head">' +
        '<span class="a2a-tag" data-agent="' + esc(fromId) + '">' + esc(f.name) + '</span>' +
        '<span class="a2a-arrow">' + I.arrow + '</span>' +
        '<span class="a2a-tag" data-agent="' + esc(toId) + '">' + esc(to.name) + '</span>' +
        '<span class="a2a-intent">' + esc(intent) + '</span>' +
      '</div>' +
      '<div class="a2a-gloss">' + esc(gloss) + '</div>' +
      '<button class="a2a-raw-btn" type="button" aria-expanded="false">message/send &middot; JSON-RPC 2.0</button>' +
      '<pre class="a2a-raw" hidden>' + esc(JSON.stringify(req, null, 2)) + '</pre>';
    els.log.appendChild(div);
    els.log.scrollTop = els.log.scrollHeight;
    if (AGENT[toId]) activate(toId);
  }
  // send an A2A handoff: build a genuine message and put it on the bus (the UI observes it)
  function a2a(fromId, toId, intent, gloss, data) { busSend(a2aRequest(fromId, toId, intent, gloss, data)); }

  // the run/task strip: scheduled trigger, live A2A task state, message count
  function renderRun() {
    if (!els.run || !RUN || !TASK) return;
    els.run.innerHTML =
      '<span class="ac-run-sched">' + (I.clock || '') + '<span>nightly &middot; 2:00 AM UTC</span></span>' +
      '<span class="ac-run-task" data-state="' + esc(TASK.status.state) + '">' + esc(TASK.status.state) + '</span>' +
      '<span class="ac-run-count">' + RUN.a2a + ' A2A</span>';
  }

  // multiplayer, popped out: Wasi (a person) on the left, directing three agents
  // on the right. One person, three agents — the whole session in one glance.
  function renderPresence() {
    if (!els.presence) return;
    // The people live in the workspace bar above; here we show only the agents
    // and who is working right now.
    if (!presence.agents) {
      els.presence.setAttribute('data-live', presence.wasi ? '1' : '0');
      els.presence.innerHTML = '<span class="acp-standby">' + (presence.wasi ? 'Bringing agents in' : 'Session standing by') + '</span>';
      return;
    }
    els.presence.setAttribute('data-live', '1');
    const staticCls = presence.painted ? ' acp-static' : '';
    const agents = AGENTS.map((a, idx) => {
      const st = presence.done[a.id] ? 'done' : (presence.active === a.id ? 'active' : 'idle');
      const delay = presence.painted ? '' : ' style="animation-delay:' + (idx * 190) + 'ms"';
      return '<span class="acp-agent' + staticCls + '" data-agent="' + a.id + '" data-status="' + st + '" title="' + esc(a.card.name) + '"' + delay + '>' +
        '<span class="acp-bot">' + (I[a.ico] || I.diamond) + '</span>' +
        '<span class="acp-name">' + esc(a.name) + '</span>' +
      '</span>';
    }).join('');
    els.presence.innerHTML = '<span class="acp-agents">' + agents + '</span>';
  }
  function filterNoise(e) {
    const row = rowOf(e);
    if (!row) return;
    row.classList.remove('gm-scan', 'unread');
    row.classList.add('gm-filtered');
    const slot = row.querySelector('.gm-slot');
    if (slot) slot.innerHTML = '<span class="gm-chip muted">Filtered</span>';
    if (unread > 0) unread--; setCount();
    done[e.id] = true;
  }

  /* ═══════ stage control ═══════ */
  function resetStage(sc) {
    done = {}; unread = 0; finished = false; resetPresence(); resetPeople();
    els.list.innerHTML = emptyHTML() + sc.emails.map(rowHTML).join('');
    els.read.classList.add('hidden'); els.read.innerHTML = '';
    els.finale.classList.add('hidden'); els.finale.innerHTML = '';
    els.log.innerHTML = '';
    resetApps();
    RUN = newRun(); TASK = newTask(); renderRun(); renderPeople(); renderPresence();
    setState('Standing by'); hideToast();
    els.dot.classList.remove('live');
    setCount(); els.range.textContent = '';
    els.avatar.textContent = (sc.account || 'j').charAt(0).toUpperCase();
    els.label.textContent = LABELS[sc.key] || 'Agent';
    els.cta.setAttribute('href', sc.cta.href);
    els.cta.textContent = sc.cta.label;
    els.skip.classList.remove('hidden');
    els.replay.classList.add('hidden');
  }

  function rowOf(e) { return els.list.querySelector('.gm-row[data-id="' + e.id + '"]'); }

  function arrive(e, i, sc) {
    const empty = els.list.querySelector('.gm-empty');
    if (empty) empty.remove();
    const row = rowOf(e);
    if (!row) return;
    row.classList.remove('is-hidden');
    row.classList.add('gm-in');
    unread++; setCount();
    els.range.textContent = (i + 1) + ' of ' + sc.emails.length;
    setFoot('Mail arriving');
  }

  function startProcess(e) {
    const row = rowOf(e);
    if (!row) return;
    row.classList.add('gm-scan');
    // keep the row visible inside the inbox list only — never scroll the page
    try {
      const list = els.list;
      if (list && list.scrollHeight > list.clientHeight + 4) {
        list.scrollTop = Math.max(0, row.offsetTop - 8);
      }
    } catch (err) {}
  }

  function finishProcess(e, idx, sc, verdicts) {
    const row = rowOf(e);
    if (!row) return;
    const bad = isBlocked(e, verdicts);
    row.classList.remove('gm-scan', 'unread');
    if (bad) row.classList.add('gm-bad');
    const slot = row.querySelector('.gm-slot');
    if (slot) slot.innerHTML = chipHTML(bad, bad ? 'Blocked' : (e.chip || 'Processed'));
    done[e.id] = true;
    if (unread > 0) unread--; setCount();
    setFoot((idx + 1) + ' of ' + sc.emails.length + ' processed');
  }

  function showFinale(sc, verdicts) {
    finished = true; running = false;
    els.finale.innerHTML = finaleHTML(sc, verdicts);
    els.finale.classList.remove('hidden');
    els.dot.classList.remove('live');
    setState(sc.finaleState);
    setFoot(sc.finaleState);
    els.skip.classList.add('hidden');
    els.replay.classList.remove('hidden');
  }

  /* ═══════ multi-app workspace (gmail / rapaport / slack) ═══════ */
  const APP_URL = { gmail: 'mail.google.com', rapaport: 'studio.jewellabs.org/price-model', slack: 'jewellabs.slack.com' };

  function switchApp(app) {
    if (!apps || !apps.screens) return;
    apps.screens.forEach((s) => s.classList.toggle('active', s.getAttribute('data-app') === app));
    if (apps.tabs) apps.tabs.querySelectorAll('.bf-tab').forEach((tb) =>
      tb.classList.toggle('active', tb.getAttribute('data-app') === app));
    if (apps.url && apps.url.lastChild) apps.url.lastChild.textContent = APP_URL[app] || '';
  }

  function resetApps() {
    if (!apps) return;
    if (apps.rapQuery) apps.rapQuery.innerHTML = '';
    if (apps.rapRows) apps.rapRows.innerHTML = '';
    if (apps.rapOut) apps.rapOut.innerHTML = '';
    if (apps.rapModel) apps.rapModel.classList.remove('done');
    slackReset();
    switchApp('gmail');
  }

  function quoteOf(e) {
    const spec = (e.reply && e.reply.spec) || [];
    const row = spec.find((r) => /indicative/i.test(r[0]));
    return row ? row[1] : '';
  }
  function rapQueryFor(e) {
    const spec = (e.reply && e.reply.spec) || [];
    const stone = spec[0] ? spec[0][1] : 'diamond';
    return stone.replace(' colour', '').replace(' clarity', '');
  }
  function rapType(text) { if (apps && apps.rapQuery) apps.rapQuery.innerHTML = esc(text) + '<span class="cur"></span>'; }
  function rapListings(e) {
    if (!apps || !apps.rapRows) return;
    const pb = (e.reply && e.reply.priceBasis) || [];
    apps.rapRows.innerHTML = pb.map((r, i) =>
      '<div class="rap-row" style="animation-delay:' + (i * 150) + 'ms"><span>' + esc(r[0]) +
      '</span><b>' + esc(r[1]) + '</b></div>').join('');
    apps.rapRows.querySelectorAll('.rap-row').forEach((r) => r.classList.add('in'));
  }
  function rapPredict() { if (apps && apps.rapModel) apps.rapModel.classList.remove('done'); }
  function rapResolve(e) {
    if (!apps || !apps.rapOut) return;
    const disc = (e.reply && e.reply.rapDiscount) || '';
    apps.rapOut.innerHTML =
      '<div class="rap-out-row"><span>Comparable set</span><b>matched</b></div>' +
      (disc ? '<div class="rap-out-row"><span>Back of Rap</span><b>' + esc(disc) + '</b></div>' : '') +
      '<div class="rap-out-row"><span>Metal</span><b>at spot</b></div>' +
      '<div class="rap-out-row total"><span>Fair value</span><b>' + esc(quoteOf(e)) + '</b></div>';
    if (apps.rapModel) apps.rapModel.classList.add('done');
  }
  /* Slack: the agent types into the compose box in real time, then sends */
  function slackReset() {
    const comp = $('slackCompose'), inp = $('slackInput'), ph = $('slackPh');
    if (apps && apps.slackThread) apps.slackThread.innerHTML = '';
    if (comp) comp.classList.remove('typing', 'ready');
    if (inp) inp.textContent = '';
    if (ph) ph.style.display = '';
  }
  function slackTypeChar(ch) {
    const comp = $('slackCompose'), inp = $('slackInput'), ph = $('slackPh');
    if (!inp || !comp) return;
    comp.classList.add('typing');
    if (ph) ph.style.display = 'none';
    inp.textContent += ch;
  }
  function slackSendMsg(e, msg) {
    const comp = $('slackCompose'), inp = $('slackInput'), ph = $('slackPh');
    const img = (e.reply && e.reply.img) || '';
    if (apps && apps.slackThread) {
      apps.slackThread.innerHTML =
        '<div class="slack-msg">' +
          '<div class="slack-ava">' + I.diamond + '</div>' +
          '<div class="slack-body">' +
            '<div class="slack-by"><span class="slack-name">Quoting Agent</span>' +
            '<span class="slack-app-badge">APP</span><span class="slack-time">now</span></div>' +
            '<div class="slack-text">' + esc(msg) + '</div>' +
            '<div class="slack-card">' + (img ? '<img src="' + img + '" alt="">' : '') +
              '<div><div class="slack-card-t">' + esc(e.subject) + '</div>' +
              '<div class="slack-card-s">' + esc(e.snippet) + '</div>' +
              '<div class="slack-card-q">' + esc(quoteOf(e)) + ' <span style="font-weight:400;font-size:12px;color:#616061">indicative</span></div></div>' +
            '</div>' +
            '<div class="slack-sent">' + I.check + 'Delivered to the owner</div>' +
          '</div>' +
        '</div>';
      const m = apps.slackThread.querySelector('.slack-msg');
      if (m) m.classList.add('in');
    }
    if (comp) comp.classList.remove('typing', 'ready');
    if (inp) inp.textContent = '';
    if (ph) ph.style.display = '';
  }

  /* ═══════ the timeline ═══════ */
  function scheduleFeature(e, sc, t0) {
    let t = t0;
    const price = quoteOf(e);
    const idx = sc.emails.indexOf(e);

    const who = e.from.name;

    const stone = (e.reply && e.reply.spec && e.reply.spec[0] ? e.reply.spec[0][1] : '');
    const rapDisc = (e.reply && e.reply.rapDiscount) || '';

    // 1. Quoting reads the request and asks Cut to plan the stone (Gmail)
    seq.at(t, () => { activate('quoting'); switchApp('gmail'); startProcess(e); openEmail(e.id); setState('Quoting reads ' + who + "'s request"); });
    seq.at(t + 900, () => a2a('quoting', 'cut', 'plan.request', 'Quoting asks Cut to plan the stone and confirm the make.', { stone: stone, skill: 'plan-rough' }));
    t += 2100;

    // 2. Cut plans the rough
    seq.at(t, () => { activate('cut'); setState('Cut plans the stone'); addLine('Planning the rough: yield and make'); });
    seq.at(t + 950, () => a2a('cut', 'quoting', 'plan.result', 'Cut confirms the plan: make holds, yield is good.', { make: 'confirmed', confidence: 0.92 }));
    t += 1750;

    // 3. Quoting prices it, back of Rap (Price Model)
    seq.at(t, () => { activate('quoting'); closeRead(); switchApp('rapaport'); setState('Quoting prices it against the Rapaport list'); });
    seq.at(t + 600, () => { rapType(rapQueryFor(e)); addTyping(); });
    seq.at(t + 1500, () => { removeTyping(); rapListings(e); addLine('Rapaport and comparables pulled'); });
    seq.at(t + 2200, () => { rapPredict(); addLine('Pricing back of Rap', 'sys'); addTyping(); });
    seq.at(t + 3300, () => { removeTyping(); rapResolve(e); if (rapDisc) addLine('Fair value at ' + rapDisc.replace('-', '') + ' back of Rap', 'ok', true); });
    t += 3900;

    // 4. Quoting asks Compliance to check origin; Compliance builds the G7 DDS
    seq.at(t, () => { activate('quoting'); switchApp('gmail'); setState('Quoting asks Compliance to check origin'); });
    seq.at(t + 600, () => a2a('quoting', 'compliance', 'dds.request', 'Check this stone against its GIA report and confirm origin before the quote goes out.', { report: 'GIA', check: 'origin', skill: 'g7-dds' }));
    t += 1500;
    seq.at(t, () => { activate('compliance'); setState('Compliance checks origin'); addLine('Cross-checking the stone against GIA grading records'); });
    seq.at(t + 1100, () => addLine('Origin verified, no mismatch. G7 DDS ready.', 'ok', true));
    seq.at(t + 1500, () => a2a('compliance', 'quoting', 'dds.result', 'Stone matches GIA, origin clean, G7 Due Diligence Statement ready.', { matched: true, origin: 'verified', statement: 'G7-DDS' }));
    seq.at(t + 2050, () => addHumanLine('Priya', 'signed off on the origin check'));
    t += 2700;

    // 5. Quoting builds the quote; Wasi reviews it before it goes out
    seq.at(t, () => { activate('quoting'); setState('Quoting builds the quote'); });
    seq.at(t + 300, () => addLine('Rendered the piece, metal at spot'));
    seq.at(t + 1100, () => addLine('Margin checked against budget', 'ok', true));
    seq.at(t + 1500, () => addHumanLine('Wasi', 'reviewed the quote, cleared to send'));
    t += 1900;

    // 6. Quoting notifies the owner (Slack)
    const order = 'JL-' + (1042 + idx);
    const smsg = 'Quote ready. ' + who + ', order #' + order + ', ' + price + ' indicative.';
    seq.at(t, () => { activate('quoting'); switchApp('slack'); slackReset(); setState('Quoting notifies the owner'); });
    let tc = t + 500;
    for (let c = 0; c < smsg.length; c++) { const ch = smsg.charAt(c); seq.at(tc, () => slackTypeChar(ch)); tc += 40; }
    seq.at(tc + 260, () => addTyping());
    seq.at(tc + 700, () => { removeTyping(); slackSendMsg(e, smsg); setState('Owner notified in Slack'); addLine('Owner notified in Slack', 'ok', true); });
    t = tc + 700 + 1400;

    // 7. Quoting replies to the client (Gmail)
    seq.at(t, () => { activate('quoting'); switchApp('gmail'); finishProcess(e, idx, sc); openEmail(e.id); setState('Quote sent to ' + who); addLine('Reply sent, indicative ' + price, 'done', true); });
    seq.at(t + 2600, () => { closeRead(); setState('Clearing the rest of the queue'); });
    t += 2900;

    return t;
  }

  function playScenario(key) {
    seq.cancel();
    active = key || DEFAULT;
    const sc = D.scenarios[active];
    if (!sc) return;
    if (reduce) { renderFinalState(active); return; }
    resetStage(sc);
    running = true;

    const fe = sc.emails.find((e) => e.id === sc.feature) || sc.emails.find((e) => !e.noise);
    const quotes = sc.emails.filter((e) => !e.noise);
    const noise = sc.emails.filter((e) => e.noise);
    let t = 500;

    // inbox fills with everything: quote requests and noise
    sc.emails.forEach((e, i) => { seq.at(t, () => arrive(e, i, sc)); t += 300; });
    t += 250;
    // 1. The desk manager joins the shared workspace (pop + toast)
    seq.at(t, () => { els.dot.classList.add('live'); wasiJoin(); setState('Wasi joined the workspace'); });
    t += 1450;
    // 2. A second teammate, Priya, joins the same workspace
    seq.at(t, () => { priyaJoin(); setState('Priya joined the workspace'); });
    t += 1450;
    // 3. The scheduled run fires; the three shared agents join, one by one
    seq.at(t, () => {
      setTaskState('working');
      agentsJoin(); setState('Three shared agents joined the workspace');
      a2a('scheduler', 'quoting', 'run.dispatch', 'Scheduled run fired, inbox polled. ' + sc.emails.length + ' new threads.',
        { trigger: 'schedule', cron: '0 2 * * *', threads: sc.emails.length });
    });
    t += 1700;

    // 3. Quoting reads the inbox and sets aside the non-quotes
    seq.at(t, () => { activate('quoting'); switchApp('gmail'); setState('Quoting reads the inbox'); addLine('Reading the inbox, setting aside non-quotes'); addTyping(); });
    t += 700;
    noise.forEach((e) => {
      seq.at(t, () => { removeTyping(); startProcess(e); });
      seq.at(t + 320, () => filterNoise(e));
      t += 620;
    });
    seq.at(t, () => { removeTyping(); addLine(quotes.length + ' quote requests queued, ' + noise.length + ' filtered', 'ok', true); });
    t += 1100;

    // the featured request, worked end to end across the agent team
    t = scheduleFeature(fe, sc, t);

    // the rest of the quote queue, cleared quickly
    quotes.filter((e) => e !== fe).forEach((e) => {
      const idx = sc.emails.indexOf(e);
      seq.at(t, () => { activate('quoting'); startProcess(e); addLine(e.console[0], 'head'); });
      seq.at(t + 560, () => { addLine('Priced and replied', 'ok', true); finishProcess(e, idx, sc); });
      t += 820;
    });

    // wrap up
    t += 300;
    seq.at(t, () => { setState('Wrapping up'); agentsDone(); addLine(sc.closeLines[0], 'sys'); addTyping(); });
    t += 1300;
    seq.at(t, () => { removeTyping(); addLine(sc.closeLines[1], 'done', true); switchApp('gmail'); setTaskState('completed'); if (RUN) { RUN.status = 'COMPLETED'; renderRun(); } showFinale(sc); });
  }

  /* Skip target and reduced-motion path: the completed stage, no timers. */
  function renderFinalState(key) {
    seq.cancel();
    active = key;
    const sc = D.scenarios[key];
    if (!sc) return;
    resetStage(sc);
    const quotes = sc.emails.filter((e) => !e.noise);
    sc.emails.forEach((e) => {
      const row = rowOf(e);
      if (!row) return;
      row.classList.remove('is-hidden', 'unread');
      const slot = row.querySelector('.gm-slot');
      if (e.noise) {
        row.classList.add('gm-filtered');
        if (slot) slot.innerHTML = '<span class="gm-chip muted">Filtered</span>';
      } else {
        done[e.id] = true;
        if (slot) slot.innerHTML = chipHTML(false, e.chip || 'Replied');
      }
    });
    const empty = els.list.querySelector('.gm-empty');
    if (empty) empty.remove();
    unread = 0; setCount();
    els.range.textContent = quotes.length + ' quoted';
    wasiJoin(); priyaJoin(); agentsJoin(); agentsDone(); setTaskState('working');
    a2a('scheduler', 'quoting', 'run.dispatch', 'Scheduled run fired, inbox polled. ' + sc.emails.length + ' new threads.', { trigger: 'schedule', cron: '0 2 * * *' });
    a2a('quoting', 'cut', 'plan.request', 'Rough-cut plan requested for each piece.', { skill: 'plan-rough' });
    a2a('cut', 'quoting', 'plan.result', 'Plans confirmed, make holds.', { make: 'confirmed' });
    a2a('quoting', 'compliance', 'dds.request', 'Stones cross-checked against grading records, origin verified.', { skill: 'g7-dds' });
    a2a('compliance', 'quoting', 'dds.result', 'Origin clean, G7 Due Diligence Statement prepared.', { statement: 'G7-DDS' });
    addHumanLine('Priya', 'signed off on origin'); addHumanLine('Wasi', 'cleared the quote to send');
    setTaskState('completed'); if (RUN) { RUN.status = 'COMPLETED'; renderRun(); }
    addLine(sc.closeLines[1], 'done', true);
    showFinale(sc);
    els.log.scrollTop = els.log.scrollHeight;
  }

  /* ═══════ reading view ═══════ */
  function openEmail(id) {
    const sc = D.scenarios[active];
    const e = sc.emails.find((x) => x.id === id);
    if (!e) return;
    els.read.innerHTML = readHTML(e, sc);
    els.read.classList.remove('hidden');
    els.finale.classList.add('hidden'); // reading view sits above the finale overlay
  }

  function closeRead() {
    els.read.classList.add('hidden');
    els.read.innerHTML = '';
    if (finished) els.finale.classList.remove('hidden'); // restore the result on back
  }

  /* ═══════ init ═══════ */
  function init() {
    els = {
      stage: $('theaterStage'), list: $('gmList'), read: $('gmRead'),
      finale: $('theaterFinale'), log: $('acLog'), people: $('acPeople'),
      state: $('acState'), toast: $('acToast'), dot: $('acDot'),
      count: $('gmCount'), range: $('gmRange'), avatar: $('gmAvatar'),
      label: $('gmLabel'), cta: $('demoCTA'), skip: $('demoSkip'),
      replay: $('demoReplay'), presence: $('acPresence'), run: $('acRun'),
    };
    for (const k in els) { if (!els[k]) return; } // fail open if the section is absent

    // the UI observes real bus traffic; open any envelope to inspect the raw JSON-RPC
    busListeners.push(renderA2A);
    els.log.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.a2a-raw-btn');
      if (!btn) return;
      const pre = btn.nextElementSibling;
      const wasHidden = pre.hasAttribute('hidden');
      if (wasHidden) pre.removeAttribute('hidden'); else pre.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', wasHidden ? 'true' : 'false');
    });

    apps = {
      screens: document.querySelectorAll('#bfScreens .app-screen'),
      tabs: $('bfTabs'), url: $('bfUrl'),
      rapQuery: $('rapQuery'), rapRows: $('rapRows'), rapModel: $('rapModel'), rapOut: $('rapOut'),
      slackThread: $('slackThread'),
    };

    els.list.addEventListener('click', (ev) => {
      const row = ev.target.closest('.gm-row');
      if (row && !row.classList.contains('is-hidden')) openEmail(row.getAttribute('data-id'));
    });
    els.read.addEventListener('click', (ev) => { if (ev.target.closest('#gmBack')) closeRead(); });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !els.read.classList.contains('hidden')) closeRead();
    });

    els.skip.addEventListener('click', () => renderFinalState(active));
    els.replay.addEventListener('click', () => {
      if (reduce) renderFinalState(active); else playScenario(active);
    });

    // initial empty paint; the IntersectionObserver in index.html calls play() on scroll-in
    resetStage(D.scenarios[DEFAULT]);

    // public API used by the scroll-in autoplay
    JL.agentDemo = {
      play(key) { playScenario(key || DEFAULT); },
      stop() { seq.cancel(); running = false; },
      running() { return running; },
      reset() { resetStage(D.scenarios[active] || D.scenarios[DEFAULT]); },
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    try { init(); } catch (err) {
      try { console.warn('[agent-demo] failed open', err); } catch (e) {}
    }
  });
})();

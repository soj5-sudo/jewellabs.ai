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
  const A2A_PROTO = '0.2.9';
  // each agent advertises an Agent Card (served at /.well-known/agent-card.json by convention)
  const AGENTS = [
    { id: 'filters', name: 'Filters', ico: 'filter', card: {
      name: 'Filters Agent', description: 'Classifies inbound threads by intent and routes quote requests.',
      url: 'https://studio.jewellabs.org/a2a/filters', version: '1.2.0', protocolVersion: A2A_PROTO,
      preferredTransport: 'JSONRPC', capabilities: { streaming: true, pushNotifications: true, stateTransitionHistory: true },
      skills: [{ id: 'triage-inbox', name: 'Inbox triage', tags: ['classification', 'routing'] }] } },
    { id: 'quoting', name: 'Quoting', ico: 'diamond', card: {
      name: 'Quoting Agent', description: 'Owns the quote: renders the piece, requests a price, verifies margin, replies.',
      url: 'https://studio.jewellabs.org/a2a/quoting', version: '2.0.1', protocolVersion: A2A_PROTO,
      preferredTransport: 'JSONRPC', capabilities: { streaming: true, pushNotifications: true, stateTransitionHistory: true },
      skills: [{ id: 'compose-quote', name: 'Compose quote', tags: ['render', 'quote'] }] } },
    { id: 'pricing', name: 'Pricing', ico: 'price', card: {
      name: 'Pricing Agent', description: 'Predicts fair value from a model trained on the Rapaport list and live metal.',
      url: 'https://studio.jewellabs.org/a2a/pricing', version: '1.4.3', protocolVersion: A2A_PROTO,
      preferredTransport: 'JSONRPC', capabilities: { streaming: true, pushNotifications: false, stateTransitionHistory: true },
      skills: [{ id: 'fair-value', name: 'Fair value', tags: ['pricing', 'model'] }] } },
    { id: 'updates', name: 'Updates', ico: 'send', card: {
      name: 'Updates Agent', description: 'Notifies the owner in Slack and the client by email.',
      url: 'https://studio.jewellabs.org/a2a/updates', version: '1.1.0', protocolVersion: A2A_PROTO,
      preferredTransport: 'JSONRPC', capabilities: { streaming: true, pushNotifications: true, stateTransitionHistory: false },
      skills: [{ id: 'notify', name: 'Notify', tags: ['slack', 'email'] }] } },
  ];
  const AGENT = {}; AGENTS.forEach((a) => { AGENT[a.id] = a; });
  AGENT.scheduler = { id: 'scheduler', name: 'Scheduler' }; // the cron trigger (not a roster worker)

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
    // A2A role: the caller sends role:"user"; a responding agent replies role:"agent"
    const isResult = /(result|ack)$/.test(intent);
    const parts = [{ kind: 'text', text: text }];
    if (data) parts.push({ kind: 'data', data: data });
    return {
      jsonrpc: '2.0', id: uid('req'), method: 'message/send',
      params: { message: {
        role: isResult ? 'agent' : 'user', kind: 'message', messageId: uid('msg'),
        taskId: TASK ? TASK.id : null, contextId: TASK ? TASK.contextId : null,
        parts: parts,
        metadata: { 'a2a/from': fromId, 'a2a/to': toId, 'a2a/intent': intent },
      } },
    };
  }
  // the bus: dispatch a real message and let the UI observe genuine traffic
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
      '<p class="gm-reply-note">Indicative figure. The final quote prices at live metal spot and confirmed stone selection.</p>';
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
  function setState(s) { els.state.textContent = s; }
  function setFoot(s) { els.foot.textContent = s; }
  function setCount() { els.count.textContent = unread > 0 ? String(unread) : ''; }

  /* ═══════ multi-agent orchestration (A2A) ═══════ */
  function renderRoster() {
    if (!els.roster) return;
    els.roster.innerHTML = AGENTS.map((a) =>
      '<div class="ac-agent" data-agent="' + a.id + '" data-status="idle">' +
        '<span class="ac-agent-ico">' + (I[a.ico] || I.diamond) + '</span>' +
        '<span class="ac-agent-name">' + a.name + '</span>' +
        '<span class="ac-agent-dot"></span>' +
      '</div>').join('');
  }
  function agentChip(id) { return els.roster ? els.roster.querySelector('.ac-agent[data-agent="' + id + '"]') : null; }
  function setAgent(id, status) { const c = agentChip(id); if (c) c.setAttribute('data-status', status); }
  function activate(id) {
    AGENTS.forEach((a) => {
      const c = agentChip(a.id);
      if (c && c.getAttribute('data-status') !== 'done') c.setAttribute('data-status', a.id === id ? 'active' : 'idle');
    });
  }
  function agentsDone() { AGENTS.forEach((a) => setAgent(a.id, 'done')); }
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
      '<span class="ac-run-sched">' + (I.clock || '') + '<span>nightly &middot; ' + esc(RUN.trigger.cron) + ' UTC</span></span>' +
      '<span class="ac-run-task" data-state="' + esc(TASK.status.state) + '">' + esc(TASK.status.state) + '</span>' +
      '<span class="ac-run-count">' + RUN.a2a + ' A2A</span>';
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
    done = {}; unread = 0; finished = false;
    els.list.innerHTML = emptyHTML() + sc.emails.map(rowHTML).join('');
    els.read.classList.add('hidden'); els.read.innerHTML = '';
    els.finale.classList.add('hidden'); els.finale.innerHTML = '';
    els.log.innerHTML = '';
    resetApps();
    renderRoster();
    RUN = newRun(); TASK = newTask(); renderRun();
    els.name.textContent = sc.teamName || sc.agentName;
    setState('Standing by'); setFoot('Standing by');
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
    apps.rapOut.innerHTML =
      '<div class="rap-out-row"><span>Comparable set</span><b>matched</b></div>' +
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

    // Quoting picks up the routed request and asks Pricing for a value
    seq.at(t, () => { activate('quoting'); switchApp('gmail'); startProcess(e); setState('Quoting agent on ' + who); openEmail(e.id); });
    seq.at(t + 750, () => a2a('quoting', 'pricing', 'price.request', 'Quoting asks Pricing for a fair value on ' + who + "'s piece.",
      { item: e.subject, stone: (e.reply && e.reply.spec && e.reply.spec[0] ? e.reply.spec[0][1] : ''), skill: 'fair-value' }));
    t += 2000;

    // Pricing agent runs the model on the price-model tab
    seq.at(t, () => { activate('pricing'); closeRead(); switchApp('rapaport'); setState('Pricing agent running the model'); });
    seq.at(t + 600, () => { rapType(rapQueryFor(e)); addTyping(); });
    seq.at(t + 1500, () => { removeTyping(); rapListings(e); addLine('Reference and comparables pulled'); });
    seq.at(t + 2200, () => { rapPredict(); addLine('Predicting the fair value', 'sys'); addTyping(); });
    seq.at(t + 3400, () => { removeTyping(); rapResolve(e); });
    seq.at(t + 3700, () => a2a('pricing', 'quoting', 'price.result', 'Pricing returns ' + price + ' fair value, high confidence.',
      { fairValue: price, confidence: 0.94, basis: 'rapaport+spot' }));
    t += 4400;

    // Quoting assembles and verifies the quote
    seq.at(t, () => { activate('quoting'); switchApp('gmail'); setState('Quoting building the quote'); });
    seq.at(t + 300, () => addLine('Rendered the piece, metal added at spot'));
    seq.at(t + 1100, () => addLine('Margin checked, verified against budget', 'ok', true));
    t += 1900;

    // Quoting hands off to Comms, which messages the owner live in Slack
    const order = 'JL-' + (1042 + idx);
    const smsg = 'Quote ready. ' + who + ', order #' + order + ', ' + price + ' indicative.';
    seq.at(t, () => a2a('quoting', 'updates', 'notify.owner', 'Quoting asks Updates to notify the owner in Slack.', { channel: 'slack', order: order, amount: price }));
    seq.at(t + 750, () => { activate('updates'); switchApp('slack'); slackReset(); setState('Updates messaging the owner'); });
    let tc = t + 1150;
    for (let c = 0; c < smsg.length; c++) { const ch = smsg.charAt(c); seq.at(tc, () => slackTypeChar(ch)); tc += 40; }
    seq.at(tc + 260, () => addTyping());
    seq.at(tc + 700, () => { removeTyping(); slackSendMsg(e, smsg); setState('Owner notified'); addLine('Delivered to the owner in Slack', 'ok', true); });
    seq.at(tc + 950, () => a2a('updates', 'quoting', 'notify.ack', 'Updates confirms the owner has the quote.', { delivered: true, channel: 'slack' }));
    t = tc + 950 + 1500; // ~2s hold on the delivered message

    // Quoting sends the reply to the client
    seq.at(t, () => { activate('quoting'); switchApp('gmail'); finishProcess(e, idx, sc); openEmail(e.id); setState('Reply sent to ' + who); addLine('Reply sent, indicative ' + price, 'done', true); });
    seq.at(t + 2700, () => { closeRead(); setState('Working the queue'); });
    t += 3000;

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
    // the run is fired by the schedule; the Task moves to 'working'; the Scheduler hands off to Filters
    seq.at(t, () => {
      els.dot.classList.add('live'); setTaskState('working');
      a2a('scheduler', 'filters', 'run.dispatch', 'Scheduled run fired, inbox polled. ' + sc.emails.length + ' new threads to classify.',
        { trigger: 'schedule', cron: '0 2 * * *', threads: sc.emails.length });
      activate('filters'); setState('Filters classifying the inbox'); addLine('Searching threads, classifying intent by skill');
    });
    t += 1050;

    // Filters: classify, filter the noise, route the quote requests
    seq.at(t, () => { switchApp('gmail'); addTyping(); });
    t += 700;
    noise.forEach((e) => {
      seq.at(t, () => { removeTyping(); startProcess(e); });
      seq.at(t + 320, () => filterNoise(e));
      t += 620;
    });
    seq.at(t, () => { removeTyping(); a2a('filters', 'quoting', 'route.requests', quotes.length + ' quote requests routed to Quoting. ' + noise.length + ' non-quotes filtered.',
      { routed: quotes.length, filtered: noise.length, skill: 'triage-inbox' }); });
    t += 1300;

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
    agentsDone(); setTaskState('working');
    a2a('scheduler', 'filters', 'run.dispatch', 'Scheduled run fired, inbox polled. ' + sc.emails.length + ' new threads.', { trigger: 'schedule', cron: '0 2 * * *' });
    a2a('filters', 'quoting', 'route.requests', quotes.length + ' quote requests routed. ' + (sc.emails.length - quotes.length) + ' filtered.', { routed: quotes.length });
    a2a('quoting', 'pricing', 'price.request', 'Fair value requested for each piece.');
    a2a('pricing', 'quoting', 'price.result', 'Prices returned from the model.', { confidence: 0.94 });
    a2a('quoting', 'updates', 'notify.owner', 'Owner notified in Slack for every quote.', { channel: 'slack' });
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
      finale: $('theaterFinale'), log: $('acLog'), name: $('acName'),
      state: $('acState'), foot: $('acFoot'), dot: $('acDot'),
      count: $('gmCount'), range: $('gmRange'), avatar: $('gmAvatar'),
      label: $('gmLabel'), cta: $('demoCTA'), skip: $('demoSkip'),
      replay: $('demoReplay'), roster: $('acRoster'), run: $('acRun'),
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

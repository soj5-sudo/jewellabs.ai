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
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let els = null;
  let apps = null;
  let active = DEFAULT;
  let finished = false;
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
        '<div><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>').join('') + '</div>' +
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

  /* ═══════ stage control ═══════ */
  function resetStage(sc) {
    done = {}; unread = 0; finished = false;
    els.list.innerHTML = emptyHTML() + sc.emails.map(rowHTML).join('');
    els.read.classList.add('hidden'); els.read.innerHTML = '';
    els.finale.classList.add('hidden'); els.finale.innerHTML = '';
    els.log.innerHTML = '';
    resetApps();
    els.name.textContent = sc.agentName;
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
    finished = true;
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

    // Gmail: read the request
    seq.at(t, () => { switchApp('gmail'); startProcess(e); setState('Reading the request'); setFoot(e.from.name); });
    seq.at(t + 350, () => { addLine(e.console[0], 'head'); addTyping(); });
    seq.at(t + 1200, () => { removeTyping(); addLine(e.console[1]); openEmail(e.id); });
    t += 2200;

    // Price Model (our model, trained on Rapaport): search + predict fair value
    seq.at(t, () => { closeRead(); switchApp('rapaport'); setState('Pricing with our model'); addLine('Opening the price model', 'sys'); });
    seq.at(t + 600, () => { rapType(rapQueryFor(e)); addTyping(); });
    seq.at(t + 1500, () => { removeTyping(); rapListings(e); addLine('Pulled the Rapaport reference and comparables'); });
    seq.at(t + 2200, () => { rapPredict(); addLine('Predicting the fair value', 'sys'); addTyping(); });
    seq.at(t + 3500, () => { removeTyping(); rapResolve(e); addLine('Fair value locked at ' + price, 'ok', true); });
    t += 4200;

    // Back to Gmail: assemble and verify the quote
    seq.at(t, () => { switchApp('gmail'); setState('Building the quote'); });
    seq.at(t + 250, () => addLine('Added the stone at model price'));
    seq.at(t + 900, () => addLine('Added the metal at spot'));
    seq.at(t + 1500, () => addLine('Checked the margin, verified against budget', 'ok', true));
    t += 2100;

    // Slack: type the owner an update in real time, then send
    const order = 'JL-' + (1042 + idx);
    const smsg = 'Quote ready. ' + e.from.name + ', order #' + order + ', ' + price + ' indicative.';
    seq.at(t, () => { switchApp('slack'); slackReset(); setState('Messaging the owner'); addLine('Switching to Slack', 'sys'); });
    seq.at(t + 450, () => addLine('Typing the owner an update'));
    let tc = t + 750;
    for (let c = 0; c < smsg.length; c++) { const ch = smsg.charAt(c); seq.at(tc, () => slackTypeChar(ch)); tc += 40; }
    seq.at(tc + 260, () => addTyping());
    seq.at(tc + 700, () => { removeTyping(); slackSendMsg(e, smsg); setState('Message sent to you'); addLine('Sent to the owner in Slack', 'ok', true); });
    t = tc + 700 + 1500; // hold on the delivered Slack message for ~2s before moving on

    // Back to Gmail: send the reply
    seq.at(t, () => { switchApp('gmail'); finishProcess(e, idx, sc); openEmail(e.id); setState('Reply sent'); addLine('Reply sent to ' + e.from.name + ', indicative ' + price, 'done', true); });
    seq.at(t + 2700, () => { closeRead(); setState('Working the inbox'); });
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

    const fe = sc.emails.find((e) => e.id === sc.feature) || sc.emails[0];
    let t = 500;

    // inbox fills
    sc.emails.forEach((e, i) => { seq.at(t, () => arrive(e, i, sc)); t += 320; });
    t += 250;
    seq.at(t, () => { els.dot.classList.add('live'); setState('Watching the inbox'); addLine(sc.openLine, 'sys'); });
    t += 650;

    // the featured request, worked end to end across apps
    t = scheduleFeature(fe, sc, t);

    // the rest of the queue, cleared quickly
    sc.emails.filter((e) => e !== fe).forEach((e) => {
      const idx = sc.emails.indexOf(e);
      seq.at(t, () => { startProcess(e); addLine(e.console[0], 'head'); });
      seq.at(t + 520, () => { addLine('Rendered, priced, replied', 'ok', true); finishProcess(e, idx, sc); });
      t += 820;
    });

    // wrap up
    t += 300;
    seq.at(t, () => { setState('Wrapping up'); addLine(sc.closeLines[0], 'sys'); addTyping(); });
    t += 1300;
    seq.at(t, () => { removeTyping(); addLine(sc.closeLines[1], 'done', true); switchApp('gmail'); showFinale(sc); });
  }

  /* Skip target and reduced-motion path: the completed stage, no timers. */
  function renderFinalState(key) {
    seq.cancel();
    active = key;
    const sc = D.scenarios[key];
    if (!sc) return;
    resetStage(sc);
    const verdicts = computeVerdicts(sc);
    sc.emails.forEach((e) => {
      done[e.id] = true;
      const row = rowOf(e);
      if (!row) return;
      row.classList.remove('is-hidden', 'unread');
      const bad = isBlocked(e, verdicts);
      if (bad) row.classList.add('gm-bad');
      const slot = row.querySelector('.gm-slot');
      if (slot) slot.innerHTML = chipHTML(bad, bad ? 'Blocked' : (e.chip || 'Processed'));
    });
    const empty = els.list.querySelector('.gm-empty');
    if (empty) empty.remove();
    unread = 0; setCount();
    els.range.textContent = sc.emails.length + ' of ' + sc.emails.length;
    addLine(sc.openLine, 'sys');
    sc.emails.forEach((e) => {
      const bad = isBlocked(e, verdicts);
      (e.console || []).forEach((ln, j) => {
        let cls = '';
        if (j === 0) cls = 'head';
        else if (bad) cls = 'bad';
        else if (j === (e.console.length - 1)) cls = 'ok';
        addLine(ln, cls, j === e.console.length - 1 && j > 0);
      });
    });
    addLine(sc.closeLines[0], 'sys');
    addLine(sc.closeLines[1], 'done', true);
    showFinale(sc, verdicts);
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
      replay: $('demoReplay'),
    };
    for (const k in els) { if (!els[k]) return; } // fail open if the section is absent

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
      stop() { seq.cancel(); },
      reset() { resetStage(D.scenarios[active] || D.scenarios[DEFAULT]); },
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    try { init(); } catch (err) {
      try { console.warn('[agent-demo] failed open', err); } catch (e) {}
    }
  });
})();

/* ═══════════════════════════════════════════════════════════
   Jewel Labs assistant — bottom-left widget
   Talks to /api/chat (Gemini, key stays server-side).
   Falls back to a built-in knowledge base if the API is
   unavailable, so it always answers. Company-scoped only.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var ENDPOINT = '/api/chat';
  var BOOK = 'https://cal.com/soham-jariwala-4fvbkw/15min';
  var STUDIO = 'https://studio.jewellabs.io';
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var GREETING = 'Hi, I am the Jewel Labs assistant. Ask me anything about what we build for the jewelry, diamond, and rare-metal trade, or how we work with new clients and investors.';
  var CHIPS = ['What does Jewel Labs do?', 'How do you handle G7 compliance?', 'Who is on the team?', 'How do we get started?'];

  // ── built-in fallback (used only if /api/chat is unreachable) ──
  function localAnswer(q) {
    var s = (q || '').toLowerCase();
    function has() { for (var i = 0; i < arguments.length; i++) if (s.indexOf(arguments[i]) !== -1) return true; return false; }

    if (has('price', 'cost', 'how much', 'pricing', 'quote', 'budget'))
      return 'Every build is scoped to the house, so pricing is set on a discovery call rather than a fixed list. We work on a subscription that covers deployment plus ongoing maintenance and scaling. The fastest way to a number is to book a short call: ' + BOOK;
    if (has('storefront', 'website', 'web site', 'shop', 'ecommerce', 'e-commerce', 'checkout', 'configurator'))
      return 'We build bespoke AI jewelry storefronts where customers design and customize pieces online, get instant quotes and feasibility checks, view items in 3D, and check out securely with Stripe, PayPal, or crypto. Never a template.';
    if (has('voice', 'call', 'phone', 'inbound', 'receptionist'))
      return 'Our AI voice agents answer every inbound call, hold a natural conversation, qualify the lead and capture intent, then drop a structured summary in your inbox. No call goes to voicemail.';
    if (has('compliance', 'g7', 'dds', 'due diligence', 'tax', 'customs', 'vat', 'provenance', 'kimberley'))
      return 'We turn compliance into a workflow: invoice in, signed Due Diligence Statement out, audit trail kept. It covers cross-border customs, localized VAT, and G7 sourcing rules, with missing-data flags routed for human review.';
    if (has('design', 'render', 'cad', 'concept', 'archive'))
      return 'Our private design AI takes a description or a rough layout and returns studio-grade renders, bench specs, and channel-ready copy. It is trained on your archive and your IP never leaves your tenancy.';
    if (has('diamond planning', 'rough', 'cut', 'yield', 'carat', 'planning'))
      return 'Diamond Planning AI lets you upload a rough diamond and get recommendations on the best cutting strategy to maximize carat yield, brilliance, or overall value.';
    if (has('crm', 'automation', 'workflow', 'meeting', 'summary', 'task', 'campaign', 'jck', 'rjo'))
      return 'Smart Business Automation covers an AI-powered CRM, meeting summaries and task allocation, voice agents, and end-to-end workflow automation, including campaigns before shows like JCK and RJO.';
    if (has('trading', 'market intelligence', 'ai-native', 'ai native', 'arbitrage'))
      return 'Yes. Jewel Labs builds AI-native trading and market-intelligence systems for diamonds, jewelry, and rare metals, alongside our AI infrastructure for storefronts, diamond planning, compliance, design, and automation.';
    if (has('custom', 'fine-tune', 'fine tune', 'model', 'wrapper', 'private'))
      return 'We build private AI models fine-tuned to your business, not GPT wrappers. That spans design, manufacturing, sales, customer service, data licensing, or any unique operational need, all on your own private infrastructure.';
    if (has('team', 'founder', 'background', 'who are you', 'who is', 'about you'))
      return 'The founding team comes out of Cornell, CMU, Berkeley, and Stanford, has worked with Fortune 500 companies across India, Los Angeles, and Singapore, and a previous venture was featured in Forbes 30 Under 30.';
    if (has('invest', 'vc', 'backed', 'funding', 'traction', 'raise', 'angel'))
      return 'Jewel Labs is backed by leading angel AI investors, including Cornell Commons and G Fellows. We build dedicated AI infrastructure exclusively for the jewelry, diamond, and rare-metal trade. For the deeper story, the team is happy to talk: ' + BOOK;
    if (has('start', 'get started', 'onboard', 'process', 'how do we', 'how does it work', 'timeline'))
      return 'Four steps: Discovery (a working call to map your business), Blueprint (a written spec), Deployment (storefront, then agents, then compliance, then design, in weeks on your own infrastructure), and Operate (maintenance and iteration). Start here: ' + BOOK;
    if (has('demo', 'contact', 'book', 'call you', 'talk', 'reach'))
      return 'Happy to. Book a 15-minute demo here: ' + BOOK + '. You can also try the studio yourself: ' + STUDIO;
    if (has('hi', 'hello', 'hey', 'yo '))
      return GREETING;
    if (has('what', 'do you', 'services', 'offer', 'help'))
      return 'Jewel Labs builds dedicated AI infrastructure for the jewelry, diamond, and rare-metal trade: bespoke storefronts, AI voice agents, G7 compliance automation, private design AI, and custom fine-tuned models. Which of those is most relevant to you?';
    return 'I can walk you through our storefronts, AI voice agents, G7 compliance automation, design AI, the team, or how we start with a new client. What would you like to know? You can also book a demo: ' + BOOK;
  }

  // ── DOM build ──
  var el = {};
  function icon(paths) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = paths; return svg;
  }
  var DIAMOND = '<polygon points="12,2.5 21.5,12 12,21.5 2.5,12"/><polygon points="12,7.5 16.5,12 12,16.5 7.5,12"/><path d="M12 2.5v5M12 21.5v-5M2.5 12h5M21.5 12h-5"/>';
  var CHAT = '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>';

  function build() {
    var root = document.createElement('div');
    root.className = 'jl-chat'; root.id = 'jl-chat';

    var launch = document.createElement('button');
    launch.className = 'jl-chat__launch'; launch.id = 'jl-chat-launch';
    launch.setAttribute('aria-label', 'Chat with the Jewel Labs assistant');
    launch.setAttribute('aria-expanded', 'false');
    var ltext = document.createElement('span'); ltext.textContent = 'Ask Jewel Labs';
    launch.appendChild(icon(CHAT)); launch.appendChild(ltext);

    var panel = document.createElement('div');
    panel.className = 'jl-chat__panel'; panel.id = 'jl-chat-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Jewel Labs assistant');

    // header
    var head = document.createElement('div'); head.className = 'jl-chat__head';
    var mark = document.createElement('div'); mark.className = 'jl-chat__mark'; mark.appendChild(icon(DIAMOND));
    var id = document.createElement('div'); id.className = 'jl-chat__id';
    var name = document.createElement('span'); name.className = 'jl-chat__name'; name.textContent = 'Jewel Labs';
    var status = document.createElement('span'); status.className = 'jl-chat__status'; status.textContent = 'Assistant';
    id.appendChild(name); id.appendChild(status);
    var close = document.createElement('button'); close.className = 'jl-chat__close'; close.setAttribute('aria-label', 'Close chat');
    close.appendChild(icon('<path d="M6 6l12 12M18 6L6 18"/>'));
    head.appendChild(mark); head.appendChild(id); head.appendChild(close);

    var log = document.createElement('div'); log.className = 'jl-chat__log'; log.id = 'jl-chat-log';
    var suggest = document.createElement('div'); suggest.className = 'jl-chat__suggest'; suggest.id = 'jl-chat-suggest';

    var form = document.createElement('form'); form.className = 'jl-chat__form';
    var input = document.createElement('textarea');
    input.className = 'jl-chat__input'; input.rows = 1; input.placeholder = 'Ask about Jewel Labs...';
    input.setAttribute('aria-label', 'Message'); input.maxLength = 1000;
    var send = document.createElement('button'); send.className = 'jl-chat__send'; send.type = 'submit';
    send.setAttribute('aria-label', 'Send'); send.appendChild(icon('<path d="M5 12h14M13 6l6 6-6 6"/>'));
    form.appendChild(input); form.appendChild(send);

    var foot = document.createElement('div'); foot.className = 'jl-chat__foot';
    foot.textContent = 'Made by Jewel Labs';

    panel.appendChild(head); panel.appendChild(log); panel.appendChild(suggest); panel.appendChild(form); panel.appendChild(foot);
    root.appendChild(panel); root.appendChild(launch);
    document.body.appendChild(root);

    el = { root: root, launch: launch, panel: panel, close: close, log: log, suggest: suggest, form: form, input: input, send: send };
  }

  // ── rendering (safe: text nodes + linkified anchors only) ──
  var URL_RE = /(https?:\/\/[^\s]+)/g;
  function appendText(node, text) {
    var last = 0, m;
    URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(text)) !== null) {
      var url = m[0], trail = '';
      var tm = url.match(/[.,;:!?)\]}'"]+$/);   // don't swallow trailing punctuation into the link
      if (tm) { trail = tm[0]; url = url.slice(0, url.length - trail.length); }
      if (m.index > last) node.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = url;
      node.appendChild(a);
      if (trail) node.appendChild(document.createTextNode(trail));
      last = m.index + m[0].length;
    }
    if (last < text.length) node.appendChild(document.createTextNode(text.slice(last)));
  }
  function addMessage(role, text) {
    var m = document.createElement('div');
    m.className = 'jl-msg jl-msg--' + (role === 'user' ? 'user' : 'bot');
    appendText(m, text);
    el.log.appendChild(m);
    el.log.scrollTop = el.log.scrollHeight;
    return m;
  }
  function showTyping() {
    var t = document.createElement('div'); t.className = 'jl-typing';
    t.appendChild(document.createElement('span')); t.appendChild(document.createElement('span')); t.appendChild(document.createElement('span'));
    el.log.appendChild(t); el.log.scrollTop = el.log.scrollHeight; return t;
  }

  // ── state ──
  var history = [];   // { role: 'user' | 'model', text }
  var busy = false;
  var greeted = false;

  function open() {
    el.root.classList.add('is-open');
    el.launch.setAttribute('aria-expanded', 'true');
    if (!greeted) {
      greeted = true;
      addMessage('model', GREETING);
      history.push({ role: 'model', text: GREETING });
      CHIPS.forEach(function (c) {
        var b = document.createElement('button'); b.className = 'jl-chip'; b.type = 'button'; b.textContent = c;
        b.addEventListener('click', function () { el.suggest.innerHTML = ''; sendMessage(c); });
        el.suggest.appendChild(b);
      });
    }
    setTimeout(function () { el.input.focus(); }, 60);
  }
  function close() {
    el.root.classList.remove('is-open');
    el.launch.setAttribute('aria-expanded', 'false');
    el.launch.focus();
  }

  async function sendMessage(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    busy = true; el.send.disabled = true;
    el.suggest.innerHTML = '';
    addMessage('user', text);
    history.push({ role: 'user', text: text });
    el.input.value = ''; autosize();
    var typing = showTyping();

    var reply;
    try {
      var ctrl = new AbortController();
      var to = setTimeout(function () { ctrl.abort(); }, 13000);
      var res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-12) }),
        signal: ctrl.signal
      });
      clearTimeout(to);
      if (!res.ok) throw new Error('http_' + res.status);
      var data = await res.json();
      reply = (data && data.reply ? String(data.reply) : '').trim();
      if (!reply) throw new Error('empty');
    } catch (err) {
      reply = localAnswer(text);
    }

    if (typing.parentNode) typing.parentNode.removeChild(typing);
    addMessage('model', reply);
    history.push({ role: 'model', text: reply });
    busy = false; el.send.disabled = false;
    el.input.focus();
  }

  function autosize() {
    el.input.style.height = 'auto';
    el.input.style.height = Math.min(el.input.scrollHeight, 96) + 'px';
  }

  function wire() {
    el.launch.addEventListener('click', open);
    el.close.addEventListener('click', close);
    el.form.addEventListener('submit', function (e) { e.preventDefault(); sendMessage(el.input.value); });
    el.input.addEventListener('input', autosize);
    el.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(el.input.value); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && el.root.classList.contains('is-open')) close(); });
    // use pointerdown so the check runs before any in-panel handler mutates the DOM
    // (a chip click clears the chips; on 'click' the detached target would read as "outside")
    document.addEventListener('pointerdown', function (e) {
      if (el.root.classList.contains('is-open') && !el.root.contains(e.target)) close();
    });
  }

  function reveal() { el.root.classList.add('is-ready'); }

  function init() {
    build(); wire();
    // Reveal after the intro settles (fail-open: also on a fixed timer).
    if (prefersReduced) { reveal(); }
    else { setTimeout(reveal, 5200); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

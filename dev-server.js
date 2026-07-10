'use strict';

/* Local dev only. Serves the static site AND runs /api/chat with the
   real Gemini call, so you can test exactly what ships on Vercel.
   Usage:  node dev-server.js   (reads .env, defaults to port 5273)
   Production uses Vercel's /api/chat.js instead — this file is not deployed. */

var http = require('http');
var fs = require('fs');
var path = require('path');

// ---- tiny .env loader (no dependency) ----
(function loadEnv() {
  try {
    var raw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    raw.split('\n').forEach(function (line) {
      var s = line.trim();
      if (!s || s[0] === '#') return;
      var eq = s.indexOf('=');
      if (eq < 0) return;
      var k = s.slice(0, eq).trim();
      var v = s.slice(eq + 1).trim();
      if (!(k in process.env)) process.env[k] = v;
    });
  } catch (_) { /* no .env — fallback mode */ }
})();

var lib = require('./api/_lib');

var PORT = process.env.PORT || 5273;
var TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8'
};

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

var server = http.createServer(function (req, res) {
  // ---- API ----
  if (req.url.split('?')[0] === '/api/chat') {
    if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method_not_allowed' });
    var chunks = '';
    req.on('data', function (c) { chunks += c; if (chunks.length > 1e5) req.destroy(); });
    req.on('end', function () {
      var body = {};
      try { body = JSON.parse(chunks || '{}'); } catch (_) {}
      var messages = Array.isArray(body.messages) ? body.messages : [];
      if (!messages.length) return sendJSON(res, 400, { error: 'no_messages' });
      lib.askGemini(messages)
        .then(function (reply) { sendJSON(res, 200, { reply: reply }); })
        .catch(function (err) {
          console.error('[chat]', err && err.code, err && err.message);
          sendJSON(res, err && err.code === 'NO_KEY' ? 503 : 502, { error: 'assistant_unavailable' });
        });
    });
    return;
  }

  // ---- static ----
  var urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  var filePath = path.join(__dirname, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  fs.readFile(filePath, function (err, buf) {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, function () {
  var mode = process.env.GEMINI_API_KEY ? 'live Gemini' : 'fallback (no key)';
  console.log('Jewel Labs dev server → http://localhost:' + PORT + '  [' + mode + ']');
});

'use strict';

/* Vercel / Node serverless function — POST /api/chat
   Keeps GEMINI_API_KEY server-side. Body: { messages: [{role,text}, ...] } */

var lib = require('./lib');

// Best-effort in-memory rate limit (per warm instance).
var HITS = {};
var WINDOW_MS = 60000;
var MAX_PER_WINDOW = 20;

function limited(ip) {
  var now = Date.now();
  var rec = HITS[ip] || { n: 0, t: now };
  if (now - rec.t > WINDOW_MS) { rec.n = 0; rec.t = now; }
  rec.n++;
  HITS[ip] = rec;
  return rec.n > MAX_PER_WINDOW;
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'method_not_allowed' }));
  }

  var ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'local';
  if (limited(ip)) {
    res.statusCode = 429;
    return res.end(JSON.stringify({ error: 'rate_limited' }));
  }

  try {
    var body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch (_) { body = {}; } }
    if (!body || typeof body !== 'object') body = {};

    var messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'no_messages' }));
    }

    var reply = await lib.askGemini(messages);
    res.statusCode = 200;
    return res.end(JSON.stringify({ reply: reply }));
  } catch (err) {
    // Signal the client to use its local knowledge-base fallback.
    var code = err && err.code === 'NO_KEY' ? 503 : 502;
    res.statusCode = code;
    return res.end(JSON.stringify({ error: 'assistant_unavailable' }));
  }
};

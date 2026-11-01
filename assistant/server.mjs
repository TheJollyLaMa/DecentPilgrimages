// Consent/origin/body/timeout gates adapted from DecentBusking bf852757 agent-service/server.mjs.
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { askModel, validateAnswer } from './model.mjs';

const problem = (status, message) => Object.assign(new Error(message), { status });

export function loadSettings(env = process.env) {
  const origins = String(env.PILGRIMAGE_ASSISTANT_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Origins must be exact HTTPS origins (localhost HTTP permitted).');
  }
  const bounded = (key, fallback, maximum) => {
    const value = Number(env[key] || fallback);
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new Error(`Invalid ${key}.`);
    return value;
  };
  return {
    enabled: env.PILGRIMAGE_ASSISTANT_ENABLED === 'true',
    apiKey: env.OPENAI_API_KEY || '',
    model: env.PILGRIMAGE_ASSISTANT_MODEL || '',
    origins,
    timeoutMs: bounded('PILGRIMAGE_ASSISTANT_TIMEOUT_MS', 8000, 15000),
    maxConcurrent: bounded('PILGRIMAGE_ASSISTANT_CONCURRENCY', 2, 4),
    maxCalls: bounded('PILGRIMAGE_ASSISTANT_MAX_CALLS', 100, 1000),
  };
}

export function createAssistantServer(settings = loadSettings(), { modelCall = askModel, now = Date.now } = {}) {
  let active = 0, calls = 0;
  const rates = new Map(), controllers = new Set();
  const configured = () => settings.enabled && settings.apiKey && settings.model && settings.origins.length;
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, value) => {
      if (!response.destroyed && !response.writableEnded) {
        response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify(value));
      }
    };
    try {
      if (request.url === '/health' && request.method === 'GET') return send(200, { enabled: Boolean(configured()), status: configured() ? 'configured' : 'disabled' });
      const origin = request.headers.origin;
      if (!settings.origins.includes(origin)) throw problem(403, 'Origin not allowed.');
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      if (request.method === 'OPTIONS' && request.url === '/message') {
        response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        response.writeHead(204); response.end(); return;
      }
      if (request.url !== '/message' || request.method !== 'POST') throw problem(404, 'Not found.');
      if (!configured()) throw problem(503, 'Trail helper disabled or unconfigured. No model request was made.');
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] || '')) throw problem(415, 'Expected application/json.');
      if (Number(request.headers['content-length'] || 0) > 6000) throw problem(413, 'Message too large.');
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 6000) throw problem(413, 'Message too large.');
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { throw problem(400, 'Invalid JSON.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['consent', 'message'].includes(key)) ||
          body.consent !== true || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 1200) throw problem(400, 'Explicit per-message consent and 1–1,200 characters are required. Context fields are not accepted.');
      if (active >= settings.maxConcurrent) throw problem(429, 'Helper busy. Try again later; no automatic retry.');
      if (calls >= settings.maxCalls) throw problem(503, 'Helper request budget exhausted pending steward review.');
      const key = request.socket.remoteAddress;
      for (const [address, value] of rates) if (value.until <= now()) rates.delete(address);
      if (!rates.has(key) && rates.size >= 1000) throw problem(503, 'Helper capacity reached.');
      const rate = rates.get(key) || { count: 0, until: now() + 60000 };
      if (++rate.count > 5) throw problem(429, 'Please wait a minute before another message.');
      rates.set(key, rate);
      ++active; ++calls;
      const controller = new AbortController();
      controllers.add(controller);
      let timer;
      const disconnected = () => { if (!response.writableEnded) controller.abort(); };
      response.on('close', disconnected);
      try {
        const deadline = new Promise((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(problem(504, 'Helper timed out. No automatic retry was made.')); }, settings.timeoutMs);
        });
        const answer = validateAnswer(await Promise.race([modelCall({ apiKey: settings.apiKey, model: settings.model, message: body.message.trim(), signal: controller.signal }), deadline]));
        send(200, answer);
      } catch (error) {
        throw problem(error.status === 504 ? 504 : 503, error.status === 504 ? error.message : 'Helper unavailable or unchecked answer withheld. No automatic retry.');
      } finally {
        clearTimeout(timer);
        response.off('close', disconnected);
        controllers.delete(controller);
        --active;
      }
    } catch (error) {
      send(error.status || 503, { error: error.status ? error.message : 'Helper unavailable.' });
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.on('close', () => { for (const controller of controllers) controller.abort(); });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createAssistantServer();
  const port = Number(process.env.PILGRIMAGE_ASSISTANT_PORT || 8787);
  server.listen(port, '127.0.0.1', () => console.log(`Trail helper on localhost:${port}; activation is explicit.`));
}

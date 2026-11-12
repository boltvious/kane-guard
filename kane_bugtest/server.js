'use strict';

/**
 * Kane Bug-Injection Sandbox
 * ---------------------------
 * A tiny zero-dependency web app with a switchable bug.
 *
 * The point: record a passing flow with Kane CLI while the app is CORRECT,
 * then flip `bug.mode` to something broken and re-run the SAME flow.
 *
 *   - If Kane reports FAIL  -> it genuinely verified behaviour.
 *   - If Kane reports PASS  -> it produced a FALSE PASS and cannot be trusted
 *                              as a verification layer on that flow.
 *
 * The bug is read from disk on every request, so no restart is needed.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const MODE_FILE = path.join(ROOT, 'bug.mode');

const USERS = { admin: 'secret123', demo: 'demo1234' };
const sessions = new Set();

let tasks = [{ id: 1, title: 'Sample task' }];
let nextId = 2;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function bugMode() {
  try {
    return fs.readFileSync(MODE_FILE, 'utf8').trim() || 'off';
  } catch {
    return 'off';
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function grantSession(res, status, payload) {
  const token = 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessions.add(token);
  res.setHeader('Set-Cookie', `sid=${token}; Path=/; HttpOnly; SameSite=Lax`);
  sendJson(res, status, payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function isAuthed(req) {
  return sessions.has(cookies(req).sid || '');
}

function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  const filePath = path.join(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;
  const mode = bugMode();

  try {
    // --- diagnostics -------------------------------------------------------
    if (p === '/api/_mode' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, mode });
    }

    if (p === '/api/reset' && req.method === 'POST') {
      tasks = [{ id: 1, title: 'Sample task' }];
      nextId = 2;
      sessions.clear();
      return sendJson(res, 200, { ok: true });
    }

    // --- auth --------------------------------------------------------------
    if (p === '/api/login' && req.method === 'POST') {
      const body = await readBody(req);
      const username = String(body.username ?? '');
      const password = String(body.password ?? '');
      const known = Object.prototype.hasOwnProperty.call(USERS, username);
      const expected = known ? USERS[username] : null;
      const valid = known && expected === password;

      // BUG(logic): password is never compared. Any known username + any
      // non-empty password is granted a session. Classic auth regression.
      if (mode === 'logic' && known && password.length > 0) {
        return grantSession(res, 200, { ok: true, bug: 'logic' });
      }

      // BUG(silent): always HTTP 200, but no session on bad credentials.
      // A flow that asserts "status === 200" passes while login failed.
      if (mode === 'silent') {
        return sendJson(res, 200, {
          ok: valid,
          error: valid ? undefined : 'Invalid username or password',
        });
      }

      if (!valid) {
        return sendJson(res, 401, { ok: false, error: 'Invalid username or password' });
      }
      return grantSession(res, 200, { ok: true });
    }

    if (p === '/api/logout' && req.method === 'POST') {
      sessions.delete(cookies(req).sid || '');
      return sendJson(res, 200, { ok: true });
    }

    if (p === '/api/session' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, authenticated: isAuthed(req) });
    }

    // --- tasks -------------------------------------------------------------
    if (p === '/api/tasks' && req.method === 'GET') {
      if (!isAuthed(req)) return sendJson(res, 401, { ok: false, error: 'Not authenticated' });
      // BUG(crash): happy path explodes loudly after login.
      if (mode === 'crash') return sendJson(res, 500, { ok: false, error: 'Internal server error' });
      return sendJson(res, 200, { ok: true, tasks });
    }

    if (p === '/api/tasks' && req.method === 'POST') {
      if (!isAuthed(req)) return sendJson(res, 401, { ok: false, error: 'Not authenticated' });
      const body = await readBody(req);
      const title = String(body.title ?? '').trim();
      if (!title) return sendJson(res, 400, { ok: false, error: 'Title is required' });

      // BUG(data): answers 200/ok with a fake task, but nothing is stored.
      // The UI optimistically shows it; a reload proves it never existed.
      if (mode === 'data') {
        return sendJson(res, 200, { ok: true, task: { id: -1, title } });
      }

      const task = { id: nextId++, title };
      tasks.push(task);
      return sendJson(res, 201, { ok: true, task });
    }

    const idMatch = p.match(/^\/api\/tasks\/(\d+)$/);
    if (idMatch && req.method === 'DELETE') {
      if (!isAuthed(req)) return sendJson(res, 401, { ok: false, error: 'Not authenticated' });
      const id = Number(idMatch[1]);
      if (!tasks.some((t) => t.id === id)) {
        return sendJson(res, 404, { ok: false, error: 'Task not found' });
      }
      // BUG(ui): claims success, server keeps the row. Looks deleted until reload.
      if (mode === 'ui') return sendJson(res, 200, { ok: true });

      tasks = tasks.filter((t) => t.id !== id);
      return sendJson(res, 200, { ok: true });
    }

    // --- static ------------------------------------------------------------
    if (req.method === 'GET' || req.method === 'HEAD') {
      return serveStatic(res, p);
    }

    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: String(err && err.message ? err.message : err) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Kane bug sandbox running on http://127.0.0.1:${PORT}  (bug mode: ${bugMode()})`);
});

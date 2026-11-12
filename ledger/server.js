'use strict';

/**
 * Ledger — mini issue tracker (app demo untuk Kane Guard)
 * --------------------------------------------------------
 * Node murni, tanpa dependency. State di JSON. Bisa di-reset lewat API
 * supaya test idempoten (I4).
 *
 * Rute:
 *   GET  /                    UI
 *   GET  /api/issues          daftar issue
 *   POST /api/issues          buat issue { title }
 *   POST /api/issues/:id/done tandai selesai
 *   DELETE /api/issues/:id    hapus
 *   POST /api/reset           kembalikan ke state awal
 *   GET  /guard               dashboard Kane Guard (proxy)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.LEDGER_PORT || 4175);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const STATE_FILE = path.join(ROOT, 'state.json');
const GUARD_URL = process.env.GUARD_URL || 'http://127.0.0.1:4174/';
const MODE_FILE = path.join(ROOT, 'bug.mode');

const INITIAL = [{ id: 1, title: 'Review PR #12', status: 'open' }];

function bugMode() {
  try {
    return fs.readFileSync(MODE_FILE, 'utf8').trim() || 'off';
  } catch {
    return 'off';
  }
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return structuredClone(INITIAL);
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

let issues = loadState();
let nextId = Math.max(0, ...issues.map((i) => i.id)) + 1;

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
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

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

function proxyGuard(res) {
  const target = new URL(GUARD_URL);
  const req = http.request(
    { hostname: target.hostname, port: target.port, path: '/', method: 'GET' },
    (upstream) => {
      res.writeHead(upstream.statusCode || 502, {
        'Content-Type': upstream.headers['content-type'] || 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      upstream.pipe(res);
    }
  );
  req.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Kane Guard belum jalan di ' + GUARD_URL);
  });
  req.end();
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const p = url.pathname;

    // --- API ---
    if (p === '/api/issues' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, issues });
    }

    if (p === '/api/issues' && req.method === 'POST') {
      const body = await readBody(req);
      const title = String(body.title ?? '').trim();
      if (!title) return sendJson(res, 400, { ok: false, error: 'Judul wajib diisi' });

      const mode = bugMode();

      // BUG(add_crash): endpoint gagal total
      if (mode === 'add_crash') {
        return sendJson(res, 500, { ok: false, error: 'Internal server error' });
      }

      // BUG(add_lost): balas 201 tapi tidak menyimpan
      if (mode === 'add_lost') {
        return sendJson(res, 201, { ok: true, issue: { id: nextId++, title, status: 'open' } });
      }

      const issue = { id: nextId++, title, status: 'open' };
      issues.push(issue);
      saveState(issues);
      return sendJson(res, 201, { ok: true, issue });
    }

    const doneMatch = p.match(/^\/api\/issues\/(\d+)\/done$/);
    if (doneMatch && req.method === 'POST') {
      const id = Number(doneMatch[1]);
      const issue = issues.find((i) => i.id === id);
      if (!issue) return sendJson(res, 404, { ok: false, error: 'Issue tidak ditemukan' });

      // BUG(done_lost): balas 200 tapi status tidak berubah
      if (bugMode() === 'done_lost') {
        return sendJson(res, 200, { ok: true, issue });
      }

      issue.status = 'done';
      saveState(issues);
      return sendJson(res, 200, { ok: true, issue });
    }

    const idMatch = p.match(/^\/api\/issues\/(\d+)$/);
    if (idMatch && req.method === 'DELETE') {
      const id = Number(idMatch[1]);
      if (!issues.some((i) => i.id === id)) {
        return sendJson(res, 404, { ok: false, error: 'Issue tidak ditemukan' });
      }
      issues = issues.filter((i) => i.id !== id);
      saveState(issues);
      return sendJson(res, 200, { ok: true });
    }

    if (p === '/api/reset' && req.method === 'POST') {
      issues = structuredClone(INITIAL);
      nextId = Math.max(0, ...issues.map((i) => i.id)) + 1;
      saveState(issues);
      return sendJson(res, 200, { ok: true, issues });
    }

    if (p === '/api/_mode' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, mode: bugMode() });
    }

    // --- dogfooding ---
    if (p === '/guard') return proxyGuard(res);

    // --- static ---
    if (req.method === 'GET') return serveStatic(res, p);

    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`Ledger: http://127.0.0.1:${PORT}`);
    console.log(`Guard:  http://127.0.0.1:${PORT}/guard`);
    console.log(`State:  ${STATE_FILE}`);
  });

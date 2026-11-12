'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Ledger } = require('./ledger');

const PORT = Number(process.env.GUARD_PORT || 4174);
const PUBLIC = path.join(__dirname, 'public');
const LEDGER_PATH = path.join(__dirname, 'ledger.jsonl');
const ledger = new Ledger(LEDGER_PATH);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/api/ledger') {
      const body = JSON.stringify({ events: ledger.readAll() });
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      return res.end(body);
    }

    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
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
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`Kane Guard dashboard: http://127.0.0.1:${PORT}`);
    console.log(`Ledger: ${LEDGER_PATH}`);
  });

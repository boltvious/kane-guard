'use strict';

/**
 * Kane Guard — Act CLI
 * --------------------
 * Catat aksi agent ke ledger, tapi HANYA setelah policy mengizinkannya.
 * Kalau policy menolak, aksi tidak dicatat sebagai dilakukan — dan ini
 * sengaja: dashboard harus mencerminkan apa yang BENAR-BENAR terjadi.
 *
 *   node act-cli.js <route> <action> [note]
 */

const path = require('path');
const { decide } = require('./policy');
const { Ledger } = require('./ledger');

const [, , route, action, ...noteParts] = process.argv;
const note = noteParts.join(' ');

if (!route || !action) {
  console.error('usage: node act-cli.js <route> <action> [note]');
  process.exit(2);
}

const verdict = decide({ route, action });
const ledger = new Ledger(path.join(__dirname, 'ledger.jsonl'));

if (!verdict.allow) {
  ledger.append({
    type: 'agent_blocked',
    payload: { route, action, reason: verdict.reason },
  });
  console.error(`BLOCKED: ${verdict.reason}`);
  process.exit(1);
}

ledger.append({
  type: 'agent_acted',
  payload: { route, action, note: note || null },
});

console.log(`allowed: ${action} (${verdict.reason})`);

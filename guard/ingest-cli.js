'use strict';

/**
 * Kane Guard — Ingest CLI
 * -----------------------
 * Masukkan satu file NDJSON hasil run Kane ke ledger, dengan source yang
 * ditentukan. Dipakai untuk memasukkan hasil run nyata (source: 'live').
 *
 *   node ingest-cli.js ../ledger/run_baseline3.ndjson live ledger_flow_test.md
 *
 * Argumen:
 *   1. path NDJSON
 *   2. source  — 'replay' | 'live' | 'third-party'
 *   3. file    — label yang ditampilkan di dashboard (opsional)
 */

const fs = require('fs');
const path = require('path');
const { Ledger } = require('./ledger');
const { appendIngest } = require('./ingest');

const [, , ndjsonPath, source = 'live', file = null] = process.argv;

if (!ndjsonPath) {
  console.error('usage: node ingest-cli.js <ndjson> [source] [file]');
  process.exit(2);
}

const full = path.resolve(ndjsonPath);
if (!fs.existsSync(full)) {
  console.error(`not found: ${full}`);
  process.exit(2);
}

const ledger = new Ledger(path.join(__dirname, 'ledger.jsonl'));
const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);

const routed = appendIngest(ledger, lines, { source, file });

console.log(`ingested: ${path.basename(full)}`);
console.log(`  source : ${source}`);
console.log(`  verdict: ${routed.verdict}`);
console.log(`  route  : ${routed.route}`);
console.log(`  reason : ${routed.reason}`);

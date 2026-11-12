'use strict';

const fs = require('fs');
const path = require('path');
const { Ledger } = require('./ledger');

const TMP = path.join(__dirname, '.ledger-test.jsonl');
let passed = 0, failed = 0;

function check(name, ok, detail) {
  if (ok) { passed++; console.log(`  \u2713 ${name}`); }
  else { failed++; console.log(`  \u2717 ${name}${detail ? ' \u2014 ' + detail : ''}`); }
}

try {
  if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
  const l = new Ledger(TMP);

  check('file belum ada \u2192 readAll() = []', l.readAll().length === 0);

  l.append({ type: 'a', payload: { x: 1 } });
  l.append({ type: 'b', payload: { y: 2 } });
  const all = l.readAll();

  check('dua event tersimpan', all.length === 2);
  check('urutan terjaga', all[0].type === 'a' && all[1].type === 'b');
  check('ts valid ISO', !isNaN(Date.parse(all[0].ts)));
  check('payload utuh', all[1].payload.y === 2);

  l.clear();
  check('clear \u2192 kosong', l.readAll().length === 0);

  // Append setelah clear tetap jalan
  l.append({ type: 'c', payload: {} });
  check('append setelah clear', l.readAll().length === 1);
} finally {
  if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
}

console.log(`\nHasil: ${passed} lulus, ${failed} gagal\n`);
process.exit(failed === 0 ? 0 : 1);

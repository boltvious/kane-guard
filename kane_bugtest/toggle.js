'use strict';

const fs = require('fs');
const path = require('path');

const MODES = ['off', 'logic', 'silent', 'data', 'ui', 'crash'];
const FILE = path.join(__dirname, 'bug.mode');

function current() {
  try {
    return fs.readFileSync(FILE, 'utf8').trim() || 'off';
  } catch {
    return 'off';
  }
}

const arg = String(process.argv[2] || '').trim().toLowerCase();

if (!arg) {
  console.log('current mode: ' + current());
  console.log('available   : ' + MODES.join(', '));
  process.exit(0);
}

if (!MODES.includes(arg)) {
  console.error('unknown mode: ' + arg);
  console.error('available   : ' + MODES.join(', '));
  process.exit(1);
}

fs.writeFileSync(FILE, arg + '\n', 'utf8');
console.log('bug mode -> ' + arg);

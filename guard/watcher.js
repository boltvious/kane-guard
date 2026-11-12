'use strict';

/**
 * Kane Guard — Watcher (core logic)
 * ----------------------------------
 * Fungsi-fungsi murni yang bisa diuji tanpa fs.watch.
 * Bagian yang menyentuh filesystem ada di watch.js.
 */

// File yang TIDAK memicu loop:
//   - dependensi & .git
//   - ledger & output Kane (menulis ke sana akan memicu diri sendiri)
//   - cookie curl dari eksperimen
const IGNORE_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /ledger\.jsonl$/,
  /\.ndjson$/,
  /^cj\d*\.txt$/,
  /\.ledger-test\.jsonl$/,
];

function shouldIgnore(filename, extra = []) {
  const n = String(filename).replace(/\\/g, '/');
  return [...IGNORE_PATTERNS, ...extra].some((re) => re.test(n));
}

function classify(filename) {
  const n = String(filename).replace(/\\/g, '/');
  if (/_test\.md$/i.test(n)) return 'test';
  if (/\.(js|mjs|cjs|ts|tsx|jsx|html|css)$/i.test(n)) return 'app';
  return 'other';
}

/**
 * Debouncer per-key. Save pada Windows sering memicu beberapa event untuk
 * satu perubahan; debouncer menggabungkannya jadi satu trigger.
 */
function createDebouncer({ ms, setTimeoutFn, clearTimeoutFn }) {
  const timers = new Map();
  return (key, fn) => {
    if (timers.has(key)) clearTimeoutFn(timers.get(key));
    const id = setTimeoutFn(() => {
      timers.delete(key);
      fn();
    }, ms);
    timers.set(key, id);
  };
}

module.exports = { shouldIgnore, classify, createDebouncer, IGNORE_PATTERNS };

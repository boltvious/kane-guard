'use strict';

const { shouldIgnore, classify, createDebouncer } = require('./watcher');

let passed = 0, failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  \u2713 ${name}`); }
  else {
    failed++;
    console.log(`  \u2717 ${name}`);
    console.log(`      harap: ${JSON.stringify(expected)}`);
    console.log(`      dapat: ${JSON.stringify(actual)}`);
  }
}

// ---- shouldIgnore -----------------------------------------------------------
console.log('\n=== shouldIgnore ===');
check('node_modules diabaikan', shouldIgnore('node_modules/foo.js'), true);
check('.git diabaikan', shouldIgnore('.git/HEAD'), true);
check('ledger.jsonl diabaikan', shouldIgnore('ledger.jsonl'), true);
check('file ndjson diabaikan', shouldIgnore('kane_bugtest/run_off.ndjson'), true);
check('cookie cj2.txt diabaikan', shouldIgnore('cj2.txt'), true);
check('ledger-test diabaikan', shouldIgnore('.ledger-test.jsonl'), true);
check('app.js TIDAK diabaikan', shouldIgnore('public/app.js'), false);
check('index.html TIDAK diabaikan', shouldIgnore('public/index.html'), false);
check('login_tasks_test.md TIDAK diabaikan', shouldIgnore('tests/login_tasks_test.md'), false);
check('backslash path dinormalisasi', shouldIgnore('public\\app.js'), false);

// ---- classify ---------------------------------------------------------------
console.log('\n=== classify ===');
check('foo_test.md \u2192 test', classify('tests/foo_test.md'), 'test');
check('_test.md di subfolder \u2192 test', classify('a/b/c_test.md'), 'test');
check('app.js \u2192 app', classify('public/app.js'), 'app');
check('styles.css \u2192 app', classify('public/styles.css'), 'app');
check('index.html \u2192 app', classify('index.html'), 'app');
check('server.ts \u2192 app', classify('src/server.ts'), 'app');
check('README.md \u2192 other', classify('README.md'), 'other');
check('test.md (tanpa underscore) \u2192 other', classify('test.md'), 'other');

// ---- createDebouncer --------------------------------------------------------
console.log('\n=== createDebouncer ===');

function makeFakeTimer() {
  let now = 0;
  let tasks = [];
  let nextId = 0;
  return {
    setTimeoutFn: (fn, ms) => {
      const id = ++nextId;
      tasks.push({ id, at: now + ms, fn });
      return id;
    },
    clearTimeoutFn: (id) => {
      tasks = tasks.filter((t) => t.id !== id);
    },
    advance: (ms) => {
      now += ms;
      const ready = tasks.filter((t) => t.at <= now);
      tasks = tasks.filter((t) => t.at > now);
      for (const t of ready) t.fn();
    },
    pending: () => tasks.length,
  };
}

{
  const ft = makeFakeTimer();
  const deb = createDebouncer({ ms: 300, setTimeoutFn: ft.setTimeoutFn, clearTimeoutFn: ft.clearTimeoutFn });
  let calls = 0;
  deb('a.js', () => calls++);
  ft.advance(100);
  deb('a.js', () => calls++);
  ft.advance(100);
  deb('a.js', () => calls++);
  ft.advance(300);
  check('3 event cepat pada file sama \u2192 1 trigger', calls, 1);
}

{
  const ft = makeFakeTimer();
  const deb = createDebouncer({ ms: 300, setTimeoutFn: ft.setTimeoutFn, clearTimeoutFn: ft.clearTimeoutFn });
  let calls = 0;
  deb('a.js', () => calls++);
  deb('b.js', () => calls++);
  ft.advance(300);
  check('2 file berbeda \u2192 2 trigger', calls, 2);
}

{
  const ft = makeFakeTimer();
  const deb = createDebouncer({ ms: 300, setTimeoutFn: ft.setTimeoutFn, clearTimeoutFn: ft.clearTimeoutFn });
  let calls = 0;
  deb('a.js', () => calls++);
  ft.advance(200);
  deb('a.js', () => calls++);
  ft.advance(400);
  check('event kedua me-reset timer', calls, 1);
}

{
  const ft = makeFakeTimer();
  const deb = createDebouncer({ ms: 300, setTimeoutFn: ft.setTimeoutFn, clearTimeoutFn: ft.clearTimeoutFn });
  let calls = 0;
  deb('a.js', () => calls++);
  ft.advance(400);
  deb('a.js', () => calls++);
  ft.advance(400);
  check('dua save terpisah \u2192 2 trigger', calls, 2);
}

console.log(`\nHasil: ${passed} lulus, ${failed} gagal\n`);
process.exit(failed === 0 ? 0 : 1);

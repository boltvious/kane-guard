'use strict';

/**
 * Kane Guard — Watcher CLI
 * ------------------------
 * Mengawasi folder untuk perubahan file. Saat ada save pada file app atau
 * _test.md, memicu aksi.
 *
 * Mode:
 *   --dry (default)  deteksi saja, cetak ke stdout, tidak menyentuh Kane
 *                    dan tidak menulis ke ledger. Gratis.
 *   --live           deteksi + jalankan `kane-cli testmd run --agent`,
 *                    tulis seluruh rantai event ke ledger.
 *                    MEMAKAN KREDIT.
 *
 * Flag lain:
 *   --dir <path>      folder yang diawasi (default: kane_bugtest/)
 *   --test <path>     file _test.md yang dijalankan saat --live
 *   --debounce <ms>   jeda penggabungan event (default 400)
 *   --once            keluar setelah trigger pertama
 *   --demo            self-test: tulis file dummy, tunggu trigger, keluar
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { shouldIgnore, classify, createDebouncer } = require('./watcher');
const { Ledger } = require('./ledger');
const { appendIngest } = require('./ingest');

const ROOT = __dirname;
const DEFAULT_DIR = path.join(ROOT, '..', 'kane_bugtest');
const DEFAULT_TEST = path.join(DEFAULT_DIR, 'tests', 'login_tasks_test.md');

function parseArgs(argv) {
  const args = {
    dir: DEFAULT_DIR,
    test: DEFAULT_TEST,
    dry: true,
    once: false,
    demo: false,
    debounce: 400,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--live') args.dry = false;
    else if (a === '--dry') args.dry = true;
    else if (a === '--once') args.once = true;
    else if (a === '--demo') args.demo = true;
    else if (a === '--dir') args.dir = path.resolve(argv[++i]);
    else if (a === '--test') args.test = path.resolve(argv[++i]);
    else if (a === '--debounce') args.debounce = Number(argv[++i]);
  }
  return args;
}

function runKane(testPath) {
  const ndjsonPath = path.join(ROOT, `run-live-${Date.now()}.ndjson`);
  const out = fs.openSync(ndjsonPath, 'w');
  const res = spawnSync(
    'kane-cli',
    ['testmd', 'run', testPath, '--agent', '--no-adaptive-heal'],
    { stdio: ['ignore', out, out], shell: true, encoding: 'utf8' }
  );
  fs.closeSync(out);
  return { ndjsonPath, exitCode: typeof res.status === 'number' ? res.status : 1 };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.demo) {
    // Demo selalu mengawasi tests/ supaya file dummy pasti terdeteksi.
    args.dir = path.join(ROOT, '..', 'kane_bugtest', 'tests');
  }

  const ledger = new Ledger(path.join(ROOT, 'ledger.jsonl'));

  console.log(`[watch] dir      = ${args.dir}`);
  console.log(`[watch] mode     = ${args.dry ? 'dry (no credits)' : 'live (KANE CLI, costs credits)'}`);
  console.log(`[watch] debounce = ${args.debounce}ms`);
  if (!args.dry) console.log(`[watch] test     = ${args.test}`);

  let fired = false;
  let liveRun = 0;

  const onTrigger = (filename) => {
    const kind = classify(filename);
    console.log(`[watch] trigger: ${filename} (kind=${kind}) @ ${new Date().toISOString()}`);

    if (!args.dry) {
      liveRun++;
      console.log(`[watch] invoking kane-cli (run #${liveRun})...`);
      const { ndjsonPath, exitCode } = runKane(args.test);
      console.log(`[watch] kane exit=${exitCode}, ndjson=${ndjsonPath}`);
      try {
        const lines = fs.readFileSync(ndjsonPath, 'utf8').split(/\r?\n/);
        const routed = appendIngest(ledger, lines, { source: 'live', file: filename });
        console.log(`[watch] routed: ${routed.route} \u2014 ${routed.reason}`);
      } catch (err) {
        console.error(`[watch] ingest failed: ${err.message}`);
      }
    }

    fired = true;
    if (args.once) process.exit(0);
  };

  const debounce = createDebouncer({
    ms: args.debounce,
    setTimeoutFn: setTimeout,
    clearTimeoutFn: clearTimeout,
  });

  fs.watch(args.dir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    if (shouldIgnore(filename)) return;
    debounce(String(filename), () => onTrigger(String(filename)));
  });

  console.log('[watch] listening... (Ctrl+C untuk berhenti)');

  if (args.demo) {
    await demoMode(args, () => fired);
    return;
  }

  // Tetap hidup sampai dihentikan.
  setInterval(() => {}, 60000);
}

async function demoMode(args, hasFired) {
  await new Promise((r) => setTimeout(r, 300));
  const demoFile = path.join(args.dir, '__demo_touch_test.md');
  console.log(`[demo] menulis ${demoFile}`);
  fs.writeFileSync(demoFile, '# demo\n', 'utf8');
  await new Promise((r) => setTimeout(r, 1500));
  try { fs.unlinkSync(demoFile); } catch {}
  const ok = hasFired();
  console.log(`[demo] ${ok ? 'DETECTED' : 'MISSED'}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('[watch] fatal:', err);
  process.exit(2);
});

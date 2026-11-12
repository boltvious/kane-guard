'use strict';

/**
 * Test router Kane Guard.
 *
 * Dua kelompok:
 *   1. Data nyata — 7 run dari kane_bugtest/run_*.ndjson (gratis, tidak makan kredit).
 *   2. Sintetis — cabang yang tidak bisa dicapai data nyata (mis. confirmed
 *      automation_bug → fix_test, yang tidak terjadi di 7 run tapi wajib ada).
 *
 * Tidak ada panggilan jaringan, tidak ada panggilan Kane. Hanya membaca file
 * dan memeriksa keputusan router.
 */

const fs = require('fs');
const path = require('path');
const { route } = require('./route');

// ---- ekspektasi dari 7 run nyata --------------------------------------------
// Semua ini didokumentasikan di SUMMARY.md. Kalau router menyimpang dari
// tabel ini, invariant I2/I3-nya rusak.
const CASES = [
  {
    file: 'run_off.ndjson',
    expect: { verdict: 'passed', route: 'done' },
    why: 'baseline app sehat',
  },
  {
    file: 'run_data.ndjson',
    expect: { verdict: 'failed', route: 'escalate' },
    why: 'application_issue tapi confirmed=false → I3',
  },
  {
    file: 'run_off2.ndjson',
    expect: { verdict: 'failed', route: 'escalate' },
    why: 'automation_bug, confirmed=false → I3',
  },
  {
    file: 'run_logic.ndjson',
    expect: { verdict: 'failed', route: 'escalate' },
    why: 'automation_bug, confirmed=false → I3',
  },
  {
    file: 'run_silent.ndjson',
    expect: { verdict: 'failed', route: 'fix_app' },
    why: 'application_issue + confirmed=true → I2',
  },
  {
    file: 'run_crash.ndjson',
    expect: { verdict: 'failed', route: 'fix_app' },
    why: 'application_issue + confirmed=true → I2',
  },
  {
    file: 'run_ui.ndjson',
    expect: { verdict: 'failed', route: 'escalate' },
    why: 'automation_bug, confirmed=false → I3',
  },
];

// ---- kasus sintetis untuk cabang yang tidak muncul di data nyata -----------
const SYNTHETIC = [
  {
    name: 'confirmed automation_bug → fix_test',
    lines: [
      JSON.stringify({ type: 'test_md_done', overall_status: 'failed' }),
      JSON.stringify({
        type: 'test_md_bug_verdict',
        confirmed: true,
        family: 'automation_bug',
        category: 'state_transition_bug',
        bug_title: 'replay mengklik dua kali',
      }),
    ],
    expect: { verdict: 'failed', route: 'fix_test' },
    why: 'I2: confirmed automation_bug → perbaiki test',
  },
  {
    name: 'tidak ada test_md_done → escalate',
    lines: [JSON.stringify({ type: 'step_event', event: 'action' })],
    expect: { verdict: 'unknown', route: 'escalate' },
    why: 'run tidak lengkap',
  },
  {
    name: 'gagal tanpa diagnosis → escalate',
    lines: [JSON.stringify({ type: 'test_md_done', overall_status: 'failed' })],
    expect: { verdict: 'failed', route: 'escalate' },
    why: 'tidak ada diagnosis untuk dirutekan',
  },
  {
    name: 'family tidak dikenal → escalate',
    lines: [
      JSON.stringify({ type: 'test_md_done', overall_status: 'failed' }),
      JSON.stringify({
        type: 'test_md_bug_verdict',
        confirmed: true,
        family: 'flaky_infra',
        bug_title: 'x',
      }),
    ],
    expect: { verdict: 'failed', route: 'escalate' },
    why: 'family di luar tabel I2',
  },
  {
    name: 'overall_status tak dikenal → escalate',
    lines: [JSON.stringify({ type: 'test_md_done', overall_status: 'errored' })],
    expect: { verdict: 'unknown', route: 'escalate' },
    why: 'status aneh',
  },
];

// ---- test runner -----------------------------------------------------------
function readLines(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/);
}

let passed = 0;
let failed = 0;

function check(name, actual, expected, why) {
  const ok = actual.verdict === expected.verdict && actual.route === expected.route;
  if (ok) {
    passed++;
    console.log(`  \u2713 ${name}`);
  } else {
    failed++;
    console.log(`  \u2717 ${name}`);
    console.log(`      harap: verdict=${expected.verdict} route=${expected.route}`);
    console.log(`      dapat: verdict=${actual.verdict} route=${actual.route}`);
    console.log(`      alasan: ${actual.reason}`);
    if (why) console.log(`      kenapa: ${why}`);
  }
}

console.log('\n=== Data nyata (7 run Kane) ===');
const baseDir = path.join(__dirname, '..', 'kane_bugtest');
for (const c of CASES) {
  const full = path.join(baseDir, c.file);
  if (!fs.existsSync(full)) {
    failed++;
    console.log(`  \u2717 ${c.file} TIDAK ADA di ${baseDir}`);
    continue;
  }
  const result = route(readLines(full));
  check(`${c.file}  (${c.why})`, result, c.expect, null);
}

console.log('\n=== Sintetis (cabang yang tidak dicapai data nyata) ===');
for (const c of SYNTHETIC) {
  const result = route(c.lines);
  check(c.name, result, c.expect, c.why);
}

console.log(`\nHasil: ${passed} lulus, ${failed} gagal\n`);
process.exit(failed === 0 ? 0 : 1);

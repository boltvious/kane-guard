'use strict';

const fs = require('fs');
const path = require('path');
const { decide, ACTIONS } = require('./policy');
const { route } = require('./route');

let passed = 0;
let failed = 0;

function check(name, actual, expectedAllow, why) {
  const ok = actual.allow === expectedAllow;
  if (ok) {
    passed++;
    console.log(`  \u2713 ${name}`);
  } else {
    failed++;
    console.log(`  \u2717 ${name}`);
    console.log(`      harap: allow=${expectedAllow}, dapat allow=${actual.allow}`);
    console.log(`      alasan: ${actual.reason}`);
    if (why) console.log(`      kenapa: ${why}`);
  }
}

// ---- matriks rute x aksi ----------------------------------------------------
console.log('\n=== Matriks rute \u00d7 aksi ===');

const MATRIX = [
  // [route, action, allow?]
  ['done',     'stop',      true,  'selalu boleh berhenti'],
  ['done',     'edit_app',  false, 'sudah hijau, jangan sentuh'],
  ['done',     'edit_test', false, 'sudah hijau, jangan sentuh'],
  ['done',     'rerun',     false, 'sudah hijau, tidak perlu run ulang'],

  ['fix_app',  'edit_app',  true,  'I2: target = kode'],
  ['fix_app',  'rerun',     true,  'verifikasi perbaikan'],
  ['fix_app',  'edit_test', false, 'I2: jangan sembunyikan bug'],

  ['fix_test', 'edit_test', true,  'I2: target = _test.md'],
  ['fix_test', 'rerun',     true,  'verifikasi perbaikan'],
  ['fix_test', 'edit_app',  false, 'I2: jangan rusak app sehat'],

  ['escalate', 'edit_app',  false, 'I3: eskalasi = tangan manusia'],
  ['escalate', 'edit_test', false, 'I3'],
  ['escalate', 'rerun',     false, 'I3: jangan bakar kredit'],
  ['escalate', 'escalate',  true,  'terminal'],
  ['escalate', 'stop',      true,  'terminal'],

  ['unknown',  'edit_app',  false, 'rute tak dikenal, default tolak'],
];

for (const [r, a, allow, why] of MATRIX) {
  const res = decide({ route: r, action: a });
  check(`${r} + ${a}`, res, allow, why);
}

// ---- budget retry (I6) ------------------------------------------------------
console.log('\n=== Budget retry (I6) ===');

check(
  'fix_app + rerun attempt=2/3 → boleh',
  decide({ route: 'fix_app', action: 'rerun', attempt: 2, maxAttempts: 3 }),
  true
);
check(
  'fix_app + rerun attempt=3/3 → tolak',
  decide({ route: 'fix_app', action: 'rerun', attempt: 3, maxAttempts: 3 }),
  false,
  'budget habis'
);
check(
  'fix_test + rerun attempt=5/3 → tolak',
  decide({ route: 'fix_test', action: 'rerun', attempt: 5, maxAttempts: 3 }),
  false
);
check(
  'budget habis + stop → tetap boleh',
  decide({ route: 'fix_app', action: 'stop', attempt: 9, maxAttempts: 3 }),
  true,
  'stop adalah jalan keluar, tidak boleh diblokir'
);
check(
  'budget habis + escalate → tetap boleh',
  decide({ route: 'fix_app', action: 'escalate', attempt: 9, maxAttempts: 3 }),
  true
);

// ---- validasi masukan ------------------------------------------------------
console.log('\n=== Masukan tidak sah ===');

check(
  'aksi ngawur → tolak',
  decide({ route: 'fix_app', action: 'delete_everything' }),
  false
);
check(
  'aksi kosong → tolak',
  decide({ route: 'fix_app', action: '' }),
  false
);
check(
  'ctx kosong → tolak',
  decide(),
  false
);

// ---- integrasi: 7 run nyata → rute → policy --------------------------------
console.log('\n=== Integrasi 7 run nyata \u2192 route \u2192 policy ===');

// Untuk setiap run, tentukan (a) aksi yang HARUS diizinkan menurut rute, dan
// (b) aksi yang HARUS ditolak. Ini membuktikan rantai route+policy konsisten
// dengan invariant, bukan hanya dengan tabel ekspektasi.
const INTEGRATION = [
  { file: 'run_off.ndjson',     allowed: 'stop',      denied: 'edit_app' },
  { file: 'run_data.ndjson',    allowed: 'escalate',  denied: 'edit_app' },
  { file: 'run_off2.ndjson',    allowed: 'escalate',  denied: 'edit_test' },
  { file: 'run_logic.ndjson',   allowed: 'escalate',  denied: 'edit_app' },
  { file: 'run_silent.ndjson',  allowed: 'edit_app',  denied: 'edit_test' },
  { file: 'run_crash.ndjson',   allowed: 'edit_app',  denied: 'edit_test' },
  { file: 'run_ui.ndjson',      allowed: 'escalate',  denied: 'edit_app' },
];

const baseDir = path.join(__dirname, '..', 'kane_bugtest');
for (const c of INTEGRATION) {
  const full = path.join(baseDir, c.file);
  if (!fs.existsSync(full)) {
    failed++;
    console.log(`  \u2717 ${c.file} tidak ada`);
    continue;
  }
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  const routed = route(lines);

  const okAction = decide({ route: routed.route, action: c.allowed });
  const badAction = decide({ route: routed.route, action: c.denied });

  check(
    `${c.file} (route=${routed.route}) izinkan "${c.allowed}"`,
    okAction,
    true,
    routed.reason
  );
  check(
    `${c.file} (route=${routed.route}) tolak "${c.denied}"`,
    badAction,
    false,
    routed.reason
  );
}

console.log(`\nHasil: ${passed} lulus, ${failed} gagal\n`);
process.exit(failed === 0 ? 0 : 1);

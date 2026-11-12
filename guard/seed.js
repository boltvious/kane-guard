'use strict';

/**
 * Seed ledger dari 7 NDJSON yang sudah kita rekam.
 *
 * Sengaja ditandai source: 'replay' agar dashboard jujur: ini keputusan
 * guard terhadap data rekaman, bukan run live. Saat watcher benar-benar
 * memicu run Kane nanti, event live akan masuk ke ledger yang sama.
 *
 * Tidak memanggil Kane. Tidak memakan kredit. Gratis.
 */

const fs = require('fs');
const path = require('path');
const { Ledger } = require('./ledger');
const { route } = require('./route');
const { decide } = require('./policy');

const LEDGER = path.join(__dirname, 'ledger.jsonl');
const NDJSON_DIR = path.join(__dirname, '..', 'kane_bugtest');

const FILES = [
  'run_off.ndjson',
  'run_data.ndjson',
  'run_off2.ndjson',
  'run_logic.ndjson',
  'run_silent.ndjson',
  'run_crash.ndjson',
  'run_ui.ndjson',
];

// Aksi "menggoda tapi salah" per rute. Ini yang harus ditolak oleh I2/I3.
const PROBE = {
  done: 'edit_app',
  fix_app: 'edit_test',
  fix_test: 'edit_app',
  escalate: 'edit_app',
};

const ledger = new Ledger(LEDGER);
ledger.clear();

let seeded = 0;

for (const file of FILES) {
  const full = path.join(NDJSON_DIR, file);
  if (!fs.existsSync(full)) {
    console.log(`  skip ${file} (tidak ada)`);
    continue;
  }

  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);

  let durationS = null;
  for (const line of lines) {
    try {
      const evt = JSON.parse(line);
      if (evt.type === 'test_md_done' && typeof evt.duration_s === 'number') {
        durationS = evt.duration_s;
      }
    } catch {}
  }

  const routed = route(lines);

  ledger.append({
    type: 'trigger',
    payload: {
      source: 'replay',
      file,
      note: 'from recorded experiment (no Kane call, no credits)',
    },
  });

  ledger.append({
    type: 'run_completed',
    payload: {
      file,
      verdict: routed.verdict,
      durationS,
      exitCode: routed.verdict === 'passed' ? 0 : 1,
    },
  });

  const bv = routed.bugVerdict;
  ledger.append({
    type: 'route_decided',
    payload: {
      route: routed.route,
      verdict: routed.verdict,
      reason: routed.reason,
      bugVerdict: bv
        ? {
            family: bv.family,
            category: bv.category,
            confirmed: bv.confirmed,
            severity: bv.severity,
            title: bv.bug_title,
            confidence: bv.confidence,
          }
        : null,
    },
  });

  // Aksi yang "wajar" menurut rute
  let natural;
  if (routed.route === 'fix_app') natural = 'edit_app';
  else if (routed.route === 'fix_test') natural = 'edit_test';
  else if (routed.route === 'done') natural = 'stop';
  else natural = 'escalate';

  const naturalPolicy = decide({ route: routed.route, action: natural });
  ledger.append({
    type: 'policy_decided',
    payload: {
      action: natural,
      allowed: naturalPolicy.allow,
      reason: naturalPolicy.reason,
      terminal: naturalPolicy.terminal,
    },
  });

  // Probe: aksi menggoda yang HARUS ditolak
  const probeAction = PROBE[routed.route] || 'edit_app';
  const probePolicy = decide({ route: routed.route, action: probeAction });
  ledger.append({
    type: 'policy_probe',
    payload: {
      action: probeAction,
      allowed: probePolicy.allow,
      reason: probePolicy.reason,
    },
  });

  // Terminal
  if (routed.route === 'done') {
    ledger.append({
      type: 'loop_done',
      payload: { reason: 'test passed' },
    });
  } else if (routed.route === 'fix_app' || routed.route === 'fix_test') {
    ledger.append({
      type: 'loop_would_act',
      payload: {
        route: routed.route,
        note: `guard would allow ${natural}; in a live loop agent would act then rerun`,
      },
    });
  } else {
    ledger.append({
      type: 'loop_escalated',
      payload: { reason: routed.reason },
    });
  }

  seeded++;
  console.log(`  \u2713 ${file} \u2192 ${routed.route}`);
}

const total = ledger.readAll().length;
console.log(`\nSeeded ${seeded} iterasi, ${total} event ke ${LEDGER}\n`);

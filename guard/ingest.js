'use strict';

/**
 * Kane Guard — Ingest
 * -------------------
 * Satu fungsi yang mengubah NDJSON Kane menjadi rangkaian event ledger.
 * Dipakai oleh:
 *   - seed.js (source: 'replay', dari 7 run lama)
 *   - watch.js --live (source: 'live', dari run baru)
 *
 * Kalau dua jalur ini memakai logika berbeda, dashboard akan berbohong.
 * Jadi keduanya HARUS lewat sini.
 */

const { route } = require('./route');
const { decide } = require('./policy');

const PROBE = {
  done: 'edit_app',
  fix_app: 'edit_test',
  fix_test: 'edit_app',
  escalate: 'edit_app',
};

function appendIngest(ledger, lines, { source = 'replay', file = null } = {}) {
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
    payload: { source, ...(file ? { file } : {}) },
  });

  ledger.append({
    type: 'run_completed',
    payload: {
      ...(file ? { file } : {}),
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

  if (routed.route === 'done') {
    ledger.append({ type: 'loop_done', payload: { reason: 'test passed' } });
  } else if (routed.route === 'fix_app' || routed.route === 'fix_test') {
    ledger.append({
      type: 'loop_would_act',
      payload: {
        route: routed.route,
        note: `guard would allow ${natural}; in a live loop agent would act then rerun`,
      },
    });
  } else {
    ledger.append({ type: 'loop_escalated', payload: { reason: routed.reason } });
  }

  return routed;
}

module.exports = { appendIngest };

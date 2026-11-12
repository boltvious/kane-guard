'use strict';

/**
 * Kane Guard — Router
 * -------------------
 * Membaca log NDJSON dari `kane-cli testmd run --agent` dan memutuskan
 * apa yang harus terjadi selanjutnya.
 *
 * Invariant yang ditegakkan (dari goal.md):
 *
 *   I1 — Verdict adalah otoritas; diagnosis adalah petunjuk.
 *        Verdict menggerakkan loop. Diagnosis hanya memilih TARGET perbaikan.
 *
 *   I2 — Rute ditentukan oleh `family`, bukan oleh "ada FAIL".
 *        application_issue → perbaiki kode app
 *        automation_bug    → perbaiki _test.md
 *        (lainnya)         → tidak dikenal, eskalasi
 *
 *   I3 — `confirmed: true` boleh otomatis; `confirmed: false` wajib eskalasi.
 *
 * Output: { verdict, route, reason, bugVerdict, doneEvent }
 *   verdict  : 'passed' | 'failed' | 'unknown'
 *   route    : 'done' | 'fix_app' | 'fix_test' | 'escalate'
 *   reason   : string yang bisa dicetak ke dashboard
 *
 * `route` adalah satu-satunya field yang dipakai untuk aksi otomatis.
 * `reason` adalah untuk manusia. Jangan pernah memutuskan dari `reason`.
 */

/**
 * Parse semua event yang relevan dari NDJSON.
 *
 * Baris yang tidak bisa di-JSON-kan diabaikan (Kane kadang mencetak
 * progress non-JSON ke stdout/stderr yang tercampur).
 */
function parseEvents(lines) {
  let doneEvent = null;
  const bugVerdicts = [];

  for (const line of lines) {
    if (!line || !line.trim()) continue;
    let evt;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    if (evt.type === 'test_md_done') doneEvent = evt;
    if (evt.type === 'test_md_bug_verdict') bugVerdicts.push(evt);
  }

  // Kalau ada beberapa bug_verdict (mis. --bug-detection continue), pakai
  // yang terakhir — itu yang merepresentasikan titik terminal run ini.
  const bugVerdict = bugVerdicts.length ? bugVerdicts[bugVerdicts.length - 1] : null;

  return { doneEvent, bugVerdict, bugVerdicts };
}

/**
 * Putuskan rute.
 *
 * @param {string[]} lines - NDJSON lines (satu string per baris)
 * @returns {{verdict: string, route: string, reason: string,
 *            bugVerdict: object|null, doneEvent: object|null}}
 */
function route(lines) {
  const { doneEvent, bugVerdict } = parseEvents(lines);

  // --- tidak ada event penutup: run tidak selesai --------------------------
  if (!doneEvent) {
    return {
      verdict: 'unknown',
      route: 'escalate',
      reason: 'run tidak selesai (tidak ada event test_md_done)',
      bugVerdict: null,
      doneEvent: null,
    };
  }

  const overall = doneEvent.overall_status;

  // --- lulus --------------------------------------------------------------
  if (overall === 'passed') {
    return {
      verdict: 'passed',
      route: 'done',
      reason: 'test lulus',
      bugVerdict: null,
      doneEvent,
    };
  }

  // --- gagal -------------------------------------------------------------
  if (overall === 'failed') {
    // Tidak ada diagnosis sama sekali → manusia yang investigasi.
    if (!bugVerdict) {
      return {
        verdict: 'failed',
        route: 'escalate',
        reason: 'gagal tanpa diagnosis — manusia harus investigasi',
        bugVerdict: null,
        doneEvent,
      };
    }

    // I3: `confirmed` bukan true → JANGAN auto-fix.
    if (bugVerdict.confirmed !== true) {
      return {
        verdict: 'failed',
        route: 'escalate',
        reason:
          `diagnosis belum terkonfirmasi (family=${bugVerdict.family}, ` +
          `confirmed=${bugVerdict.confirmed}) — I3 meminta tinjauan manusia`,
        bugVerdict,
        doneEvent,
      };
    }

    // I2: `confirmed === true` → rute berdasarkan `family`.
    if (bugVerdict.family === 'application_issue') {
      return {
        verdict: 'failed',
        route: 'fix_app',
        reason:
          `confirmed application_issue ` +
          `(category=${bugVerdict.category || '?'}): ` +
          `${bugVerdict.bug_title}`,
        bugVerdict,
        doneEvent,
      };
    }

    if (bugVerdict.family === 'automation_bug') {
      return {
        verdict: 'failed',
        route: 'fix_test',
        reason:
          `confirmed automation_bug: ${bugVerdict.bug_title} — ` +
          `perbaiki _test.md, JANGAN sentuh kode app`,
        bugVerdict,
        doneEvent,
      };
    }

    // Family di luar tabel I2 → eskalasi.
    return {
      verdict: 'failed',
      route: 'escalate',
      reason: `family tidak dikenal ("${bugVerdict.family}") — eskalasi`,
      bugVerdict,
      doneEvent,
    };
  }

  // --- status aneh --------------------------------------------------------
  return {
    verdict: 'unknown',
    route: 'escalate',
    reason: `overall_status tidak dikenal: "${overall}"`,
    bugVerdict,
    doneEvent,
  };
}

module.exports = { route, parseEvents };

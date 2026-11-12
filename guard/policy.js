'use strict';

/**
 * Kane Guard — Policy Enforcement
 * -------------------------------
 * Router menjawab "apa yang SALAH". Policy menjawab "apa yang BOLEH
 * dilakukan agent sekarang".
 *
 * Ini yang membuat guardrail punya gigi. Tanpa penolakan, ini cuma dashboard.
 *
 * Invariant yang ditegakkan di sini:
 *
 *   I2 — Rute menentukan target. fix_app hanya boleh menyentuh kode;
 *        fix_test hanya boleh menyentuh _test.md. Menyilang = ditolak.
 *
 *   I3 — escalate berarti agent TIDAK BOLEH bertindak. Hanya boleh menyerahkan
 *        ke manusia atau berhenti.
 *
 *   I6 — Budget retry habis = rerun ditolak, paksa escalate.
 *
 * Kosakata aksi agent (sengaja kecil):
 *   edit_app   — ubah kode aplikasi
 *   edit_test  — ubah file _test.md
 *   rerun      — picu run Kane baru
 *   escalate   — serahkan ke manusia (terminal)
 *   stop       — akhiri loop tanpa aksi lebih (terminal)
 */

const ACTIONS = ['edit_app', 'edit_test', 'rerun', 'escalate', 'stop'];

const TERMINAL = new Set(['escalate', 'stop']);

/**
 * Putuskan apakah aksi boleh dilakukan.
 *
 * @param {object} ctx
 * @param {string} ctx.route        - dari route(): 'done'|'fix_app'|'fix_test'|'escalate'
 * @param {string} ctx.action       - salah satu dari ACTIONS
 * @param {number} [ctx.attempt=0]  - berapa kali sudah dicoba
 * @param {number} [ctx.maxAttempts=3]
 * @returns {{allow: boolean, reason: string, terminal: boolean}}
 */
function decide(ctx) {
  const {
    route,
    action,
    attempt = 0,
    maxAttempts = 3,
  } = ctx || {};

  // --- validasi masukan -----------------------------------------------------
  if (!ACTIONS.includes(action)) {
    return deny(`aksi tidak dikenal: "${action}"`);
  }

  // --- aksi terminal selalu diizinkan --------------------------------------
  // Loop yang tidak bisa berhenti adalah kebocoran kredit (I6).
  if (TERMINAL.has(action)) {
    return {
      allow: true,
      reason: action === 'stop' ? 'berhenti' : 'serahkan ke manusia',
      terminal: true,
    };
  }

  // --- budget retry (I6) ----------------------------------------------------
  if (attempt >= maxAttempts) {
    return deny(
      `budget retry habis (${attempt}/${maxAttempts}) — ` +
      `hanya escalate/stop yang diizinkan`
    );
  }

  // --- rute -----------------------------------------------------------------
  switch (route) {
    case 'done':
      // Sudah lulus. Jangan sentuh apa pun.
      return deny(
        `test sudah lulus — "${action}" akan merusak keadaan hijau; ` +
        `hanya stop yang wajar`
      );

    case 'fix_app':
      if (action === 'edit_app') {
        return allow('rute fix_app: perbaiki kode aplikasi');
      }
      if (action === 'rerun') {
        return allow('rute fix_app: jalankan ulang untuk memverifikasi perbaikan');
      }
      if (action === 'edit_test') {
        return deny(
          'rute fix_app: diagnosis menunjuk kode aplikasi — ' +
          'mengubah _test.md akan menyembunyikan bug, bukan memperbaikinya (I2)'
        );
      }
      break;

    case 'fix_test':
      if (action === 'edit_test') {
        return allow('rute fix_test: perbaiki _test.md');
      }
      if (action === 'rerun') {
        return allow('rute fix_test: jalankan ulang untuk memverifikasi perbaikan');
      }
      if (action === 'edit_app') {
        return deny(
          'rute fix_test: diagnosis menunjuk test yang cacat — ' +
          'mengubah kode aplikasi akan merusak app yang sehat (I2)'
        );
      }
      break;

    case 'escalate':
      return deny(
        `rute escalate: agent tidak boleh bertindak — ` +
        `hanya escalate/stop (I3). "${action}" ditolak.`
      );

    default:
      return deny(`rute tidak dikenal: "${route}" — default menolak`);
  }

  // Jaring pengaman: kombinasi rute+aksi yang tidak tercakup switch.
  return deny(`kombinasi tidak diizinkan: route=${route} action=${action}`);
}

function allow(reason) {
  return { allow: true, reason, terminal: false };
}

function deny(reason) {
  return { allow: false, reason, terminal: false };
}

module.exports = { decide, ACTIONS, TERMINAL };

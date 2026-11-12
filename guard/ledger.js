'use strict';

/**
 * Kane Guard — Ledger
 * -------------------
 * Append-only JSONL. Setiap baris = satu event. Dashboard membaca file ini
 * dan merender timeline. File ini adalah satu-satunya sumber kebenaran
 * untuk apa yang loop lakukan — tidak ada state di memori yang bisa
 * berbeda dengan disk.
 */

const fs = require('fs');

class Ledger {
  constructor(filePath) {
    this.filePath = filePath;
  }

  append(event) {
    const full = { ts: new Date().toISOString(), ...event };
    fs.appendFileSync(this.filePath, JSON.stringify(full) + '\n', 'utf8');
    return full;
  }

  readAll() {
    if (!fs.existsSync(this.filePath)) return [];
    return fs
      .readFileSync(this.filePath, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => {
        try { return JSON.parse(l); } catch { return null; }
      })
      .filter(Boolean);
  }

  clear() {
    if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
  }
}

module.exports = { Ledger };

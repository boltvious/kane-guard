# GOAL — Kane CLI Hackathon

Dokumen kerja. Bukan pitch, bukan brosur. Ini yang kita pegang saat membangun,
supaya setiap keputusan bisa dipertanggungjawabkan ke satu kalimat di sini.

Tanggal: 12 November 2026
Deadline submit: 19 November 2026, 23:59 IST
Repo harus di-init ≥ 12 November (commit history dicek juri)

---

## 0. Kondisi Operasional (diperbarui 12 Nov)

- **Saldo saat ini:** ~1013 kredit (saldo lama, dipakai untuk 7 run uji suntik bug).
- **Kredit hackathon 10.000 aktif setelah 12 Nov 14:00.** Setelah itu authoring
  beberapa flow jadi terjangkau.
- **Agent = sesi AI ini**, bukan CLI pihak ketiga. Tidak perlu `codex`, `gemini`,
  atau `qwen`. Brief mengizinkan: *"Any agent, any stack. Claude Code, Cursor,
  Copilot..."* — AI assistant adalah agent yang sah.
- **Demo 3 menit = batas yang harus dipadatkan**, bukan target yang harus dipenuhi.
  Juri berhenti menonton di 3:00. Yang wajib ada: momen agent memutuskan **tidak**
  memperbaiki kode.

---

## 1. Inti Hackathon (apa yang sebenarnya diminta)

Dari halaman event, bagian "Why this exists":

> *"One part of the loop never closed: the agent that writes the code has no way
> to verify it... Writing the code got easy. **Trusting it didn't.**"*
>
> *"An agent that writes code but can't check its own work is running open-loop.
> An agent that calls Kane CLI sees what it just shipped, reads the failure, and
> fixes it before anyone reviews the PR."*

**Tiga lapis maksud acara:**

1. **Yang terlihat** — bangun web app, verifikasi dengan Kane, demo 3 menit.
2. **Yang sebenarnya** — memindahkan Kane dari kategori "alat test terminal"
   ke kategori "lapisan verifikasi yang dipanggil agent" (infrastruktur).
3. **Yang paling jujur** — mereka butuh *case study*. Hadiah uang kecil ($3.000);
   hadiah distribusinya besar (1:1 founder, blog feature, amplifikasi channel).

**Konsekuensi:** yang dibangun harus membuat loop itu **benar** — bukan memuji
Kane, bukan mengekspos kelemahannya.

**Rubrik (bobot sama):** Ships · Verified · Closed loop · Craft.
Tie-breaker: **Verified**, lalu **Closed loop**.

---

## 2. Dasar Empiris

Dari **7 run uji suntik bug** pada app `kane_bugtest`:

| # | Mode | Verdict | FAIL di | `family` | `confirmed` | Diagnosis |
|---|------|---------|---------|----------|-------------|-----------|
| 1 | `off` | PASS 6/6 | — | — | — | ✅ |
| 2 | `data` | FAIL | step 4 | `application_issue` | ❌ | ✅ |
| 3 | state kotor | FAIL | step 5 | `automation_bug` | ❌ | ✅ |
| 4 | `logic` | FAIL | step 2 | `automation_bug` | ❌ | ❌ |
| 5 | `silent` | FAIL | step 4 | `application_issue` | ✅ | ✅ |
| 6 | `crash` | FAIL | step 4 | `application_issue` | ✅ | ✅ |
| 7 | `ui` | FAIL | step 5 | `automation_bug` | ❌ | ⚠️ |

**Fakta kunci:**

- **Verdict pass/fail: 7/7 benar. Nol false pass.**
- **Diagnosis: 5/6 akurat.** Satu salah total (run 4: bug produk dituduh
  masalah otomasi, confidence 0.94).
- **`confirmed: true` berkorelasi dengan diagnosis presisi** (run 5, 6:
  confidence 0.97–0.98, tepat sasaran).
- **Kane bisa merekam aksi cacat** (run 7: klik Delete terekam dua kali).
  Replay gagal di klik kedua; app tidak pernah diuji.
- **Test tidak idempoten → FAIL palsu** (run 3, 7). State bocor antar-run.

**Implikasi:** loop naif ("FAIL → perbaiki kode") akan **merusak kode yang benar**.

---

## 3. Enam Invariant "Loop yang Benar"

**I1 — Verdict adalah otoritas; diagnosis adalah petunjuk.**
Loop boleh *bertindak* berdasarkan verdict. Loop hanya boleh *memilih target
perbaikan* berdasarkan diagnosis.

**I2 — Rute ditentukan oleh `family`, bukan oleh "ada FAIL".**

```
application_issue  → target perbaikan = kode app
automation_bug     → target perbaikan = _test.md
(tidak dikenali)   → target = tidak ada. berhenti.
```

**I3 — `confirmed: true` boleh otomatis; `confirmed: false` tidak.**
`confirmed:false` → eskalasi ke manusia, atau minta run kedua independen.

**I4 — Idempoten atau tidak dijalankan.**
Reset state sebelum setiap run.

**I5 — Audit sebelum authoring, bukan setelah.**
Periksa `_test.md` (klik berulang, langkah tanpa reset, assertion yang tak
menyentuh state) **sebelum** membakar waktu authoring.

**I6 — Retry terbatas, dengan jalan keluar eksplisit.**
Batas percobaan + status `escalated` yang terlihat di dashboard.

---

## 4. Yang Otomatis Tersingkir

- **Hook → Kane → agent fix → ulang** (versi naif). Melanggar I2 dan I3.
- **Auto-fix pada semua FAIL.** Merusak kode sehat pada `automation_bug`.
- **Retry tanpa batas.**
- **Dashboard yang "terlihat" loop.** Setiap angka harus dari run sungguhan.
- **App demo yang tidak stateful.** Tanpa state, tidak ada yang bisa diverifikasi
  bermakna — dan di situ Kane paling kuat (data, crash, silent semua bug state).
- **Memanggil CLI agent pihak ketiga.** Tidak perlu; agent-nya sesi AI ini.

---

## 5. Bentuk yang Mengikuti

Web dashboard + hook file watcher.

```
save
 ↓
[AUDIT]  I5 — _test.md lolos?  tidak → tolak, jangan bakar kredit/waktu
 ↓ ya
[RESET]  I4 — pulihkan state
 ↓
[RUN]    Kane --agent (NDJSON)
 ↓
[PARSE]  verdict + family + confirmed
 ↓
[ROUTE]  I2 + I3
 ├─ application_issue + confirmed → "perbaiki kode"
 ├─ automation_bug     + confirmed → "perbaiki test"
 └─ selain itu                     → escalate, berhenti
 ↓
agent (sesi AI) bertindak → save → ulang (I6: maks N kali)
```

### 5a. Penegakan, bukan sekadar kebijakan

Kalau rute `escalate`, harness **harus bisa menolak aksi agent**. Bukan hanya
menampilkan peringatan — harus memblokir sampai manusia mengizinkan.

Tanpa penolakan, ini bukan guardrail, ini cuma dashboard.

Ini yang membedakan alat kita dari "hook yang jalan Kane".

---

## 6. Dogfooding: Dashboard Diverifikasi Kane

Flow utama app = "picu run → lihat verdict → lihat rute". Itu bisa ditulis
sebagai `_test.md` dan diuji Kane.

- Kita punya **app sungguhan** dengan primary flow.
- **Closed loop harfiah**: Kane memverifikasi alat yang mengatur Kane.
- Demo tidak bisa bohong, karena alat yang memamerkan loop sedang diuji.

---

## 7. Momen Demo (dinilai tertinggi)

Bukan "lihat, hijau". Tapi **dua FAIL yang ditangani berbeda**:

1. **Suntik bug nyata** → Kane `application_issue` + `confirmed` → agent
   **memperbaiki kode** → hijau.
2. **Rusak test-nya** (klik duplikat, temuan run 7) → Kane `automation_bug` →
   agent **tidak menyentuh kode**, memperbaiki test → hijau.

Langkah 2 adalah "the moment": agent membaca hasil Kane lalu **memutuskan untuk
tidak memperbaiki app**.

---

## 8. Yang Dipotong

- **Multi-agent.** Satu agent (sesi ini). "Any agent" itu tesis mereka, bukan
  fitur yang harus kita bangun.
- **Cloud hosting.** Lokal, satu perintah.
- **UI cantik.** Timeline yang terbaca > visual yang mengesankan.
- **Dukungan semua jenis test.** Satu flow, dua mode kegagalan.
- **Demo panjang.** 3 menit, padat. Take bersih direkam dua kali: sekali untuk
  memastikan loop jalan, sekali untuk rekaman final.

---

## 9. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Aksi agent live lambat/tak terduga saat rekaman | Demo gagal | Rekam dua kali; timing sudah diketahui di take 1 |
| Kredit habis | ~~Tinggi~~ → rendah setelah 10k aktif | I5 tetap dipertahankan untuk hemat waktu |
| Waktu | Fitur setengah jadi | Potong agresif (bagian 8) |
| Demo terlihat loop padahal animasi | Skor Craft jatuh | Semua angka dari run sungguhan |
| Harness tidak benar-benar memblokir | Alat tak berguna | Uji penolakan secara eksplisit |

**Risiko terbesar sekarang:** aksi agent live saat rekaman. Bukan kredit, bukan
teknologi.

---

## 10. Status Kriteria (diperbarui 12 Nov)

| # | Kriteria | Status | Bukti |
|---|---|---|---|
| 1 | File watcher memicu Kane | ✅ **selesai** | `guard/watcher.js` (22/22) + `watch.js --demo` DETECTED |
| 2 | Parser NDJSON | ✅ **selesai** | `guard/route.js` `parseEvents` |
| 3 | Router (I2 + I3) | ✅ **selesai** | `guard/route.js`, 12/12 test |
| 4 | Agent bertindak sesuai rute | ✅ **selesai** | live run: `agent_acted edit_app` + `agent_blocked edit_test` |
| 5 | Dashboard | ✅ **live** | `guard/server.js`, 7 iterasi / 42 event |
| 6 | Harness menolak aksi | ✅ **selesai** | `guard/policy.js`, 38/38 test |

**6 dari 6 selesai.**

### #4 — apa yang terbukti

Loop live pada app `ledger/`, dicatat di `guard/ledger.jsonl`:

1. **Baseline PASS** (310 detik) — app sehat, Kane hijau.
2. **`fix_app`** — bug `add_crash` (HTTP 500) → Kane `application_issue`
   `confirmed:true` → guard izinkan `edit_app` → agent **memperbaiki kode** →
   Kane PASS. **Loop tertutup.**
3. **`agent_blocked`** — agent mencoba `edit_test` di rute yang sama →
   **ditolak** dengan alasan I2 (*"mengubah _test.md akan menyembunyikan bug"*).
4. **`escalate`** — test cacat → Kane `automation_bug` `confirmed:false` →
   guard menolak agent bertindak → berhenti di tangan manusia.

Temuan tambahan yang penting: **Kane tidak pernah menandai `automation_bug`
sebagai `confirmed: true`** di 4 percobaan dengan cacat test berbeda.
Rute `fix_test` karena itu praktis tidak terjangkau, dan itu **disengaja**:
melonggarkan I3 akan membuat guard salah di run `logic` (Kane keliru bilang
`automation_bug` padahal bug app).

Yang dinilai juri ada di langkah 3: **agent memutuskan untuk tidak
memperbaiki app**, dan guard tercatat menolaknya.

---

## 11. Build Log

### Yang sudah dibangun

```
guard/
├── route.js           router: NDJSON → verdict/family/confirmed → rute
├── route.test.js      12 kasus (7 data nyata + 5 sintetis) — 12/12 lulus
├── policy.js          penegakan: rute + aksi → allow/deny + budget retry (I6)
├── policy.test.js     38 kasus (matriks, budget, masukan sah, integrasi) — 38/38 lulus
├── ledger.js          append-only JSONL
├── ledger.test.js     7/7 lulus
├── ingest.js          NDJSON → ledger, satu jalur untuk replay & live
├── watcher.js         shouldIgnore / classify / createDebouncer (pure)
├── watcher.test.js    22 kasus (filter, klasifikasi, debounce) — 22/22 lulus
├── watch.js           CLI: fs.watch + debounce; --dry default, --live memanggil Kane
├── seed.js            isi ledger dari 7 NDJSON nyata (gratis)
├── server.js          serve dashboard + /api/ledger
└── public/
    ├── index.html
    ├── dashboard.js   timeline, group per iterasi, render event
    └── styles.css
```

Total: **79 test lulus, 0 gagal.** (12 + 38 + 7 + 22)

### Watcher: apa yang terbukti

- **Filter** — `node_modules`, `.git`, `ledger.jsonl`, `*.ndjson`, cookie curl,
  dan `.ledger-test.jsonl` diabaikan. Tanpa ini, watcher akan memicu diri sendiri
  setiap kali menulis ke ledger.
- **Klasifikasi** — `_test.md` → `test`; `.js/.ts/.html/.css` → `app`; lainnya → `other`.
- **Debounce per-key** — 3 event cepat pada file sama → 1 trigger; dua save
  terpisah → 2 trigger. Save Windows sering memicu beberapa event untuk satu
  perubahan; tanpa debounce, satu `Ctrl+S` bisa membakar beberapa run Kane.
- **`fs.watch` nyata** — `node watch.js --demo` menulis file dummy dan
  melaporkan `DETECTED`. Ini bukan mock; ini filesystem sungguhan.
- **Mode aman secara default** — `--dry` tidak menyentuh Kane dan tidak menulis
  ke ledger. `--live` baru memanggil Kane, dan itu memakan kredit. Seseorang
  harus secara eksplisit memintanya.

### Keputusan router terhadap 7 run nyata

| Run | Rute | Alasan |
|---|---|---|
| `run_off` | `done` | lulus |
| `run_data` | `escalate` | application_issue tapi confirmed=false (I3) |
| `run_off2` | `escalate` | automation_bug, confirmed=false (I3) |
| `run_logic` | `escalate` | automation_bug, confirmed=false (I3) |
| `run_silent` | `fix_app` | application_issue + confirmed=true (I2) |
| `run_crash` | `fix_app` | application_issue + confirmed=true (I2) |
| `run_ui` | `escalate` | automation_bug, confirmed=false (I3) |

Hanya **2 dari 7** yang menghasilkan rute otomatis. Sisanya eskalasi. Router naif
(`FAIL → fix_app`) akan mengirim 6 dari 7 ke perbaikan kode — termasuk dua di
mana Kane sendiri keliru atau merekam aksi cacat. **Selisih 6 vs 2 itu adalah
produknya.**

### Yang terbukti di UI

Dashboard menampilkan probe per iterasi: aksi yang "menggoda" dan **ditolak**
oleh policy. Contoh dari iterasi `run_data`:

- rute = `escalate`
- probe `edit_app` → **✗ deny**: *"rute escalate: agent tidak boleh bertindak"*

Guardrail terlihat, bukan diklaim.

### Catatan kejujuran untuk demo

Dashboard saat ini memakai `source: 'replay'` — memutar ulang 7 NDJSON nyata,
bukan run live. Itu bukan animasi: setiap event berasal dari run Kane yang
benar-benar terjadi. Tapi untuk demo, watcher akan menulis `source: 'live'` ke
ledger yang sama, sehingga juri melihat perbedaan secara langsung.

---

## 12. Prinsip Pegangan

> Definisi "loop yang benar" adalah hasil pengukuran, bukan pendapat.
> Kalau satu keputusan desain tidak bisa dilacak ke I1–I6, itu kemungkinan besar
> fitur yang tidak perlu.

> Menang bukan karena app-nya mewah, tapi karena loop-nya rapat dan bisa
> dipertanggungjawabkan.

> Alat yang tidak bisa menolak bukan guardrail. Kemampuan menolak adalah
> produknya.

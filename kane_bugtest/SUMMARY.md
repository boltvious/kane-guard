# Kane CLI — Hasil Uji Suntik Bug (Verifikasi Independen)

Tanggal: 11 November 2026
Versi Kane CLI: 0.10.3
Mesin: Windows, Node v22.23.1, Chrome lokal
Biaya total: 1200 → 1013,78 kredit (~186 terpakai, 7 run)

---

## Tujuan

Menguji apakah Kane CLI benar-benar **memverifikasi perilaku**, atau hanya memutar
ulang rekaman lalu menyebutnya "pass". Metodenya: suntik bug yang diketahui
pasti, lalu lihat apakah Kane menangkapnya.

## Metode

App uji `kane_bugtest` punya saklar bug (`bug.mode`) yang dibaca tiap request,
tanpa perlu restart. Satu flow `tests/login_tasks_test.md` (6 step) dijalankan
berulang pada mode berbeda, dengan `--no-adaptive-heal` agar replay miss jadi
terminal.

---

## Tabel Hasil Lengkap (7 run)

| # | Mode | Verdict | FAIL di | `family` | `confirmed` | Diagnosis |
|---|------|---------|---------|----------|-------------|-----------|
| 1 | `off` | PASS 6/6 | — | — | — | ✅ |
| 2 | `data` | FAIL | step 4 | `application_issue` | ❌ | ✅ |
| 3 | state kotor | FAIL | step 5 | `automation_bug` | ❌ | ✅ |
| 4 | `logic` | FAIL | step 2 | `automation_bug` | ❌ | ❌ |
| 5 | `silent` | FAIL | step 4 | `application_issue` | ✅ | ✅ |
| 6 | `crash` | FAIL | step 4 | `application_issue` | ✅ | ✅ |
| 7 | `ui` | FAIL | step 5 | `automation_bug` | ❌ | ⚠️ |

**Verdict pass/fail: 7 dari 7 benar. Nol false pass.**
**Diagnosis: 5 dari 6 yang bisa dinilai akurat.** (run 7 tidak sampai menguji app)

---

## Detail Per Run

### 1. Baseline — app sehat (`off`)

- **PASSED** 6/6, 558 detik, ~126 kredit (authoring)
- Assertion nyata terhadap DOM hidup, contoh:

```js
Array.from(el(13).querySelectorAll('.task-title'))
  .some(e => e.textContent.trim() === 'Buy milk')
```

### 2. Bug `data` — add-task jawab 200 tapi tidak menyimpan

- **FAILED step 4** (`assertion_failed`), ~7 kredit
- `buy_milk_task_still_listed`: `true` → `false`

```json
{"bug_title":"Newly added tasks disappear after reload",
 "family":"application_issue", "category":"functional_defect",
 "severity":"major", "confidence":0.91, "confirmed":false}
```

### 3. State kotor setelah `data` (bug dimatikan)

- **FAILED step 5**

```json
{"bug_title":"Replay repeats deletion after task is removed",
 "family":"automation_bug", "category":"state_transition_bug",
 "severity":"minor", "confidence":0.96, "confirmed":false}
```

Kane menyalahkan test-nya sendiri, bukan app. Benar — test tidak idempoten.

### 4. Bug `logic` — login menerima password salah

- **FAILED step 2** (step yang benar), ~15 kredit
- Replay berjalan sesuai skrip (wait → fill → fill → click → assert GAGAL)
- App mulai dari halaman sign-in; dashboard muncul **karena bug**

```json
{"bug_title":"Replay began on an authenticated task dashboard",
 "family":"automation_bug", "severity":"minor",
 "confidence":0.94, "confirmed":false}
```

**Diagnosis salah** — bug produk diklasifikasikan sebagai masalah otomasi.

### 5. Bug `silent` — login balas 200 tanpa sesi

- **FAILED step 4**, ~8 kredit

```json
{"bug_title":"Task creation rejected for apparent signed-in user",
 "family":"application_issue", "category":"api_error",
 "severity":"major", "confidence":0.97, "confirmed":true}
```

**Terbaik.** Diagnosis menembus UI: *"the task API says the user is not
authenticated"* — persis mekanisme bug. Tidak tertipu HTTP 200 palsu.

### 6. Bug `crash` — task list balas HTTP 500

- **FAILED step 4**, ~8 kredit

```json
{"bug_title":"Task list fails with internal server error after reload",
 "family":"application_issue", "category":"api_error",
 "severity":"major", "confidence":0.98, "confirmed":true}
```

Menyebut "internal server error" secara eksplisit. Presisi tinggi.

### 7. Bug `ui` — delete balas 200 tapi tidak benar-benar menghapus

- **FAILED step 5**, tapi di **aksi klik**, bukan assertion
- Bug `ui` **terbukti nyata** secara manual (DELETE 200, data masih ada)
- **Kane tidak pernah sampai menguji app.**

```json
{"bug_title":"Delete replay targets task after it was already removed",
 "family":"automation_bug", "severity":"minor",
 "confidence":0.93, "confirmed":false}
```

**Penyebab dari log:** Kane merekam **klik Delete DUA KALI** saat authoring
(ordinal 33 dan 34). Pada replay, klik pertama berhasil, baris hilang, klik
kedua menabrak elemen yang sudah tidak ada → gagal sebelum assertion.

Ini bukan false pass (verdict FAIL benar), tapi **false coverage**: test
melaporkan gagal karena rekamannya sendiri cacat, dan perilaku app yang
seharusnya diuji tidak tersentuh.

---

## Kesimpulan

### Yang terbukti benar

- **Nol false pass dalam 7 run.** Tidak ada satu pun kasus app rusak yang
  dilaporkan PASS.
- **Assertion nyata** terhadap DOM hidup, bukan sekadar "UI tidak error".
- **Diagnosis umumnya tajam** — pada `silent` dan `crash` Kane menunjuk lapisan
  API dan jenis kegagalan yang tepat (`api_error`), level analisis tinggi.
- **Membedakan bug produk vs bug otomasi** — terlihat di uji 3.
- **`confirmed: true` adalah sinyal andal** — dua verdict yang confirmed (uji 5
  dan 6) keduanya diagnosis presisi. Yang `confirmed: false` cenderung lebih
  ragu atau meleset.

### Yang perlu diwaspadai

- **Diagnosis bisa salah** — uji 4 salah mengklasifikasikan bug produk sebagai
  `automation_bug` dengan confidence 0.94. Jangan pakai `family`/`category`
  tanpa verifikasi manusia, kecuali `confirmed: true`.
- **Authoring bisa menghasilkan rekaman cacat** — uji 7 membuktikan Kane dapat
  merekam aksi duplikat. Replay setia menjalankannya, gagal lebih awal, dan
  app tidak pernah teruji. Kualitas rekaman wajib diperiksa manusia.
- **Test harus idempoten** — state server tertinggal antar-run menyebabkan
  kegagalan (uji 3 dan 7). Ini tanggung jawab penulis test, bukan Kane.
- **Evidence upload bisa gagal** — pada uji 6 muncul
  `test_md_evidence_ingest: failed, stage: upload`, meski verdict tetap dihasilkan.

### Koreksi hipotesis awal

Hipotesis awal: *"pass Kane cuma berarti 'sesuai rekaman', bukan 'benar'."*

**Gugur total.** Verdict pass/fail Kane terbukti bisa dipercaya: 7/7 benar,
nol false pass, assertion mengeksekusi JS terhadap DOM.

Penilaian yang lebih tepat:

> **Verdict pass/fail: sangat bisa dipercaya.** Nol false pass dalam 7 run.
> **Diagnosis: umumnya membantu, jangan dipakai buta.** 5/6 akurat;
> `confirmed: true` layak dipercaya, `confirmed: false` perlu verifikasi.
> **Kualitas rekaman: tanggung jawab manusia.** Kane bisa merekam aksi cacat,
> dan verdict `automation_bug` yang dihasilkan benar secara teknis tapi
> menyesatkan kalau dibaca sebagai "app baik-baik saja".

### Batasan yang tetap berlaku

1. **Authoring mahal** (~126 kredit untuk flow 6 step). Replay murah (~7-15).
2. **Bergantung cloud** — wajib login, hasil di-upload, tidak ada opsi offline.
3. **Model tertutup** (`v16-alpha`), tidak bisa diganti.
4. **Setiap run membuka `kaneai-playground.lambdatest.io`** sebelum navigasi ke
   target — diduga dari `default_url` di konfigurasi, belum dikonfirmasi.
5. **Cakupan 6/6 mode bug teruji.** Semua tertangkap (FAIL), tapi satu (`ui`)
   tertangkap karena alasan yang salah.

### Rekomendasi pemakaian

- **Layak** sebagai gerbang lulus/gagal untuk regression test, **asalkan**:
  - test-nya idempoten (reset state sebelum/sesudah),
  - rekaman authoring diperiksa manusia sekali,
  - diagnosis `confirmed: false` tidak dipakai untuk keputusan.
- **Jangan** mengandalkan Kane sebagai satu-satunya sumber kebenaran untuk
  diagnosis penyebab bug.

---

## Data mentah

- `run_off.ndjson` — authoring, app sehat, PASSED (104 KB)
- `run_data.ndjson` — bug `data`, FAILED step 4
- `run_off2.ndjson` — app sehat + state kotor, FAILED step 5
- `run_logic.ndjson` — bug `logic`, FAILED step 2, diagnosis salah
- `run_silent.ndjson` — bug `silent`, FAILED step 4, presisi, confirmed
- `run_crash.ndjson` — bug `crash`, FAILED step 4, presisi, confirmed
- `run_ui.ndjson` — bug `ui`, FAILED step 5 di klik (rekaman cacat, app tak teruji)
- `RUNBOOK.md` — matriks eksperimen lengkap

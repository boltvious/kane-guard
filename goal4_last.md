# GOAL #4 — Agent Bertindak Sesuai Rute

Dokumen kerja terpisah. `goal.md` memuat seluruh rencana; dokumen ini hanya
untuk **kriteria terakhir** yang belum terbukti.

Status saat ini: **5 dari 6 kriteria selesai.**
Kredit: 1013,78. Kredit hackathon 10k belum masuk meski jam 15:17 lewat 14:00.

---

## 1. Yang Harus Dibuktikan

> **Agent membaca rute dari guard, lalu bertindak SESUAI RUTE — bukan sesuai FAIL.**

Ini kriteria yang paling mudah dipalsukan. "Loop terlihat hidup" bisa dibuat
dengan animasi. Yang membuktikannya adalah **keputusan yang berlawanan dengan
insting naif**: ketika Kane berkata FAIL, agent memutuskan **tidak** memperbaiki
kode.

### Bukti minimum yang sah

1. Satu iterasi `fix_app` — agent mengubah **kode**, Kane hijau lagi.
2. Satu iterasi `fix_test` — agent **tidak menyentuh kode**, ia mengubah
   `_test.md`, Kane hijau lagi.
3. Kedua iterasi tercatat di `guard/ledger.jsonl` dengan `source: 'live'`.
4. Dashboard menampilkan keduanya tanpa disunting.

Tanpa nomor 2, demo ini sama dengan hook biasa.

---

## 2. Kenapa Ini yang Paling Sulit

Tiga alasan yang sudah terbukti di eksperimen sebelumnya:

1. **Agent (aku) cenderung bertindak cepat.** Di run `logic`, aku hampir
   menyimpulkan "cookie lama" dan memperbaiki hal yang salah. Rute `escalate`
   memaksa berhenti. Insting itu harus dilawan.
2. **Aksi agent memakan waktu.** Bukan masalah kredit, tapi masalah rekaman.
   Agent yang berpikir 30 detik di tengah demo terasa lambat di video 3 menit.
3. **State bocor antar-run.** Run 3 dan 7 gagal karena ini. Reset state harus
   menjadi langkah pertama setiap iterasi, bukan langkah opsional.

---

## 3. App Demo: "Ledger"

Bukan `kane_bugtest`. Nama itu jelas test fixture, dan brief memperingatkan
"polished todo app" — kita butuh sesuatu yang **kecil tapi terasa seperti
produk sungguhan**.

### Bentuk

Mini issue tracker, satu halaman, stateful:

- Daftar issue (judul + status: `open` / `done`)
- Buat issue baru
- Tandai selesai
- Hapus issue
- Route `/guard` — menampilkan dashboard Kane Guard (dogfooding)

### Kenapa app ini

- **Stateful.** Bug-nya bisa nyata (persistensi, status palsu, hapus palsu).
- **Kecil.** Flow `_test.md` cukup 4 langkah, authoring lebih murah dan cepat.
- **Dogfooding.** `/guard` menampilkan dashboard yang mengatur Kane. Flow demo
  menyentuh alatnya sendiri.

### Teknologi

- Node murni, tanpa dependency (pola `kane_bugtest`)
- JSON file sebagai state (mudah di-reset)
- `POST /api/reset` untuk I4

---

## 4. Flow Uji

`tests/ledger_flow_test.md`, empat langkah:

```
1. Buka app, konfirmasi judul + daftar issue awal
2. Buat issue "Ship demo", konfirmasi muncul
3. Reload, konfirmasi "Ship demo" masih ada
4. Tandai selesai, reload, konfirmasi status tetap done
```

Frontmatter `url: http://127.0.0.1:4175`.

---

## 5. Urutan Eksekusi

### Tahap A — Bangun (gratis, tanpa Kane)

- [ ] A1. Scaffold `ledger/` (server, state JSON, `/api/reset`, `/guard`)
- [ ] A2. UI satu halaman (daftar, tambah, selesai, hapus)
- [ ] A3. Uji manual: create → reload → persist → done → reload → persist
- [ ] A4. Tulis `tests/ledger_flow_test.md` (4 langkah)
- [ ] A5. Audit test dengan `guard/watcher.js` + cek manual (klik duplikat,
      idempotensi, assertion menyentuh state)

### Tahap B — Baseline (butuh kredit, ~130)

- [ ] B1. `kane-cli testmd run tests/ledger_flow_test.md --agent` → **PASS**
- [ ] B2. Seed ledger dengan hasil ini (`source: 'live'`, bukan replay)
- [ ] B3. Verifikasi dashboard menampilkan iterasi baru

### Tahap C — Skenario `fix_app` (butuh kredit, ~30)

- [ ] C1. Suntik bug nyata: `POST /api/issues` balas 201 tapi tidak menyimpan
- [ ] C2. Jalankan Kane → FAIL `application_issue` + `confirmed: true`
- [ ] C3. Guard merutekan ke `fix_app`
- [ ] C4. **Agent memperbaiki kode** (bukan test)
- [ ] C5. Jalankan Kane → **PASS**
- [ ] C6. Ledger mencatat rantai lengkap

### Tahap D — Skenario `fix_test` — TEMUAN: tidak terjangkau

**Status: tidak bisa dicapai dengan data Kane nyata.**

Diuji 4 kali dengan berbagai jenis cacat test (klik duplikat, assertion
terbalik, state tidak idempoten). Setiap kali Kane melaporkan:

```
family: automation_bug
confirmed: false
confidence: 0.93–0.98
```

**Kane tidak pernah menandai `automation_bug` sebagai `confirmed: true`.**
Polanya konsisten di 8 run:

| Run | family | confirmed |
|---|---|---|
| silent | application_issue | **true** |
| crash | application_issue | **true** |
| data | application_issue | false |
| add_lost | application_issue | false |
| logic | automation_bug | false |
| ui | automation_bug | false |
| off2 | automation_bug | false |
| fixtest2 | automation_bug | false |

`confirmed` tampaknya dikalibrasi untuk **bug produk yang jelas** (HTTP 5xx,
API menolak). Untuk bug test, Kane sengaja tidak memberi konfirmasi.

### Kenapa ini bagus, bukan buruk

Kalau kita longgarkan I3 untuk menerima `automation_bug` tanpa konfirmasi,
kita akan **salah di run `logic`** — di mana Kane bilang `automation_bug`
padahal sebenarnya bug app (confidence 0.94). Guard yang berhenti lebih
baik daripada guard yang menebak.

### Keputusan

Tetap pertahankan I3 ketat. **Jangan** longgarkan.

### Narasi demo pengganti: tiga babak

1. **Baseline PASS** — Kane menguji app sehat, semua hijau.
2. **`fix_app`** — bug app, Kane `confirmed: true` → guard izinkan agent ubah
   kode → Kane PASS. **Loop tertutup.**
3. **`escalate`** — test cacat, Kane `automation_bug, confirmed: false` →
   guard **menolak** agent bertindak → eskalasi ke manusia.
   **Ini momen yang dinilai: agent tidak merusak.**

Kalimat pitch:

> *"Kane benar di semua diagnosis. Tapi di 5 dari 8 kasus, dia belum cukup
> yakin. Kalau agent kami naif, ia akan merusak kode. Guard kami tahu bedanya.
> Verifikasi sejati bukan hanya lulus/gagal, tapi tahu kapan harus berhenti."*

### Tahap E — Skenario `escalate` (opsional, ~30)

- [ ] E1. Suntik bug ambigu (mis. `logic`) → Kane FAIL `automation_bug`
      dengan `confirmed: false`
- [ ] E2. Guard merutekan ke `escalate`
- [ ] E3. **Agent tidak bertindak.** Dashboard menampilkan "butuh manusia"
- [ ] E4. Ini bukti bahwa loop punya tombol berhenti (I6)

### Tahap F — Rekaman (gratis)

- [ ] F1. Tulis `DEMO.md` — skrip 3 menit, urutan aksi, kalimat yang diucapkan
- [ ] F2. Rekam take 1 (untuk memastikan timing)
- [ ] F3. Rekam take 2 (rekaman final)

---

## 6. Anggaran Kredit

| Tahap | Perkiraan | Kumulatif |
|---|---|---|
| B (baseline authoring) | ~130 | 130 |
| C (replay + verify) | ~25 | 155 |
| D (replay + verify) | ~25 | 180 |
| E (opsional) | ~25 | 205 |
| Cadangan (rekaman ulang) | ~200 | 405 |

Sisa saldo **1013** cukup untuk seluruh rencana **plus dua kali ulang penuh**,
tanpa menunggu kredit 10k.

---

## 7. Momen Demo (yang harus terekam)

Urutan yang dinilai juri:

1. **Suntik bug app** → Kane FAIL → dashboard menunjukkan `route: fix_app` →
   **agent mengubah kode** → Kane PASS.
2. **Rusak test** → Kane FAIL → dashboard menunjukkan `route: fix_test` →
   **agent mengubah test, bukan kode** → Kane PASS.
3. **Probe ditolak** — dashboard menampilkan `✗ deny edit_app` pada iterasi #2.

Kalimat yang harus terdengar di video:

> *"Kane bilang FAIL dua kali. Di kasus pertama, guard menyuruh saya memperbaiki
> kode. Di kasus kedua, guard menyuruh saya memperbaiki test — dan policy
> memblokir saya kalau saya mencoba menyentuh kode. Itu bedanya."*

---

## 8. Risiko Khusus #4

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Agent (aku) lupa mengikuti rute | Demo gagal | Policy memblokir; probe terlihat di dashboard |
| Flow 4 langkah tetap tidak idempoten | FAIL palsu | Reset state di awal; uji manual sebelum Kane |
| Kane rekam klik duplikat di flow baru | `automation_bug` tak terduga | Audit `_test.md` manual sebelum authoring |
| `confirmed: false` pada bug yang disuntik | Rute jadi `escalate`, bukan `fix_app` | Pilih bug yang jelas (HTTP 200 palsu, bukan bug logika halus) |
| Rekaman terlalu lambat | Video > 3 menit | Rekam dua kali; potong bagian menunggu |

---

## 9. Definisi Selesai

#4 dianggap selesai ketika **semua** ini benar:

- [ ] App `ledger/` jalan dan bisa diverifikasi Kane
- [ ] `guard/ledger.jsonl` memuat minimal: 1 baseline PASS, 1 `fix_app`
      (FAIL → PASS), 1 `fix_test` (FAIL → PASS)
- [ ] Setiap entri `fix_test` diikuti `policy_probe` dengan `allowed: false`
      untuk `edit_app`
- [ ] Dashboard menampilkan ketiganya tanpa disunting
- [ ] `DEMO.md` ada dan cukup untuk merekam video 3 menit
- [ ] `goal.md` diperbarui: 6/6 kriteria selesai

---

## 10. Prinsip yang Dipegang di Tahap Ini

> **Kalau di tengah demo aku merasa "ah, ini bug app, langsung perbaiki saja",
> itu saatnya berhenti dan membaca rute.** Insting itu yang dirancang untuk
> ditahan oleh guard.

> **Rekaman harus memperlihatkan keputusan, bukan hanya hasil.** Hijau di akhir
> tidak membuktikan apa-apa; yang membuktikan adalah FAIL di tengah dan rute
> yang dipilih untuk keluar darinya.

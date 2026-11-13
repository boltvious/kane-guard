# SUBMISSION — Kane CLI Online Hackathon

Deadline: **19 November 2026, 23:59 IST**
Form: https://www.surveymonkey.com/r/kane-cli-hackathon-submission

Empat hal yang diminta form. Semua teks di bawah siap copy-paste.

---

## 1. GitHub repo

```
https://github.com/boltvious/kane-guard
```

Repo publik. README memuat setup steps, arsitektur, dan bukti.
Di-initialize 13 November 2026 — setelah tanggal 12 November, sesuai aturan.

---

## 2. Video demo

```
[PASTE URL YOUTUBE UNLISTED DI SINI]
```

- Visibility: **Unlisted** (bukan Private)
- Durasi: ≤ 3:00
- Uji link di jendela incognito sebelum submit

---

## 3. Satu paragraf

**Versi utama (pakai ini):**

> **Kane Guard** is a verification layer that sits between an AI coding agent
> and Kane CLI. Before building it, I ran seven deliberate bug-injection
> experiments against a throwaway app and found that Kane's pass/fail verdict
> was right 7 out of 7 times, but its *diagnosis* was wrong once, and
> `confirmed: true` only ever appeared on unambiguous product bugs. That means
> an agent that acts on every FAIL will rewrite healthy code whenever the
> failure came from the test. Kane Guard fixes that: it routes by `family`
> (`application_issue` → fix the app, `automation_bug` → fix the test), refuses
> to act automatically when `confirmed` is false, and blocks the agent in code
> when it tries to edit the wrong target. Every decision lands in an
> append-only ledger and a dashboard that is itself verified by Kane. Built
> with an AI coding agent driving the workspace through a local tool bridge;
> Kane CLI verifies the app under test, the guard's own dashboard, and the loop
> itself. 79 tests pass against recorded NDJSON, consuming zero credits.

**Versi pendek** (kalau ada batas karakter):

> Kane Guard is a guardrail between an AI coding agent and Kane CLI. I measured
> Kane with seven injected bugs: the pass/fail verdict was right 7/7, but the
> diagnosis was wrong once and `confirmed` was only true for unambiguous
> product bugs. So the guard routes by `family`, refuses to act when
> `confirmed` is false, and blocks the agent in code when it edits the wrong
> target. Every decision is recorded in an append-only ledger and a dashboard
> that Kane itself verifies. 79 tests, zero credits.

**Pilih agent yang kamu sebut.** Kalau ingin lebih spesifik, ganti frasa
*"an AI coding agent driving the workspace through a local tool bridge"* dengan
nama agent yang kamu pakai. Brief mengizinkan agent apa pun — termasuk asisten
chat yang mengemudikan workspace lewat bridge. Yang penting jujur.

---

## 4. Live URL atau perintah runnable

```
cd ledger && node server.js      # app under test  → http://127.0.0.1:4175
cd guard  && node server.js      # dashboard       → http://127.0.0.1:4174
cd guard  && node seed.js        # load recorded evidence into the dashboard
```

Butuh **Node 18+** dan **Chrome**. Tidak ada dependency npm di kedua app.
Dashboard langsung menampilkan 12 iterasi tanpa login apa pun.

Untuk melihat alatnya bekerja (membutuhkan login Kane CLI):
```
cd ledger && node toggle.js add_crash
kane-cli testmd run tests/ledger_flow_test.md --agent --no-adaptive-heal > run_live.ndjson 2>&1
node ..\guard\ingest-cli.js run_live.ndjson live tests/ledger_flow_test.md
```

---

## Checklist sebelum submit

- [ ] Repo publik dan bisa dibuka tanpa login
- [ ] Commit pertama bertanggal ≥ 12 November 2026
- [ ] Video **Unlisted**, durasi ≤ 3:00
- [ ] Link video diuji di incognito
- [ ] Timestamp `02:10` di deskripsi mengarah ke momen `BLOCKED`
- [ ] Paragraf di atas sudah disesuaikan dengan agent yang benar-benar dipakai
- [ ] Tidak ada access key, token, atau email pribadi di mana pun
- [ ] Submit **sebelum 19 November, 23:59 IST**

---

## Kalau juri bertanya

**"Kenapa Kane, bukan Playwright?"**
> Because Playwright would never tell me that a failure came from my test rather
> than my app. Kane did, eight times. And from those eight I could build a guard
> that knows when to stop — something you can't build on a tool that only says
> "failed".

**"App-nya terlalu sederhana?"**
> The app is the substrate, not the product. The guard is. The brief lists
> "a kane-watch file watcher" and "a GitHub bot that adds Kane verification"
> as valid submissions; Kane Guard is that class of tool, with a small app
> attached so the loop can be demonstrated honestly.

**"Apa yang membuat ini berbeda dari hook biasa?"**
> A hook runs Kane and reports. This one refuses. When the route says `fix_app`
> and the agent reaches for `_test.md`, `policy.js` returns `deny` with a
> readable reason, and that refusal is recorded in the ledger. You can see it on
> the dashboard at 02:10 in the video.

**"Kenapa rute `fix_test` tidak pernah muncul?"**
> Because Kane has never returned `confirmed: true` for an `automation_bug` —
> not in eight runs. Loosening the rule would have made the guard act on a run
> where Kane said `automation_bug` but the real bug was in the app. We kept it
> strict on purpose, and we documented it in README and `goal4_last.md`.

---

## Fakta yang aman disebut

| | |
|---|---|
| Kane CLI | 0.10.3 |
| Eksperimen bug-injection | 7 run, verdict 7/7 benar, diagnosis 5/6 |
| Iterasi ledger | 12 recorded + run live saat demo |
| Test otomatis | 79, semuanya lulus, nol kredit |
| Biaya total proyek | ~330 kredit |

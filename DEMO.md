# DEMO — 3 minutes

Judges stop watching at 3:00. The good part goes first.

Record twice: once to learn the timing, once for the final cut. Nothing here
is staged — every number shown comes from a real run already in
`guard/ledger.jsonl`.

---

## Before recording

```bash
cd ledger && node server.js      # :4175
cd guard  && node server.js      # :4174
```

Both windows open side by side. Browser on **http://127.0.0.1:4174**.

Confirm the dashboard shows **12 iterations**. If it shows fewer, run
`cd guard && node seed.js` first, then re-ingest the live runs.

---

## 0:00 – 0:20 · What this is

> "Kane CLI tells you pass or fail, and it's right almost every time. I checked — seven injected bugs, seven correct verdicts. But an AI agent that reads 'FAIL' and immediately edits your code will break a healthy app whenever the failure was the test's fault. So I built the part between them: Kane Guard."

Show the dashboard, top of the timeline.

---

## 0:20 – 0:50 · The naive loop, and why it's wrong

Scroll to iteration **#2, `run_data.ndjson`**.

> "Kane said: application_issue. That looks like a product bug. But look — `confirmed: false`. Kane wasn't sure. A naive hook would have fixed the code anyway. My guard escalated instead."

Point at the **PROBE** line: `✗ deny edit_app`.

> "And if the agent tried to act anyway, the policy would have refused."

---

## 0:50 – 2:10 · The loop that actually closes

Open **http://127.0.0.1:4175** — the app.

> "This is the app under test. Issue tracker. I injected a real bug: creating an issue returns HTTP 500."

Flip the switch on camera:

```bat
cd ledger
node toggle.js add_crash
```

> "Kane runs."

Run it:

```bat
cd ledger
kane-cli testmd run tests/ledger_flow_test.md --agent --no-adaptive-heal
```

While it runs, keep talking:

> "Kane says `application_issue`, `confirmed: true`, confidence 0.99. The guard reads that and routes to `fix_app`."

Reload the dashboard. Show the new iteration: **route `fix_app`**, **policy ✓ allow `edit_app`**, **probe ✗ deny `edit_test`**.

> "So I fix the code. Not the test. The guard would have blocked me if I'd tried."

Fix it:

```bat
node toggle.js off
```

> "Run again."

Reload dashboard: new iteration, **route `done`**.

> "Green. Loop closed. Kane verified the fix, and the guard made sure I fixed the right thing."

---

## 2:10 – 2:45 · The moment that matters

Scroll to the iteration ending **`agent_blocked`**.

> "This is what separates a guard from a dashboard. The route was `fix_app` — fix the code. I tried to touch the test anyway."

Point at the line:

> **`agent_blocked · edit_test`**
> *"rute fix_app: diagnosis menunjuk kode aplikasi — mengubah _test.md akan menyembunyikan bug, bukan memperbaikinya (I2)"*

> "Refused. In code, with a reason a human can read. Not a warning — a block."

---

## 2:45 – 3:00 · The honest part

Scroll to the last iteration, ending **`escalate`**.

> "One more thing I found while building this. Kane has never once marked an `automation_bug` as confirmed — not in eight tries. So my guard stops. It doesn't guess. That's not a bug in Kane; it's Kane telling me it isn't sure. And a verifier that says 'I'm not sure' is worth more than one that's confidently wrong."

End card: **github.com/boltvious/kane-guard — Kane Guard**

---

## Things to have ready before the take

- App running on 4175, dashboard on 4174
- `bug.mode` set to `off`
- Ledger showing 12 iterations
- A terminal window at `ledger/` with the commands ready to paste

---

## What not to do

- **Don't speed up the Kane run on screen.** A 30-second wait is honest; a fast-forward looks like a mock. Cut to the result instead.
- **Don't say "it works" without showing the verdict.** The verdict is the product.
- **Don't hide the `escalate` ending.** It's the strongest argument in the demo.

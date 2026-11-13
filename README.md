# Kane Guard

**A verifier that knows when to say no.**

Kane CLI gives you pass/fail you can trust. But an agent that reads *"FAIL"* and immediately rewrites your code will break a healthy app whenever the failure came from a bad test.

Kane Guard sits between the agent and Kane CLI. It reads Kane's verdict, decides **what the failure actually belongs to**, and — when Kane isn't sure — refuses to let the agent touch anything.

Built for the [Kane CLI Online Hackathon](https://www.testmuai.com/kane-cli/), November 2026.

---

## The problem, measured

Before writing any code, we ran **7 deliberate bug-injection experiments** against a throwaway app (see `kane_bugtest/` and `kane_bugtest/SUMMARY.md`). The result:

- **Verdict pass/fail: 7/7 correct.** No false passes. Kane is genuinely reliable at detecting failure.
- **Diagnosis: 5/6 accurate.** One run misclassified an application bug as an automation bug.
- **`confirmed: true` only ever appeared on unambiguous product bugs** (HTTP 500, auth rejected).

That last point is the important one. An agent that acts on every FAIL will:

- fix code when the test was wrong,
- or fix nothing when the bug was real but quiet.

Both are expensive. Neither is caught by a naive hook.

---

## What Kane Guard does

```
save
 ↓
[watcher]     debounced file change, ignores its own output
 ↓
[kane]        kane-cli testmd run --agent --no-adaptive-heal
 ↓
[router]      verdict + family + confirmed → route
 ↓
[policy]      route + proposed action → allow / deny
 ↓
[ledger]      append-only JSONL, the only source of truth
 ↓
[dashboard]   renders the chain, unedited
```

### Six invariants

1. **Verdict is authority; diagnosis is a hint.** Act on pass/fail; choose the *target* of the fix from the diagnosis.
2. **Route by `family`, not by "there is a FAIL".**
   - `application_issue` → fix the app
   - `automation_bug` → fix the test
   - anything else → stop
3. **`confirmed: true` may act automatically. `confirmed: false` may not.** Escalate to a human.
4. **Idempotent or not run at all.** Reset state before each run.
5. **Audit before authoring.** Check the `_test.md` before spending credits.
6. **Bounded retries with an explicit exit.** A loop with no stop button is a credit leak.

These live in `goal.md`. Every design decision traces back to one of them.

### How the guard reads Kane

The guard reads three signals from the NDJSON stream, and nothing it does not
need:

| Signal | Where it comes from | How the guard uses it |
|---|---|---|
| `overall_status` | `test_md_done` | pass/fail — the authority |
| `family` + `confirmed` | `test_md_bug_verdict` | which target to fix, and whether it may act at all |
| `result_code` | `run_end` | cross-check: `740` is a confirmed product bug, per Kane's docs |

Exit codes are used as a sanity check only (`0` pass, `1` fail, `2` error,
`3` timeout/cancel). A run without a `test_md_done` event is treated as
incomplete and escalated — a truncated log must never be read as a pass.

One thing the documentation does not mention, and we hit it three times: Kane
can **record a duplicate click** during authoring. Replay then runs the second
click against an element that is gone. The guard surfaces that as
`automation_bug`, correctly, but the flow under test never reaches the
assertion that would have checked the app. Fixing that is the author's job —
`ledger/` removes the button once an issue is done, so there is nothing left
to double-click.

---

## Proof, not claims

The ledger (`guard/ledger.jsonl`) contains **12 iterations: 7 replay + 5 live**.

| Iteration | Route | What happened |
|---|---|---|
| Baseline | `done` | Kane passed a healthy app (310 s) |
| `add_crash` | `fix_app` | Kane: `application_issue`, `confirmed: true` |
| ↳ agent | `agent_acted edit_app` | agent fixed the code |
| ↳ agent | `agent_blocked edit_test` | **guard refused** — *"editing _test.md hides the bug"* (I2) |
| ↳ verify | `done` | Kane passed after the fix — **loop closed** |
| broken test | `escalate` | Kane: `automation_bug`, `confirmed: false` → guard stopped |

**The moment that matters is the block.** The agent tried to touch the test while the route said `fix_app`. The policy denied it, with a reason a human can read. Nothing was hidden, nothing was auto-approved.

### A finding we did not expect

Across 8 runs, **Kane never returned `confirmed: true` for an `automation_bug`** — even when its diagnosis was exactly right (`confidence: 0.98`). `confirmed` appears calibrated for product bugs, not test bugs.

So the `fix_test` route is effectively unreachable with a strict policy. **We kept it strict on purpose.** Loosening it would have made the guard act on a run where Kane said `automation_bug` but the real bug was in the app. A guard that stops is worth more than a guard that guesses.

---

## Why Kane, and not something else

Twelve runs in. Every line below is from our own data, not from the docs.

### 1. The verdict can be trusted without qualification

Seven injected bugs, seven correct verdicts. Zero false passes. Playwright
needs a selector you write by hand; Kane needs a sentence in plain English
and is still right. For an agent that has no eyes, this is the only signal
that matters.

### 2. `family` — a distinction most test tools don't make

Other tools report "failed". Kane reports `application_issue` or
`automation_bug`. That difference is why the guard exists at all. Without
`family`, there is no way to know whether to fix the app or fix the test.

### 3. `confirmed` — honesty that wasn't asked for

Five of eight runs came back with `confirmed: false`. Kane withholds
confirmation when it isn't sure. We initially read this as a weakness. After
twelve runs, we read it as the most useful property: a verifier that says
"I'm not sure" is worth more than one that is confidently wrong.

### 4. Assertions that actually run

Not "the UI looks calm". Kane executes JavaScript against the live DOM:

```js
Array.from(el(13).querySelectorAll('.task-title'))
  .some(e => e.textContent.trim() === 'Buy milk')
```

That's why it can break a passing run. We checked.

### 5. `--agent` NDJSON that doesn't lie

Every step, every decision, every credit — as a structured stream. That's
what makes a guard possible. Most test tools emit colored text that cannot
be parsed.

### 6. Diagnosis that reaches through layers

On the `silent` run, Kane wrote *"the task API says the user is not
authenticated"*. It didn't blame the button, didn't blame browser state. It
pointed at the API layer. We didn't expect that from a tool that "clicks
buttons".

---

What this costs is real, and it's documented separately: authoring is slow
and expensive, the model is closed, and the diagnosis can be wrong. Those
limits are in [`kane_bugtest/SUMMARY.md`](kane_bugtest/SUMMARY.md) and
[`goal4_last.md`](goal4_last.md). A guardrail built on a tool whose limits
you won't name is not a guardrail.

---

## Why Kane, and not something else

Twelve runs in. Every line below is from our own data, not from the docs.

### 1. The verdict can be trusted without qualification

Seven injected bugs, seven correct verdicts. Zero false passes. Playwright
needs a selector you write by hand; Kane needs a sentence in plain English
and is still right. For an agent that has no eyes, this is the only signal
that matters.

### 2. `family` — a distinction most test tools don't make

Other tools report "failed". Kane reports `application_issue` or
`automation_bug`. That difference is why the guard exists at all. Without
`family`, there is no way to know whether to fix the app or fix the test.

### 3. `confirmed` — honesty that wasn't asked for

Five of eight runs came back with `confirmed: false`. Kane withholds
confirmation when it isn't sure. We initially read this as a weakness. After
twelve runs, we read it as the most useful property: a verifier that says
"I'm not sure" is worth more than one that is confidently wrong.

### 4. Assertions that actually run

Not "the UI looks calm". Kane executes JavaScript against the live DOM:

```js
Array.from(el(13).querySelectorAll('.task-title'))
  .some(e => e.textContent.trim() === 'Buy milk')
```

That's why it can break a passing run. We checked.

### 5. `--agent` NDJSON that doesn't lie

Every step, every decision, every credit — as a structured stream. That's
what makes a guard possible. Most test tools emit colored text that cannot
be parsed.

### 6. Diagnosis that reaches through layers

On the `silent` run, Kane wrote *"the task API says the user is not
authenticated"*. It didn't blame the button, didn't blame browser state. It
pointed at the API layer. We didn't expect that from a tool that "clicks
buttons".

---

What this costs is real, and it's documented separately: authoring is slow
and expensive, the model is closed, and the diagnosis can be wrong. Those
limits are in [`kane_bugtest/SUMMARY.md`](kane_bugtest/SUMMARY.md) and
[`goal4_last.md`](goal4_last.md). A guardrail built on a tool whose limits
you won't name is not a guardrail.

---

## Running it

Requires **Node 18+** and a **Chrome** install. No npm dependencies in either app.

```bash
# 1. the app under test
cd ledger && node server.js          # http://127.0.0.1:4175

# 2. the guard dashboard
cd guard && node server.js           # http://127.0.0.1:4174

# 3. load the recorded evidence into the dashboard
cd guard && node seed.js
```

Open **http://127.0.0.1:4174** to see the timeline. Open **http://127.0.0.1:4175/guard** to see the same dashboard from inside the app (dogfooding).

### Watching for changes

```bash
cd guard
node watch.js --demo          # self-test, writes a file and confirms detection
node watch.js                 # dry: detects saves, spends nothing
node watch.js --live          # runs Kane on save — costs credits
```

---

## Tests

**79 tests, 0 failures. No credits consumed.** All tests run against recorded NDJSON from the experiments above.

```bash
cd guard
node route.test.js      # 12 — routing against 7 real runs + 5 synthetic branches
node policy.test.js     # 38 — route×action matrix, retry budget, integration
node ledger.test.js     #  7 — append-only log
node watcher.test.js    # 22 — filters, classification, debounce
```

The router test is the interesting one: it asserts that **4 of the 7 real runs must escalate**, not auto-fix. A naive router would have sent 6 of 7 to code changes.

---

## Layout

```
guard/                  the product
  route.js              NDJSON → verdict / family / confirmed → route
  policy.js             route + action → allow / deny + retry budget
  ledger.js             append-only JSONL
  ingest.js             one code path for replay and live
  watcher.js            fs event filters, classification, debounce
  watch.js              CLI: dry by default, --live calls Kane
  server.js             dashboard + /api/ledger
  seed.js               loads recorded evidence
  ingest-cli.js         loads one run into the ledger
  act-cli.js            records an agent action, policy-gated
  public/               dashboard UI

ledger/                 the app under test
  server.js             issue tracker, JSON state, /api/reset, /guard
  toggle.js             bug switch (off | add_crash | add_lost | done_lost)
  tests/                Kane test specs

kane_bugtest/           the 7-run experiment that motivated all of this
  SUMMARY.md            findings, including the ones that hurt

goal.md                 working doc: hackathon thesis, invariants, build log
goal4_last.md           the last criterion in detail, with its outcome
```

---

## What this is not

- **Not a smarter test runner.** Kane still does the running.
- **Not a wrapper that hides Kane's limits.** The limits are documented in `kane_bugtest/SUMMARY.md` and in `goal4_last.md`.
- **Not multi-agent.** One agent is enough to prove the loop; "any agent" is TestMu AI's thesis, not something we needed to implement.

---

## Credits

Built with Kane CLI `0.10.3`.

Total spend across the entire project, including 7 experiments, 5 live loop runs, and two full authoring passes.

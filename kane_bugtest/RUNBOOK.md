# Kane CLI — False-Pass Probe

Goal: determine whether Kane CLI **actually verifies behaviour**, or merely replays
recorded interactions and calls it a pass.

We do this by proving a pass is *falsifiable*: the same recorded flow must FAIL
once the app is deliberately broken in a way the flow should catch.

## Setup

```bat
cd kane_bugtest
node server.js
```

The app listens on http://127.0.0.1:4173 and the bug switch is read from
`bug.mode` on every request, so no restart is ever needed.

## The switch

```bat
node toggle.js            :: show current mode
node toggle.js logic      :: any known username + any password is accepted
node toggle.js silent     :: bad login returns HTTP 200 (no session)
node toggle.js data       :: add-task answers ok but never persists
node toggle.js ui         :: delete answers ok but never removes
node toggle.js crash      :: task list returns HTTP 500 after login
node toggle.js off        :: correct behaviour
```

## Experiment matrix

Run step 1 once (this is the *authoring* run — it costs credits). Then flip the
switch and re-run the SAME command (these are *replay* runs — cheap).

| # | mode    | flow recorded | what a real verifier must say |
|---|---------|---------------|-------------------------------|
| 1 | `off`   | full flow     | PASS (baseline)               |
| 2 | `logic` | full flow     | FAIL on "Reject invalid credentials" |
| 3 | `silent`| full flow     | FAIL on "Reject invalid credentials" |
| 4 | `crash` | full flow     | FAIL at "Your tasks" loads    |
| 5 | `data`  | full flow     | FAIL after reload in "Add a task and verify persistence" |
| 6 | `ui`    | full flow     | FAIL after reload in "Delete the task and verify persistence" |

Rows 5 and 6 are the interesting ones: the UI never shows an error, so only a
verifier that checks **state after reload** will catch them.

## Commands

```bat
kane-cli whoami
kane-cli balance

:: authoring run against the healthy app
kane-cli testmd run tests/login_tasks_test.md

:: flip a bug and replay the same test
node toggle.js data
kane-cli testmd run tests/login_tasks_test.md

:: machine-readable form, for the agent loop
kane-cli testmd run tests/login_tasks_test.md --agent
```

## How to score the result

- **Mode `off` PASS and every other mode FAIL** → Kane is doing real
  verification on this flow. It may be trusted *for this class of check*.
- **Any broken mode still returns PASS** → that is a **false pass**. The tool
  cannot be used as a safety net for that kind of bug, and any "green run"
  in a CI must be read with that in mind.
- **Mode `off` itself fails** → the tool is flaky or the flow wording is
  ambiguous; fix the flow before drawing conclusions about the bugs.

Record every outcome. Do not accept a marketing claim in place of a row.

## Notes

- Replay is cached, so an unchanged flow should be deterministic. Run mode `off`
  three times in a row; any flip-flop is a flakiness signal on its own.
- `data` and `ui` are deliberately *silent*. They are the honest test of whether
  the verifier reads application state or just watches the UI stay calm.

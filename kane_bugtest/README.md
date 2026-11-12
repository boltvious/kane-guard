# kane_bugtest

A zero-dependency, deliberately breakable web app used to test whether
**Kane CLI** catches bugs it should catch, or silently produces false passes.

- Node 18+ / Chrome. No npm install needed.
- `node server.js` → http://127.0.0.1:4173
- `node toggle.js <mode>` → flip an injected bug live, no restart
- `kane_bugtest/tests/login_tasks_test.md` → the flow under test
- `RUNBOOK.md` → the experiment matrix and how to read the results

Credentials: `admin` / `secret123`

Bug modes: `off`, `logic`, `silent`, `data`, `ui`, `crash`

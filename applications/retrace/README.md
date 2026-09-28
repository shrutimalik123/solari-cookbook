# Retrace

**Autonomous bug reproduction and regression verification**, built on the
architecture in `Solari Autonomous QA Agent Plan of Action.pdf`: reproduce a
bug in a real browser, patch and test it in an isolated microVM, then
re-verify the fix from a fresh browser session before calling it done.

```text
1. REPRODUCE         2. PATCH + VERIFY        3. RE-VERIFY
   Solari Browser  →   Solari Sandbox      →    fresh Solari Browser
   (recording on)      (git apply, tests)       (clean sandbox, no patch history)
```

The bundled bug is a real off-by-one in `fixtures/off-by-one`:
`renderTotal` reads `items[items.length]` — one past the end — instead of
`items[items.length - 1]`, so it throws `TypeError: Cannot read properties of
undefined (reading 'cents')` both as a failing unit test and as an uncaught
error on the page. The pipeline is not staged around this bug — it reproduces
it, generates the real fix as a unified diff, applies it, and proves the fix
with a real test run and a real page load, in both offline and live mode.

## Run the offline demo

No credentials, no network. Applies real `git apply` and runs real
`node --test` against a temp directory — nothing is simulated except the
absence of a browser.

```bash
cd applications/retrace
npm install
npm run demo
```

```text
run      : rt_...
mode     : offline
status   : verified
reproduced: true
patched  : true
cleanup  : ok — offline mode created no remote resources
report   : applications/retrace/artifacts/rt_.../run.json
```

## Run against live Solari

```bash
cd applications/retrace
npm install
cp .env.example .env   # add your SOLARI_API_KEY
npm run live
```

This spins up one Solari Sandbox to host the buggy page, reproduces it with a
recorded Cloud Browser session, applies the patch and runs the test suite
inside that same sandbox, then — only if the patch passed — spins up a
**second**, unpatched-history sandbox seeded with the patched file, and
re-verifies it with a **fresh** browser session. Both sandboxes are destroyed
in a `finally` block regardless of where the run fails; the report's
`cleanup` field records what was actually released.

## Test

```bash
npm test
```

Exercises the fixture, the (non-LLM) patch generator, the local sandbox
runner against both the buggy and patched fixture, and the PR body renderer.

## What this does and doesn't implement

The plan of action describes four phases. This build covers the
reproduce → patch → verify → re-verify loop end to end against real Solari
primitives, and is explicit about what it stops short of:

- **Patch generation is not an LLM.** `src/patch.ts`'s `fixturePatchGenerator`
  always returns the same canned diff for the bundled bug — it ignores the
  reproduction evidence entirely. `PatchGenerator` is the seam a real
  generator plugs into: same signature, same call site, no other code changes.
  This was a deliberate scope choice, not an oversight — see the comment in
  that file.
- **No GitHub PR is opened.** `src/pr.ts`'s `renderPrBody` produces the exact
  markdown — diff, reproduction evidence, verification result — a real
  integration would attach to a PR. `publishPr` writes that markdown to
  `artifacts/<run>/pr-body.md` instead of calling the GitHub API, and this
  application reads no `GITHUB_TOKEN`.
- **No webhook receiver.** A run is triggered by `npm run demo` / `npm run
  live`, not a GitHub issue or Sentry webhook. `src/live.ts` is where a
  webhook handler would call in.
- **The Desktop (X11) primitive is unused.** The plan of action lists it as a
  pillar for GUI validation; this bug and fixture are web-only, so nothing
  here exercises it.

## Corrections to the plan of action

Two claims in the source PDF don't match this cookbook's own documented
behavior, and this build follows the cookbook, not the PDF:

- **The replay is not a video.** The PDF describes a "signed video replay
  URL." Per this repo's README and
  [`browser-session-recording-py`](../../examples/browser-session-recording-py),
  Solari's session replay is rrweb NDJSON — a DOM-level recording — not a
  video file. Nothing here generates or links a video.
- **Replay download has no documented TypeScript accessor.** The Python SDK
  exposes `solari.sessions.download_replay(session_id)`; no TS equivalent is
  documented in this cookbook. `src/live.ts` calls the same-shaped REST
  endpoint directly (as [`browser-login-handoff-ts`](../../examples/browser-login-handoff-ts)
  does for its own undocumented endpoints) and, per this repo's own
  [`browser-page-assertions-py`](../../examples/browser-page-assertions-py),
  treats a persistent 404 after the poll window as unverified rather than as
  a pipeline failure.

## Evidence contract

Every run writes `artifacts/<run-id>/run.json` with:

- the reproduction backend, target, captured console/page errors, and replay
  status;
- the applied patch as a unified diff;
- the sandbox backend, apply result, and test exit code;
- the re-verification result (live mode only) — rendered text and page
  errors from the patched build;
- cleanup evidence: which sandboxes were actually killed.

Screenshots (live mode only) are saved alongside it as `reproduction.jpg` and
`reverify.jpg`. No API key is ever written to the report.

## Operational rules this pipeline follows

Straight from this cookbook's own gotchas, because getting any one of these
wrong either bills idle compute or produces a false pass:

- **`kill()`, not `close()`, ends a sandbox.** `close()` only drops the local
  control channel; `src/live.ts` kills both sandboxes in a `finally` block.
- **Sandbox commands are not shell-interpreted.** Every multi-step command
  here goes through an explicit `sh -c "..."`, never a bare string.
- **Recording upload is asynchronous.** The replay poll waits ~28s
  (8 × 3.5s) before giving up, matching the plan's own ~25–30s guidance.

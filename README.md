# Retrace

**Autonomous bug reproduction and regression verification**, built on the
[Solari Cookbook](https://getsolari.com) — cloud browsers, sandboxes, and
desktops behind one API key. Retrace reproduces a bug in a real browser
session, patches and tests it in an isolated microVM, then re-verifies the
fix from a fresh browser session before calling it done.

```text
1. REPRODUCE           2. PATCH + VERIFY         3. RE-VERIFY
   Solari Browser   →     Solari Sandbox     →      fresh Solari Browser
   (recording: on)        (git apply, tests)        (clean sandbox, no patch history)
```

This was built against a specific design document,
[Solari Autonomous QA Agent Plan of Action.pdf](<Solari Autonomous QA Agent Plan of Action.pdf>) —
a four-phase blueprint combining the cookbook's cloud browser, sandbox, and
desktop primitives into one pipeline. [Retrace - Implementation Report.pdf](<Retrace - Implementation Report.pdf>)
covers what was actually built, why several phases were deliberately scoped
down rather than stubbed silently, and where the implementation corrects
claims in the plan against this cookbook's own documented behavior.

## Why

Bug reproduction is a triage bottleneck because "works on my machine" is not
a falsifiable statement until someone spends 45–90 minutes turning it into
one. The plan's fix was to automate that turn: reproduce the fault in an
isolated cloud browser, hand the evidence to a patch generator, verify the
candidate patch in a disposable microVM, and re-confirm the fix before
anyone opens a pull request. The cookbook already contained every primitive
that architecture calls for — what it lacked was a working implementation
proving the pipeline against a real fault instead of describing it in the
abstract. That's what Retrace closes.

## What it does

The bundled bug is a real off-by-one in `applications/retrace/fixtures/off-by-one`:
a cart-total renderer that reads one index past the end of an array, throwing
`TypeError: Cannot read properties of undefined (reading 'cents')` both as a
failing unit test and as an uncaught page error. Retrace reproduces that
fault, generates the real fix as a unified diff, applies it, and proves the
fix with a real test run inside a sandbox and a real page load from a second,
independently-seeded sandbox — nothing in the loop is simulated.

## Quickstart

```bash
git clone https://github.com/shrutimalik123/solari-cookbook.git
cd solari-cookbook/applications/retrace
npm install
npm run demo                         # offline, no credentials
```

```bash
cp .env.example .env                 # add SOLARI_API_KEY, from console.getsolari.com
npm run live                         # real Solari Browser + Sandbox
```

See [applications/retrace](applications/retrace) for the full README,
[DESIGN.md](applications/retrace/DESIGN.md) for the architecture and trust
boundaries, and `npm test` for the suite that exercises the fixture, the
patch generator, both sandbox outcomes, and the report renderer.

## What it achieved

- The unpatched fixture fails its own test suite and throws on page load; the
  patched fixture passes and renders correctly — both directions asserted by
  the test suite, not assumed.
- The full offline pipeline runs end to end to `status: verified`, writing a
  real evidence file (`run.json`) and a real generated PR body.
- `npx tsc --noEmit` passes with no errors; all 7 tests pass.
- The test suite caught a real bug during the build: Node's test runner sets
  `NODE_TEST_CONTEXT` on its own process, which leaked into a grandchild
  `node --test` spawned by the sandbox runner and silently swallowed its exit
  code. Fixed in `src/proc.ts`. See the implementation report for the detail.

## Where this differs from the plan of action

- **Patch generation is not an LLM.** A deterministic, explicitly-labeled
  stand-in always returns the same canned fix; `PatchGenerator` is the seam a
  real generator plugs into. No LLM key is required to run anything here.
- **No GitHub PR is opened.** The exact markdown a PR would contain is
  rendered and written to disk; no `GITHUB_TOKEN` is read anywhere.
- **No webhook receiver.** A run is triggered by `npm run demo` / `npm run
  live`, not a GitHub issue or Sentry webhook.
- **The replay is not a video.** The plan describes a "signed video replay
  URL"; this cookbook's own docs are explicit that Solari's session replay is
  rrweb NDJSON, a DOM-level recording, not a video file.
- **Two sandboxes, not one.** Re-verification runs from a second, freshly
  seeded sandbox that never inherits the first one's patch history or test
  run — read literally, this is what the plan's "temporary preview container"
  asks for.

Full detail, including the phase-by-phase comparison table, is in
[Retrace - Implementation Report.pdf](<Retrace - Implementation Report.pdf>).

## Built on the Solari Cookbook

Retrace is one application in a larger repo of short, runnable Solari
examples and bigger applications:

- **[examples/](examples)** — one idea per file: launching a browser, running
  code in a sandbox, recording a session, driving a computer-use desktop.
- **[applications/](applications)** — bigger programs, including
  [worldline](applications/worldline), a speculative-execution engine for
  computer-use agents.

One `slr_live_` key ([console.getsolari.com](https://console.getsolari.com))
works across browsers, sandboxes, and desktops, and every product bills to
the same balance.

## Links

- Docs — [docs.getsolari.com](https://docs.getsolari.com)
- Console — [console.getsolari.com](https://console.getsolari.com)
- Changelog — [changelog.getsolari.com](https://changelog.getsolari.com)
- Questions — [hello@getsolari.com](mailto:hello@getsolari.com)

## Contributing

New examples and applications are welcome — see
[applications/README.md](applications/README.md) for what belongs there.
Keep additions small or complete, make them run end-to-end against the real
API, and put anything surprising in a comment right where it bites.

MIT licensed.

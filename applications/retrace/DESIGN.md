# Retrace design

## Pipeline

```text
seed sandbox A (buggy files) --serve--> recorded browser session --> reproduction evidence
        |
        v
apply patch in sandbox A --> run tests in sandbox A --> sandbox verification evidence
        |                                   (only if verification passed)
        v
read back patched file --> seed sandbox B --serve--> fresh browser session --> re-verification evidence
        |
        v
kill sandbox B, kill sandbox A, close browser client   (finally, unconditional)
```

Two sandboxes exist because the plan of action's Step 3 asks for re-verification
against "a temporary preview container" — a build with no memory of the
patching that produced it, not a continuation of the VM that ran `git apply`.
Sandbox A's file state after a passing test run is trusted only as far as
reading back the one file the patch touched; sandbox B is seeded fresh from
that content plus the original fixture files, so re-verification never
inherits sandbox A's `.git` history, patch file, or test run artifacts.

## Trust boundaries

The patch generator controls only the diff text. It does not control:

- what reproduction actually observed (it receives that as input, and the
  bundled generator ignores it — see README);
- whether the diff is judged to have applied (`git apply`'s own exit code);
- whether the tests are judged to have passed (`node --test`'s own exit code
  inside the sandbox, not a self-report from inside the patched code);
- whether the re-verification page load is judged clean (a fresh, independent
  browser session's `pageerror` events and rendered text, not anything the
  patched code reports about itself).

A patch that fails `git apply` or fails the test suite short-circuits the
pipeline before re-verification runs at all; `status` becomes `patch-failed`,
not `verified`.

## Why the demo mode isn't simulated

The offline path (`src/reproduce.local.ts`, `src/sandbox.local.ts`) has no
Solari credentials, but it does not fake results the way a pure fixture
double would. It `require()`s the actual bundled `format.js` and lets it
actually throw; it applies the actual patch with a real `git apply` in a real
temp directory and runs the actual test suite with real `node --test`. The
only thing offline mode doesn't have is a browser — there is no DOM, no
recording, and no re-verification step, and the report says so rather than
inventing one.

## Known platform quirk worth keeping on record

Node's test runner sets `NODE_TEST_CONTEXT` on its own process. Because
`sandbox.local.ts` spawns a **grandchild** `node --test` (to run the fixture's
suite) from inside this application's **own** `node --test` run, that env var
inherits by default and the grandchild silently reports success regardless of
its real exit code — it assumes it's a worker of the outer run and tries to
report over an IPC channel that isn't there. `src/proc.ts` strips
`NODE_TEST_CONTEXT` from every spawned command's environment for exactly this
reason. Anyone extending this pipeline to shell out to other test runners from
inside this test suite should check for the same class of leak.

## Non-goals

- The bundled patch generator is not a claim that pattern-matching one canned
  diff constitutes an LLM-driven fix synthesizer. See README.
- SHA-256 isn't used here for artifact integrity the way Worldline uses it;
  the verification story is exit codes and a fresh page load, which is the
  right granularity for a single-file JS fix rather than a multi-file ledger.
- This is not a claim that the GitHub PR flow, webhook ingestion, or Desktop
  surface from the plan of action are implemented. See README.

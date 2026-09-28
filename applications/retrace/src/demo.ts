import { loadFixture } from "./fixture.js"
import { fixturePatchGenerator } from "./patch.js"
import { reproduceLocally } from "./reproduce.local.js"
import { verifyPatchLocally } from "./sandbox.local.js"
import type { ReverifyResult, RunReport } from "./types.js"

/** Runs the whole pipeline offline: no Solari credentials, no network calls. */
export async function runDemo(runId: string, createdAt: string): Promise<RunReport> {
  const fixture = loadFixture()

  const reproduction = await reproduceLocally()
  const generatePatch = fixturePatchGenerator(fixture.patchDiff)
  const patch = await generatePatch(reproduction)
  const sandbox = await verifyPatchLocally(fixture, reproduction.reproduced ? patch : null)

  const reverify: ReverifyResult = {
    attempted: false,
    passed: false,
    targetUrl: null,
    consoleErrors: [],
    pageErrors: [],
    renderedText: null,
    screenshot: null,
    note: "Offline mode has no live preview to re-verify against. Run `npm run live` for the browser-backed re-verification step.",
  }

  const status: RunReport["status"] = !reproduction.reproduced
    ? "reproduction-failed"
    : sandbox.passed
      ? "verified"
      : "patch-failed"

  return {
    schemaVersion: "1.0",
    runId,
    mode: "offline",
    createdAt,
    reproduction,
    patch,
    sandbox,
    reverify,
    cleanup: {
      attempted: true,
      succeeded: true,
      detail: "offline mode created no remote resources",
      resourcesReleased: [],
    },
    status,
    error: null,
  }
}

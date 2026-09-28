/**
 * Offline stand-in for Phase 2 (Reproducer Engine) that needs no Solari
 * credentials: it requires the fixture's own JS and calls the buggy function
 * directly, capturing the real thrown error. This is not a browser session —
 * there is no DOM, no console, no recording — but the fault is the same one a
 * Solari Cloud Browser session would observe as an uncaught page error. See
 * live.ts for the credentialed version that actually loads the page in a
 * browser and records the session.
 */
import { createRequire } from "node:module"
import path from "node:path"
import { FIXTURE_ROOT } from "./fixture.js"
import type { ReproductionResult } from "./types.js"

const require = createRequire(import.meta.url)

export async function reproduceLocally(): Promise<ReproductionResult> {
  const modulePath = path.join(FIXTURE_ROOT, "src", "format.js")
  delete require.cache[require.resolve(modulePath)]
  const { renderTotal } = require(modulePath) as {
    renderTotal: (items: { cents: number }[]) => string
  }

  const pageErrors: string[] = []
  let reproduced = false
  try {
    renderTotal([{ cents: 500 }, { cents: 1999 }])
  } catch (err) {
    reproduced = true
    pageErrors.push(err instanceof Error ? `${err.name}: ${err.message}` : String(err))
  }

  return {
    backend: "offline-node",
    targetUrl: `file://${path.join(FIXTURE_ROOT, "public", "index.html").replace(/\\/g, "/")}`,
    sessionId: "offline",
    reproduced,
    consoleErrors: [],
    pageErrors,
    screenshot: null,
    replay: {
      requested: false,
      available: false,
      note: "Offline mode runs the fixture's JS directly with no browser session, so there is nothing to record or replay. Run `npm run live` for a real Solari Browser session and recording.",
    },
  }
}

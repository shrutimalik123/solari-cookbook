/**
 * Live pipeline: reproduce the bug in a real Solari Cloud Browser session,
 * patch and test it in a real Solari Sandbox, then re-verify the patched build
 * from a second sandbox with a fresh browser session. Two sandboxes exist
 * concurrently for at most the re-verification window; both are killed in the
 * `finally` block regardless of where the pipeline fails.
 *
 * Two operational rules from the cookbook are load-bearing here, not optional:
 *   1. `kill()`, never just `close()` — `close()` only drops the local control
 *      channel and leaves the VM billing until its idle timeout.
 *   2. Commands are not shell-interpreted — argv goes in `args`, or an explicit
 *      `sh -c` for anything with redirection or backgrounding.
 */
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { Solari } from "@solarisdk/browser"
import { SolariClient } from "@solarisdk/sdk"
import { requireEnv } from "./env.js"
import { loadFixture } from "./fixture.js"
import { fixturePatchGenerator } from "./patch.js"
import { ensureRunArtifactsDir } from "./report.js"
import type {
  CleanupEvidence,
  PatchCandidate,
  ReproductionResult,
  ReverifyResult,
  RunReport,
  SandboxRunResult,
} from "./types.js"

const PORT = 8080
// The plan of action calls for a ~25-30s polling backoff before asserting
// replay availability, since the recording upload finalizes asynchronously
// after the session closes. examples/browser-page-assertions-py in this same
// cookbook records that replay endpoints have 404'd even after that full
// window on a live account, so this polls for it but never fails the pipeline
// on a miss.
const REPLAY_POLL_ATTEMPTS = 8
const REPLAY_POLL_INTERVAL_MS = 3500

type Sandbox = Awaited<ReturnType<SolariClient["sandboxes"]["create"]>>
type Page = Awaited<ReturnType<Awaited<ReturnType<Solari["launch"]>>["newPage"]>>

async function sh(sandbox: Sandbox, script: string) {
  return sandbox.commands.run("sh", { args: ["-c", script] })
}

/** previewUrl carries a `?pt_token=` query; build paths through URL, not string concatenation. */
function at(baseUrl: string, pathname: string): string {
  const u = new URL(baseUrl)
  u.pathname = pathname
  return u.toString()
}

async function waitForServer(url: string, attempts = 20): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // preview routing not up yet
    }
  }
  throw new Error(`server never came up at ${url}`)
}

async function seedFixture(sandbox: Sandbox, files: { relPath: string; contents: string }[]) {
  for (const file of files) {
    await sandbox.files.write(`/repo/${file.relPath}`, file.contents)
  }
  await sh(
    sandbox,
    "cd /repo && git init -q && git config user.email retrace@example.com && git config user.name retrace && git add -A && git commit -q -m seed",
  )
}

async function serveRepo(sandbox: Sandbox): Promise<string> {
  await sh(sandbox, `cd /repo && nohup python3 -m http.server ${PORT} >/dev/null 2>&1 &`)
  const { url } = await sandbox.previewUrl(PORT)
  await waitForServer(at(url, "/public/index.html"))
  return url
}

/** Best-effort: the TS SDK has no documented replay accessor yet (see README). */
async function pollReplay(apiKey: string, sessionId: string): Promise<{ available: boolean; note: string }> {
  const API = "https://api.getsolari.com"
  for (let attempt = 1; attempt <= REPLAY_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, REPLAY_POLL_INTERVAL_MS))
    try {
      const res = await fetch(`${API}/sessions/${encodeURIComponent(sessionId)}/replay`, {
        headers: { authorization: `Bearer ${apiKey}` },
      })
      if (res.ok) return { available: true, note: `replay ready after ~${(attempt * REPLAY_POLL_INTERVAL_MS) / 1000}s` }
    } catch {
      // transient — keep polling
    }
  }
  const waited = (REPLAY_POLL_ATTEMPTS * REPLAY_POLL_INTERVAL_MS) / 1000
  return {
    available: false,
    note: `no replay after ~${waited}s. This cookbook has observed replay endpoints 404 even after this window on a live account (see examples/browser-page-assertions-py) — treat this as unverified, not as a pipeline failure.`,
  }
}

async function saveScreenshot(page: Page, artifactsDir: string, name: string): Promise<string | null> {
  try {
    const buffer = (await page.screenshot({ type: "jpeg", quality: 60 })) as Buffer
    const file = `${name}.jpg`
    await writeFile(path.join(artifactsDir, file), buffer)
    return file
  } catch {
    return null
  }
}

interface Watchers {
  pageErrors: string[]
  consoleErrors: string[]
}

function attachWatchers(page: Page): Watchers {
  const watchers: Watchers = { pageErrors: [], consoleErrors: [] }
  page.on("pageerror", (err: Error) => watchers.pageErrors.push(`${err.name}: ${err.message}`))
  page.on("console", (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === "error") watchers.consoleErrors.push(msg.text())
  })
  return watchers
}

export async function runLive(runId: string, createdAt: string): Promise<RunReport> {
  const apiKey = requireEnv("SOLARI_API_KEY")
  const fixture = loadFixture()
  const artifactsDir = await ensureRunArtifactsDir(runId)

  const solari = new Solari({ apiKey })
  const client = new SolariClient({ apiKey })

  const resourcesReleased: string[] = []
  const cleanupErrors: string[] = []

  let reproduction: ReproductionResult | null = null
  let patch: PatchCandidate | null = null
  let sandboxResult: SandboxRunResult | null = null
  let reverify: ReverifyResult = {
    attempted: false,
    passed: false,
    targetUrl: null,
    consoleErrors: [],
    pageErrors: [],
    renderedText: null,
    screenshot: null,
    note: "not attempted",
  }
  let errorMessage: string | null = null

  let verifySandbox: Sandbox | null = null
  let previewSandbox: Sandbox | null = null

  try {
    // --- Step 1: reproduce in a recorded Cloud Browser session -------------
    verifySandbox = await client.sandboxes.create({
      template: "base",
      timeoutMs: 5 * 60_000,
      lifecycle: { onTimeout: "kill" },
    })
    await verifySandbox.connect()
    await seedFixture(verifySandbox, fixture.files)
    const buggyUrl = at(await serveRepo(verifySandbox), "/public/index.html")

    const reproBrowser = await solari.launch({ stealth: true, recording: true })
    const reproSessionId = reproBrowser.id
    let watchers: Watchers = { pageErrors: [], consoleErrors: [] }
    let screenshot: string | null = null
    try {
      const page = await reproBrowser.newPage()
      watchers = attachWatchers(page)
      await page.goto(buggyUrl, { waitUntil: "networkidle", timeout: 20_000 })
      await page.waitForTimeout(1000)
      screenshot = await saveScreenshot(page, artifactsDir, "reproduction")
    } finally {
      await reproBrowser.close().catch(() => undefined)
    }

    const replay = await pollReplay(apiKey, reproSessionId)
    reproduction = {
      backend: "solari-browser",
      targetUrl: buggyUrl,
      sessionId: reproSessionId,
      reproduced: watchers.pageErrors.length > 0,
      consoleErrors: watchers.consoleErrors,
      pageErrors: watchers.pageErrors,
      screenshot,
      replay: { requested: true, available: replay.available, note: replay.note },
    }

    // --- Step 2: patch + verify in the sandbox ------------------------------
    const generatePatch = fixturePatchGenerator(fixture.patchDiff)
    patch = await generatePatch(reproduction)

    await verifySandbox.files.write("/repo/.retrace-patch.diff", patch.diff)
    const applyResult = await sh(verifySandbox, "cd /repo && git apply .retrace-patch.diff")
    const applied = applyResult.exitCode === 0
    const testResult = applied
      ? await sh(verifySandbox, "cd /repo && node --test")
      : { exitCode: null as number | null, stdout: "", stderr: "" }

    sandboxResult = {
      backend: "solari-sandbox",
      sandboxId: verifySandbox.sandboxId,
      applied,
      applyError: applied ? null : (applyResult.stderr || applyResult.stdout).trim(),
      testExitCode: testResult.exitCode,
      testStdout: testResult.stdout,
      testStderr: testResult.stderr,
      passed: applied && testResult.exitCode === 0,
    }

    // --- Step 3: re-verify the patched build from a fresh sandbox + browser -
    if (sandboxResult.passed) {
      const patchedFormatJs = await verifySandbox.files.readText("/repo/src/format.js")
      previewSandbox = await client.sandboxes.create({
        template: "base",
        timeoutMs: 5 * 60_000,
        lifecycle: { onTimeout: "kill" },
      })
      await previewSandbox.connect()
      await seedFixture(
        previewSandbox,
        fixture.files.map((f) => (f.relPath === "src/format.js" ? { ...f, contents: patchedFormatJs } : f)),
      )
      const patchedUrl = at(await serveRepo(previewSandbox), "/public/index.html")

      const reverifyBrowser = await solari.launch()
      let rvWatchers: Watchers = { pageErrors: [], consoleErrors: [] }
      let renderedText: string | null = null
      let rvScreenshot: string | null = null
      try {
        const page = await reverifyBrowser.newPage()
        rvWatchers = attachWatchers(page)
        await page.goto(patchedUrl, { waitUntil: "networkidle", timeout: 20_000 })
        renderedText = ((await page.locator("#total").innerText()) as string).trim()
        rvScreenshot = await saveScreenshot(page, artifactsDir, "reverify")
      } finally {
        await reverifyBrowser.close().catch(() => undefined)
      }

      const passed = rvWatchers.pageErrors.length === 0 && renderedText === "$19.99"
      reverify = {
        attempted: true,
        passed,
        targetUrl: patchedUrl,
        consoleErrors: rvWatchers.consoleErrors,
        pageErrors: rvWatchers.pageErrors,
        renderedText,
        screenshot: rvScreenshot,
        note: passed
          ? "patched page rendered the expected total with no page errors"
          : "patched page did not match the expected clean result",
      }
    } else {
      reverify.note = "skipped: sandbox verification did not pass"
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err)
  } finally {
    if (previewSandbox) {
      try {
        await previewSandbox.kill()
        resourcesReleased.push(`sandbox:${previewSandbox.sandboxId}`)
      } catch (err) {
        cleanupErrors.push(err instanceof Error ? err.message : String(err))
      }
    }
    if (verifySandbox) {
      try {
        await verifySandbox.kill()
        resourcesReleased.push(`sandbox:${verifySandbox.sandboxId}`)
      } catch (err) {
        cleanupErrors.push(err instanceof Error ? err.message : String(err))
      }
    }
    await solari.close().catch(() => undefined)
  }

  const status: RunReport["status"] = errorMessage
    ? "error"
    : !reproduction?.reproduced
      ? "reproduction-failed"
      : !sandboxResult?.passed
        ? "patch-failed"
        : reverify.attempted && !reverify.passed
          ? "patch-failed"
          : "verified"

  const cleanup: CleanupEvidence = {
    attempted: true,
    succeeded: cleanupErrors.length === 0,
    detail: cleanupErrors.length === 0 ? "ok" : cleanupErrors.join("; "),
    resourcesReleased,
  }

  return {
    schemaVersion: "1.0",
    runId,
    mode: "live",
    createdAt,
    reproduction: reproduction ?? {
      backend: "solari-browser",
      targetUrl: "",
      sessionId: "",
      reproduced: false,
      consoleErrors: [],
      pageErrors: [],
      screenshot: null,
      replay: { requested: false, available: false, note: "run did not reach the reproduction step" },
    },
    patch: patch ?? { id: "none", description: "not generated", targetFile: "", diff: "" },
    sandbox: sandboxResult ?? {
      backend: "solari-sandbox",
      sandboxId: "",
      applied: false,
      applyError: null,
      testExitCode: null,
      testStdout: "",
      testStderr: "",
      passed: false,
    },
    reverify,
    cleanup,
    status,
    error: errorMessage,
  }
}

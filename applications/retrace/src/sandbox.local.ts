/**
 * Offline stand-in for Phase 3 (VM Sandbox Runner) that needs no Solari
 * credentials: seeds the fixture into a real temp directory, applies the patch
 * with real `git apply`, and runs the real test suite with real `node --test`.
 * Nothing here is simulated — it just runs on this machine instead of inside a
 * Solari microVM. See sandbox.live.ts for the credentialed version that runs
 * the same steps inside an actual sandbox.
 */
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Fixture } from "./fixture.js"
import type { PatchCandidate, SandboxRunResult } from "./types.js"
import { run } from "./proc.js"

export async function verifyPatchLocally(fixture: Fixture, patch: PatchCandidate | null): Promise<SandboxRunResult> {
  const dir = await mkdtemp(path.join(tmpdir(), "retrace-local-"))
  try {
    for (const file of fixture.files) {
      const dest = path.join(dir, file.relPath)
      await mkdir(path.dirname(dest), { recursive: true })
      await writeFile(dest, file.contents, "utf8")
    }

    await run("git", ["init", "-q"], { cwd: dir })
    await run("git", ["config", "user.email", "retrace@example.com"], { cwd: dir })
    await run("git", ["config", "user.name", "retrace"], { cwd: dir })
    await run("git", ["add", "-A"], { cwd: dir })
    await run("git", ["commit", "-q", "-m", "seed"], { cwd: dir })

    let applied = false
    let applyError: string | null = null
    if (patch) {
      const diffPath = path.join(dir, ".retrace-patch.diff")
      await writeFile(diffPath, patch.diff, "utf8")
      const applyResult = await run("git", ["apply", diffPath], { cwd: dir })
      applied = applyResult.exitCode === 0
      applyError = applied ? null : applyResult.stderr.trim() || applyResult.stdout.trim()
    }

    // `node --test` with no path argument auto-discovers `**/*.test.js`, which
    // is more reliable across platforms than passing a directory (a bare
    // directory argument has been observed not to trigger discovery here).
    const testResult = await run("node", ["--test"], { cwd: dir })

    return {
      backend: "local-node",
      sandboxId: `local:${path.basename(dir)}`,
      applied: patch ? applied : true,
      applyError,
      testExitCode: testResult.exitCode,
      testStdout: testResult.stdout,
      testStderr: testResult.stderr,
      passed: (patch ? applied : true) && testResult.exitCode === 0,
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

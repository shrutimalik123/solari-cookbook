export interface ReproductionResult {
  backend: "offline-node" | "solari-browser"
  targetUrl: string
  sessionId: string
  reproduced: boolean
  consoleErrors: string[]
  pageErrors: string[]
  screenshot: string | null
  replay: { requested: boolean; available: boolean; note: string }
}

export interface PatchCandidate {
  id: string
  description: string
  targetFile: string
  diff: string
}

export interface SandboxRunResult {
  backend: "local-node" | "solari-sandbox"
  sandboxId: string
  applied: boolean
  applyError: string | null
  testExitCode: number | null
  testStdout: string
  testStderr: string
  passed: boolean
}

export interface ReverifyResult {
  attempted: boolean
  passed: boolean
  targetUrl: string | null
  consoleErrors: string[]
  pageErrors: string[]
  renderedText: string | null
  screenshot: string | null
  note: string
}

export interface CleanupEvidence {
  attempted: boolean
  succeeded: boolean
  detail: string
  resourcesReleased: string[]
}

export type RunStatus = "verified" | "patch-failed" | "reproduction-failed" | "error"

export interface RunReport {
  schemaVersion: "1.0"
  runId: string
  mode: "offline" | "live"
  createdAt: string
  reproduction: ReproductionResult
  patch: PatchCandidate
  sandbox: SandboxRunResult
  reverify: ReverifyResult
  cleanup: CleanupEvidence
  status: RunStatus
  error: string | null
}

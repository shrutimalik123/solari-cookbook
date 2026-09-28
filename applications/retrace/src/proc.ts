import { execFile } from "node:child_process"

export interface ProcResult {
  exitCode: number | null
  stdout: string
  stderr: string
}

// This module's own test suite runs under `node --test`, which sets
// NODE_TEST_CONTEXT on itself. That var inherits into any child process
// spawned below by default env inheritance — and a *grandchild* `node --test`
// (sandbox.local.ts runs one) reads it, assumes it's a worker of the outer
// test run, and reports over an IPC channel that doesn't exist instead of
// exiting with its real status. Strip it so a spawned command always behaves
// like a normal, undirected process.
const CHILD_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== "NODE_TEST_CONTEXT"))

/** Runs a command and resolves even on a nonzero exit — callers decide what a failure means. */
export function run(command: string, args: string[], options: { cwd: string }): Promise<ProcResult> {
  return new Promise((resolve) => {
    execFile(command, args, { cwd: options.cwd, env: CHILD_ENV }, (error, stdout, stderr) => {
      // execFile sets error.code to the exit code (a number) when the child
      // ran and exited nonzero, but to a string (e.g. "ENOENT") when it never
      // started — ErrnoException types `code` as `string`, so read it loosely.
      const code = (error as unknown as { code?: unknown } | null)?.code
      const exitCode = !error ? 0 : typeof code === "number" ? code : 1
      resolve({ exitCode, stdout, stderr })
    })
  })
}

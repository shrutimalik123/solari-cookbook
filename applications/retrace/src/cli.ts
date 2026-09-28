#!/usr/bin/env node
import { runDemo } from "./demo.js"
import { runLive } from "./live.js"
import { writeReport } from "./report.js"
import type { RunReport } from "./types.js"

function newRunId(): string {
  return `rt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function printSummary(report: RunReport, reportPath: string): void {
  console.log(`run      : ${report.runId}`)
  console.log(`mode     : ${report.mode}`)
  console.log(`status   : ${report.status}`)
  console.log(`reproduced: ${report.reproduction.reproduced}`)
  console.log(`patched  : ${report.sandbox.passed}`)
  if (report.mode === "live") console.log(`re-verified: ${report.reverify.attempted ? report.reverify.passed : "n/a"}`)
  console.log(`cleanup  : ${report.cleanup.succeeded ? "ok" : "failed"} — ${report.cleanup.detail}`)
  if (report.error) console.log(`error    : ${report.error}`)
  console.log(`report   : ${reportPath}`)
}

async function main(): Promise<void> {
  const command = process.argv[2]
  const runId = newRunId()
  const createdAt = new Date().toISOString()

  if (command === "demo") {
    const report = await runDemo(runId, createdAt)
    const { reportPath } = await writeReport(report)
    printSummary(report, reportPath)
    process.exitCode = report.status === "verified" ? 0 : 1
    return
  }

  if (command === "live") {
    const report = await runLive(runId, createdAt)
    const { reportPath } = await writeReport(report)
    printSummary(report, reportPath)
    process.exitCode = report.status === "verified" && report.cleanup.succeeded ? 0 : 1
    return
  }

  console.error("usage: retrace <demo|live>")
  console.error("  demo  run the offline pipeline against the bundled fixture bug, no credentials")
  console.error("  live  run against real Solari Browser + Sandbox (needs SOLARI_API_KEY)")
  process.exitCode = 2
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err))
  process.exitCode = 1
})

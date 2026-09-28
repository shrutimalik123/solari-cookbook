import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { RunReport } from "./types.js"
import { publishPr } from "./pr.js"

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const ARTIFACTS_ROOT = path.resolve(HERE, "..", "artifacts")

export function runArtifactsDir(runId: string): string {
  return path.join(ARTIFACTS_ROOT, runId)
}

export async function ensureRunArtifactsDir(runId: string): Promise<string> {
  const dir = runArtifactsDir(runId)
  await mkdir(dir, { recursive: true })
  return dir
}

export async function writeReport(report: RunReport): Promise<{ dir: string; reportPath: string; prBodyPath: string }> {
  const dir = await ensureRunArtifactsDir(report.runId)
  const reportPath = path.join(dir, "run.json")
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8")
  const { bodyPath } = await publishPr(report, dir)
  return { dir, reportPath, prBodyPath: bodyPath }
}

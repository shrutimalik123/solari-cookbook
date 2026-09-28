import type { PatchCandidate, ReproductionResult } from "./types.js"

/**
 * Phase 2/4 of the plan of action calls for an LLM that reads the stack trace
 * and DOM errors from reproduction and synthesizes a candidate diff. That call
 * is not wired up here — this repo ships no LLM key requirement, by design (see
 * README). `PatchGenerator` is the seam it would plug into: swap
 * `fixturePatchGenerator` for one that sends `reproduction` to a model and
 * returns its diff, and nothing else in the pipeline changes.
 */
export type PatchGenerator = (reproduction: ReproductionResult) => Promise<PatchCandidate>

/**
 * NOT an LLM. This is a deterministic stand-in that always returns the same
 * canned fix for the bundled off-by-one fixture, so the sandbox-verification
 * and reporting stages have a real diff to apply without requiring model
 * credentials. It ignores `reproduction` entirely — a real generator would not.
 */
export function fixturePatchGenerator(patchDiff: string): PatchGenerator {
  return async (_reproduction: ReproductionResult): Promise<PatchCandidate> => ({
    id: "off-by-one-fix",
    description: "Read items[items.length - 1] instead of items[items.length].",
    targetFile: "src/format.js",
    diff: patchDiff,
  })
}

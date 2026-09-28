import test from "node:test"
import assert from "node:assert/strict"
import { fixturePatchGenerator } from "../src/patch.js"
import type { ReproductionResult } from "../src/types.js"

const DUMMY_REPRODUCTION: ReproductionResult = {
  backend: "offline-node",
  targetUrl: "irrelevant",
  sessionId: "irrelevant",
  reproduced: true,
  consoleErrors: [],
  pageErrors: ["irrelevant"],
  screenshot: null,
  replay: { requested: false, available: false, note: "" },
}

test("fixturePatchGenerator ignores its input and always returns the canned fix", async () => {
  const generate = fixturePatchGenerator("--- a\n+++ b\n")
  const patch = await generate(DUMMY_REPRODUCTION)
  assert.strictEqual(patch.targetFile, "src/format.js")
  assert.strictEqual(patch.diff, "--- a\n+++ b\n")
})

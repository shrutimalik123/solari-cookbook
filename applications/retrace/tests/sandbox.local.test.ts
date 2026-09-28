import test from "node:test"
import assert from "node:assert/strict"
import { loadFixture } from "../src/fixture.js"
import { fixturePatchGenerator } from "../src/patch.js"
import { verifyPatchLocally } from "../src/sandbox.local.js"

// These spawn real `git` and `node` child processes against a temp directory —
// slower than a pure unit test, but the point of this module is that nothing
// in it is simulated.

test("verifyPatchLocally: unpatched fixture fails its own test suite", async () => {
  const fixture = loadFixture()
  const result = await verifyPatchLocally(fixture, null)
  assert.strictEqual(result.applied, true) // no patch requested, nothing to apply
  assert.notStrictEqual(result.testExitCode, 0)
  assert.strictEqual(result.passed, false)
})

test("verifyPatchLocally: patched fixture passes", async () => {
  const fixture = loadFixture()
  const patch = await fixturePatchGenerator(fixture.patchDiff)({
    backend: "offline-node",
    targetUrl: "",
    sessionId: "",
    reproduced: true,
    consoleErrors: [],
    pageErrors: [],
    screenshot: null,
    replay: { requested: false, available: false, note: "" },
  })
  const result = await verifyPatchLocally(fixture, patch)
  assert.strictEqual(result.applied, true)
  assert.strictEqual(result.testExitCode, 0)
  assert.strictEqual(result.passed, true)
})

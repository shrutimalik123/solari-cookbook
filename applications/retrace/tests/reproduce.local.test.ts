import test from "node:test"
import assert from "node:assert/strict"
import { reproduceLocally } from "../src/reproduce.local.js"

test("reproduceLocally really throws on the bundled bug, not a canned result", async () => {
  const result = await reproduceLocally()
  assert.strictEqual(result.reproduced, true)
  assert.strictEqual(result.pageErrors.length, 1)
  assert.match(result.pageErrors[0]!, /TypeError/)
  assert.strictEqual(result.replay.available, false)
})

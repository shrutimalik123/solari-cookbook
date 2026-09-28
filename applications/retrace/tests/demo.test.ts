import test from "node:test"
import assert from "node:assert/strict"
import { runDemo } from "../src/demo.js"

test("runDemo: end to end against the bundled fixture, no credentials", async () => {
  const report = await runDemo("rt_test", "2026-01-01T00:00:00.000Z")
  assert.strictEqual(report.mode, "offline")
  assert.strictEqual(report.reproduction.reproduced, true)
  assert.strictEqual(report.sandbox.passed, true)
  assert.strictEqual(report.status, "verified")
  assert.strictEqual(report.cleanup.succeeded, true)
  assert.strictEqual(report.reverify.attempted, false)
})

import test from "node:test"
import assert from "node:assert/strict"
import { renderPrBody } from "../src/pr.js"
import { runDemo } from "../src/demo.js"

test("renderPrBody includes the diff and the verification result", async () => {
  const report = await runDemo("rt_test", "2026-01-01T00:00:00.000Z")
  const body = renderPrBody(report)
  assert.match(body, /```diff/)
  assert.match(body, /items\[items\.length - 1\]/)
  assert.match(body, /Passed: yes/)
  assert.match(body, /Not opened automatically/)
})

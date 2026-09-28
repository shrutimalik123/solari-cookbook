import test from "node:test"
import assert from "node:assert/strict"
import { loadFixture } from "../src/fixture.js"

test("loadFixture reads the off-by-one bug, its test, its page, and its fix", () => {
  const fixture = loadFixture()
  const paths = fixture.files.map((f) => f.relPath).sort()
  assert.deepStrictEqual(paths, ["public/index.html", "src/format.js", "test/format.test.js"])

  const format = fixture.files.find((f) => f.relPath === "src/format.js")
  assert.ok(format?.contents.includes("items[items.length]"), "fixture should still contain the bug")

  assert.ok(fixture.patchDiff.includes("-  const last = items[items.length]"))
  assert.ok(fixture.patchDiff.includes("+  const last = items[items.length - 1]"))
})

const test = require("node:test")
const assert = require("node:assert/strict")
const { renderTotal } = require("../src/format")

test("renderTotal renders the last item's total", () => {
  const items = [{ cents: 500 }, { cents: 1999 }]
  assert.strictEqual(renderTotal(items), "$19.99")
})

// The bug: `renderTotal` reads one index past the last item instead of the
// last item itself, so it always resolves to `undefined` and throws when
// something reads `.cents` off it. Off-by-one in the classic form.
function formatCurrency(cents) {
  const dollars = cents / 100
  return `$${dollars.toFixed(2)}`
}

function renderTotal(items) {
  const last = items[items.length] // bug: should be items.length - 1
  return formatCurrency(last.cents)
}

// Plain functions with a CommonJS export tacked on at the end: usable as a
// browser <script src> global (for the reproduction page) and as a Node
// require() (for the test suite) from the same file, no bundler involved.
if (typeof module !== "undefined") {
  module.exports = { formatCurrency, renderTotal }
}

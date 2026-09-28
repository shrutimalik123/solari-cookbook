/**
 * The bundled bug: `renderTotal` in fixtures/off-by-one/src/format.js reads one
 * index past the last item in a list, so it throws `TypeError: Cannot read
 * properties of undefined (reading 'cents')`. It fails a unit test and, loaded
 * on a page, throws as an uncaught page error — the same fault shape a real
 * GitHub issue would describe, just self-contained so this app runs without a
 * target repo.
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const FIXTURE_ROOT = path.resolve(HERE, "..", "fixtures", "off-by-one")

export interface FixtureFile {
  /** Path relative to the repo root the sandbox/temp dir seeds. */
  relPath: string
  contents: string
}

export interface Fixture {
  files: FixtureFile[]
  patchDiff: string
  entryHtml: string
  testGlob: string
}

export function loadFixture(): Fixture {
  const read = (rel: string) => readFileSync(path.join(FIXTURE_ROOT, rel), "utf8")
  return {
    files: [
      { relPath: "src/format.js", contents: read("src/format.js") },
      { relPath: "test/format.test.js", contents: read("test/format.test.js") },
      { relPath: "public/index.html", contents: read("public/index.html") },
    ],
    patchDiff: read("patch/fix.diff"),
    entryHtml: "public/index.html",
    testGlob: "test/format.test.js",
  }
}

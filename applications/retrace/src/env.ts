// Read through a function so the return type is `string`, not `string | undefined`.
// A bare `if (!apiKey) throw` at module scope only narrows that module's local
// binding — it does not survive being imported elsewhere.
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

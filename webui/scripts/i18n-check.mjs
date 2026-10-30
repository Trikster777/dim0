/**
 * Locale parity check for `src/locales/*.json`.
 *
 * Rules:
 * - an English key missing from Russian      → error (exit 1)
 * - an empty Russian value                   → error (exit 1)
 * - a Russian key English doesn't have       → warning (exit 0), error with `--strict`
 *
 * Deliberately dependency-free: it must run before/without a working
 * `node_modules` and inside CI as a plain `node` invocation.
 */
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"


const LOCALES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src", "locales")
const BASE_LANG = "en"
const TARGET_LANG = "ru"


/**
 * Flatten a nested locale into `area.component.meaning` → value pairs.
 */
function flatten(value, prefix, out) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix === "" ? key : `${prefix}.${key}`
    const isPlainObject = child !== null && typeof child === "object" && !Array.isArray(child)
    if (isPlainObject) flatten(child, path, out)
    else out.set(path, child)
  }
  return out
}


/**
 * Read one locale file and return its flattened key map.
 */
function readLocale(lang) {
  const file = resolve(LOCALES_DIR, `${lang}.json`)
  const parsed = JSON.parse(readFileSync(file, "utf8"))
  return flatten(parsed, "", new Map())
}


/**
 * Print a list of keys under a single header.
 */
function report(title, keys, log) {
  if (keys.length === 0) return
  log(`${title} (${keys.length}):`)
  for (const key of keys) log(`  - ${key}`)
}


/**
 * Compare the two locales and exit with a status CI can branch on.
 */
function main() {
  const strict = process.argv.includes("--strict")
  const base = readLocale(BASE_LANG)
  const target = readLocale(TARGET_LANG)

  const missing = [...base.keys()].filter((key) => !target.has(key))
  const empty = [...target.entries()]
    .filter(([, value]) => typeof value !== "string" || value.trim() === "")
    .map(([key]) => key)
  const extra = [...target.keys()].filter((key) => !base.has(key))

  console.log(`i18n-check: ${BASE_LANG}=${base.size} keys, ${TARGET_LANG}=${target.size} keys`)
  report(`missing in ${TARGET_LANG}`, missing, console.error)
  report(`empty in ${TARGET_LANG}`, empty, console.error)
  report(
    strict ? `unexpected in ${TARGET_LANG}` : `warning: ${TARGET_LANG}-only keys`,
    extra,
    strict ? console.error : console.warn,
  )

  const failed = missing.length > 0 || empty.length > 0 || (strict && extra.length > 0)
  if (failed) {
    console.error(
      `i18n-check: FAILED — ${missing.length} missing, ${empty.length} empty, ${extra.length} extra`,
    )
    process.exit(1)
  }
  console.log("i18n-check: OK")
}


try {
  main()
} catch (error) {
  console.error(`i18n-check: could not read the locales — ${error.message}`)
  process.exit(1)
}

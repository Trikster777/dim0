/**
 * Vitest global setup. Patches `globalThis.indexedDB` (+ IDBKeyRange, etc.) with
 * the in-memory `fake-indexeddb` implementation so persistence code runs in
 * Node/jsdom without a browser. Tests reset state with a fresh `IDBFactory`.
 */
import "fake-indexeddb/auto"

// The UI is translated. Every assertion in this suite is written against the
// English strings, so the language is pinned here — before any app module (and
// therefore `src/i18n`) is imported. `I18N_FORCE_LANG` turns the detector off;
// the stored value covers code paths that read `localStorage` directly. The
// storage write is guarded because some specs opt into the node environment.
process.env.I18N_FORCE_LANG = "en"
globalThis.localStorage?.setItem("dim0.lang", "en")

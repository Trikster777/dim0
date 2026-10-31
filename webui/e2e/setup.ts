/**
 * Shared E2E state setup.
 *
 * The UI is translated, so every spec asserts against English strings. The
 * language is pinned through Playwright's `storageState`: it is installed for the
 * dev-server origin when the browser context is created, i.e. before each test
 * navigates. Without it a Russian `navigator.language` would flip the whole suite.
 */
export const E2E_ORIGIN = "http://localhost:4321"

/** `dim0.lang` key written by `src/i18n` — kept in sync manually (no app imports here). */
export const LANG_STORAGE_KEY = "dim0.lang"

/** Browser state every test starts from: English interface. */
export const EN_STORAGE_STATE = {
  cookies: [],
  origins: [
    {
      origin: E2E_ORIGIN,
      localStorage: [{ name: LANG_STORAGE_KEY, value: "en" }],
    },
  ],
}

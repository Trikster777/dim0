import i18n, { type ResourceLanguage } from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"

import en from "@/locales/en.json"
import ru from "@/locales/ru.json"


export const SUPPORTED_LANGS = ["en", "ru"] as const

export type Lang = (typeof SUPPORTED_LANGS)[number]

/** `localStorage` key holding the language the user picked explicitly. */
export const LANG_STORAGE_KEY = "dim0.lang"

const DEFAULT_LANG: Lang = "en"

// The JSON files are the single source of truth: the runtime imports them here and
// `scripts/i18n-check.mjs` reads the same files on disk.
const resources = {
  en: { translation: en as ResourceLanguage },
  ru: { translation: ru as ResourceLanguage },
}

/** The one i18next instance: shared by the app, the tests and `lib/i18n/errors`. */
export { i18n }

let initPromise: Promise<void> | null = null


/**
 * Narrow an arbitrary value to one of the supported language codes.
 */
function isLang(value: unknown): value is Lang {
  return SUPPORTED_LANGS.some((lang) => lang === value)
}


/**
 * Language pinned by the environment (tests use it so assertions never depend on
 * the machine). `I18N_FORCE_LANG` wins over the stored choice and the browser
 * locale; the `VITE_` twin covers bundles where `process` doesn't exist.
 */
function readForcedLang(): Lang | undefined {
  const fromVite = import.meta.env.VITE_I18N_FORCE_LANG as string | undefined
  const fromNode = typeof process === "undefined" ? undefined : process.env.I18N_FORCE_LANG
  const raw = fromVite ?? fromNode
  return isLang(raw) ? raw : undefined
}


/**
 * Mirror the active language onto `<html lang>` so the document advertises it.
 */
function applyDocumentLang(lang: Lang): void {
  if (typeof document !== "undefined") document.documentElement.lang = lang
}


/**
 * Initialize i18next once (idempotent). Detection order is stored choice →
 * browser locale → `en`; with `I18N_FORCE_LANG` set the detector is off and the
 * language is fixed. Call it before the first render.
 */
export function initI18n(): Promise<void> {
  if (initPromise !== null) return initPromise
  const forced = readForcedLang()
  // A forced language means "read nothing, cache nothing": the detector's default
  // localStorage cache would otherwise write a stray `i18nextLng` key.
  const detection =
    forced === undefined
      ? {
          order: ["localStorage", "navigator"],
          caches: ["localStorage"],
          lookupLocalStorage: LANG_STORAGE_KEY,
        }
      : { order: [], caches: [] }
  initPromise = i18n
    .use(initReactI18next)
    .use(LanguageDetector)
    .init({
      resources,
      supportedLngs: [...SUPPORTED_LANGS],
      fallbackLng: DEFAULT_LANG,
      load: "languageOnly",
      returnEmptyString: false,
      initAsync: false,
      lng: forced,
      detection,
      interpolation: { escapeValue: false },
    })
    .then(() => {
      applyDocumentLang(getLanguage())
    })
  return initPromise
}


/**
 * Active UI language, collapsed to a supported code (`en` when unknown).
 */
export function getLanguage(): Lang {
  const current = i18n.resolvedLanguage ?? i18n.language
  return isLang(current) ? current : DEFAULT_LANG
}


/**
 * Switch the UI language, remember the choice for the next visit and update
 * `<html lang>`.
 */
export async function setLanguage(lang: Lang): Promise<void> {
  await initI18n()
  await i18n.changeLanguage(lang)
  try {
    globalThis.localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    // Storage can be unavailable (private mode, blocked cookies) — the switch
    // still applies for the current session.
  }
  applyDocumentLang(lang)
}

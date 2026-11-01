import { apiFetch } from "@/api"
import { i18n } from "@/i18n"
import { statusOf } from "@/lib/api-error"
import { createExternalStore } from "@/lib/store"
import { useSyncExternalStore } from "react"
import { toast } from "sonner"


/** localStorage key holding the voice the user picked. */
export const VOICE_STORAGE_KEY = "dim0.tts.voice"

/** localStorage key holding the auto-speak flag. */
export const AUTO_SPEAK_STORAGE_KEY = "dim0.tts.autoSpeak"

/** localStorage key holding the playback speed. */
export const SPEED_STORAGE_KEY = "dim0.tts.speed"

/** localStorage key holding the timbre preset. */
export const TONE_STORAGE_KEY = "dim0.tts.tone"

/** Endpoint that lists the voices of the service. */
const TTS_VOICES_ENDPOINT = "/tts/voices"

/** Slowest playback the user may pick. */
export const MIN_SPEED = 0.5

/** Fastest playback the user may pick. */
export const MAX_SPEED = 2

/** Granularity of the speed control. */
export const SPEED_STEP = 0.05

/** Playback speed of a fresh browser. */
export const DEFAULT_SPEED = 1


/** Timbre preset of the synthesized speech. */
export type VoiceTone = "neutral" | "warm" | "bright"


/** Every timbre preset — the value stored in the browser storage. */
export const VOICE_TONES: VoiceTone[] = ["neutral", "warm", "bright"]


/**
 * Filter of a timbre preset. The service knows nothing about the timbre —
 * the preset is a client-side filter over the returned wave.
 */
export type ToneFilter = {
  type: "lowpass" | "highshelf"
  frequency: number
  gain: number
}


/**
 * Filters of the presets. "neutral" has no filter at all — the wave goes
 * to the speakers untouched.
 */
export const TONE_FILTERS: Record<Exclude<VoiceTone, "neutral">, ToneFilter> = {
  warm: { type: "lowpass", frequency: 1500, gain: 0 },
  bright: { type: "highshelf", frequency: 3500, gain: 8 },
}


/** Settings shared by every answer of the chat. */
export type VoiceSettings = {
  /** Voice the user picked — empty means "let the backend decide". */
  voice: string
  /** Whether new answers of the agent are spoken on their own. */
  autoSpeak: boolean
  /** Playback speed of the synthesized speech. */
  speed: number
  /** Timbre preset of the synthesized speech. */
  tone: VoiceTone
}


/** Voice list of the service — loaded lazily and cached in the module. */
export type VoicesState = {
  /** Whether the list was already asked for (a second opening asks nothing). */
  requested: boolean
  /** Voices the service reported. */
  voices: string[]
  /** True when the service refused to answer. */
  failed: boolean
}


/**
 * Read a value from the browser storage — an unavailable storage (private
 * mode) is not an error, the choice then only lives in this session.
 */
const readStorage = (key: string): string | null => {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}


/**
 * Write a value into the browser storage.
 */
const writeStorage = (key: string, value: string | null) => {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key)
    else globalThis.localStorage?.setItem(key, value)
  } catch {
    // Storage can be unavailable (private mode) — the choice still applies to
    // the current session.
  }
}


/**
 * Clamp the speed into the allowed range and round it to the step of the
 * control — a hand-written value from the storage cannot slip past.
 */
export const normalizeSpeed = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value))
  if (!Number.isFinite(parsed)) return DEFAULT_SPEED
  const clamped = Math.min(MAX_SPEED, Math.max(MIN_SPEED, parsed))
  return Math.round(clamped / SPEED_STEP) * SPEED_STEP
}


/**
 * Read the timbre preset from an arbitrary value — an unknown preset falls
 * back to the neutral one.
 */
export const normalizeTone = (value: unknown): VoiceTone => {
  if (typeof value !== "string") return "neutral"
  const tone = value.toLowerCase() as VoiceTone
  return VOICE_TONES.includes(tone) ? tone : "neutral"
}


/**
 * Read the settings from the browser storage — the source of truth after a
 * reload.
 */
const readSettings = (): VoiceSettings => ({
  voice: readStorage(VOICE_STORAGE_KEY) ?? "",
  autoSpeak: readStorage(AUTO_SPEAK_STORAGE_KEY) === "1",
  speed: normalizeSpeed(readStorage(SPEED_STORAGE_KEY)),
  tone: normalizeTone(readStorage(TONE_STORAGE_KEY)),
})


/**
 * The settings of the module — shared by every answer of the chat. The
 * browser storage fills it on the start: the choice of the user outlives a
 * reload.
 */
const settingsStore = createExternalStore<VoiceSettings>(readSettings())

/** True once the backend answered 503 — the module is off until a reload. */
const disabledStore = createExternalStore<boolean>(false)

/** The voice list of the service — the module-level cache of `GET /tts/voices`. */
const voicesStore = createExternalStore<VoicesState>({ requested: false, voices: [], failed: false })


/**
 * Pick the stored settings up. The browser storage is the source of truth
 * after a reload, the module store is the source of truth while the page
 * lives. Calling it twice changes nothing.
 */
export const hydrateVoiceSettings = () => {
  const stored = readSettings()
  const current = settingsStore.get()
  if (
    current.voice === stored.voice &&
    current.autoSpeak === stored.autoSpeak &&
    current.speed === stored.speed &&
    current.tone === stored.tone
  ) {
    return
  }
  settingsStore.set(stored)
}


/**
 * Remember the picked voice — the choice outlives a reload.
 */
export const setVoice = (voice: string) => {
  writeStorage(VOICE_STORAGE_KEY, voice || null)
  settingsStore.set({ ...settingsStore.get(), voice })
}


/**
 * Remember the auto-speak flag.
 */
export const setAutoSpeak = (autoSpeak: boolean) => {
  writeStorage(AUTO_SPEAK_STORAGE_KEY, autoSpeak ? "1" : null)
  settingsStore.set({ ...settingsStore.get(), autoSpeak })
}


/**
 * Remember the playback speed.
 */
export const setSpeed = (speed: number) => {
  const normalized = normalizeSpeed(speed)
  writeStorage(SPEED_STORAGE_KEY, String(normalized))
  settingsStore.set({ ...settingsStore.get(), speed: normalized })
}


/**
 * Remember the timbre preset.
 */
export const setTone = (tone: VoiceTone) => {
  const normalized = normalizeTone(tone)
  writeStorage(TONE_STORAGE_KEY, normalized)
  settingsStore.set({ ...settingsStore.get(), tone: normalized })
}


/**
 * The settings as they are right now — for the code that plays the speech
 * and does not re-render on a change.
 */
export const getVoiceSettings = (): VoiceSettings => settingsStore.get()


/**
 * Whether the backend told us that the module is switched off.
 */
export const isModuleDisabled = (): boolean => disabledStore.get()


/**
 * Latch the switched-off module: the user gets one clear toast and every
 * control of the module freezes — nothing is asked of the backend until
 * the page is reloaded.
 */
export const markModuleDisabled = () => {
  if (disabledStore.get()) return
  disabledStore.set(true)
  toast(i18n.t("tts.disabled"))
}


/**
 * Load the voice list of the service — once per page. The request goes on the
 * first opening of the section, not on the mount of the dialog; the list is
 * served from the module cache afterwards.
 */
export const loadVoices = async () => {
  if (disabledStore.get()) return
  if (voicesStore.get().requested) return
  voicesStore.set({ requested: true, voices: [], failed: false })

  try {
    const payload = await apiFetch<{ voices?: string[] }>({
      path: TTS_VOICES_ENDPOINT,
      method: "GET",
      responseType: "json",
    })
    const voices = payload?.voices ?? []
    voicesStore.set({ requested: true, voices, failed: false })

    // A voice the service does not know anymore is dropped: the backend then
    // falls back to the voice of its own configuration.
    const picked = settingsStore.get().voice
    if (picked && !voices.includes(picked)) {
      setVoice("")
    }
  } catch (error) {
    if (statusOf(error) === 503) {
      // The module is off, exactly as with POST /tts: one clear toast, the
      // voice list is hidden and every control stays frozen until a reload.
      markModuleDisabled()
      voicesStore.set({ requested: true, voices: [], failed: false })
      return
    }
    voicesStore.set({ requested: true, voices: [], failed: true })
    toast(i18n.t("tts.voicesUnavailable"))
  }
}


/**
 * The settings of the module — re-renders when they change.
 */
export const useVoiceSettings = (): VoiceSettings =>
  useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get)


/**
 * The voice list of the service — re-renders when it is loaded.
 */
export const useVoiceList = (): VoicesState =>
  useSyncExternalStore(voicesStore.subscribe, voicesStore.get, voicesStore.get)


/**
 * Whether the module is switched off — re-renders when it is latched.
 */
export const useModuleDisabled = (): boolean =>
  useSyncExternalStore(disabledStore.subscribe, disabledStore.get, disabledStore.get)


/**
 * Reset the module state — the settings, the cached voices and the latch.
 * Used by the tests to start from a clean slate.
 */
export const resetVoiceSettings = () => {
  settingsStore.set({ voice: "", autoSpeak: false, speed: DEFAULT_SPEED, tone: "neutral" })
  disabledStore.set(false)
  voicesStore.set({ requested: false, voices: [], failed: false })
  writeStorage(VOICE_STORAGE_KEY, null)
  writeStorage(AUTO_SPEAK_STORAGE_KEY, null)
  writeStorage(SPEED_STORAGE_KEY, null)
  writeStorage(TONE_STORAGE_KEY, null)
  toast.dismiss?.()
}

import { TONE_FILTERS, normalizeSpeed, type VoiceSettings, type VoiceTone } from "./voice-settings"


/** Constructor of the Web Audio context — the prefixed one is the old Safari. */
type AudioContextConstructor = new () => AudioContext


/**
 * The Web Audio context of the module. It is created on the first click of
 * the user — a context created outside a gesture starts suspended.
 */
let context: AudioContext | null = null

/** The filter of the timbre preset — one for the whole module. */
let filter: BiquadFilterNode | null = null

/** The source of every audio element that went through the filter. */
const sources = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>()


/**
 * The constructor of the Web Audio context of the browser, if it has one.
 */
const contextConstructor = (): AudioContextConstructor | null => {
  const scope = globalThis as typeof globalThis & {
    AudioContext?: AudioContextConstructor
    webkitAudioContext?: AudioContextConstructor
  }
  return scope.AudioContext ?? scope.webkitAudioContext ?? null
}


/**
 * The Web Audio context — created on the first call. A browser without Web
 * Audio simply has none: the speech then plays as it is.
 */
const ensureContext = (): AudioContext | null => {
  if (context) return context
  const Ctor = contextConstructor()
  if (!Ctor) return null
  try {
    context = new Ctor()
  } catch {
    return null
  }
  try {
    filter = context.createBiquadFilter()
  } catch {
    filter = null
  }
  return context
}


/**
 * Wake the Web Audio context up — called from the click of the user, while
 * the browser still allows the context to start.
 */
export const prepareAudioPlayback = (tone: VoiceTone) => {
  if (tone === "neutral") return
  const ctx = ensureContext()
  if (!ctx) return
  if (ctx.state === "suspended") {
    void Promise.resolve(ctx.resume?.()).catch(() => undefined)
  }
}


/**
 * Play the wave faster or slower. The pitch follows the speed — the browser
 * resamples the wave instead of stretching it, so the voice sounds higher
 * when it is fast and lower when it is slow.
 */
const applySpeed = (audio: HTMLAudioElement, speed: number) => {
  audio.playbackRate = normalizeSpeed(speed)
  const element = audio as HTMLAudioElement & { preservesPitch?: boolean }
  try {
    element.preservesPitch = false
  } catch {
    // An old browser has no such property — the speed still applies.
  }
}


/**
 * Route the wave through the filter of the timbre preset. Without Web Audio
 * — or without a running context — the wave is left alone and plays as it
 * is.
 */
const applyTone = (audio: HTMLAudioElement, tone: VoiceTone) => {
  if (tone === "neutral") return
  const ctx = ensureContext()
  if (!ctx || !filter) return
  if (ctx.state !== "running") return

  let source = sources.get(audio)
  if (!source) {
    try {
      source = ctx.createMediaElementSource(audio)
    } catch {
      // The element is already captured by another source — it plays as it is.
      return
    }
    sources.set(audio, source)
  }

  const spec = TONE_FILTERS[tone]
  try {
    source.disconnect()
    filter.type = spec.type
    filter.frequency.value = spec.frequency
    filter.gain.value = spec.gain
    source.connect(filter)
    filter.connect(ctx.destination)
  } catch {
    // The graph refused the connection — the wave plays without the filter.
  }
}


/**
 * Apply the settings of the user to the audio about to play: the speed of
 * the playback and the timbre of the voice.
 */
export const applyVoiceSettings = (audio: HTMLAudioElement, settings: VoiceSettings) => {
  applySpeed(audio, settings.speed)
  applyTone(audio, settings.tone)
}


/**
 * Reset the Web Audio state — used by the tests.
 */
export const resetAudioPlayback = () => {
  context = null
  filter = null
}

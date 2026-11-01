import { apiFetch } from "@/api"
import { useChatMessages } from "@/features/agent/hooks/use-chat-messages"
import type { ChatMessage } from "@/features/agent/types/chat"
import { isReasoningTextStep } from "@/features/agent/types/stream"
import { CancelStatusIcon, CircleNotchIcon, SpeakerHighIcon, StopIcon } from "@/components/icons"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { i18n } from "@/i18n"
import { localizeApiError } from "@/lib/i18n/errors"
import clsx from "clsx"
import { useEffect, useId, useMemo, useRef, useSyncExternalStore, type ChangeEvent } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"


/** localStorage key holding the voice the user picked. */
const VOICE_STORAGE_KEY = "dim0.tts.voice"

/** localStorage key holding the auto-speak flag. */
const AUTO_SPEAK_STORAGE_KEY = "dim0.tts.autoSpeak"

/** Endpoint that synthesizes the speech. */
const TTS_ENDPOINT = "/tts"

/** Endpoint that lists the voices of the service. */
const TTS_VOICES_ENDPOINT = "/tts/voices"


/** Phase of the speech button. */
type SpeechPhase = "idle" | "loading" | "playing"


/** State of the one speech that may be running at a time. */
type SpeechState = {
  /** Key of the owner (a component instance or an auto-speak turn). */
  owner: string | null
  phase: SpeechPhase
  /** Localized text of the failure the owner ran into. */
  error: string | null
}


/** Voice list of the service — loaded lazily and cached in the module. */
type VoicesState = {
  /** Whether the list was already asked for (a second opening asks nothing). */
  requested: boolean
  /** Voices the service reported. */
  voices: string[]
  /** True when the service refused to answer. */
  failed: boolean
}


/** Settings shared by every answer of the chat. */
type SpeakSettings = {
  /** Voice the user picked — empty means "let the backend decide". */
  voice: string
  /** Whether new answers of the agent are spoken on their own. */
  autoSpeak: boolean
}


/** Minimal external store — the speech state lives outside React. */
type Store<T> = {
  get: () => T
  set: (value: T) => void
  subscribe: (listener: () => void) => () => void
}


const createStore = <T,>(initial: T): Store<T> => {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set: (next: T) => {
      value = next
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}


const speechStore = createStore<SpeechState>({ owner: null, phase: "idle", error: null })

/** True once the backend answered 503 — the module is off until a reload. */
const disabledStore = createStore<boolean>(false)

/** The voice list of the service — the module-level cache of `GET /tts/voices`. */
const voicesStore = createStore<VoicesState>({ requested: false, voices: [], failed: false })

/** The settings of the module — shared by every answer of the chat. */
const settingsStore = createStore<SpeakSettings>({ voice: "", autoSpeak: false })


/** Abort controller of the request that is in flight, if any. */
let activeController: AbortController | null = null

/** Audio element of the running speech, if any. */
let activeAudio: HTMLAudioElement | null = null

/** Object URL of the running speech, if any. */
let activeObjectUrl: string | null = null

/** Id of the last answer the auto-speak has spoken — it speaks each one once. */
let lastAutoSpokenMessageId: string | null = null


/**
 * Read the HTTP status off a thrown value, if it carries one.
 */
const statusOf = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null) return undefined
  const status = (error as { status?: unknown }).status
  return typeof status === "number" ? status : undefined
}


/**
 * Read the picked voice from the browser storage (empty when nothing is picked).
 */
const readStoredVoice = (): string => {
  try {
    return globalThis.localStorage?.getItem(VOICE_STORAGE_KEY) ?? ""
  } catch {
    return ""
  }
}


/**
 * Remember the picked voice in the browser storage — the choice outlives a reload.
 */
const writeStoredVoice = (voice: string) => {
  try {
    if (voice) globalThis.localStorage?.setItem(VOICE_STORAGE_KEY, voice)
    else globalThis.localStorage?.removeItem(VOICE_STORAGE_KEY)
  } catch {
    // Storage can be unavailable (private mode) — the choice still applies to
    // the current session.
  }
}


/**
 * Read the auto-speak flag from the browser storage (off unless it was turned on).
 */
const readAutoSpeak = (): boolean => {
  try {
    return globalThis.localStorage?.getItem(AUTO_SPEAK_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}


/**
 * Remember the auto-speak flag in the browser storage.
 */
const writeAutoSpeak = (autoSpeak: boolean) => {
  try {
    if (autoSpeak) globalThis.localStorage?.setItem(AUTO_SPEAK_STORAGE_KEY, "1")
    else globalThis.localStorage?.removeItem(AUTO_SPEAK_STORAGE_KEY)
  } catch {
    // Storage can be unavailable (private mode) — the choice still applies to
    // the current session.
  }
}


/**
 * Stop the audio and release the object URL of the running speech.
 */
const releaseAudio = () => {
  if (activeAudio) {
    activeAudio.pause()
    activeAudio.onended = null
    activeAudio = null
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl)
    activeObjectUrl = null
  }
}


/**
 * Cancel the running speech: the request is aborted, the sound stops and the
 * object URL is released — nothing is left behind.
 */
const stopSpeech = () => {
  activeController?.abort()
  activeController = null
  releaseAudio()
  speechStore.set({ owner: null, phase: "idle", error: null })
}


/**
 * Latch the switched-off module: the user gets one clear toast and the
 * button stays visible but inactive — nothing is asked of the backend until
 * the page is reloaded.
 */
const markModuleDisabled = () => {
  if (disabledStore.get()) return
  disabledStore.set(true)
  toast(i18n.t("tts.disabled"))
}


/**
 * The text of an agent answer — the very text the copy button copies.
 */
const answerTextOf = (message: ChatMessage): string => {
  const steps = message.properties?.reasoning?.reasoning ?? []
  const text = steps.filter(isReasoningTextStep).map((step) => step.message).join("")
  return text || message.content?.markdown || ""
}


/**
 * Ask the backend to speak the given text and play the audio it returns.
 * The voice is taken from the shared settings: empty means "the backend
 * picks the default one".
 */
const speakText = async (owner: string, text: string) => {
  if (disabledStore.get()) return
  if (!text.trim()) return
  stopSpeech()
  speechStore.set({ owner, phase: "loading", error: null })

  const controller = new AbortController()
  activeController = controller
  const voice = settingsStore.get().voice

  try {
    const blob = await apiFetch<Blob>({
      path: TTS_ENDPOINT,
      method: "POST",
      body: voice ? { text, voice } : { text },
      responseType: "blob",
      signal: controller.signal,
    })
    if (controller.signal.aborted) return

    const objectUrl = URL.createObjectURL(blob)
    const audio = new Audio(objectUrl)
    activeAudio = audio
    activeObjectUrl = objectUrl
    audio.onended = () => {
      if (activeAudio === audio) stopSpeech()
    }
    void audio.play().catch(() => undefined)
    speechStore.set({ owner, phase: "playing", error: null })
  } catch (error) {
    if (controller.signal.aborted) return
    if (statusOf(error) === 503) {
      markModuleDisabled()
      speechStore.set({ owner: null, phase: "idle", error: null })
      return
    }
    speechStore.set({
      owner,
      phase: "idle",
      error: localizeApiError(error, "tts.error"),
    })
  }
}


/**
 * Load the voice list of the service — once per page. The request goes on the
 * first opening of the list, not on the mount of the answer; the list is
 * served from the module cache afterwards.
 */
const loadVoices = async () => {
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
      writeStoredVoice("")
      settingsStore.set({ ...settingsStore.get(), voice: "" })
    }
  } catch (error) {
    if (statusOf(error) === 503) {
      // The module is off, exactly as with POST /tts: one clear toast, the
      // voice list is hidden and the button stays frozen until a reload.
      markModuleDisabled()
      voicesStore.set({ requested: true, voices: [], failed: false })
      return
    }
    voicesStore.set({ requested: true, voices: [], failed: true })
    toast(i18n.t("tts.voicesUnavailable"))
  }
}


/**
 * Speak button of an agent answer. The spoken text is the very text the copy
 * button copies — the component only receives it.
 */
export const SpeakAnswer = ({ answer, compact = false }: { answer: string, compact?: boolean }) => {
  const { t } = useTranslation()
  const instanceId = useId()

  const speech = useSyncExternalStore(speechStore.subscribe, speechStore.get)
  const moduleDisabled = useSyncExternalStore(disabledStore.subscribe, disabledStore.get)
  const voices = useSyncExternalStore(voicesStore.subscribe, voicesStore.get)
  const settings = useSyncExternalStore(settingsStore.subscribe, settingsStore.get)

  const messages = useChatMessages()

  const transcript = useMemo(() => messages ?? [], [messages])

  /** The newest finished answer of the agent — the one auto-speak reads. */
  const latestAssistant = useMemo(() => {
    for (let i = transcript.length - 1; i >= 0; i -= 1) {
      const message = transcript[i]
      if (message?.role === "assistant" && !message.streaming) return message
    }
    return null
  }, [transcript])

  const latestAssistantId = latestAssistant?.id ?? null
  const latestAssistantText = latestAssistant ? answerTextOf(latestAssistant) : ""

  /** Id of the newest message of the user — a new one interrupts the speech. */
  const lastUserMessageId = useMemo(() => {
    for (let i = transcript.length - 1; i >= 0; i -= 1) {
      const message = transcript[i]
      if (message?.role === "user") return message.id
    }
    return null
  }, [transcript])

  // Pick the stored settings up on mount: the browser storage is the source of
  // truth after a reload, the module store is the source of truth while the
  // page lives.
  useEffect(() => {
    const stored: SpeakSettings = { voice: readStoredVoice(), autoSpeak: readAutoSpeak() }
    const current = settingsStore.get()
    if (current.voice !== stored.voice || current.autoSpeak !== stored.autoSpeak) {
      settingsStore.set(stored)
    }
  }, [])

  // A new message of the user interrupts the speech: the user took the turn.
  const seenUserMessageId = useRef<string | null>(null)
  const userMessageSeen = useRef(false)
  useEffect(() => {
    if (!userMessageSeen.current) {
      userMessageSeen.current = true
      seenUserMessageId.current = lastUserMessageId
      return
    }
    if (seenUserMessageId.current === lastUserMessageId) return
    seenUserMessageId.current = lastUserMessageId
    stopSpeech()
  }, [lastUserMessageId])

  // Auto-speak: every new answer of the agent is read on its own — once.
  useEffect(() => {
    if (!latestAssistantId) return
    if (lastAutoSpokenMessageId === latestAssistantId) return
    if (disabledStore.get()) return
    if (!settingsStore.get().autoSpeak) return
    lastAutoSpokenMessageId = latestAssistantId
    if (!latestAssistantText.trim()) return
    void speakText(instanceId, latestAssistantText)
  }, [instanceId, latestAssistantId, latestAssistantText])

  const owns = speech.owner === instanceId
  const phase = owns ? speech.phase : "idle"
  const errorText = owns ? speech.error : null

  const isEmpty = answer.trim() === ""
  const isBusy = phase === "loading" || phase === "playing"

  const label = moduleDisabled
    ? t("tts.disabled")
    : errorText ?? (isBusy ? (phase === "loading" ? t("tts.loading") : t("tts.stop")) : t("tts.play"))
  const Icon = moduleDisabled
    ? SpeakerHighIcon
    : phase === "loading"
      ? CircleNotchIcon
      : phase === "playing"
        ? StopIcon
        : errorText
          ? CancelStatusIcon
          : SpeakerHighIcon

  const handleClick = () => {
    if (moduleDisabled) return
    if (isEmpty) return
    if (isBusy) {
      stopSpeech()
      return
    }
    void speakText(instanceId, answer)
  }

  const handleVoiceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const voice = event.target.value
    writeStoredVoice(voice)
    settingsStore.set({ ...settingsStore.get(), voice })
  }

  const handleAutoSpeakChange = (event: ChangeEvent<HTMLInputElement>) => {
    const autoSpeak = event.target.checked
    writeAutoSpeak(autoSpeak)
    settingsStore.set({ ...settingsStore.get(), autoSpeak })
  }

  const button = (
    <button
      className={clsx(
        "transition-all text-muted-foreground hover:text-foreground flex flex-row items-center rounded-md",
        compact ? "justify-center size-8" : "text-xs gap-2 p-1",
        (isEmpty || moduleDisabled) && "opacity-50 pointer-events-none",
      )}
      onClick={handleClick}
      disabled={isEmpty || moduleDisabled}
      aria-label={label}
      title={label}
      aria-busy={phase === "loading"}
    >
      <Icon className='size-4 shrink-0' strokeWidth={2} weight={compact ? "duotone" : undefined} />
      {!compact && <span>{label}</span>}
    </button>
  )

  return (
    <div className="flex flex-row items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side={compact ? "left" : "top"}>{label}</TooltipContent>
      </Tooltip>
      {!compact && (
        <>
          {!moduleDisabled && (
            <select
              className="text-xs text-muted-foreground bg-transparent border border-border rounded-md px-1 py-0.5 max-w-28"
              aria-label={t("tts.voice")}
              title={voices.failed ? t("tts.voicesUnavailable") : t("tts.voice")}
              value={settings.voice}
              onMouseDown={() => void loadVoices()}
              onFocus={() => void loadVoices()}
              onChange={handleVoiceChange}
            >
              <option value="">{t("tts.voice")}</option>
              {voices.voices.map((voice) => (
                <option key={voice} value={voice}>{voice}</option>
              ))}
            </select>
          )}
          <label className="flex flex-row items-center gap-1 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              className="size-3 accent-primary"
              aria-label={t("tts.autoSpeak")}
              checked={settings.autoSpeak}
              onChange={handleAutoSpeakChange}
            />
            <span>{t("tts.autoSpeak")}</span>
          </label>
        </>
      )}
    </div>
  )
}


/**
 * Reset the module state — the speech, the cached voices and the settings.
 * Used by the tests to start from a clean slate.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const resetSpeakAnswerState = () => {
  stopSpeech()
  speechStore.set({ owner: null, phase: "idle", error: null })
  disabledStore.set(false)
  voicesStore.set({ requested: false, voices: [], failed: false })
  lastAutoSpokenMessageId = null
  localStorage.removeItem(VOICE_STORAGE_KEY)
  localStorage.removeItem(AUTO_SPEAK_STORAGE_KEY)
  settingsStore.set({ voice: "", autoSpeak: false })
  toast.dismiss?.()
}

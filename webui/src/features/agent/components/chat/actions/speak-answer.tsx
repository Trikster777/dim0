import { apiFetch } from "@/api"
import { useChatMessages } from "@/features/agent/hooks/use-chat-messages"
import type { ChatMessage } from "@/features/agent/types/chat"
import { isReasoningTextStep } from "@/features/agent/types/stream"
import { applyVoiceSettings, prepareAudioPlayback } from "@/features/agent/tts/audio-playback"
import {
  getVoiceSettings,
  hydrateVoiceSettings,
  isModuleDisabled,
  markModuleDisabled,
  resetVoiceSettings,
  useModuleDisabled,
} from "@/features/agent/tts/voice-settings"
import { CancelStatusIcon, CircleNotchIcon, SpeakerHighIcon, StopIcon } from "@/components/icons"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { localizeApiError } from "@/lib/i18n/errors"
import { statusOf } from "@/lib/api-error"
import { createExternalStore } from "@/lib/store"
import clsx from "clsx"
import { useEffect, useId, useMemo, useRef, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"


/** Endpoint that synthesizes the speech. */
const TTS_ENDPOINT = "/tts"


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


const speechStore = createExternalStore<SpeechState>({ owner: null, phase: "idle", error: null })


/** Abort controller of the request that is in flight, if any. */
let activeController: AbortController | null = null

/** Audio element of the running speech, if any. */
let activeAudio: HTMLAudioElement | null = null

/** Object URL of the running speech, if any. */
let activeObjectUrl: string | null = null

/** Id of the last answer the auto-speak has spoken — it speaks each one once. */
let lastAutoSpokenMessageId: string | null = null


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
  if (isModuleDisabled()) return
  if (!text.trim()) return
  stopSpeech()
  speechStore.set({ owner, phase: "loading", error: null })

  const controller = new AbortController()
  activeController = controller
  const settings = getVoiceSettings()

  // The Web Audio context has to start inside the gesture of the user — the
  // first await of this function still happens inside that gesture.
  prepareAudioPlayback(settings.tone)

  try {
    const blob = await apiFetch<Blob>({
      path: TTS_ENDPOINT,
      method: "POST",
      body: settings.voice ? { text, voice: settings.voice } : { text },
      responseType: "blob",
      signal: controller.signal,
    })
    if (controller.signal.aborted) return

    const objectUrl = URL.createObjectURL(blob)
    const audio = new Audio(objectUrl)
    applyVoiceSettings(audio, settings)
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
 * Speak button of an agent answer. The spoken text is the very text the copy
 * button copies — the component only receives it.
 */
export const SpeakAnswer = ({ answer, compact = false }: { answer: string, compact?: boolean }) => {
  const { t } = useTranslation()
  const instanceId = useId()

  const speech = useSyncExternalStore(speechStore.subscribe, speechStore.get)
  const moduleDisabled = useModuleDisabled()

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
    hydrateVoiceSettings()
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
    if (isModuleDisabled()) return
    if (!getVoiceSettings().autoSpeak) return
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
    </div>
  )
}


/**
 * Reset the module state — the speech and the settings of the voice.
 * Used by the tests to start from a clean slate.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const resetSpeakAnswerState = () => {
  stopSpeech()
  speechStore.set({ owner: null, phase: "idle", error: null })
  lastAutoSpokenMessageId = null
  resetVoiceSettings()
}

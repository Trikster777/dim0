// Tests for the "Agent voice" section of the agent settings: the list of
// voices is asked for when the section opens and served from the cache
// afterwards, the choice survives a reload, the speed and the timbre are
// written to their keys and reach the audio element, and the whole section
// freezes when the module answers 503.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ChatMessage } from "@/features/agent/types/chat"


const state = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  messages: [] as ChatMessage[],
}))


vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>()
  return { ...actual, apiFetch: state.apiFetch }
})

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }))

vi.mock("@/features/agent/hooks/use-chat-messages", () => ({
  useChatMessages: () => state.messages,
}))


import { ApiRequestError } from "@/api"
import { toast } from "sonner"
import { VoicePane } from "../settings-dialog"
import { SpeakAnswer, resetSpeakAnswerState } from "@/features/agent/components/chat/actions/speak-answer"
import { resetAudioPlayback } from "@/features/agent/tts/audio-playback"


/** Stand-in for the browser audio element — jsdom has no real playback. */
class FakeAudio {
  static instances: FakeAudio[] = []

  src: string
  paused = true
  playbackRate = 1
  preservesPitch = true
  onended: (() => void) | null = null
  play = vi.fn(() => {
    this.paused = false
    return Promise.resolve()
  })
  pause = vi.fn(() => {
    this.paused = true
  })

  constructor(src: string) {
    this.src = src
    FakeAudio.instances.push(this)
  }
}


/** Stand-in for the filter of the Web Audio graph. */
class FakeFilter {
  type = "lowpass"
  frequency = { value: 0 }
  gain = { value: 0 }
  connect = vi.fn()
  disconnect = vi.fn()
}


/** The filter of the last built graph — the test looks at it. */
let lastFilter: FakeFilter | null = null


/** Stand-in for the Web Audio context — jsdom has no Web Audio at all. */
class FakeAudioContext {
  state = "running"
  destination = { id: "destination" }
  createBiquadFilter = vi.fn(() => {
    lastFilter = new FakeFilter()
    return lastFilter
  })
  createMediaElementSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }))
  resume = vi.fn(() => Promise.resolve())
}


/** Mocks of the object-URL factory of the browser. */
const createObjectURL = vi.fn(() => "blob:voice-pane")
const revokeObjectURL = vi.fn()


/** The voices of the service — the list is never hardcoded in the app. */
const SERVICE_VOICES = ["aidar", "baya", "kseniya", "xenia", "eugene"]


const voiceSelect = () => screen.getByRole<HTMLSelectElement>("combobox", { name: "Voice" })
const autoSpeakBox = () => screen.getByRole<HTMLInputElement>("checkbox", { name: "Speak agent answers automatically" })
const speedSlider = () => screen.getByRole<HTMLInputElement>("slider", { name: "Speed" })


describe("VoicePane", () => {
  beforeEach(() => {
    state.apiFetch.mockReset()
    state.messages = []
    FakeAudio.instances = []
    lastFilter = null
    localStorage.clear()
    resetSpeakAnswerState()
    resetAudioPlayback()
    vi.mocked(toast).mockClear()
    vi.stubGlobal("Audio", FakeAudio)
    vi.stubGlobal("AudioContext", FakeAudioContext)
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
    globalThis.URL.createObjectURL = createObjectURL
    globalThis.URL.revokeObjectURL = revokeObjectURL
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("asks for the voice list when the section opens", async () => {
    state.apiFetch.mockResolvedValue({ voices: SERVICE_VOICES })
    render(<VoicePane />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(state.apiFetch).toHaveBeenCalledTimes(1)
    const [options] = state.apiFetch.mock.calls[0] as [{ path: string, method: string, responseType: string }]
    expect(options.path).toBe("/tts/voices")
    expect(options.method).toBe("GET")
    expect(options.responseType).toBe("json")

    const values = Array.from(voiceSelect().options).map((option) => option.value)
    expect(values).toEqual(["", ...SERVICE_VOICES])
  })

  it("serves the voice list from the cache when the section is opened again", async () => {
    state.apiFetch.mockResolvedValue({ voices: SERVICE_VOICES })
    const { unmount } = render(<VoicePane />)

    await act(async () => {
      await Promise.resolve()
    })
    unmount()

    render(<VoicePane />)
    await act(async () => {
      await Promise.resolve()
    })

    // The list was asked for once — the module cache answers the next opening.
    expect(state.apiFetch).toHaveBeenCalledTimes(1)
    expect(Array.from(voiceSelect().options)).toHaveLength(SERVICE_VOICES.length + 1)
  })

  it("shows a toast and an empty list when the voices are unavailable", async () => {
    // Not a 503: the module is on, the list itself did not come.
    state.apiFetch.mockRejectedValue(new ApiRequestError(502, "/tts/voices"))
    render(<VoicePane />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith("The voice list is unavailable")
    expect(Array.from(voiceSelect().options)).toHaveLength(1)
    expect(screen.getByText("The voice list is unavailable")).toBeTruthy()
  })

  it("freezes the whole section when the module answers 503", async () => {
    state.apiFetch.mockRejectedValue(new ApiRequestError(503, "/tts/voices"))
    render(<VoicePane />)

    await act(async () => {
      await Promise.resolve()
    })

    // One clear toast — the module is off, not the list.
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith("Speech is disabled")
    expect(screen.getByText("Speech is disabled")).toBeTruthy()

    expect(voiceSelect().hasAttribute("disabled")).toBe(true)
    expect(autoSpeakBox().hasAttribute("disabled")).toBe(true)
    expect(speedSlider().hasAttribute("disabled")).toBe(true)
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.hasAttribute("disabled")).toBe(true)
    }
  })

  it("does not ask for the voice list again after the module was latched off", async () => {
    state.apiFetch.mockRejectedValue(new ApiRequestError(503, "/tts/voices"))
    const { unmount } = render(<VoicePane />)

    await act(async () => {
      await Promise.resolve()
    })
    unmount()

    render(<VoicePane />)
    await act(async () => {
      await Promise.resolve()
    })

    expect(state.apiFetch).toHaveBeenCalledTimes(1)
  })

  it("remembers the picked voice and sends it to the backend", async () => {
    state.apiFetch.mockImplementation((options: { path: string }) =>
      options.path === "/tts/voices"
        ? Promise.resolve({ voices: SERVICE_VOICES })
        : Promise.resolve(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" })),
    )
    render(<VoicePane />)

    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.change(voiceSelect(), { target: { value: "kseniya" } })

    expect(localStorage.getItem("dim0.tts.voice")).toBe("kseniya")

    render(<SpeakAnswer answer="Привет" />)
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Speak" }))
    })

    const call = state.apiFetch.mock.calls.find(([options]) => options.path === "/tts")
    expect(call).toBeTruthy()
    const [options] = call as [{ path: string, body: unknown }]
    expect(options.body).toEqual({ text: "Привет", voice: "kseniya" })
  })

  it("keeps auto-speak off by default and remembers the choice", async () => {
    state.apiFetch.mockResolvedValue({ voices: SERVICE_VOICES })
    render(<VoicePane />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(autoSpeakBox().checked).toBe(false)
    expect(localStorage.getItem("dim0.tts.autoSpeak")).toBe(null)

    fireEvent.click(autoSpeakBox())

    expect(autoSpeakBox().checked).toBe(true)
    expect(localStorage.getItem("dim0.tts.autoSpeak")).toBe("1")
  })

  it("restores the picked voice from the browser storage", async () => {
    // The state of a previous visit: the browser remembers the voice, the page
    // does not.
    localStorage.setItem("dim0.tts.voice", "kseniya")
    state.apiFetch.mockResolvedValue({ voices: SERVICE_VOICES })
    render(<VoicePane />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(voiceSelect().value).toBe("kseniya")
  })

  it("does not start speaking when a voice is picked", async () => {
    state.apiFetch.mockResolvedValue({ voices: SERVICE_VOICES })
    render(<VoicePane />)

    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.change(voiceSelect(), { target: { value: "kseniya" } })

    // Only the voice list was asked for — the speech waits for a click.
    expect(state.apiFetch).toHaveBeenCalledTimes(1)
    expect(FakeAudio.instances).toHaveLength(0)
  })

  it("writes the speed to its key and applies it to the audio", async () => {
    state.apiFetch.mockImplementation((options: { path: string }) =>
      options.path === "/tts/voices"
        ? Promise.resolve({ voices: SERVICE_VOICES })
        : Promise.resolve(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" })),
    )
    render(<VoicePane />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(speedSlider().min).toBe("0.5")
    expect(speedSlider().max).toBe("2")
    expect(speedSlider().step).toBe("0.05")
    expect(speedSlider().value).toBe("1")

    fireEvent.change(speedSlider(), { target: { value: "1.5" } })

    expect(localStorage.getItem("dim0.tts.speed")).toBe("1.5")

    render(<SpeakAnswer answer="Привет" />)
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Speak" }))
    })

    expect(FakeAudio.instances[0]?.playbackRate).toBe(1.5)
    // The pitch follows the speed — the wave is resampled, not stretched.
    expect(FakeAudio.instances[0]?.preservesPitch).toBe(false)
  })

  it("writes the timbre to its key and applies it to the audio", async () => {
    state.apiFetch.mockImplementation((options: { path: string }) =>
      options.path === "/tts/voices"
        ? Promise.resolve({ voices: SERVICE_VOICES })
        : Promise.resolve(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" })),
    )
    render(<VoicePane />)

    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.click(screen.getByRole("radio", { name: "Warm" }))

    expect(localStorage.getItem("dim0.tts.tone")).toBe("warm")

    render(<SpeakAnswer answer="Привет" />)
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Speak" }))
    })

    expect(lastFilter?.type).toBe("lowpass")
    expect(lastFilter?.frequency.value).toBe(1500)
  })

  it("keeps the plain timbre without a filter", async () => {
    state.apiFetch.mockImplementation((options: { path: string }) =>
      options.path === "/tts/voices"
        ? Promise.resolve({ voices: SERVICE_VOICES })
        : Promise.resolve(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" })),
    )
    render(<VoicePane />)

    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole("radio", { name: "Bright" }))

    expect(localStorage.getItem("dim0.tts.tone")).toBe("bright")

    render(<SpeakAnswer answer="Привет" />)
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Speak" }))
    })

    expect(lastFilter?.type).toBe("highshelf")
    expect(lastFilter?.frequency.value).toBe(3500)
    expect(lastFilter?.gain.value).toBe(8)
  })

  it("plays the speech as it is when the browser has no Web Audio", async () => {
    vi.unstubAllGlobals()
    vi.stubGlobal("Audio", FakeAudio)
    state.apiFetch.mockImplementation((options: { path: string }) =>
      options.path === "/tts/voices"
        ? Promise.resolve({ voices: SERVICE_VOICES })
        : Promise.resolve(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" })),
    )
    render(<VoicePane />)

    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole("radio", { name: "Warm" }))

    render(<SpeakAnswer answer="Привет" />)
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Speak" }))
    })

    expect(FakeAudio.instances).toHaveLength(1)
    expect(lastFilter).toBe(null)
  })
})

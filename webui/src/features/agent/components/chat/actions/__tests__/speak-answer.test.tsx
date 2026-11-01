// Tests for the speak button of an agent answer: a click speaks the very text
// the copy button copies, the stop click cancels the request and releases the
// object URL, a 503 (the module is off) shows one toast and freezes the
// button, a new message of the user interrupts the speech, and the auto-speak
// reads the newest answer on its own.
//
// The voice list, the auto-speak switch, the speed and the timbre live in the
// settings dialog — they are covered by the voice section test.

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
import { SpeakAnswer, resetSpeakAnswerState } from "../speak-answer"


/** Stand-in for the browser audio element — jsdom has no real playback. */
class FakeAudio {
  static instances: FakeAudio[] = []

  src: string
  paused = true
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


/** Mocks of the object-URL factory of the browser. */
const createObjectURL = vi.fn(() => "blob:speak-answer")
const revokeObjectURL = vi.fn()


const speakButton = () => screen.getByRole("button", { name: /Speak|Speech is disabled/ })


/** Assistant message whose answer text is the given one. */
const assistantMessage = (id: string, text: string): ChatMessage => ({
  id,
  role: "assistant",
  content: { markdown: text },
  chatUid: "chat-1",
  properties: {
    reasoning: {
      type: "reasoning",
      reasoning: [{ type: "reasoning_step", id: `${id}-step`, reasoning: "", message: text }],
    },
  },
})


/** User message of the transcript. */
const userMessage = (id: string, text: string): ChatMessage => ({
  id,
  role: "user",
  content: { markdown: text },
  chatUid: "chat-1",
  properties: {},
})


describe("SpeakAnswer", () => {
  beforeEach(() => {
    state.apiFetch.mockReset()
    state.messages = []
    FakeAudio.instances = []
    localStorage.clear()
    resetSpeakAnswerState()
    vi.mocked(toast).mockClear()
    vi.stubGlobal("Audio", FakeAudio)
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
    globalThis.URL.createObjectURL = createObjectURL
    globalThis.URL.revokeObjectURL = revokeObjectURL
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("speaks the very text the copy button copies", async () => {
    state.apiFetch.mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" }))
    render(<SpeakAnswer answer="Привет, мир" />)

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Speak" }))
    })

    expect(state.apiFetch).toHaveBeenCalledTimes(1)
    const [options] = state.apiFetch.mock.calls[0] as [{ path: string, method: string, body: unknown, responseType: string }]
    expect(options.path).toBe("/tts")
    expect(options.method).toBe("POST")
    expect(options.body).toEqual({ text: "Привет, мир" })
    expect(options.responseType).toBe("blob")
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(FakeAudio.instances).toHaveLength(1)
    expect(FakeAudio.instances[0]?.src).toBe("blob:speak-answer")
  })

  it("stops the sound and releases the object URL when the stop is clicked", async () => {
    state.apiFetch.mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" }))
    render(<SpeakAnswer answer="Привет, мир" />)

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Speak" }))
    })
    expect(FakeAudio.instances[0]?.paused).toBe(false)

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stop" }))
    })

    expect(FakeAudio.instances[0]?.paused).toBe(true)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:speak-answer")
    expect(screen.getByRole("button", { name: "Speak" })).toBeTruthy()
  })

  it("shows one toast and freezes the button when the module is off", async () => {
    state.apiFetch.mockRejectedValue(new ApiRequestError(503, "/tts"))
    render(<SpeakAnswer answer="Привет, мир" />)

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Speak" }))
    })

    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith("Speech is disabled")

    const frozen = screen.getByRole("button", { name: "Speech is disabled" })
    expect(frozen.hasAttribute("disabled")).toBe(true)

    await act(async () => {
      fireEvent.click(frozen)
    })
    expect(state.apiFetch).toHaveBeenCalledTimes(1)
  })

  it("speaks the newest answer on its own when auto-speak is on", async () => {
    localStorage.setItem("dim0.tts.autoSpeak", "1")
    state.messages = [assistantMessage("a1", "Привет")]
    state.apiFetch.mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" }))

    render(<SpeakAnswer answer="Привет" />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(state.apiFetch).toHaveBeenCalledTimes(1)
    const [options] = state.apiFetch.mock.calls[0] as [{ path: string, body: unknown }]
    expect(options.path).toBe("/tts")
    expect(options.body).toEqual({ text: "Привет" })
  })

  it("stops the sound when a new user message arrives", async () => {
    state.messages = [assistantMessage("a1", "Привет")]
    state.apiFetch.mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" }))
    const { rerender } = render(<SpeakAnswer answer="Привет" />)

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Speak" }))
    })
    expect(FakeAudio.instances[0]?.paused).toBe(false)

    state.messages = [assistantMessage("a1", "Привет"), userMessage("u1", "Ещё раз")]
    await act(async () => {
      rerender(<SpeakAnswer answer="Привет" />)
    })

    expect(FakeAudio.instances[0]?.paused).toBe(true)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:speak-answer")
  })

  it("shows the localized reason of the failure", async () => {
    state.apiFetch.mockRejectedValue(new ApiRequestError(400, "/tts"))
    render(<SpeakAnswer answer="Привет" />)

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Speak" }))
    })

    expect(screen.getByRole("button", { name: "There is nothing to speak" })).toBeTruthy()
  })

  it("asks nothing when there is nothing to speak", async () => {
    render(<SpeakAnswer answer="   " />)

    const button = screen.getByRole("button", { name: "Speak" })
    expect(button.hasAttribute("disabled")).toBe(true)

    await act(async () => {
      fireEvent.click(button)
    })
    expect(state.apiFetch).not.toHaveBeenCalled()
  })

  it("aborts the pending request when the speech is stopped", async () => {
    state.apiFetch.mockImplementation(() => new Promise<Blob>(() => undefined))
    render(<SpeakAnswer answer="Привет" />)

    await act(async () => {
      fireEvent.click(speakButton())
    })

    const [options] = state.apiFetch.mock.calls[0] as [{ signal: AbortSignal }]
    expect(options.signal.aborted).toBe(false)

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Synthesizing/ }))
    })

    expect(options.signal.aborted).toBe(true)
    expect(FakeAudio.instances).toHaveLength(0)
  })

  it("aborts the pending request when a new user message arrives", async () => {
    state.messages = [assistantMessage("a1", "Привет")]
    state.apiFetch.mockImplementation(() => new Promise<Blob>(() => undefined))
    const { rerender } = render(<SpeakAnswer answer="Привет" />)

    await act(async () => {
      fireEvent.click(speakButton())
    })

    const [options] = state.apiFetch.mock.calls[0] as [{ signal: AbortSignal }]
    expect(options.signal.aborted).toBe(false)

    state.messages = [assistantMessage("a1", "Привет"), userMessage("u1", "Ещё раз")]
    await act(async () => {
      rerender(<SpeakAnswer answer="Привет" />)
    })

    expect(options.signal.aborted).toBe(true)
  })
})

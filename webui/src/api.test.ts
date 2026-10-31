// Tests for the additive binary-response support of the shared HTTP layer:
// a WAV body has to reach the caller as raw bytes. The legacy `apiFetch`
// reads non-JSON bodies with `res.text()`, which destroys the audio, so the
// binary path must never touch the text reader.

import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiRequestError, apiFetch } from "@/api"


const stubFetch = (response: unknown) => {
  const mock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal("fetch", mock)
  return mock
}


describe("apiFetch binary responses", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("hands the audio bytes back as a Blob without reading them as text", async () => {
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x01, 0x7f])
    let textCalls = 0
    stubFetch({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => "audio/wav" },
      blob: async () => new Blob([bytes], { type: "audio/wav" }),
      text: async () => {
        textCalls += 1
        return "RIFF not the audio"
      },
      json: async () => {
        throw new Error("json must not be called for a binary response")
      },
    })

    const blob = await apiFetch<Blob>({
      path: "/tts",
      method: "POST",
      body: { text: "привет", voice: "xenia" },
      responseType: "blob",
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes)
    expect(textCalls).toBe(0)
  })

  it("rejects with an error carrying the status and the endpoint", async () => {
    stubFetch({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({ detail: "TTS module is disabled" }),
      blob: async () => new Blob(),
      json: async () => ({ detail: "TTS module is disabled" }),
    })

    const thrown = await apiFetch({
      path: "/tts",
      method: "POST",
      body: { text: "привет" },
      responseType: "blob",
    }).then(
      () => null,
      (err: unknown) => err,
    )

    expect(thrown).toBeInstanceOf(ApiRequestError)
    const apiError = thrown as ApiRequestError
    expect(apiError.status).toBe(503)
    expect(apiError.endpoint).toBe("/tts")
  })
})

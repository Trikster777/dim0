import { describe, expect, it } from "vitest"
import { fetchProviderModels, parseModelsResponse, ProviderModelsError } from "./provider-models"


/** A minimal Response stand-in — no network, no undici. */
const jsonResponse = (payload: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }) as unknown as Response


describe("parseModelsResponse", () => {
  it("reads the OpenAI shape {data:[{id}]}", () => {
    expect(parseModelsResponse({ data: [{ id: "gpt-5.4" }, { id: "gpt-5.4-mini" }] })).toEqual([
      "gpt-5.4",
      "gpt-5.4-mini",
    ])
  })

  it("reads {models:[...]}", () => {
    expect(parseModelsResponse({ models: ["a", "b"] })).toEqual(["a", "b"])
    expect(parseModelsResponse({ models: [{ id: "a" }] })).toEqual(["a"])
  })

  it("reads a bare array of strings", () => {
    expect(parseModelsResponse(["a", "b"])).toEqual(["a", "b"])
  })

  it("drops duplicates and keeps the order", () => {
    expect(parseModelsResponse({ data: [{ id: "b" }, { id: "a" }, { id: "b" }] })).toEqual(["b", "a"])
  })

  it("returns nothing for junk", () => {
    expect(parseModelsResponse(null)).toEqual([])
    expect(parseModelsResponse("nope")).toEqual([])
    expect(parseModelsResponse(42)).toEqual([])
    expect(parseModelsResponse({ foo: 1 })).toEqual([])
    expect(parseModelsResponse({ data: "nope" })).toEqual([])
    expect(parseModelsResponse({ data: [{ nope: 1 }] })).toEqual([])
    expect(parseModelsResponse([{ nope: 1 }])).toEqual([])
  })
})


describe("fetchProviderModels", () => {
  it("asks the provider's /models with the key as a bearer token", async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return jsonResponse({ data: [{ id: "m1" }] })
    }) as unknown as typeof fetch

    const models = await fetchProviderModels({
      baseURL: "https://example.test/v1/",
      apiKey: "sk-x",
      fetchImpl,
    })

    expect(models).toEqual(["m1"])
    expect(calls[0]?.url).toBe("https://example.test/v1/models")
    const headers = calls[0]?.init?.headers as Record<string, string> | undefined
    expect(headers?.Authorization).toBe("Bearer sk-x")
    expect(headers?.Accept).toBe("application/json")
  })

  it("throws a status error on a non-2xx answer", async () => {
    const fetchImpl = (async () => jsonResponse({ error: "nope" }, 401)) as unknown as typeof fetch
    await expect(
      fetchProviderModels({ baseURL: "https://example.test/v1", apiKey: "sk-x", fetchImpl }),
    ).rejects.toMatchObject({ kind: "status" })
  })

  it("throws a network error when the provider is unreachable", async () => {
    const fetchImpl = (async () => {
      throw new Error("offline")
    }) as unknown as typeof fetch
    await expect(
      fetchProviderModels({ baseURL: "https://example.test/v1", apiKey: "sk-x", fetchImpl }),
    ).rejects.toMatchObject({ kind: "network" })
  })

  it("throws a parse error on a non-JSON body", async () => {
    const fetchImpl = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("not json")
        },
      }) as unknown as Response) as unknown as typeof fetch
    await expect(
      fetchProviderModels({ baseURL: "https://example.test/v1", apiKey: "sk-x", fetchImpl }),
    ).rejects.toMatchObject({ kind: "parse" })
  })

  it("the error carries a kind the UI can localize", async () => {
    const fetchImpl = (async () => jsonResponse({}, 500)) as unknown as typeof fetch
    const err = await fetchProviderModels({
      baseURL: "https://example.test/v1",
      apiKey: "sk-x",
      fetchImpl,
    }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProviderModelsError)
    expect((err as ProviderModelsError).kind).toBe("status")
  })
})

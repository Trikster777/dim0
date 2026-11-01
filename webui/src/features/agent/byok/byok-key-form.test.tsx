// Smoke test for the BYOK provider form: the provider list, adding a user's
// own OpenAI-compatible provider (name → base URL → key → model), loading the
// provider's model list, and removing the provider again.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useByokStore } from "./byok-store"
import { ByokKeyForm } from "./byok-key-form"


// Radix's select needs a ResizeObserver; jsdom has none.
if (!("ResizeObserver" in globalThis)) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
}


const reset = () => {
  useByokStore.setState({
    provider: "openrouter",
    llm: {},
    configured: false,
    customProviders: [],
    searchEngine: "perplexity",
    search: {},
    codeKey: "",
    parseKey: "",
  })
  localStorage.clear()
}


/** Fill the "add provider" panel and save it. */
const addProvider = (label = "My Provider", url = "https://example.test/v1") => {
  fireEvent.click(screen.getByRole("button", { name: "Add provider" }))
  const panel = screen.getByTestId("add-provider-panel")
  fireEvent.change(within(panel).getByLabelText("Provider name"), { target: { value: label } })
  fireEvent.change(within(panel).getByLabelText("Base URL"), { target: { value: url } })
  fireEvent.change(within(panel).getByLabelText("API key"), { target: { value: "sk-x" } })
  fireEvent.change(within(panel).getByLabelText("Model"), { target: { value: "my-model" } })
  fireEvent.click(within(panel).getByRole("button", { name: "Save" }))
}


describe("ByokKeyForm — the provider list", () => {
  beforeEach(reset)
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("lists the built-in providers", () => {
    render(<ByokKeyForm />)
    expect(screen.getByRole("button", { name: /OpenRouter/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /OpenAI/ })).toBeTruthy()
  })

  it("adds a user's own provider, keeps its key + model and makes it active", () => {
    render(<ByokKeyForm />)
    addProvider()

    const st = useByokStore.getState()
    expect(st.customProviders).toEqual([
      { id: "my-provider", label: "My Provider", baseURL: "https://example.test/v1" },
    ])
    expect(st.provider).toBe("my-provider")
    expect(st.llm["my-provider"]).toEqual({ apiKey: "sk-x", model: "my-model" })
    // and it shows up in the list under its own name
    expect(screen.getByRole("button", { name: /My Provider/ })).toBeTruthy()
  })

  it("removes a user's own provider (description and key)", () => {
    render(<ByokKeyForm />)
    addProvider()
    fireEvent.click(screen.getByRole("button", { name: "Remove provider" }))

    const st = useByokStore.getState()
    expect(st.customProviders).toEqual([])
    expect(st.llm["my-provider"]).toBeUndefined()
  })

  it("loads the provider's model list from the provider itself", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: "m1" }, { id: "m2" }] }),
      }) as unknown as Response,
    )
    vi.stubGlobal("fetch", fetchMock)

    render(<ByokKeyForm />)
    addProvider()
    fireEvent.click(screen.getByRole("button", { name: "Load models" }))

    expect(await screen.findByText("Models loaded: 2")).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0]
    expect(call?.[0]).toBe("https://example.test/v1/models")
    expect(call?.[1]?.headers).toMatchObject({ Authorization: "Bearer sk-x" })
  })
})

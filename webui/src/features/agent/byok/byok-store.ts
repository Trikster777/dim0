import { create } from "zustand"
import type { ByokConfig, ByokProvider } from "@/features/agent/engine/byok-client"
import { isBuiltinByokProvider } from "@/features/agent/engine/byok-client"
import { isKeylessSearchEngine } from "@/features/agent/engine/services/kinds"


const STORAGE_KEY = "dim0.byok"


/** Web-search providers, including the explicitly selected keyless Parallel option. */
export type SearchEngine = "perplexity" | "tavily" | "linkup" | "exa" | "parallel"


const DEFAULT_SEARCH_ENGINE: SearchEngine = "perplexity"


/** The provider picked when nothing else is chosen (and after a removal). */
const DEFAULT_BYOK_PROVIDER = "openrouter"


/**
 * A user's own OpenAI-compatible provider: what it is called, where it lives.
 * The key is NOT here — it lives in the per-provider `llm` map like any other.
 */
export type CustomProvider = {
  id: string
  label: string
  baseURL: string
}


/** A model provider's own BYOK credential. */
type LlmCred = { apiKey: string; model: string }


type Stored = {
  provider: ByokProvider
  /** Per-provider model keys — each provider keeps its own key + model. */
  llm: Partial<Record<ByokProvider, LlmCred>>
  searchEngine: SearchEngine
  /** Per-engine search keys — set one without clearing the others. */
  search: Partial<Record<SearchEngine, string>>
  codeKey: string
  /** Document parsing (Mistral OCR) — relayed through our proxy. */
  parseKey: string
  /** The user's own providers (description only — the key stays in `llm`). */
  customProviders: CustomProvider[]
}


/**
 * Read the stored custom providers, dropping anything malformed. Old blobs
 * (written before custom providers existed) simply have no such field → [].
 */
const parseCustomProviders = (raw: unknown): CustomProvider[] => {
  if (!Array.isArray(raw)) return []
  const out: CustomProvider[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const rec = item as Record<string, unknown>
    const id = typeof rec.id === "string" ? rec.id.trim() : ""
    const label = typeof rec.label === "string" ? rec.label.trim() : ""
    const baseURL = typeof rec.baseURL === "string" ? rec.baseURL.trim() : ""
    if (!id || !label || !baseURL) continue
    out.push({ id, label, baseURL })
  }
  return out
}


/** Read a remembered config from localStorage (opt-in), migrating the old
 *  single-key shape ({apiKey, searchKey}) into the per-provider maps. */
const load = (): Stored | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<Stored> & {
      apiKey?: string
      model?: string
      searchKey?: string
    }
    const provider = p.provider ?? DEFAULT_BYOK_PROVIDER
    const searchEngine = p.searchEngine ?? DEFAULT_SEARCH_ENGINE
    return {
      provider,
      llm: p.llm ?? (p.apiKey ? { [provider]: { apiKey: p.apiKey, model: p.model ?? "" } } : {}),
      searchEngine,
      search: p.search ?? (p.searchKey ? { [searchEngine]: p.searchKey } : {}),
      codeKey: p.codeKey ?? "",
      parseKey: p.parseKey ?? "",
      customProviders: parseCustomProviders(p.customProviders),
    }
  } catch {
    return null
  }
}


/**
 * Fallback model id per provider when the user leaves the field blank.
 * Built-ins have a sensible default; a user's own provider has none — the
 * model there is mandatory (the provider's own names).
 */
export const defaultModel = (provider: ByokProvider): string => {
  if (provider === "openai") return "gpt-5.4"
  if (provider === "openrouter") return "openai/gpt-5.4"
  return ""
}


/** Latin kebab-case slug of a provider name ("My Provider" → "my-provider"). */
export const providerSlug = (label: string): string =>
  label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")


/**
 * A provider id that clashes with nothing: not a built-in, not another custom
 * provider. Falls back to "custom-provider" when the name has no latin chars.
 */
export const uniqueProviderId = (label: string, taken: readonly string[]): string => {
  const used = new Set(taken)
  const base = providerSlug(label) || "custom-provider"
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}


type ByokState = {
  // Models (LLM) — called direct from the browser. Per-provider keys.
  provider: ByokProvider
  llm: Partial<Record<ByokProvider, LlmCred>>
  configured: boolean
  /** The user's own OpenAI-compatible providers (label + base URL). */
  customProviders: CustomProvider[]
  // Web search — relayed through our proxy. Per-engine keys.
  searchEngine: SearchEngine
  search: Partial<Record<SearchEngine, string>>
  // Code interpreter (Daytona) — relayed through our proxy.
  codeKey: string
  // Document parsing (Mistral OCR) — relayed through our proxy.
  parseKey: string
  /** Save a provider's model key + model, and make it the active provider. */
  setLlm: (cfg: { provider: ByokProvider; apiKey: string; model: string }) => void
  /** Switch the active model provider (keys are preserved per provider). */
  setProvider: (provider: ByokProvider) => void
  /** Register a user's own provider (its key is saved separately). */
  addCustomProvider: (provider: CustomProvider) => void
  /** Forget a user's own provider — both its description and its key. */
  removeCustomProvider: (id: string) => void
  /** Switch the active search engine (keys are preserved per engine). */
  setSearchEngine: (engine: SearchEngine) => void
  /** Save one engine's key without touching the others. */
  setSearchKey: (engine: SearchEngine, apiKey: string) => void
  setCode: (cfg: { apiKey: string }) => void
  setParse: (cfg: { apiKey: string }) => void
  clear: () => void
  /** The active provider's config (key + model), or null when it has no key. */
  asConfig: () => ByokConfig | null
  /** The active engine's search credential, or null when it has no key. */
  searchByok: () => { engine: SearchEngine; apiKey: string } | null
  /** The code (Daytona) BYOK key, or null when unset. */
  codeByok: () => string | null
  /** The document-parsing (Mistral) BYOK key, or null when unset. */
  parseByok: () => string | null
}


const initial = load()
const configuredFor = (provider: ByokProvider, llm: Partial<Record<ByokProvider, LlmCred>>): boolean =>
  Boolean(llm[provider]?.apiKey)


/**
 * BYOK config across services, keyed per provider/engine so several keys
 * coexist (OpenRouter + OpenAI, Tavily + Linkup, …). `provider`/`searchEngine`
 * are the ACTIVE selections; `configured` tracks whether the active model
 * provider has a key. Persisted to localStorage on this device by default (so
 * keys survive reloads/redeploys); `clear()` forgets them. Keys go only to the
 * provider (direct for models, relayed per-request for search/code) — never to
 * our servers.
 */
export const useByokStore = create<ByokState>((set, get) => ({
  provider: initial?.provider ?? DEFAULT_BYOK_PROVIDER,
  llm: initial?.llm ?? {},
  configured: configuredFor(initial?.provider ?? DEFAULT_BYOK_PROVIDER, initial?.llm ?? {}),
  customProviders: initial?.customProviders ?? [],
  searchEngine: initial?.searchEngine ?? DEFAULT_SEARCH_ENGINE,
  search: initial?.search ?? {},
  codeKey: initial?.codeKey ?? "",
  parseKey: initial?.parseKey ?? "",

  setLlm: ({ provider, apiKey, model }) => {
    const llm = { ...get().llm, [provider]: { apiKey, model } }
    set({ provider, llm, configured: configuredFor(provider, llm) })
    persist(get)
  },

  setProvider: (provider) => {
    set({ provider, configured: configuredFor(provider, get().llm) })
    persist(get)
  },

  addCustomProvider: (provider) => {
    const customProviders = [
      ...get().customProviders.filter((p) => p.id !== provider.id),
      provider,
    ]
    set({ customProviders })
    persist(get)
  },

  removeCustomProvider: (id) => {
    const { llm, customProviders, provider } = get()
    const nextLlm = { ...llm }
    delete nextLlm[id]
    const nextProviders = customProviders.filter((p) => p.id !== id)
    // The active provider must stay a real one: fall back to the default
    // builtin when the removed provider was the active one.
    const active =
      isBuiltinByokProvider(provider) || nextProviders.some((p) => p.id === provider)
        ? provider
        : DEFAULT_BYOK_PROVIDER
    set({
      llm: nextLlm,
      customProviders: nextProviders,
      provider: active,
      configured: configuredFor(active, nextLlm),
    })
    persist(get)
  },

  setSearchEngine: (engine) => {
    set({ searchEngine: engine })
    persist(get)
  },

  setSearchKey: (engine, apiKey) => {
    set({ search: { ...get().search, [engine]: apiKey }, searchEngine: engine })
    persist(get)
  },

  setCode: ({ apiKey }) => {
    set({ codeKey: apiKey })
    persist(get)
  },

  setParse: ({ apiKey }) => {
    set({ parseKey: apiKey })
    persist(get)
  },

  clear: () => {
    // `searchEngine` goes back to the default too: leaving a keyless selection
    // in memory would keep this session on it, then silently drop to the
    // default after a reload once localStorage is gone.
    // The user's own provider DESCRIPTIONS stay: a name and a base URL are
    // not secrets — only the keys are.
    set({ llm: {}, configured: false, searchEngine: DEFAULT_SEARCH_ENGINE, search: {}, codeKey: "", parseKey: "" })
    persist(get)
  },

  asConfig: () => {
    const { provider, llm, customProviders } = get()
    const cred = llm[provider]
    if (!cred?.apiKey) return null
    // A user's own provider needs its base URL; the built-ins carry theirs.
    const custom = customProviders.find((p) => p.id === provider)
    return {
      provider,
      apiKey: cred.apiKey,
      model: cred.model.trim() || defaultModel(provider),
      ...(custom ? { baseURL: custom.baseURL } : {}),
    }
  },

  searchByok: () => {
    const { searchEngine, search } = get()
    if (isKeylessSearchEngine(searchEngine)) return null
    const apiKey = search[searchEngine]
    return apiKey?.trim() ? { engine: searchEngine, apiKey: apiKey.trim() } : null
  },

  codeByok: () => get().codeKey.trim() || null,

  parseByok: () => get().parseKey.trim() || null,
}))


const hasAnyKey = (s: ByokState): boolean =>
  Object.values(s.llm).some((c) => c?.apiKey) ||
  Object.values(s.search).some(Boolean) ||
  Boolean(s.codeKey) ||
  Boolean(s.parseKey)


/** Persist the config to localStorage on this device (until `clear()`). */
function persist(get: () => ByokState): void {
  const { provider, llm, searchEngine, search, codeKey, parseKey, customProviders } = get()
  try {
    if (hasAnyKey(get()) || customProviders.length > 0 || isKeylessSearchEngine(searchEngine)) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ provider, llm, searchEngine, search, codeKey, parseKey, customProviders }),
      )
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // storage unavailable — config stays in-memory only
  }
}

/**
 * Loading a provider's model list — the `/models` endpoint every
 * OpenAI-compatible API exposes. Pure, network-free helpers so the parsing is
 * unit-testable without a provider.
 *
 * The key goes only to the provider itself (as a bearer token) and never to
 * our servers or the console.
 */

/** Why a model-list request failed — the UI turns it into a localized hint. */
export type ProviderModelsErrorKind = "network" | "status" | "parse"


/** A model-list failure with a kind the caller can localize. */
export class ProviderModelsError extends Error {
  readonly kind: ProviderModelsErrorKind

  constructor(kind: ProviderModelsErrorKind, message: string) {
    super(message)
    this.name = "ProviderModelsError"
    this.kind = kind
  }
}


/** The models endpoint of an OpenAI-compatible base URL. */
export const modelsUrl = (baseURL: string): string => `${baseURL.replace(/\/+$/, "")}/models`


/** One model id out of a list-shaped entry (a string, or an object with `id`). */
const modelIdOf = (entry: unknown): string | null => {
  if (typeof entry === "string") {
    const trimmed = entry.trim()
    return trimmed ? trimmed : null
  }
  if (entry && typeof entry === "object") {
    const id = (entry as Record<string, unknown>).id
    if (typeof id === "string") {
      const trimmed = id.trim()
      return trimmed ? trimmed : null
    }
  }
  return null
}


/**
 * Model ids out of a provider's `/models` payload. Understands the OpenAI
 * shape (`{data: [{id}]}`), a plain `{models: [...]}` list, and a bare array.
 * Anything else yields no models. Duplicates are dropped, order is kept.
 */
export const parseModelsResponse = (payload: unknown): string[] => {
  const ids: string[] = []
  const add = (id: string | null): void => {
    if (id && !ids.includes(id)) ids.push(id)
  }
  const list = (raw: unknown): void => {
    if (!Array.isArray(raw)) return
    for (const entry of raw) add(modelIdOf(entry))
  }

  if (Array.isArray(payload)) {
    list(payload)
    return ids
  }
  if (payload && typeof payload === "object") {
    const rec = payload as Record<string, unknown>
    if (Array.isArray(rec.data)) {
      list(rec.data)
      return ids
    }
    if (Array.isArray(rec.models)) {
      list(rec.models)
      return ids
    }
  }
  return ids
}


/**
 * Fetch the model ids a provider offers. `fetchImpl` is injectable (tests
 * pass a stub; the desktop build passes the CORS-free Tauri fetch). Throws a
 * `ProviderModelsError` on a network failure, a non-2xx status, or an
 * unreadable body — the caller keeps the model field editable either way.
 */
export const fetchProviderModels = async (opts: {
  baseURL: string
  apiKey: string
  fetchImpl?: typeof fetch
}): Promise<string[]> => {
  const doFetch = opts.fetchImpl ?? fetch
  const url = modelsUrl(opts.baseURL)
  let res: Response
  try {
    res = await doFetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        Accept: "application/json",
      },
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new ProviderModelsError("network", `Could not reach the provider: ${detail}`)
  }
  if (!res.ok) {
    throw new ProviderModelsError("status", `The provider answered with HTTP ${res.status}`)
  }
  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw new ProviderModelsError("parse", "The provider answered with a non-JSON body")
  }
  return parseModelsResponse(payload)
}

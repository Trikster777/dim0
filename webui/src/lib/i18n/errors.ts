import { i18n } from "@/i18n"


/** Status → locale key, shared by every endpoint. */
const STATUS_KEYS: Partial<Record<number, string>> = {
  400: "errors.bad_request",
  401: "errors.unauthorized",
  403: "errors.forbidden",
  404: "errors.not_found",
  409: "errors.conflict",
  413: "errors.payload_too_large",
  429: "errors.rate_limited",
  500: "errors.server",
  502: "errors.unavailable",
  503: "errors.unavailable",
  504: "errors.timeout",
}

/** Endpoints where a status means something more specific than its generic key. */
const ENDPOINT_STATUS_KEYS: Record<string, Partial<Record<number, string>>> = {
  // A 401 here is a wrong username/password pair, not an expired session.
  "/users/signin": { 401: "errors.bad_credentials" },
  // The TTS module answers with its own reasons: nothing to speak, text too
  // long, the synthesis service is down, the module is switched off.
  "/tts": {
    400: "tts.empty",
    413: "tts.too_long",
    502: "tts.unavailable",
    503: "tts.disabled",
  },
}

/** Fields a thrown API error may carry alongside its message. */
type ApiErrorFields = {
  status?: unknown
  statusCode?: unknown
  endpoint?: unknown
  detail?: unknown
  message?: unknown
}


/**
 * Read the fields we can use off an arbitrary thrown value.
 */
function fieldsOf(error: unknown): ApiErrorFields {
  if (typeof error !== "object" || error === null) return {}
  return error as ApiErrorFields
}


/**
 * Accept only real HTTP statuses; everything else means "no status".
 */
function toStatus(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined
}


/**
 * First non-blank string of the given fields, returned verbatim (never trimmed)
 * so an unknown server message reaches the user exactly as the backend wrote it.
 */
function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value
  }
  return undefined
}


/**
 * Path of an endpoint given either a bare path or an absolute URL.
 */
function toEndpoint(value: unknown): string | undefined {
  if (typeof value !== "string" || value === "") return undefined
  try {
    return new URL(value, "http://dim0.invalid").pathname
  } catch {
    return value
  }
}


/**
 * Locale key for an HTTP status, with an optional endpoint-specific override.
 * Pure mapping: `undefined` means "no translation known for this status".
 */
export function apiErrorKey(status: number, endpoint?: string): string | undefined {
  if (toStatus(status) === undefined) return undefined
  const byEndpoint = endpoint === undefined ? undefined : ENDPOINT_STATUS_KEYS[endpoint]
  return byEndpoint?.[status] ?? STATUS_KEYS[status]
}


/**
 * User-facing text for a failed request. Known statuses are localized; anything
 * else is passed through untouched instead of being flattened into a generic
 * message. `fallbackKey` is used only when the error carries no text at all.
 */
export function localizeApiError(error: unknown, fallbackKey: string): string {
  const fields = fieldsOf(error)
  const status = toStatus(fields.status ?? fields.statusCode)
  if (status !== undefined) {
    const key = apiErrorKey(status, toEndpoint(fields.endpoint))
    if (key !== undefined) return i18n.t(key)
  }

  const detail = firstText(fields.detail, fields.message, error)
  if (detail !== undefined) return detail

  return i18n.t(fallbackKey)
}

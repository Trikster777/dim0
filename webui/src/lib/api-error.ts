/**
 * Read the HTTP status off a thrown value, if it carries one. The API client
 * throws `ApiRequestError` for a failed response, but a network failure comes
 * as a plain `TypeError` — both must be readable the same way.
 */
export const statusOf = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null) return undefined
  const status = (error as { status?: unknown }).status
  return typeof status === "number" ? status : undefined
}

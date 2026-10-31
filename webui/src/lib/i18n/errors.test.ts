import { beforeAll, describe, expect, it } from "vitest"

import { initI18n, setLanguage } from "@/i18n"
import { apiErrorKey, localizeApiError } from "@/lib/i18n/errors"


describe("apiErrorKey", () => {
  it("maps known statuses onto errors.* keys", () => {
    expect(apiErrorKey(404)).toBe("errors.not_found")
    expect(apiErrorKey(429)).toBe("errors.rate_limited")
    expect(apiErrorKey(500)).toBe("errors.server")
  })

  it("returns undefined for a status it has no text for", () => {
    expect(apiErrorKey(418)).toBeUndefined()
  })

  it("lets the endpoint override the generic status key", () => {
    expect(apiErrorKey(401)).toBe("errors.unauthorized")
    expect(apiErrorKey(401, "/users/signin")).toBe("errors.bad_credentials")
  })
})


describe("localizeApiError", () => {
  beforeAll(async () => {
    await initI18n()
    await setLanguage("en")
  })

  it("returns the localized text for a known HTTP status", () => {
    expect(localizeApiError({ status: 404 }, "errors.server"))
      .toBe("We couldn't find what you asked for.")
  })

  it("returns an unknown detail verbatim, even when the status is known to the API", () => {
    const error = { status: 418, detail: "Board limit reached: 5 of 5 used." }
    expect(localizeApiError(error, "errors.server"))
      .toBe("Board limit reached: 5 of 5 used.")
  })

  it("returns a plain Error message verbatim", () => {
    expect(localizeApiError(new Error("Wrong password or username."), "errors.server"))
      .toBe("Wrong password or username.")
  })

  it("falls back to the caller's key when the error carries no text", () => {
    expect(localizeApiError(new Error("   "), "errors.server"))
      .toBe("The server ran into a problem. Try again.")
  })
})

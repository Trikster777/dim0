import * as React from "react"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { googleSigninWeb } from "@/api"
import { Loader2Icon } from "@/components/icons"
import { localizeApiError } from "@/lib/i18n/errors"
import { consumePendingGoogleOAuth, webGoogleRedirectUri } from "../lib/web-google"
import { useCompleteSignin } from "../hooks/use-complete-signin"


/**
 * Google OAuth redirect landing (`/signin/google/callback`). Validates the
 * returned `state` against the value stashed before the redirect (CSRF), then
 * hands the auth `code` + PKCE verifier to the backend to exchange for app
 * tokens. On success `completeSignin` routes into the app; on failure it shows
 * the error with a way back to sign-in.
 */
export function GoogleCallbackPage() {
  const { t } = useTranslation()
  const completeSignin = useCompleteSignin()
  const started = React.useRef(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    // The auth code is single-use; guard against React StrictMode's double-invoke.
    if (started.current) return
    started.current = true

    const params = new URLSearchParams(window.location.search)
    const oauthError = params.get("error")
    const code = params.get("code")
    const state = params.get("state")
    // Read + clear the stashed PKCE/state regardless, so a stale one can't linger.
    const pending = consumePendingGoogleOAuth()
    // Scrub the single-use code/state from the address bar + history immediately —
    // they're spent, and reloading this URL would re-run with a now-invalid code.
    window.history.replaceState(null, "", window.location.pathname)

    void (async () => {
      if (oauthError) return setError(t("auth.google_callback.cancelled"))
      if (!code || !state || !pending) return setError(t("auth.google_callback.incomplete"))
      if (state !== pending.state) return setError(t("auth.google_callback.security_check"))
      try {
        const token = await googleSigninWeb(code, pending.verifier, webGoogleRedirectUri())
        await completeSignin(token)
      } catch (e) {
        setError(localizeApiError(e, "auth.google_callback.error_fallback"))
      }
    })()
  }, [completeSignin, t])

  return (
    <div className="w-full max-w-md mx-auto py-16 text-center">
      {error ? (
        <div className="space-y-4">
          <p className="text-sm text-destructive">{error}</p>
          <Link
            to="/signin"
            replace
            className="inline-block text-sm font-medium text-primary underline underline-offset-4"
          >
            {t("auth.back_to_sign_in")}
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          {t("auth.google_callback.completing")}
        </div>
      )}
    </div>
  )
}

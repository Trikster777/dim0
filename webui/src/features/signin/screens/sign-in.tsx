import * as React from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Google } from "@lobehub/icons"
import { useTranslation } from "react-i18next"
import { getAuthMethods, signin } from "@/api"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Loader2Icon, LockIcon, MailIcon } from "@/components/icons"
import { localizeApiError } from "@/lib/i18n/errors"
import { PasswordInput } from "../components/password-input"
import { initiateWebGoogleSignin } from "../lib/web-google"
import { desktopGoogleSignin } from "../lib/desktop-google"
import { useCompleteSignin } from "../hooks/use-complete-signin"
import { isTauri } from "@/platform"

/** Renders the sign-in screen and routes successful authentication into the app. */
export function SigninPage() {
  const { t } = useTranslation()
  const completeSignin = useCompleteSignin()

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [googleError, setGoogleError] = React.useState<string | null>(null)
  const [googleRedirecting, setGoogleRedirecting] = React.useState(false)

  const authMethodsQuery = useQuery({
    queryKey: ["auth-methods"],
    queryFn: getAuthMethods,
  })

  const startWebGoogle = React.useCallback(async (clientId: string) => {
    setGoogleError(null)
    setGoogleRedirecting(true)
    try {
      // Navigates the top-level window to Google's consent screen; control returns
      // via the /signin/google/callback route.
      await initiateWebGoogleSignin(clientId)
    } catch (error) {
      setGoogleError(localizeApiError(error, "auth.google.error_fallback"))
      setGoogleRedirecting(false)
    }
  }, [])

  // Pressing Back from Google's consent restores this page from bfcache with the
  // "redirecting" spinner still latched — `pageshow` (fires on restore) clears it
  // so the button is usable again without a hard reload.
  React.useEffect(() => {
    const reset = () => setGoogleRedirecting(false)
    window.addEventListener("pageshow", reset)
    return () => window.removeEventListener("pageshow", reset)
  }, [])

  const localSigninMutation = useMutation({
    mutationFn: () => signin(email, password),
    onMutate: () => setGoogleError(null),
    onSuccess: completeSignin,
  })

  // Desktop: GIS can't run in the webview, so sign in via the system browser
  // (loopback + PKCE). Uses the "Desktop app" OAuth client, exchanged server-side.
  const desktopGoogleMutation = useMutation({
    mutationFn: (clientId: string) => desktopGoogleSignin(clientId),
    onMutate: () => setGoogleError(null),
    onSuccess: completeSignin,
    onError: error => {
      setGoogleError(localizeApiError(error, "auth.google.error_fallback"))
    },
  })

  const authMethods = authMethodsQuery.data
  const desktop = isTauri()
  const showLocalSignin = authMethods?.local ?? true
  // Web uses the redirect (auth-code + PKCE) flow — gated on the backend having the
  // web client secret configured (google_web_redirect). Desktop uses the
  // system-browser flow (own "Desktop app" client id). Never both.
  const showGoogleWeb = !desktop && Boolean(authMethods?.google_web_redirect && authMethods.google_client_id)
  // Desktop availability is independent of the web client — the backend only
  // returns google_desktop_client_id when the Desktop OAuth client is configured,
  // so its presence alone gates the button (a deploy may have desktop but no web).
  const showGoogleDesktop = desktop && Boolean(authMethods?.google_desktop_client_id)
  const showSeparator = showLocalSignin && (showGoogleWeb || showGoogleDesktop)
  const localError = localSigninMutation.isError
    ? localizeApiError(localSigninMutation.error, "auth.sign_in.error_fallback")
    : null

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="bg-card text-card-foreground border border-border shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex flex-col items-center justify-center gap-2">
            <img src="/dim0.svg" alt={t("auth.sign_in.logo_alt")} className="h-12 w-12 aspect-square object-contain" />
            <span className="text-muted-foreground">{t("auth.sign_in.title")}</span>
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t("auth.sign_in.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={e => {
              e.preventDefault()
              if (!showLocalSignin) return
              localSigninMutation.mutate()
            }}
          >
            {showLocalSignin ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth.email_label")}</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder={t("auth.placeholder_email")}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      autoFocus
                      className="pl-9"
                    />
                    <MailIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" strokeWidth={2} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.password_label")}</Label>
                  <div className="relative">
                    <PasswordInput
                      id="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="pl-9 pr-9"
                    />
                    <LockIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" strokeWidth={2} />
                  </div>
                </div>

                {localError ? (
                  <p className="text-sm text-destructive">
                    {localError}
                  </p>
                ) : null}

                <Button type="submit" className="w-full" disabled={localSigninMutation.isPending || authMethodsQuery.isLoading}>
                  {localSigninMutation.isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                      {t("auth.sign_in.submitting")}
                    </span>
                  ) : (
                    t("auth.sign_in.submit")
                  )}
                </Button>
              </>
            ) : null}

            {showSeparator ? (
              <div className="space-y-3">
                <Separator />
                <p className="text-center text-sm text-muted-foreground">{t("auth.or")}</p>
              </div>
            ) : null}

            {showGoogleWeb ? (
              <div className="space-y-2">
                {googleError ? (
                  <p className="text-sm text-destructive">{googleError}</p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void startWebGoogle(authMethods!.google_client_id!)}
                  disabled={googleRedirecting}
                >
                  {googleRedirecting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                      {t("auth.google.redirecting")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Google.Color size={18} />
                      {t("auth.google.continue")}
                    </span>
                  )}
                </Button>
              </div>
            ) : null}

            {showGoogleDesktop ? (
              <div className="space-y-2">
                {googleError ? (
                  <p className="text-sm text-destructive">{googleError}</p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => desktopGoogleMutation.mutate(authMethods!.google_desktop_client_id!)}
                  disabled={desktopGoogleMutation.isPending}
                >
                  {desktopGoogleMutation.isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                      {t("auth.google.continue_in_browser")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Google.Color size={18} />
                      {t("auth.google.continue")}
                    </span>
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {t("auth.google.browser_hint")}
                </p>
              </div>
            ) : null}

            {!authMethodsQuery.isLoading && !showLocalSignin && !showGoogleWeb && !showGoogleDesktop ? (
              <p className="text-sm text-destructive">
                {t("auth.sign_in.no_methods")}
              </p>
            ) : null}

            {authMethodsQuery.isError ? (
              <p className="text-sm text-destructive">
                {localizeApiError(authMethodsQuery.error, "auth.sign_in.methods_error")}
              </p>
            ) : null}

            <p className="text-center text-xs text-muted-foreground">
              {t("auth.legal.sign_in_prefix")}{" "}
              <a
                href="https://www.dim0.net/terms"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                {t("auth.legal.terms")}
              </a>{" "}
              {t("auth.legal.and")}{" "}
              <a
                href="https://www.dim0.net/privacy"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                {t("auth.legal.privacy")}
              </a>
              .
            </p>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t("auth.sign_in.no_account")}{" "}
                <Link to="/signup" className="font-medium underline">
                  {t("auth.sign_in.create_one")}
                </Link>
              </span>
              <Link to="/forgot-password" className="text-muted-foreground underline">
                {t("auth.sign_in.forgot_password")}
              </Link>
            </div>

            <div className="text-center">
              <Link to="/" className="text-sm text-muted-foreground underline underline-offset-2">
                {t("auth.sign_in.back_to_local_boards")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

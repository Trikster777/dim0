import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { Loader2Icon, MailCheckIcon } from "@/components/icons"

import { getEmailVerificationStatus, resendVerificationEmail, verifyEmailToken } from "@/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { clearTokens } from "@/features/signin/auth-storage"
import { localizeApiError } from "@/lib/i18n/errors"
import { useAppStore } from "@/store"


export function VerifyEmailPage() {
  /** Render a verification gate screen until the account email is confirmed. */
  const { t } = useTranslation()
  const navigate = useNavigate()
  const userEmail = useAppStore(s => s.userEmail)
  const setUserId = useAppStore(s => s.setUserId)
  const setUserEmail = useAppStore(s => s.setUserEmail)
  const setUserPlan = useAppStore(s => s.setUserPlan)
  const setEmailVerificationEnabled = useAppStore(s => s.setEmailVerificationEnabled)
  const setEmailVerified = useAppStore(s => s.setEmailVerified)

  const [infoMessage, setInfoMessage] = React.useState<string | null>(null)
  const triedTokenVerificationRef = React.useRef(false)

  const resendMut = useMutation({
    mutationFn: async () => resendVerificationEmail(),
    onSuccess: () => setInfoMessage(t("auth.verify_email.sent")),
  })

  const verifyTokenMut = useMutation({
    mutationFn: async (token: string) => verifyEmailToken(token),
    onSuccess: () => {
      setEmailVerificationEnabled(true)
      setEmailVerified(true)
      setInfoMessage(t("auth.verify_email.verified"))
      navigate({ to: "/", replace: true })
    },
    onError: () => {
      setInfoMessage(t("auth.verify_email.invalid_link"))
    },
  })

  const checkMut = useMutation({
    mutationFn: async () => getEmailVerificationStatus(),
    onSuccess: status => {
      setEmailVerificationEnabled(status.enabled)
      setEmailVerified(status.verified)
      if (!status.enabled || status.verified) {
        navigate({ to: "/", replace: true })
        return
      }
      setInfoMessage(t("auth.verify_email.still_unverified"))
    },
  })

  React.useEffect(() => {
    /** Auto-consume verification token when user opens email link. */
    const token = new URLSearchParams(window.location.search).get("token")
    if (!token) return
    if (triedTokenVerificationRef.current) return
    triedTokenVerificationRef.current = true
    verifyTokenMut.mutate(token)
  }, [verifyTokenMut])

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="bg-card text-card-foreground border border-border shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <MailCheckIcon className="h-6 w-6 text-secondary-foreground" />
            {t("auth.verify_email.title")}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t("auth.verify_email.sent_to_prefix")} <span className="font-medium text-foreground">{userEmail}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {resendMut.isError ? (
            <p className="text-sm text-destructive">
              {localizeApiError(resendMut.error, "auth.verify_email.resend_error")}
            </p>
          ) : null}

          {verifyTokenMut.isError ? (
            <p className="text-sm text-destructive">
              {localizeApiError(verifyTokenMut.error, "auth.verify_email.token_error")}
            </p>
          ) : null}

          {checkMut.isError ? (
            <p className="text-sm text-destructive">
              {localizeApiError(checkMut.error, "auth.verify_email.status_error")}
            </p>
          ) : null}

          {infoMessage ? (
            <p className="text-sm text-muted-foreground">{infoMessage}</p>
          ) : null}

          {verifyTokenMut.isPending ? (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              {t("auth.verify_email.verifying")}
            </p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={resendMut.isPending}
            onClick={() => {
              setInfoMessage(null)
              resendMut.mutate()
            }}
          >
            {resendMut.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2Icon className="h-4 w-4 animate-spin" />
                {t("auth.verify_email.sending")}
              </span>
            ) : (
              t("auth.verify_email.resend")
            )}
          </Button>

          <Separator />

          <Button
            type="button"
            className="w-full"
            disabled={checkMut.isPending}
            onClick={() => {
              setInfoMessage(null)
              checkMut.mutate()
            }}
          >
            {checkMut.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2Icon className="h-4 w-4 animate-spin" />
                {t("auth.verify_email.checking")}
              </span>
            ) : (
              t("auth.verify_email.continue")
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              clearTokens()
              setUserId("root")
              setUserEmail("root@localhost")
              setUserPlan("free")
              setEmailVerificationEnabled(false)
              setEmailVerified(true)
              navigate({ to: "/signin", replace: true })
            }}
          >
            {t("auth.verify_email.sign_out")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

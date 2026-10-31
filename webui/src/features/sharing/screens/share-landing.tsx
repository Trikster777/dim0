import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate, useParams } from "@tanstack/react-router"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { getAccessToken } from "@/features/signin/auth-storage"
import { useAppStore } from "@/store"
import { acceptShareLink, previewShareLink, type ShareRole } from "../api"


type Phase = "checking-auth" | "needs-signin" | "loading" | "ready" | "accepting" | "error"


/**
 * Landing route for `/share/<token>`. Three high-level paths:
 *
 *  1. Not signed in: the token is stashed in sessionStorage and the
 *     user is redirected to /signin. After auth they can click the
 *     link again (or a future polish pass can drain pending tokens
 *     automatically from the root layout).
 *  2. Signed in + link valid: render a small "X invited you to ..."
 *     panel with an Open button that consumes the link and navigates
 *     into the board.
 *  3. Link unknown / revoked: friendly error with a way back home.
 */
export function ShareLandingScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = useAppStore((s) => s.userId)
  const params = useParams({ strict: false }) as { token?: string }
  const token = params.token ?? ""
  const [phase, setPhase] = useState<Phase>("checking-auth")
  const [info, setInfo] = useState<{ graph_uid: string; role: ShareRole } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError(t("share.error.missing_token"))
      setPhase("error")
      return
    }
    if (!getAccessToken()) {
      try {
        sessionStorage.setItem("dim0:pendingShareToken", token)
      } catch {
        // Quota errors etc. — harmless to ignore.
      }
      setPhase("needs-signin")
      return
    }
    setPhase("loading")
    let cancelled = false
    previewShareLink(token)
      .then((res) => {
        if (cancelled) return
        setInfo(res)
        setPhase("ready")
      })
      .catch(() => {
        if (cancelled) return
        setError(t("share.error.inactive_link"))
        setPhase("error")
      })
    return () => {
      cancelled = true
    }
  }, [token, t])

  const onOpen = async () => {
    setPhase("accepting")
    try {
      const result = await acceptShareLink(token)
      // Best-effort: clear the pending-token marker since we used it.
      try {
        sessionStorage.removeItem("dim0:pendingShareToken")
      } catch {
        // ignore
      }
      if (!result.already_member) {
        toast.success(
          t("share.toast.added", { role: result.role }),
        )
      }
      // Refresh the sidebar's "Shared with me" section — without
      // this, the newly-accessible board doesn't show up until a
      // full page reload. Triggered after the accept regardless of
      // already_member, since membership-role can also change.
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ["listBoards", userId] })
      }
      navigate({ to: "/boards/$id", params: { id: result.graph_uid } })
    } catch {
      setError(t("share.error.accept"))
      setPhase("error")
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border border-border bg-background p-6 shadow-md">
        {phase === "checking-auth" || phase === "loading" ? (
          <Status text={t("share.checking_invitation")} />
        ) : phase === "needs-signin" ? (
          <SignInPanel onGoSignIn={() => navigate({ to: "/signin" })} />
        ) : phase === "ready" && info ? (
          <ReadyPanel role={info.role} onOpen={onOpen} />
        ) : phase === "accepting" ? (
          <Status text={t("share.joining")} />
        ) : (
          <ErrorPanel
            message={error ?? t("share.error.unknown")}
            onGoHome={() => navigate({ to: "/" })}
          />
        )}
      </div>
    </div>
  )
}


function Status({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}


function SignInPanel({ onGoSignIn }: { onGoSignIn: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <h1 className="text-lg font-semibold">{t("share.signin_panel.title")}</h1>
      <p className="text-sm text-muted-foreground">
        {t("share.signin_panel.description")}
      </p>
      <Button onClick={onGoSignIn} className="mt-2">
        {t("share.signin_panel.submit")}
      </Button>
    </div>
  )
}


function ReadyPanel({ role, onOpen }: { role: ShareRole; onOpen: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <h1 className="text-lg font-semibold">{t("share.ready.title")}</h1>
      <p className="text-sm text-muted-foreground">
        {role === "member"
          ? t("share.ready.member")
          : t("share.ready.viewer")}
      </p>
      <Button onClick={onOpen} className="mt-2">
        {t("share.ready.open")}
      </Button>
    </div>
  )
}


function ErrorPanel({ message, onGoHome }: { message: string; onGoHome: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <h1 className="text-lg font-semibold">{t("share.error_panel.title")}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="secondary" onClick={onGoHome} className="mt-2">
        {t("share.error_panel.back_home")}
      </Button>
    </div>
  )
}

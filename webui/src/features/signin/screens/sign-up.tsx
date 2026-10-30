import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { useNavigate, Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { decodeJwt, resolveBillingPlan } from "@/lib/decode-jwt"
import { useAppStore } from "@/store"
import { getEmailVerificationStatus, signup } from "@/api"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Loader2Icon, LockIcon, MailIcon, UserProfileIcon, UserSquareIcon } from "@/components/icons"
import { localizeApiError } from "@/lib/i18n/errors"
import { PasswordInput } from "../components/password-input"
import { PasswordStrengthMeter } from "../components/password-strength-meter"
import { getPasswordStrength } from "../lib/password-strength"

/** Renders the sign-up screen and creates a new account after validation passes. */
export function SignupPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setUserId = useAppStore(s => s.setUserId)
  const setUserEmail = useAppStore(s => s.setUserEmail)
  const setUserPlan = useAppStore(s => s.setUserPlan)
  const setEmailVerificationEnabled = useAppStore(s => s.setEmailVerificationEnabled)
  const setEmailVerified = useAppStore(s => s.setEmailVerified)

  const [name, setName] = React.useState("")
  const [username, setUsername] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [passwordError, setPasswordError] = React.useState<string | null>(null)
  const passwordStrength = React.useMemo(() => getPasswordStrength(password), [password])
  const canSubmit = passwordStrength.isValid

  const mut = useMutation({
    mutationFn: () => signup({ email, password, name, username }),
    onSuccess: async token => {
      const p = decodeJwt(token.access_token)
      if (p.sub) setUserId(String(p.sub))
      if (typeof p.email === "string") setUserEmail(p.email)
      setUserPlan(resolveBillingPlan(p))
      const status = await getEmailVerificationStatus()
      setEmailVerificationEnabled(status.enabled)
      setEmailVerified(status.verified)
      if (status.enabled && !status.verified) {
        navigate({ to: "/verify-email", replace: true })
        return
      }
      navigate({ to: "/chats", replace: true })
    }
  })

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="bg-card text-card-foreground border border-border shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("auth.sign_up.title")}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t("auth.sign_up.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={e => {
              e.preventDefault()
              if (!passwordStrength.isValid) {
                setPasswordError(t("auth.weak_password"))
                return
              }
              setPasswordError(null)
              mut.mutate()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">{t("auth.name_label")}</Label>
              <div className="relative">
                <Input
                  id="name"
                  placeholder={t("auth.placeholder_name")}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="pl-9"
                />
                <UserProfileIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" strokeWidth={2} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">{t("auth.username_label")}</Label>
              <div className="relative">
                <Input
                  id="username"
                  placeholder={t("auth.placeholder_username")}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="pl-9"
                />
                <UserSquareIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" strokeWidth={2} />
              </div>
            </div>

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
                  autoComplete="new-password"
                  className="pl-9 pr-9"
                />
                <LockIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" strokeWidth={2} />
              </div>
              <PasswordStrengthMeter password={password} />
            </div>

            {passwordError ? (
              <p className="text-sm text-destructive">{passwordError}</p>
            ) : null}

            {mut.isError ? (
              <p className="text-sm text-destructive">
                {localizeApiError(mut.error, "auth.sign_up.error_fallback")}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={mut.isPending || !canSubmit}>
              {mut.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  {t("auth.sign_up.submitting")}
                </span>
              ) : (
                t("auth.sign_up.submit")
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              {t("auth.legal.sign_up_prefix")}{" "}
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

            <Separator />

            <p className="text-sm text-muted-foreground">
              {t("auth.sign_up.have_account")}{" "}
              <Link to="/signin" className="font-medium underline">
                {t("auth.sign_up.sign_in")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

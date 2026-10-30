import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { forgotPassword } from "@/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2Icon, MailIcon } from "@/components/icons"
import { localizeApiError } from "@/lib/i18n/errors"


/** Renders the forgot-password screen and submits a reset-link request. */
export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = React.useState("")

  const mut = useMutation({
    mutationFn: () => forgotPassword(email),
  })

  const submitted = mut.isSuccess

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="bg-card text-card-foreground border border-border shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("auth.forgot_password.title")}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t("auth.forgot_password.description")}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {submitted ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("auth.forgot_password.sent_prefix")} <span className="font-medium text-foreground">{email}</span>,{" "}
                {t("auth.forgot_password.sent_suffix")}
              </p>
              <Link
                to="/signin"
                className="block w-full text-center text-sm font-medium underline underline-offset-2"
              >
                {t("auth.back_to_sign_in")}
              </Link>
            </div>
          ) : (
            <form
              className="space-y-5"
              onSubmit={e => {
                e.preventDefault()
                mut.mutate()
              }}
            >
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

              {mut.isError ? (
                <p className="text-sm text-destructive">
                  {localizeApiError(mut.error, "auth.forgot_password.error_fallback")}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={mut.isPending}>
                {mut.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    {t("auth.forgot_password.sending")}
                  </span>
                ) : (
                  t("auth.forgot_password.submit")
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                {t("auth.forgot_password.remembered_it")}{" "}
                <Link to="/signin" className="font-medium underline">
                  {t("auth.back_to_sign_in")}
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

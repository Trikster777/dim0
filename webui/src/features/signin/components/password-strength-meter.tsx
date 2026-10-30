import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { getPasswordStrength, type PasswordStrength } from "../lib/password-strength"


type PasswordStrengthMeterProps = {
  password: string
}


/** Locale keys for the strength label produced by `getPasswordStrength`. */
const LABEL_KEYS: Record<PasswordStrength["label"], string> = {
  "Very weak": "auth.password_strength.very_weak",
  "Weak": "auth.password_strength.weak",
  "Fair": "auth.password_strength.fair",
  "Good": "auth.password_strength.good",
  "Strong": "auth.password_strength.strong",
}


export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const { t } = useTranslation()

  if (!password) return null

  const strength = getPasswordStrength(password)

  const activeColor =
    strength.score <= 1
      ? "bg-destructive"
      : strength.score <= 3
        ? "bg-amber-500"
        : "bg-emerald-500"

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, index) => {
          const active = index < strength.score
          return (
            <div
              key={index}
              className={cn(
                "h-1 w-full rounded-full transition-colors",
                active ? activeColor : "bg-muted"
              )}
            />
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {t("auth.password_strength.label")} <span className="font-medium text-foreground">{t(LABEL_KEYS[strength.label])}</span>
      </p>

      <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
        <span className={strength.checks.minLength ? "text-emerald-600 dark:text-emerald-400" : undefined}>
          {strength.checks.minLength ? "✓" : "•"} {t("auth.password_strength.check_min_length")}
        </span>
        <span className={strength.checks.hasUppercase ? "text-emerald-600 dark:text-emerald-400" : undefined}>
          {strength.checks.hasUppercase ? "✓" : "•"} {t("auth.password_strength.check_uppercase")}
        </span>
        <span className={strength.checks.hasLowercase ? "text-emerald-600 dark:text-emerald-400" : undefined}>
          {strength.checks.hasLowercase ? "✓" : "•"} {t("auth.password_strength.check_lowercase")}
        </span>
        <span className={strength.checks.hasNumber ? "text-emerald-600 dark:text-emerald-400" : undefined}>
          {strength.checks.hasNumber ? "✓" : "•"} {t("auth.password_strength.check_number")}
        </span>
        <span className={strength.checks.hasSpecial ? "text-emerald-600 dark:text-emerald-400" : undefined}>
          {strength.checks.hasSpecial ? "✓" : "•"} {t("auth.password_strength.check_special")}
        </span>
      </div>
    </div>
  )
}

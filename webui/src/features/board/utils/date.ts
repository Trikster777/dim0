// utils/formatDistanceToNow.ts
import { i18n } from "@/i18n"


export function formatDistanceToNow(
  isoDate?: string | null
): { text: string | undefined, tooltip: string | undefined } {
  if (!isoDate) {
    return { text: undefined, tooltip: undefined }
  }

  const date = new Date(isoDate)
  if (isNaN(date.getTime())) {
    // Invalid date string
    return { text: undefined, tooltip: undefined }
  }

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  let text: string
  if (seconds < 60) {
    text = i18n.t("harness.relative.seconds", { count: seconds })
  } else if (minutes < 60) {
    text = i18n.t("harness.relative.minutes", { count: minutes })
  } else if (hours < 24) {
    text = i18n.t("harness.relative.hours", { count: hours })
  } else if (days < 7) {
    text = i18n.t("harness.relative.days", { count: days })
  } else if (weeks < 5) {
    text = i18n.t("harness.relative.weeks", { count: weeks })
  } else if (months < 12) {
    text = i18n.t("harness.relative.months", { count: months })
  } else {
    text = i18n.t("harness.relative.years", { count: years })
  }

  // Tooltip full date (localized, human-friendly)
  const tooltip = date.toLocaleString(i18n.language || undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return { text, tooltip }
}

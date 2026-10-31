import { type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import { cn } from "@/lib/utils"
import { i18n } from "@/i18n"


export type NodeFooterStatus = "idle" | "pending" | "saving" | "saved" | "error"


export type NodeFooterProps = {
  /** Save state pill rendered on the right. */
  status?: NodeFooterStatus
  /** ISO timestamp of last edit. Formatted as a short relative string. */
  updatedAt?: string
  /** Left-aligned content (chips, badges, status descriptors). */
  children?: ReactNode
  className?: string
}


const STATUS_LABEL_KEY: Record<NodeFooterStatus, string> = {
  idle: "",
  pending: "harness.footer.edited",
  saving: "harness.footer.saving",
  saved: "harness.footer.saved",
  error: "harness.footer.save_failed",
}


const STATUS_CLASS: Record<NodeFooterStatus, string> = {
  idle: "text-muted-foreground",
  pending: "text-amber-600 dark:text-amber-400",
  saving: "text-muted-foreground",
  saved: "text-emerald-600 dark:text-emerald-400",
  error: "text-destructive",
}


/**
 * Footer chrome for custom node views — relative timestamp + save
 * status pill on the right, free-form children on the left.
 */
export function NodeFooter({ status, updatedAt, children, className }: NodeFooterProps) {
  const { t } = useTranslation()
  const labelKey = status ? STATUS_LABEL_KEY[status] : ""
  const label = labelKey ? t(labelKey) : ""

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-t border-border/40 px-2 py-1 text-xs text-muted-foreground",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 truncate">{children}</div>
      <div className="flex items-center gap-2">
        {updatedAt ? <span className="truncate">{formatRelative(updatedAt, t)}</span> : null}
        {label && status ? <span className={STATUS_CLASS[status]}>{label}</span> : null}
      </div>
    </div>
  )
}


/** Tiny relative-time helper. Avoids pulling in date-fns for one call site. */
const formatRelative = (iso: string, t: TFunction): string => {
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return ""
  const diff = Date.now() - time
  if (diff < 60_000) return t("harness.footer.just_now")
  if (diff < 3_600_000) {
    return t("harness.footer.minutes_ago", { count: Math.floor(diff / 60_000) })
  }
  if (diff < 86_400_000) {
    return t("harness.footer.hours_ago", { count: Math.floor(diff / 3_600_000) })
  }
  return new Date(time).toLocaleDateString(i18n.language || undefined)
}

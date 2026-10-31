import { CheckIcon, CopyActionIcon } from "@/components/icons"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import clsx from "clsx"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"


/**
 * Button component to copy the assistant's answer to the clipboard.
 * Renders icon-only with a tooltip when `compact` is set; otherwise shows icon + "Copy" label.
 */
export const CopyAnswer = ({ answer, compact = false }: { answer: string, compact?: boolean }) => {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const actionLabel = t("agent.copy.current_answer")

  const handleCopy = () => {
    void navigator.clipboard.writeText(answer).then(() => {
      setCopied(true)
      toast(t("agent.copy.copied"))
      setTimeout(() => setCopied(false), 2000) // Reset after 2 seconds
    })
  }

  const Icon = copied ? CheckIcon : CopyActionIcon

  const buttonEl = (
    <button
      className={clsx(
        "transition-all text-muted-foreground hover:text-foreground flex flex-row items-center rounded-md",
        compact ? "justify-center size-8" : "text-xs gap-2 p-1",
      )}
      onClick={handleCopy}
      aria-label={actionLabel}
      title={actionLabel}
    >
      <Icon className='size-4 shrink-0' strokeWidth={2} weight={compact ? "duotone" : undefined} />
      {!compact && <span>{t("agent.copy.label")}</span>}
    </button>
  )

  if (!compact) return buttonEl

  return (
    <Tooltip>
      <TooltipTrigger asChild>{buttonEl}</TooltipTrigger>
      <TooltipContent side='left'>{t("agent.copy.label")}</TooltipContent>
    </Tooltip>
  )
}

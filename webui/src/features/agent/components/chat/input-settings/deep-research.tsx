import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ResearchIcon } from "@/components/icons"
import { useChatStore } from "@/features/agent/store/chat-store"
import { clsx } from "clsx"
import { useTranslation } from "react-i18next"

// Component that allows users to enable or disable the deep research tool
export const DeepResearchChoiceMenu = () => {
  const { t } = useTranslation()
  const useDeepResearch = useChatStore((state) => state.useDeepResearch)
  const setUseDeepResearch = useChatStore((state) => state.setUseDeepResearch)

  const handleToggle = () => {
    setUseDeepResearch(!useDeepResearch)
  }

  const tooltipText = useDeepResearch
    ? t("agent.settings.disable_research")
    : t("agent.settings.enable_research")

  const buttonClass = clsx(
    "transition-all shrink-0 my-icon p-2 rounded-md hover:bg-accent dark:bg-input/30 dark:hover:bg-accent/50 text-xs flex flex-row items-center gap-2 border border-transparent hover:border-border transition-colors",
    useDeepResearch ? '!text-secondary-foreground' : 'text-muted-foreground'
  )

  return (
    <Tooltip delayDuration={400}>
      <div className="rounded-md bg-background backdrop-blur-md supports-[backdrop-filter]:bg-sidebar/50">
        <TooltipTrigger asChild>
          <button
            className={buttonClass}
            onClick={handleToggle}
          >
            <ResearchIcon className='size-4 shrink-0' strokeWidth={2} />
            <span className='sr-only'>{t("agent.settings.research_label")}</span>
          </button>
        </TooltipTrigger>
      </div>
      <TooltipContent>
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  )
}

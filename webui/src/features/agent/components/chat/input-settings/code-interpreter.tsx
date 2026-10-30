import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CodeInterpreterIcon } from "@/components/icons"
import { useChatStore } from "@/features/agent/store/chat-store"
import clsx from "clsx"
import { useTranslation } from "react-i18next"
import { useShallow } from "zustand/shallow"


/**
 * Button component to toggle the Code Interpreter tool in the chat interface.
 */
export const CodeInterpreterChoiceMenu = () => {
  const { t } = useTranslation()
  const codeService = useChatStore(useShallow((state) => state.services.code.find((s) => s.name === "openai")))
  const enabledTools = useChatStore(useShallow((state) => state.enabledTools))
  const setEnabledTools = useChatStore((state) => state.setEnabledTools)

  const isEnabled = enabledTools.includes("code_interpreter")
  const isAvailable = codeService?.available || false

  const message = isAvailable
    ? (isEnabled ? t("agent.settings.disable_code") : t("agent.settings.enable_code"))
    : t("agent.settings.code_unavailable")

  const toggleCodeInterpreter = () => {
    if (isEnabled) {
      setEnabledTools(enabledTools.filter((tool) => tool !== "code_interpreter"))
    } else {
      setEnabledTools([...enabledTools, "code_interpreter"])
    }
  }

  const buttonClass = clsx(
    "transition-all w-full my-icon px-2 py-1.5 rounded-md hover:bg-accent dark:hover:bg-accent/50 border border-transparent hover:border-border transition-colors flex flex-row items-center gap-2 text-left text-muted-foreground"
  )
  const iconClass = clsx(
    "size-4 shrink-0",
    isEnabled ? "text-secondary-foreground" : "text-muted-foreground"
  )

  return (
    <Tooltip delayDuration={400}>
      <div className="w-full">
        <TooltipTrigger asChild>
          <button
            className={buttonClass}
            onClick={toggleCodeInterpreter}
            aria-label={t("agent.settings.toggle_code")}
            title={t("agent.settings.toggle_code")}
          >
            <CodeInterpreterIcon className={iconClass} strokeWidth={2} />
            <span className="text-xs">{t("agent.settings.code_label")}</span>
          </button>
        </TooltipTrigger>
      </div>
      <TooltipContent>
        {message}
      </TooltipContent>
    </Tooltip>
  )
}

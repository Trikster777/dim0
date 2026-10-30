import { GlobeIcon, CodeInterpreterIcon, BrowserSearchIcon } from "@/components/icons"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToolConfirm, type ToolConfirmRequest } from "@/features/agent/engine/tool-confirm-store"


const asString = (value: unknown): string => (typeof value === "string" ? value : "")


/** Human-facing copy keys + preview for a pending off-board tool request. */
const describe = (req: ToolConfirmRequest): { title: string; hint: string; preview: string; Icon: typeof GlobeIcon } => {
  if (req.name === "fetch") {
    return {
      title: "agent.tool_confirm.allow_fetch_title",
      hint: "agent.tool_confirm.allow_fetch_hint",
      preview: asString(req.args.url),
      Icon: GlobeIcon,
    }
  }
  if (req.name === "web_search") {
    return {
      title: "agent.tool_confirm.allow_search_title",
      hint: "agent.tool_confirm.allow_search_hint",
      preview: asString(req.args.query),
      Icon: BrowserSearchIcon,
    }
  }
  return {
    title: "agent.tool_confirm.allow_code_title",
    hint: "agent.tool_confirm.allow_code_hint",
    preview: asString(req.args.code),
    Icon: CodeInterpreterIcon,
  }
}


/**
 * Confirmation for off-board agent tools (`fetch` / `web_search` / `code_interpreter`).
 * Mounted at the board level whenever the browser engine runs (LocalBoardScreen
 * for local boards, BoardView for synced ones); shows the exact URL/query/code
 * and pauses the run until the user decides (see `useToolConfirm` + the agent
 * loop's CONFIRM_TOOLS). The preview is plain text — never HTML — so it can't
 * inject markup.
 */
export const ToolConfirmDialog = () => {
  const { t } = useTranslation()
  const pending = useToolConfirm((s) => s.pending)
  const resolve = useToolConfirm((s) => s.resolve)
  if (!pending) return null

  const { title, hint, preview, Icon } = describe(pending)

  return (
    <AlertDialog open onOpenChange={(open) => !open && resolve("deny")}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon className="size-4 shrink-0 text-primary" strokeWidth={2} />
            {t(title)}
          </AlertDialogTitle>
          <AlertDialogDescription>{t(hint)}</AlertDialogDescription>
        </AlertDialogHeader>
        {preview && (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/40 p-2 text-xs">
            {preview}
          </pre>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => resolve("deny")}>{t("agent.tool_confirm.deny")}</AlertDialogCancel>
          {/* "Allow once" gates the next call again; "Allow for this request"
              auto-approves further calls to this tool for the rest of the run. */}
          <Button variant="outline" onClick={() => resolve("once")}>{t("agent.tool_confirm.allow_once")}</Button>
          <Button onClick={() => resolve("always")}>{t("agent.tool_confirm.allow_for_request")}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

import { useTranslation } from "react-i18next"
import { CloudCheckIcon, MonitorIcon } from "@/components/icons"
import type { BoardKind } from "@/features/board/model"


/**
 * Small pill telling a board apart at a glance: `local-only` → "On device"
 * (monitor glyph), `synced` → "Synced" (cloud glyph). Shown on dashboard cards
 * so the local/remote distinction is per-board, not just group-header deep.
 */
export function BoardKindBadge({ kind }: { kind: BoardKind }) {
  const { t } = useTranslation()
  const synced = kind === "synced"
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium " +
        (synced
          ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
          : "bg-muted text-muted-foreground")
      }
      title={synced ? t("board.card.kind_synced_title") : t("board.card.kind_local_title")}
    >
      {synced ? (
        <CloudCheckIcon className="size-3 shrink-0" strokeWidth={2} />
      ) : (
        <MonitorIcon className="size-3 shrink-0" strokeWidth={2} />
      )}
      {synced ? t("board.card.kind_synced") : t("board.card.kind_local")}
    </span>
  )
}

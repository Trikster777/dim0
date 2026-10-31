import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "@tanstack/react-router"
import { ChevronDownIcon, NoteIcon } from "@/components/icons"
import { centerNoteSearch } from "@/features/board/utils/center-note"
import { useBoardAppStore } from "@/features/board/harness/store/board-app-store"
import type { NoteSource } from "../../utils/note-sources"


/**
 * One cited note. The row itself jumps to the node — recenter + open its folder
 * layer (`centerNoteSearch`: `root_id` opens the layer, `center` selects +
 * centers via useCenterFromUrl) — cross-folder aware, since whole-board search
 * can surface notes in other layers. The chevron expands the snippets that
 * grounded the answer, kept separate so a row click always navigates.
 */
const NoteSourceItem = ({ source }: { source: NoteSource }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setViewMode = useBoardAppStore((s) => s.setViewMode)
  const [open, setOpen] = useState(false)

  const noteLabel = source.label || t("agent.note_tool.untitled_note")

  const locate = (): void => {
    // Surface the board first — the chat can be open over files/list view, where
    // the canvas (and useCenterFromUrl) isn't showing, so the URL patch alone
    // would no-op.
    setViewMode("board")
    void navigate({ to: ".", replace: true, search: centerNoteSearch(source.parentId, source.noteId) })
  }

  return (
    <div className="rounded-lg border border-border/60 bg-transparent">
      <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
        <button
          type="button"
          onClick={locate}
          title={t("agent.sources.find_on_board")}
          aria-label={t("agent.sources.find_note_aria", { label: noteLabel })}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left hover:text-secondary-foreground"
        >
          <NoteIcon className="size-3.5 shrink-0 text-primary" strokeWidth={2} />
          <span className="truncate text-primary">{noteLabel}</span>
        </button>
        {source.snippets.length > 0 && (
          <button
            type="button"
            aria-label={open ? t("agent.sources.hide_snippets") : t("agent.sources.show_snippets")}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-secondary-foreground"
          >
            <ChevronDownIcon className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2} />
          </button>
        )}
      </div>
      {open && source.snippets.length > 0 && (
        <div className="space-y-2 px-3 pb-2 pt-1">
          {source.snippets.map((p, i) => (
            <p key={i} className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
              {p}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}


/**
 * Notes an answer cited — the board notes `search_notes` surfaced this turn,
 * keyed by node id. Clicking a row jumps to the node on the board.
 */
export const NoteSourcesView = ({ sources }: { sources: NoteSource[] }) => {
  const { t } = useTranslation()
  if (sources.length === 0) return null

  return (
    <div className="mt-2 min-w-0 space-y-1">
      <div className="ml-1 flex items-center gap-1 text-xs font-mono text-muted-foreground">
        <NoteIcon className="size-4 shrink-0 text-primary" strokeWidth={2} />
        <span className="text-primary">{t("agent.sources.notes")}</span>
      </div>
      {sources.map((s) => (
        <NoteSourceItem key={s.noteId} source={s} />
      ))}
    </div>
  )
}

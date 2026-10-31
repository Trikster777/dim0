import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel,
  ContextMenuSeparator, ContextMenuTrigger
} from "@/components/ui/context-menu"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { useConvertToMindMap } from "@/features/board/api/convert-to-mindmap"
import { useCreateBoard } from "@/features/board/api/create-board"
import { useListBoards } from "@/features/board/api/list-boards"
import { untitledLabel } from "@/features/board/const"
import { useBoardAppStore } from "@/features/board/harness/store/board-app-store"
import {
  CancelStatusIcon,
  CheckCircleStatusIcon,
  CircleNotchIcon,
  NotebookIcon,
  SchemaMapIcon,
  TreeMapIcon,
  type AppIconComponent,
} from "@/components/icons"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useNavigate } from "@tanstack/react-router"
import clsx from "clsx"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useAppStore } from "@/store"
import { useIsLocalBoard } from "@/features/board/lib/use-is-local-board"
import { useLocalTransform } from "@/features/agent/local/use-local-transform"


// Spinner icon for loading state
const LoadingIcon = () => (
  <CircleNotchIcon
    className="size-4 animate-spin [animation-duration:750ms]"
    strokeWidth={2}
  />
)

const SuccessIcon = () => (
  <CheckCircleStatusIcon
    className="text-foreground size-4"
    strokeWidth={2}
  />
)

const ErrorIcon = () => (
  <CancelStatusIcon
    className="text-destructive size-4"
    strokeWidth={2}
  />
)


export interface SaveAsNoteProps {
  message: string
  type: "notify" | "mapify" | "schemify"
  saveAsIs?: boolean
  boardId?: string
  useAnchors?: boolean
  compact?: boolean
}


// Button that generates a mind map from the given message.
export const SaveAsNote = ({
  message,
  type,
  saveAsIs = false,
  boardId,
  useAnchors = false,
  compact = false,
}: SaveAsNoteProps) => {
  const { t } = useTranslation()
  const [processing, setProcessing] = useState<boolean>(false)
  const userId = useAppStore(s => s.userId)
  const rootId = useBoardAppStore(state => state.rootId) ?? undefined

  const { convertToMindMapAsync } = useConvertToMindMap()
  const { data: boardList } = useListBoards(userId)
  const { createBoardAsync } = useCreateBoard()
  const isLocal = useIsLocalBoard()
  const runLocalTransform = useLocalTransform()

  const navigate = useNavigate()

  /**
   * Navigate to a board, preserving the current subfolder context when present.
   */
  const goToBoard = (targetBoardId: string) => {
    void navigate({
      to: '/boards/$id',
      params: { id: targetBoardId },
      search: rootId
        ? (prev: Record<string, unknown>) => ({ ...prev, root_id: rootId })
        : undefined,
    })
  }

  const ensureMessage = () => {
    if (!message.trim()) {
      toast.error(t("agent.save_note.no_message"))
      return false
    }
    return true
  }

  // Local board: run the in-browser transform on the current canvas (no backend,
  // no cross-board picker — everything happens on the board you're looking at).
  const launchLocal = async () => {
    if (!ensureMessage() || processing) return
    setProcessing(true)
    const id = toast(`${label}…`, { icon: <LoadingIcon />, duration: Infinity })
    try {
      const { ok } = await runLocalTransform(type, message)
      toast.dismiss(id)
      if (ok) toast.success(t("agent.save_note.added"), { icon: <SuccessIcon />, duration: 3000 })
      else toast.error(t("agent.save_note.nothing_created"), { icon: <ErrorIcon />, duration: 4000 })
    } catch (error) {
      console.error("Local transform failed:", error)
      toast.dismiss(id)
      toast.error(t("agent.save_note.local_failed"), { icon: <ErrorIcon />, duration: 4000 })
    } finally {
      setProcessing(false)
    }
  }

  // Launch on an existing board, with loading/success/error toasts
  const launchGeneration = async (boardId: string) => {
    if (!ensureMessage()) return
    if (processing) return

    setProcessing(true)
    const startedAt = Date.now()
    const formatElapsed = () => String(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    const id = toast(t("agent.save_note.rewriting", { elapsed: formatElapsed() }), {
      icon: <LoadingIcon />,
      duration: Infinity
    })
    const timer = window.setInterval(() => {
      toast(t("agent.save_note.rewriting", { elapsed: formatElapsed() }), {
        id,
        icon: <LoadingIcon />,
        duration: Infinity
      })
    }, 1000)
    try {
      await convertToMindMapAsync({
        boardId,
        answer: message,
        toolType: type,
        saveAsIs,
        useAnchors
      })
      window.clearInterval(timer)
      toast.dismiss(id)
      const finalElapsed = formatElapsed()
      toast.success(t("agent.save_note.notes_updated", { elapsed: finalElapsed }), {
        icon: <SuccessIcon />,
        duration: 3000,
        action: {
          label: t("agent.save_note.go_to_board"),
          onClick: () => {
            goToBoard(boardId)
          }
        }
      })
    } catch (error) {
      console.error("Error converting to mind map:", error)
      window.clearInterval(timer)
      toast.dismiss(id)
      const finalElapsed = formatElapsed()
      toast.error(t("agent.save_note.rewrite_failed", { elapsed: finalElapsed }), {
        icon: <ErrorIcon />,
        duration: 4000
      })
    } finally {
      window.clearInterval(timer)
      setProcessing(false)
    }
  }

  // Create a new board, then generate — one toast sequence for the whole flow
  const createAndLaunch = async () => {
    if (!ensureMessage()) return
    if (processing) return

    setProcessing(true)
    const startedAt = Date.now()
    const formatElapsed = () => String(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    const id = toast(
      t("agent.save_note.creating", { elapsed: formatElapsed() }),
      {
        icon: <LoadingIcon />,
        duration: Infinity
      }
    )
    const timer = window.setInterval(() => {
      toast(t("agent.save_note.creating", { elapsed: formatElapsed() }), {
        id,
        icon: <LoadingIcon />,
        duration: Infinity
      })
    }, 1000)
    try {
      const boardId = await createBoardAsync()
      await convertToMindMapAsync({ boardId, answer: message, toolType: type, saveAsIs, useAnchors })
      window.clearInterval(timer)
      toast.dismiss(id)
      const finalElapsed = formatElapsed()
      toast.success(
        t("agent.save_note.notes_updated", { elapsed: finalElapsed }),
        {
          icon: <SuccessIcon />,
          duration: 3000,
          action: {
            label: t("agent.save_note.go_to_board"),
            onClick: () => {
              goToBoard(boardId)
            }
          }
        }
      )
    } catch (error) {
      console.error("Error creating board or converting to mind map:", error)
      window.clearInterval(timer)
      toast.dismiss(id)
      const finalElapsed = formatElapsed()
      toast.error(
        t("agent.save_note.create_failed", { elapsed: finalElapsed }),
        {
          icon: <ErrorIcon />,
          duration: 4000
        })
    } finally {
      window.clearInterval(timer)
      setProcessing(false)
    }
  }

  const label = type === "notify"
    ? t("agent.save_note.type_notify")
    : type === "mapify"
      ? t("agent.save_note.type_mapify")
      : t("agent.save_note.type_schemify")
  const Icon: AppIconComponent = type === "notify"
    ? NotebookIcon
    : type === "mapify"
      ? TreeMapIcon
      : SchemaMapIcon
  const actionLabel = type === "notify"
    ? t("agent.save_note.aria_notify")
    : type === "mapify"
    ? t("agent.save_note.aria_mapify")
    : t("agent.save_note.aria_schemify")

  const buttonClass = clsx(
    "transition-all text-muted-foreground hover:text-foreground flex flex-row items-center rounded-md",
    compact ? "justify-center size-8" : "text-xs gap-2 p-1",
    processing && "opacity-75 pointer-events-none"
  )

  const iconCpn = processing ?
    <LoadingIcon /> :
    <Icon className="size-4" strokeWidth={2} weight={compact ? "duotone" : undefined} />

  const dropdownTrigger = (
    <DropdownMenuTrigger asChild>
      <button
        className={buttonClass}
        aria-label={actionLabel}
        title={actionLabel}
      >
        {iconCpn}
        {!compact && <span>{label}</span>}
      </button>
    </DropdownMenuTrigger>
  )

  const contextTrigger = (
    <ContextMenuTrigger asChild>
      <button
        className={buttonClass}
        onClick={() => boardId && launchGeneration(boardId)}
        aria-label={actionLabel}
        title={actionLabel}
      >
        {iconCpn}
        {!compact && <span>{label}</span>}
      </button>
    </ContextMenuTrigger>
  )

  const withTooltip = (trigger: React.ReactNode) =>
    compact ? (
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side='left'>{label}</TooltipContent>
      </Tooltip>
    ) : (
      trigger
    )

  // Local board: a plain button that runs the in-browser transform on the
  // current canvas — no board picker (other boards aren't in this store).
  if (isLocal) {
    return withTooltip(
      <button className={buttonClass} onClick={launchLocal} aria-label={actionLabel} title={actionLabel}>
        {iconCpn}
        {!compact && <span>{label}</span>}
      </button>,
    )
  }

  return (
    <>
      {!boardId ? (
        <DropdownMenu>
          {withTooltip(dropdownTrigger)}
          <DropdownMenuContent className="w-48">
            <DropdownMenuLabel>{t("agent.save_note.boards")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="bg-accent/50" onClick={createAndLaunch}>
              <span>{t("agent.save_note.create_new_board")}</span>
            </DropdownMenuItem>
            {boardList?.map((board) => (
              <DropdownMenuItem key={board.uid} onClick={() => launchGeneration(board.uid)}>
                {board.label || untitledLabel()}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <ContextMenu>
          {withTooltip(contextTrigger)}
          <ContextMenuContent className="w-48">
            <ContextMenuLabel>{t("agent.save_note.select_board")}</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuItem className="bg-accent/50" onClick={createAndLaunch}>
              <span>{t("agent.save_note.create_new_board")}</span>
            </ContextMenuItem>
            {boardList?.map((board) => (
              <ContextMenuItem key={board.uid} onClick={() => launchGeneration(board.uid)}>
                {board.label || untitledLabel()}
              </ContextMenuItem>
            ))}
          </ContextMenuContent>
        </ContextMenu>
      )}
    </>
  )
}

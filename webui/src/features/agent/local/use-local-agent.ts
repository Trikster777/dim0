import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { getCanvasStoreRef } from "@/features/board/harness/canvas-store-ref"
import { runAgent } from "@/features/agent/engine/agent-loop"
import { resolveAgentLlm } from "@/features/agent/engine/services/local-llm"
import { createNote, linkNotes, updateNote } from "@/features/agent/engine/tools"
import type { AgentEvent } from "@/features/agent/engine/types"
import { useByokStore } from "@/features/agent/byok/byok-store"


// v1 toolset: the build tools (create/update/link) over the local store.
// search_notes / list_boards land once their ctx (search/registry) is wired.
const BUILD_TOOLS = [createNote, updateNote, linkNotes]


/** Run the frontend agent against the live local board via BYOK. */
export function useLocalAgent() {
  const { t } = useTranslation()
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const asConfig = useByokStore((s) => s.asConfig)

  const send = useCallback(
    async (prompt: string): Promise<void> => {
      const store = getCanvasStoreRef()
      if (!store) {
        setError(t("agent.local.no_active_board"))
        return
      }
      const config = asConfig()
      if (!config) {
        setError(t("agent.local.set_key_first"))
        return
      }
      setError(null)
      setRunning(true)
      setEvents([])
      try {
        const llm = resolveAgentLlm(config, { signedIn: false })
        if (!llm) {
          setError(t("agent.local.set_key_first"))
          return
        }
        for await (const ev of runAgent({ userMessage: prompt, tools: BUILD_TOOLS, llm, ctx: { store } })) {
          setEvents((prev) => [...prev, ev])
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setRunning(false)
      }
    },
    [asConfig, t],
  )

  return { events, running, error, send }
}

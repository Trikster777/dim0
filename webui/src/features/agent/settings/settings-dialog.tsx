import { useState, type ComponentType } from "react"
import { useTranslation } from "react-i18next"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  CodeInterpreterIcon,
  DocumentFileIcon,
  GlobeIcon,
  LinkIcon,
  ToolsMenuIcon,
  SparklesIcon,
} from "@/components/icons"
import { cn } from "@/lib/utils"
import { useIsSignedIn } from "@/lib/auth"
import { useByokStore, type SearchEngine } from "@/features/agent/byok/byok-store"
import { useToolTrustStore, type ConfirmToolName } from "@/features/agent/settings/tool-trust-store"
import { Switch } from "@/components/ui/switch"
import { ByokKeyForm } from "@/features/agent/byok/byok-key-form"
import { ModelChoiceMenu } from "@/features/agent/components/chat/input-settings/model-card"
import { useChatStore } from "@/features/agent/store/chat-store"
import { useListAvailableServices } from "@/features/agent/api/list-available-services"
import { useModelCatalog } from "@/features/agent/api/use-model-catalog"
import { agentResolveContext, isOnline } from "@/features/agent/engine/services/context"
import { resolveAllServices, resolveService } from "@/features/agent/engine/services/resolve"
import { isKeylessSearchEngine, type ServiceKind } from "@/features/agent/engine/services/kinds"


type SectionId = "general" | "models" | "search" | "code" | "documents"

const NAV: { id: SectionId; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "general", label: "agent.settings.nav_general", icon: ToolsMenuIcon },
  { id: "models", label: "agent.settings.nav_models", icon: SparklesIcon },
  { id: "search", label: "agent.settings.nav_search", icon: GlobeIcon },
  { id: "code", label: "agent.settings.nav_code", icon: CodeInterpreterIcon },
  { id: "documents", label: "agent.settings.nav_documents", icon: DocumentFileIcon },
]

const SEARCH_ENGINES: { id: SearchEngine; label: string; placeholder: string }[] = [
  { id: "perplexity", label: "Perplexity", placeholder: "pplx-…" },
  { id: "tavily", label: "Tavily", placeholder: "tvly-…" },
  { id: "linkup", label: "Linkup", placeholder: "lk-…" },
  { id: "exa", label: "Exa", placeholder: "exa-…" },
  { id: "parallel", label: "agent.settings.parallel_keyless", placeholder: "" },
]

const fieldClass =
  "flex-1 min-w-0 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-sm outline-none " +
  "transition focus:border-secondary-foreground/50 focus:ring-4 focus:ring-secondary-foreground/15"


/** Which service each nav section configures (General is a summary, no dot). */
const NAV_KIND: Partial<Record<SectionId, ServiceKind>> = {
  models: "llm",
  search: "search",
  code: "code",
  documents: "parse",
}


/**
 * Unified agent settings — a dialog with a left nav (General / Model providers /
 * Web search / Code) and a right pane. General is the everyday surface: pick the
 * active model, and see each tool's usable/not marker with a shortcut into its
 * key section. The provider sections hold BYOK keys. "Our keys first."
 */
export function SettingsDialog({ trigger }: { trigger: React.ReactNode }) {
  const { t } = useTranslation()
  const [section, setSection] = useState<SectionId>("general")
  useModelCatalog() // public model list — populates the picker for everyone
  useListAvailableServices() // signed-in: search/code/tool availability

  // Per-service usable/not status, so the left nav doubles as a status overview.
  const signedIn = useIsSignedIn()
  const configured = useByokStore((s) => s.configured)
  const asConfig = useByokStore((s) => s.asConfig)
  const searchByok = useByokStore((s) => s.searchByok)
  const searchEngine = useByokStore((s) => s.searchEngine)
  const codeByok = useByokStore((s) => s.codeByok)
  const parseByok = useByokStore((s) => s.parseByok)
  const resolutions = resolveAllServices(
    agentResolveContext({
      signedIn,
      llm: configured ? asConfig() : null,
      search: searchByok(),
      searchEngine,
      code: codeByok(),
      parse: parseByok(),
    }),
  )

  return (
    <Dialog>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="w-[min(760px,calc(100vw-2rem))] max-w-none overflow-hidden rounded-2xl p-0">
        <DialogTitle className="sr-only">{t("agent.settings.agent_settings")}</DialogTitle>
        <div className="flex h-[min(560px,80vh)]">
          <nav className="flex w-44 shrink-0 flex-col border-r border-border bg-sidebar/60 p-2">
            <div className="px-2 pb-2 pt-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              {t("agent.settings.title")}
            </div>
            {NAV.map(({ id, label, icon: Icon }) => {
              const kind = NAV_KIND[id]
              return (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  section === id
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{t(label)}</span>
                {kind && (
                  <span className="ml-auto shrink-0">
                    <StatusDot usable={resolutions[kind].mode !== "off"} />
                  </span>
                )}
              </button>
              )
            })}
            <ForgetKeysButton />
          </nav>
          <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
            {section === "general" && <GeneralPane onNavigate={setSection} />}
            {section === "models" && <ProvidersPane />}
            {section === "search" && <SearchPane />}
            {section === "code" && <CodePane />}
            {section === "documents" && <DocumentsPane />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


/** Forget every BYOK key stored on this device (the persistence safety valve). */
function ForgetKeysButton() {
  const { t } = useTranslation()
  const clear = useByokStore((s) => s.clear)
  const hasKeys = useByokStore(
    (s) =>
      Object.values(s.llm).some((c) => c?.apiKey) ||
      Object.values(s.search).some(Boolean) ||
      !!s.codeKey ||
      !!s.parseKey,
  )
  return (
    <button
      type="button"
      onClick={clear}
      disabled={!hasKeys}
      className="mt-auto rounded-lg px-2.5 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
    >
      {t("agent.settings.forget_keys")}
    </button>
  )
}


/** Usable/not status dot — green when the service resolves, red otherwise. */
function StatusDot({ usable }: { usable: boolean }) {
  const { t } = useTranslation()
  return (
    <span
      className={cn("size-2 shrink-0 rounded-full", usable ? "bg-emerald-500" : "bg-red-500")}
      aria-label={usable ? t("agent.settings.status_usable") : t("agent.settings.status_not_setup")}
    />
  )
}


function PaneTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}


/** General: the active model + a per-tool usable marker with a shortcut to keys. */
function GeneralPane({ onNavigate }: { onNavigate: (s: SectionId) => void }) {
  const { t } = useTranslation()
  const signedIn = useIsSignedIn()
  const configured = useByokStore((s) => s.configured)
  const asConfig = useByokStore((s) => s.asConfig)
  const searchByok = useByokStore((s) => s.searchByok)
  const searchEngine = useByokStore((s) => s.searchEngine)
  const codeByok = useByokStore((s) => s.codeByok)
  const parseByok = useByokStore((s) => s.parseByok)
  const resolutions = resolveAllServices(
    agentResolveContext({
      signedIn,
      llm: configured ? asConfig() : null,
      search: searchByok(),
      searchEngine,
      code: codeByok(),
      parse: parseByok(),
    }),
  )

  const tools: { kind: ServiceKind; label: string; icon: ComponentType<{ className?: string }>; section?: SectionId }[] = [
    { kind: "search", label: "agent.settings.web_search_label", icon: GlobeIcon, section: "search" },
    { kind: "code", label: "agent.settings.code_label", icon: CodeInterpreterIcon, section: "code" },
    { kind: "parse", label: "agent.settings.nav_documents", icon: DocumentFileIcon, section: "documents" },
    { kind: "fetch", label: "agent.settings.fetch", icon: LinkIcon },
  ]

  const modelUsable = resolutions.llm.mode !== "off"

  return (
    <div>
      <PaneTitle title={t("agent.settings.nav_general")} hint={t("agent.settings.general_hint")} />

      <div className="mb-1 flex items-center gap-2">
        <StatusDot usable={modelUsable} />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("agent.settings.model")}</span>
      </div>
      <div className="rounded-lg border border-border">
        <ModelChoiceMenu display="row" />
      </div>
      {modelUsable ? (
        <p className="mb-5 mt-1.5 text-[11px] text-muted-foreground">
          {t("agent.settings.auto_hint")}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => onNavigate("models")}
          className="mb-5 mt-1.5 text-[11px] font-medium text-secondary-foreground underline-offset-2 hover:underline"
        >
          {t("agent.settings.set_model_key")}
        </button>
      )}

      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("agent.settings.tools")}</div>
      <div className="divide-y divide-border/60 rounded-lg border border-border">
        {tools.map(({ kind, label, icon: Icon, section }) => {
          const mode = resolutions[kind].mode
          return (
            <div key={kind} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm">
                <StatusDot usable={mode !== "off"} />
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                {t(label)}
              </span>
              {mode === "keyless" ? (
                <Chip tone="byok" label={t("agent.settings.no_key_needed")} />
              ) : mode === "managed" ? (
                <Chip tone="managed" label={t("agent.settings.our_keys")} />
              ) : mode === "byok" ? (
                <Chip tone="byok" label={t("agent.settings.your_key")} />
              ) : section ? (
                <button
                  type="button"
                  onClick={() => onNavigate(section)}
                  className="text-xs font-medium text-secondary-foreground underline-offset-2 hover:underline"
                >
                  {t("agent.settings.set_key")}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">{t("agent.settings.needs_account")}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


function Chip({ tone, label }: { tone: "managed" | "byok"; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tone === "managed" ? "bg-secondary text-secondary-foreground" : "border border-border text-foreground",
      )}
    >
      {label}
    </span>
  )
}


function ProvidersPane() {
  const { t } = useTranslation()
  return (
    <div>
      <PaneTitle title={t("agent.settings.nav_models")} hint={t("agent.settings.providers_hint")} />
      <ByokKeyForm />
    </div>
  )
}


/**
 * A standing "always allow" grant for one off-board tool. When on, the agent
 * skips the per-call confirm prompt for that tool (this device only). Per-tool
 * on purpose — trusting web search shouldn't silently trust code execution.
 */
function TrustToolRow({ tool, title, description }: { tool: ConfirmToolName; title: string; description: string }) {
  const on = useToolTrustStore((s) => s.autoAllow[tool])
  const setAutoAllow = useToolTrustStore((s) => s.setAutoAllow)

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-sm">{title}</div>
        <div className="text-[11px] text-muted-foreground">{description}</div>
      </div>
      <Switch checked={on} onCheckedChange={(v) => setAutoAllow(tool, v)} label={title} />
    </div>
  )
}


/**
 * Web search: a list of engine options with a usable marker. Available engines
 * (our keys when signed in, or a saved BYOK key) are selectable; the rest are
 * greyed until you add a key below. The picked engine is the one the agent uses;
 * if none is picked the resolver takes the first available.
 */
function SearchPane() {
  const { t } = useTranslation()
  const signedIn = useIsSignedIn()
  const engine = useByokStore((s) => s.searchEngine)
  const keys = useByokStore((s) => s.search)
  const setSearchEngine = useByokStore((s) => s.setSearchEngine)
  const setSearchKey = useByokStore((s) => s.setSearchKey)
  const managed = useChatStore((s) => s.services.search)
  // Local draft for the ACTIVE engine's key; re-seeded when the active changes.
  const [key, setKey] = useState(keys[engine] ?? "")
  const [editing, setEditing] = useState(engine)
  if (editing !== engine) {
    setEditing(engine)
    setKey(keys[engine] ?? "")
  }
  const active = SEARCH_ENGINES.find((e) => e.id === engine) ?? SEARCH_ENGINES[0]

  const managedAvailable = (id: SearchEngine): boolean =>
    signedIn && (managed.find((s) => s.name === id)?.available ?? false)
  const usable = (id: SearchEngine): boolean =>
    (isKeylessSearchEngine(id) && isOnline()) || managedAvailable(id) || !!keys[id]

  return (
    <div>
      <PaneTitle title={t("agent.settings.nav_search")} hint={t("agent.settings.search_hint")} />

      <TrustToolRow
        tool="web_search"
        title={t("agent.settings.always_allow_web_search")}
        description={t("agent.settings.always_allow_web_search_desc")}
      />
      <TrustToolRow
        tool="fetch"
        title={t("agent.settings.always_allow_fetch")}
        description={t("agent.settings.always_allow_fetch_desc")}
      />

      <div className="mb-4 overflow-hidden rounded-lg border border-border">
        {SEARCH_ENGINES.map((e) => {
          const isUsable = usable(e.id)
          const isActive = e.id === engine
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => setSearchEngine(e.id)}
              className={cn(
                "flex w-full items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5 text-left text-sm last:border-b-0 transition-colors",
                isActive ? "bg-secondary/60" : "hover:bg-accent",
              )}
            >
              <span className={cn("flex items-center gap-2", !isUsable && !isActive && "text-muted-foreground")}>
                <StatusDot usable={isUsable} />
                {t(e.label)}
              </span>
              {isActive && (
                <span className="text-[11px] font-medium text-secondary-foreground">
                  {isUsable ? t("agent.settings.selected") : t("agent.settings.add_key")}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {isKeylessSearchEngine(engine) ? (
        <p className="text-xs text-muted-foreground">
          {t("agent.settings.keyless_hint")}
        </p>
      ) : (
        <>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("agent.settings.your_engine_key", { name: t(active.label) })}</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={key}
              onChange={(ev) => setKey(ev.target.value)}
              placeholder={active.placeholder}
              className={fieldClass}
            />
            <SaveButton disabled={key === (keys[engine] ?? "")} onClick={() => setSearchKey(engine, key.trim())} />
          </div>
        </>
      )}
    </div>
  )
}


function CodePane() {
  const { t } = useTranslation()
  const signedIn = useIsSignedIn()
  const savedKey = useByokStore((s) => s.codeKey)
  const setCode = useByokStore((s) => s.setCode)
  const [key, setKey] = useState(savedKey)
  const usable = resolveService("code", agentResolveContext({ signedIn, code: savedKey.trim() || null })).mode !== "off"

  return (
    <div>
      <PaneTitle title={t("agent.settings.nav_code")} hint={t("agent.settings.code_hint")} />
      <TrustToolRow
        tool="code_interpreter"
        title={t("agent.settings.always_allow_code")}
        description={t("agent.settings.always_allow_code_desc")}
      />
      <div className="mb-2 flex items-center gap-2 text-xs font-medium">
        <StatusDot usable={usable} />
        Daytona
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={key}
          onChange={(ev) => setKey(ev.target.value)}
          placeholder="dtn-…"
          className={fieldClass}
        />
        <SaveButton disabled={key === savedKey} onClick={() => setCode({ apiKey: key.trim() })} />
      </div>
    </div>
  )
}


function DocumentsPane() {
  const { t } = useTranslation()
  const signedIn = useIsSignedIn()
  const savedKey = useByokStore((s) => s.parseKey)
  const setParse = useByokStore((s) => s.setParse)
  const [key, setKey] = useState(savedKey)
  const usable = resolveService("parse", agentResolveContext({ signedIn, parse: savedKey.trim() || null })).mode !== "off"

  return (
    <div>
      <PaneTitle title={t("agent.settings.nav_documents")} hint={t("agent.settings.documents_hint")} />
      <div className="mb-2 flex items-center gap-2 text-xs font-medium">
        <StatusDot usable={usable} />
        Mistral
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={key}
          onChange={(ev) => setKey(ev.target.value)}
          placeholder="mis-…"
          className={fieldClass}
        />
        <SaveButton disabled={key === savedKey} onClick={() => setParse({ apiKey: key.trim() })} />
      </div>
    </div>
  )
}


function SaveButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-accent disabled:opacity-40"
    >
      {t("common.save")}
    </button>
  )
}

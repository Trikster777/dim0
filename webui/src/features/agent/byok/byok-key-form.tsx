import { useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DeleteIcon } from "@/components/icons"
import { isTauri } from "@/platform"
import { tauriFetch } from "@/features/agent/engine/services/desktop-http"
import { BUILTIN_BYOK_PROVIDERS } from "@/features/agent/engine/byok-client"
import { useByokStore, uniqueProviderId } from "./byok-store"
import { fetchProviderModels } from "./provider-models"


const BUILTIN_LABELS: Record<(typeof BUILTIN_BYOK_PROVIDERS)[number], string> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
}


/** Placeholder value for the model picker when no model is picked yet. */
const NO_MODEL = "__dim0_no_model__"


const fieldClass =
  "rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-sm outline-none " +
  "transition focus:border-secondary-foreground/50 focus:ring-4 focus:ring-secondary-foreground/15"


/**
 * BYOK key entry — a list of model providers (the built-ins plus the user's
 * own OpenAI-compatible ones), the selected provider's key and model, and a
 * way to pull the provider's model list straight from it. Styled to the island
 * vocabulary (sidebar surface, rounded controls, soft focus ring). Calls back
 * when saved. Keys are sent only to the provider, never to our servers.
 */
export function ByokKeyForm({ onSaved }: { onSaved?: () => void }) {
  const { t } = useTranslation()
  const provider = useByokStore((s) => s.provider)
  const llm = useByokStore((s) => s.llm)
  const customProviders = useByokStore((s) => s.customProviders)
  const setProvider = useByokStore((s) => s.setProvider)
  const setLlm = useByokStore((s) => s.setLlm)
  const addCustomProvider = useByokStore((s) => s.addCustomProvider)
  const removeCustomProvider = useByokStore((s) => s.removeCustomProvider)

  const [apiKey, setApiKey] = useState(llm[provider]?.apiKey ?? "")
  const [model, setModel] = useState(llm[provider]?.model ?? "")
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newBaseURL, setNewBaseURL] = useState("")
  const [newKey, setNewKey] = useState("")
  const [newModel, setNewModel] = useState("")
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsFailed, setModelsFailed] = useState(false)

  // The active provider is the store's; the drafts follow it — each provider
  // keeps its own key + model, so switching never overwrites another.
  const [draftProvider, setDraftProvider] = useState(provider)
  if (draftProvider !== provider) {
    setDraftProvider(provider)
    setApiKey(llm[provider]?.apiKey ?? "")
    setModel(llm[provider]?.model ?? "")
    setModels([])
    setModelsFailed(false)
  }

  const activeCustom = customProviders.find((p) => p.id === provider) ?? null
  const isCustom = activeCustom !== null

  const save = (): void => {
    if (!apiKey.trim()) return
    setLlm({ provider, apiKey: apiKey.trim(), model: model.trim() })
    onSaved?.()
  }

  // Register the user's own provider, then make it the active one with its
  // key + model. The id is a slug of the name, unique across providers.
  const saveCustom = (): void => {
    const label = newLabel.trim()
    const baseURL = newBaseURL.trim()
    const key = newKey.trim()
    if (!label || !baseURL || !key) return
    const taken = [...BUILTIN_BYOK_PROVIDERS, ...customProviders.map((p) => p.id)]
    const id = uniqueProviderId(label, taken)
    addCustomProvider({ id, label, baseURL })
    setLlm({ provider: id, apiKey: key, model: newModel.trim() })
    setAdding(false)
    setNewLabel("")
    setNewBaseURL("")
    setNewKey("")
    setNewModel("")
    onSaved?.()
  }

  // Ask the provider which models it serves. The model field stays a free
  // text field either way — a provider may not expose /models at all.
  const loadModels = async (): Promise<void> => {
    if (!activeCustom) return
    setLoadingModels(true)
    setModelsFailed(false)
    try {
      const list = await fetchProviderModels({
        baseURL: activeCustom.baseURL,
        apiKey: apiKey.trim(),
        ...(isTauri() ? { fetchImpl: tauriFetch } : {}),
      })
      setModels(list)
    } catch {
      setModels([])
      setModelsFailed(true)
    } finally {
      setLoadingModels(false)
    }
  }

  const keyPlaceholder = provider === "openai" ? "sk-…" : provider === "openrouter" ? "sk-or-…" : "sk-…"
  const modelPlaceholder = provider === "openai" ? "gpt-5.4" : provider === "openrouter" ? "openai/gpt-5.4" : "model-id"

  return (
    <div className="flex flex-col gap-2.5 text-sm">
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="px-3 pb-1 pt-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          {t("agent.settings.builtin_providers")}
        </div>
        {BUILTIN_BYOK_PROVIDERS.map((id) => (
          <ProviderRow
            key={id}
            id={id}
            label={BUILTIN_LABELS[id]}
            active={provider === id}
            hasKey={Boolean(llm[id]?.apiKey)}
            onPick={() => setProvider(id)}
          />
        ))}
        {customProviders.length > 0 && (
          <div className="px-3 pb-1 pt-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            {t("agent.settings.custom_providers")}
          </div>
        )}
        {customProviders.map((p) => (
          <ProviderRow
            key={p.id}
            id={p.id}
            label={p.label}
            active={provider === p.id}
            hasKey={Boolean(llm[p.id]?.apiKey)}
            onPick={() => setProvider(p.id)}
            onRemove={() => removeCustomProvider(p.id)}
            removeLabel={t("agent.settings.remove_provider")}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setAdding((v) => !v)}
        className="self-start rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-accent"
      >
        {t("agent.settings.add_provider")}
      </button>

      {adding && (
        <div
          data-testid="add-provider-panel"
          className="flex flex-col gap-2 rounded-lg border border-border bg-background/40 p-3"
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t("agent.settings.provider_name")}</span>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="My provider"
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t("agent.settings.provider_base_url")}</span>
            <input
              value={newBaseURL}
              onChange={(e) => setNewBaseURL(e.target.value)}
              placeholder="https://api.your-provider.com/v1"
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t("agent.settings.api_key")}</span>
            <input
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="sk-…"
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t("agent.settings.model")}</span>
            <input
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              placeholder="model-id"
              className={fieldClass}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveCustom}
              disabled={!newLabel.trim() || !newBaseURL.trim() || !newKey.trim()}
              className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-40"
            >
              {t("common.save")}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-accent"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{t("agent.settings.api_key")}</span>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={keyPlaceholder}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{t("agent.settings.model")}</span>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={modelPlaceholder}
          className={fieldClass}
        />
      </label>

      {isCustom && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] text-muted-foreground">{activeCustom.baseURL}</p>
          <button
            type="button"
            onClick={() => void loadModels()}
            disabled={loadingModels || !apiKey.trim()}
            className="self-start rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-accent disabled:opacity-40"
          >
            {t("agent.settings.load_models")}
          </button>
          {modelsFailed && (
            <p className="text-[11px] text-destructive">{t("agent.settings.models_load_failed")}</p>
          )}
          {models.length > 0 && (
            <>
              <Select value={model || NO_MODEL} onValueChange={(v) => setModel(v)}>
                <SelectTrigger size="sm" className="w-full justify-between">
                  <SelectValue placeholder={t("agent.settings.pick_model")} />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {t("agent.settings.models_loaded", { count: models.length })}
              </p>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={!apiKey.trim() || (isCustom && !model.trim())}
        className="self-start rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-40"
      >
        {t("common.save")}
      </button>

      <p className="text-[11px] leading-snug text-muted-foreground">
        {t("agent.settings.byok_footnote")}
      </p>
    </div>
  )
}


/** One provider in the list — a status dot, the name, and (for our own) a
 *  remove button. The active row is highlighted. */
function ProviderRow({
  id,
  label,
  active,
  hasKey,
  onPick,
  onRemove,
  removeLabel,
}: {
  id: string
  label: string
  active: boolean
  hasKey: boolean
  onPick: () => void
  onRemove?: () => void
  removeLabel?: string
}) {
  const { t } = useTranslation()
  return (
    <div
      className={cn(
        "flex items-center gap-1 border-t border-border/60 px-3 py-2 transition-colors",
        active ? "bg-secondary/60" : "hover:bg-accent",
      )}
    >
      <button
        type="button"
        onClick={onPick}
        data-provider-id={id}
        className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
      >
        <span
          className={cn("size-2 shrink-0 rounded-full", hasKey ? "bg-emerald-500" : "bg-red-500")}
          aria-label={hasKey ? t("agent.settings.status_usable") : t("agent.settings.status_not_setup")}
        />
        <span className="truncate">{label}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          title={removeLabel}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
        >
          <DeleteIcon className="size-4" />
        </button>
      )}
    </div>
  )
}

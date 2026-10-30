import type { AppIconComponent } from "@/components/icons"
import { ExaBrandIcon, OpenAIBrandIcon, PerplexityBrandIcon, TavilyBrandIcon } from "@/components/icons"

/**
 * Link preview interface for web pages.
 */
export interface LinkPreview {
  title?: string
  description?: string
  image?: string
  siteName?: string
  favicon?: string
}


/**
 * Web search engine options.
 */
export const WebSearchEngines = ["openai", "perplexity", "tavily", "linkup", "exa"] as const
export type WebSearchEngine = typeof WebSearchEngines[number]


export const WebSearchEngineName: Record<WebSearchEngine, string> = {
  openai: "OpenAI",
  perplexity: "Perplexity",
  tavily: "Tavily",
  linkup: "Linkup",
  exa: "Exa"
}


// Keys, not copy: the engine picker renders them through `t()`.
export const WebSearchEngineDescription: Record<WebSearchEngine, string> = {
  openai: "agent.search_engine.openai",
  perplexity: "agent.search_engine.perplexity",
  tavily: "agent.search_engine.tavily",
  linkup: "agent.search_engine.linkup",
  exa: "agent.search_engine.exa"
}


export const WebSearchEngineIcons: Record<WebSearchEngine, AppIconComponent | null> = {
  openai: OpenAIBrandIcon,
  perplexity: PerplexityBrandIcon,
  tavily: TavilyBrandIcon,
  linkup: null,
  exa: ExaBrandIcon,
} 

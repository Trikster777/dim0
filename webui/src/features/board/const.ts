import { i18n } from "@/i18n"


export const DEBOUNCE_DELAY = 500 // milliseconds

/** Locale key for the name shown when a board or chat has no title yet. */
export const UNTITLED_LABEL = "board.untitled"

/** Translated default name for an untitled board/chat (current language). */
export const untitledLabel = (): string => i18n.t(UNTITLED_LABEL)
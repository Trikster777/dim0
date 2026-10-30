import { useEditorState } from "@tiptap/react"
import { useTranslation } from "react-i18next"
import type { Editor } from "@tiptap/react"

type Props = { editor: Editor }

export function StatusBar({ editor }: Props) {
  const { t } = useTranslation()
  const { words, characters } = useEditorState({
    editor,
    selector: (ctx) => ({
      words: ctx.editor.storage.characterCount.words() as number,
      characters: ctx.editor.storage.characterCount.characters() as number,
    }),
  })

  return (
    <div className="flex h-7 shrink-0 items-center border-t border-border px-4">
      <span className="font-sans text-[11px] text-muted-foreground">
        {t("editor.status.words", { count: words })} · {t("editor.status.chars", { count: characters })}
      </span>
    </div>
  )
}

import { NodeViewWrapper } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { useDocHeadings } from "./use-doc-headings"


/**
 * In-document Table of Contents block. Lists every h1–h3 heading and
 * scrolls the editor to that heading on click. Re-renders live as the
 * doc's headings change. Read-only — the block is an atom node.
 */
export function TocBlockView({ editor }: NodeViewProps) {
  const { t } = useTranslation()
  const headings = useDocHeadings(editor)

  function jump(pos: number) {
    editor
      .chain()
      .focus()
      .setTextSelection(pos + 1)
      .scrollIntoView()
      .run()
  }

  return (
    <NodeViewWrapper
      as="div"
      className="toc-block"
      contentEditable={false}
    >
      <p className="toc-block-title">{t("editor.toc.on_this_page")}</p>
      {headings.length === 0 ? (
        <p className="toc-block-empty">
          {t("editor.toc.empty")}
        </p>
      ) : (
        <ul className="toc-block-list">
          {headings.map((h, i) => (
            <li
              key={i}
              className={cn(
                "toc-block-item",
                h.level === 2 && "toc-block-item--h2",
                h.level === 3 && "toc-block-item--h3",
              )}
            >
              <button
                type="button"
                onClick={() => jump(h.pos)}
                className="toc-block-link"
              >
                {h.text || t("editor.toc.empty_heading")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </NodeViewWrapper>
  )
}

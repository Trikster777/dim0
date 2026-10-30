import type { Editor, Range } from "@tiptap/core"
import type { Icon } from "@phosphor-icons/react"
import { i18n } from "@/i18n"
import { untitledLabel } from "@/features/board/const"
import { openMathEditor } from "../math/math-edit-trigger"
import {
  TextT,
  TextHOne,
  TextHTwo,
  TextHThree,
  ListBullets,
  ListNumbers,
  ListChecks,
  Quotes,
  Code,
  Minus,
  MathOperationsIcon,
  TableIcon,
  CaretRightIcon,
  ImageIcon,
  ListDashes,
  Notepad,
} from "@phosphor-icons/react"
import { pickAndInsertImage } from "../image/insert-image"
import { primePageCache } from "../page/page-cache"
import type { PageProvider } from "../page/types"

export interface SlashCommand {
  /** Locale key; the menu renders the translated title. */
  title: string
  keywords: string[]
  icon: Icon
  group: "basic"
  action: (editor: Editor, range: Range) => void
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // ── basic blocks ─────────────────────────────────────────────────────────
  {
    title: "editor.slash.text",
    keywords: ["paragraph", "plain", "text", "p"],
    icon: TextT,
    group: "basic",
    action: (editor, range) =>
      editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: "editor.slash.heading_1",
    keywords: ["h1", "heading", "title", "big"],
    icon: TextHOne,
    group: "basic",
    action: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
  },
  {
    title: "editor.slash.heading_2",
    keywords: ["h2", "heading", "subtitle"],
    icon: TextHTwo,
    group: "basic",
    action: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
  },
  {
    title: "editor.slash.heading_3",
    keywords: ["h3", "heading"],
    icon: TextHThree,
    group: "basic",
    action: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
  },
  {
    title: "editor.slash.bullet_list",
    keywords: ["ul", "list", "bullets", "unordered"],
    icon: ListBullets,
    group: "basic",
    action: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "editor.slash.numbered_list",
    keywords: ["ol", "numbered", "ordered", "list"],
    icon: ListNumbers,
    group: "basic",
    action: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "editor.slash.todo_list",
    keywords: ["todo", "task", "check", "checkbox"],
    icon: ListChecks,
    group: "basic",
    action: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "editor.slash.quote",
    keywords: ["quote", "blockquote", "callout"],
    icon: Quotes,
    group: "basic",
    action: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "editor.slash.toggle",
    keywords: ["toggle", "details", "collapse", "expand", "disclosure"],
    icon: CaretRightIcon,
    group: "basic",
    action: (editor, range) =>
      editor.chain().focus().deleteRange(range).setDetails().run(),
  },
  {
    title: "editor.slash.code_block",
    keywords: ["code", "codeblock", "pre", "snippet"],
    icon: Code,
    group: "basic",
    action: (editor, range) =>
      editor.chain().focus().deleteRange(range).setCodeBlock({ language: "plaintext" }).run(),
  },
  {
    title: "editor.slash.math_block",
    keywords: ["math", "latex", "equation", "formula", "katex"],
    icon: MathOperationsIcon,
    group: "basic",
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range)
        .insertContent({ type: "blockMath", attrs: { latex: "" } }).run()
      // After insertion the cursor sits just after the new atom; the block
      // itself is at selection.from - 1. Defer one tick so the NodeView DOM
      // exists before the popover anchors to it.
      const pos = Math.max(0, editor.state.selection.from - 1)
      requestAnimationFrame(() => openMathEditor({ pos, latex: "", isInline: false }))
    },
  },
  {
    title: "editor.slash.table",
    keywords: ["table", "grid", "rows", "columns"],
    icon: TableIcon,
    group: "basic",
    action: (editor, range) =>
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: "editor.slash.divider",
    keywords: ["hr", "divider", "separator", "rule", "line"],
    icon: Minus,
    group: "basic",
    action: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: "editor.slash.image",
    keywords: ["image", "img", "picture", "photo", "upload"],
    icon: ImageIcon,
    group: "basic",
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).run()
      pickAndInsertImage(editor)
    },
  },
  {
    title: "editor.slash.toc",
    keywords: ["toc", "outline", "headings", "contents", "summary"],
    icon: ListDashes,
    group: "basic",
    action: (editor, range) =>
      editor.chain().focus().deleteRange(range).insertContent({ type: "tableOfContents" }).run(),
  },
  {
    title: "editor.slash.subpage",
    keywords: ["subpage", "sub-page", "page", "child", "embed"],
    icon: Notepad,
    group: "basic",
    action: (editor, range) => {
      // Read provider + the host note id from the editor's storage and
      // create a child page; the new id gets stamped on a `subpage` block.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const storage = (editor.storage as any).pageProvider as
        | { provider: PageProvider | null; parentNoteId: string | null }
        | undefined
      const provider = storage?.provider
      const parentNoteId = storage?.parentNoteId ?? undefined
      if (!provider) return
      editor.chain().focus().deleteRange(range).run()
      void (async () => {
        try {
          const page = await provider.create({
            title: untitledLabel(),
            parentId: parentNoteId,
          })
          primePageCache(page)
          editor
            .chain()
            .focus()
            .insertContent({
              type: "subpage",
              attrs: { pageId: page.id, title: page.title || untitledLabel() },
            })
            .run()
          provider.onNavigate?.(page.id)
        } catch (err) {
          console.error("[/subpage] create failed", err)
        }
      })()
    },
  },
]

const localizeCommand = (command: SlashCommand): SlashCommand => ({
  ...command,
  title: i18n.t(command.title),
})

export function filterCommands(query: string): SlashCommand[] {
  const commands = SLASH_COMMANDS.map(localizeCommand)
  if (!query) return commands
  const q = query.toLowerCase()
  return commands.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(q) ||
      cmd.keywords.some((k) => k.includes(q)),
  )
}

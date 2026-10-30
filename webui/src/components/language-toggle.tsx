import { CheckmarkIcon, GlobeIcon } from "@/components/icons"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getLanguage, setLanguage, SUPPORTED_LANGS, type Lang } from "@/i18n"
import { useTranslation } from "react-i18next"


const LANG_LABEL_KEYS: Record<Lang, string> = {
  en: "common.language_toggle.english",
  ru: "common.language_toggle.russian",
}


/**
 * Compact interface-language picker, built like `ModeToggle` so it can sit next
 * to it in the sidebar footer. The choice is persisted by `setLanguage`.
 */
export function LanguageToggle(props: React.ComponentProps<typeof Button>) {
  const { t } = useTranslation()
  const current = getLanguage()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("common.language_toggle.aria_label")}
          className='border-none !size-8 !bg-transparent hover:!bg-accent/50 !shadow-none'
          {...props}
        >
          <GlobeIcon className='h-4 w-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className='min-w-[140px]'>
        <DropdownMenuLabel className='text-xs text-muted-foreground font-normal'>
          {t("common.language_toggle.label")}
        </DropdownMenuLabel>
        {SUPPORTED_LANGS.map((lang) => {
          const isActive = lang === current
          return (
            <DropdownMenuItem key={lang} onClick={() => void setLanguage(lang)} className='gap-2'>
              <span className='flex-1'>{t(LANG_LABEL_KEYS[lang])}</span>
              {isActive ? <CheckmarkIcon className='h-3.5 w-3.5' /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

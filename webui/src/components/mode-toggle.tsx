import { CheckmarkIcon, MonitorIcon, MoonIcon, SunIcon } from "@/components/icons"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "@/components/theme-provider"
import { type Mode, type ThemeMeta } from "@/components/theme-constants"
import { useTranslation } from "react-i18next"


type SwatchTrio = ThemeMeta["swatchLight"]


/** Three-dot color swatch row for previewing a theme. */
function Swatches({ colors }: { colors: SwatchTrio }) {
  return (
    <span className='inline-flex items-center gap-0.5'>
      {colors.map((c, i) => (
        <span
          key={i}
          className='inline-block h-2.5 w-2.5 rounded-full border border-border'
          style={{ backgroundColor: c }}
        />
      ))}
    </span>
  )
}


const MODES: { id: Mode; label: string; Icon: typeof SunIcon }[] = [
  { id: "light",  label: "theme.mode.light",  Icon: SunIcon },
  { id: "dark",   label: "theme.mode.dark",   Icon: MoonIcon },
  { id: "system", label: "theme.mode.system", Icon: MonitorIcon },
]


/**
 * Combined theme + mode picker. Trigger shows the active theme's swatch trio;
 * dropdown groups theme selection on top and mode selection below.
 */
export function ModeToggle(props: React.ComponentProps<typeof Button>) {
  const { t } = useTranslation()
  const { themeId, mode, resolvedTheme, themes, setThemeId, setMode } = useTheme()
  const activeTheme = themes.find((t) => t.id === themeId) ?? themes[0]
  const activeSwatch = resolvedTheme === "dark" ? activeTheme.swatchDark : activeTheme.swatchLight

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className='border-none !size-8 !bg-transparent hover:!bg-accent/50 !shadow-none'
          {...props}
        >
          <Swatches colors={activeSwatch} />
          <span className="sr-only">{t('theme.toggle_label')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className='min-w-[180px]'>
        <DropdownMenuLabel className='text-xs text-muted-foreground font-normal'>{t('theme.section.theme')}</DropdownMenuLabel>
        {themes.map((theme) => {
          const swatch = resolvedTheme === "dark" ? theme.swatchDark : theme.swatchLight
          const isActive = theme.id === themeId
          return (
            <DropdownMenuItem key={theme.id} onClick={() => setThemeId(theme.id)} className='gap-2'>
              <Swatches colors={swatch} />
              <span className='flex-1'>{t(theme.label)}</span>
              {isActive ? <CheckmarkIcon className='h-3.5 w-3.5' /> : null}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className='text-xs text-muted-foreground font-normal'>{t('theme.section.mode')}</DropdownMenuLabel>
        {MODES.map(({ id, label, Icon }) => {
          const isActive = id === mode
          return (
            <DropdownMenuItem key={id} onClick={() => setMode(id)} className='gap-2'>
              <Icon className='h-4 w-4' />
              <span className='flex-1'>{t(label)}</span>
              {isActive ? <CheckmarkIcon className='h-3.5 w-3.5' /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

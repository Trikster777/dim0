import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ChatHistoryIcon, GridViewIcon, InfoCircleIcon, TextListIcon, TextParagraphIcon } from '@/components/icons'
import type { ViewMode } from '../../types/newsfeeds-view'

export function TopViewPanel({
  viewMode,
  setViewMode,
  hasLatest
}: {
  viewMode: ViewMode
  setViewMode: (m: ViewMode) => void
  hasLatest: boolean
}) {
  const { t } = useTranslation()
  const normalButtonClass = `
    transition-colors
    text-card-foreground
    hover:bg-secondary hover:text-secondary-foreground
    p-3
    rounded-lg
  `
  const activeButtonClass = `
    ${normalButtonClass}
    bg-secondary text-secondary-foreground
  `

  const ModeButton = ({
    mode,
    label,
    icon,
    disabled
  }: {
    mode: ViewMode
    label: string
    icon: React.ReactNode
    disabled?: boolean
  }) => {
    const active = viewMode === mode
    const cls = active ? activeButtonClass : normalButtonClass
    return (
      <Button
        variant={null}
        size='icon'
        disabled={disabled}
        onClick={() => !disabled && setViewMode(mode)}
        className={cls}
        title={t('newsfeed.view_mode.switch_title', { label })}
        aria-label={t('newsfeed.view_mode.switch_title', { label })}
        aria-pressed={active}
      >
        {icon}
      </Button>
    )
  }

  return (
    <div
      className={`
        absolute z-50 border border-border shadow-md
        backdrop-blur-md supports-[backdrop-filter]:bg-card/80 backdrop-saturate-150
        bg-card text-card-foreground rounded-xl
        p-1 flex gap-1
        right-2 top-1/2 -translate-y-1/2 md:translate-y-0
        flex-col items-stretch
        md:right-auto md:left-1/2 md:top-4 md:-translate-x-1/2
        md:flex-row md:items-center
      `}
      role='toolbar'
      aria-label={t('newsfeed.view_mode.toolbar')}
    >
      <ModeButton
        mode='linear'
        label={t('newsfeed.view_mode.linear')}
        icon={<TextListIcon className='size-4 shrink-0' strokeWidth={2} />}
        disabled={!hasLatest}
      />
      <ModeButton
        mode='grid'
        label={t('newsfeed.view_mode.grid')}
        icon={<GridViewIcon className='size-4 shrink-0' strokeWidth={2} />}
        disabled={!hasLatest}
      />
      <ModeButton
        mode='article'
        label={t('newsfeed.view_mode.article')}
        icon={<TextParagraphIcon className='size-4 shrink-0' strokeWidth={2} />}
        disabled={!hasLatest}
      />
      <Separator orientation='vertical' className='md:!h-6 hidden md:block' />
      <ModeButton
        mode='history'
        label={t('newsfeed.view_mode.history')}
        icon={<ChatHistoryIcon className='size-4 shrink-0' strokeWidth={2} />}
      />
      <ModeButton
        mode='info'
        label={t('newsfeed.view_mode.info')}
        icon={<InfoCircleIcon className='size-4 shrink-0' strokeWidth={2} />}
      />
    </div>
  )
}

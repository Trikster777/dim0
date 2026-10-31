import { cn } from '@/lib/utils'
import { Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

const DotLottieReact = lazy(async () => {
  const m = await import('@lottiefiles/dotlottie-react')
  return { default: m.DotLottieReact }
})

const MASCOTS = [
  {
    name: 'Dog',
    file: 'Dog.lottie',
    message: "agent.welcome.dog",
  },
  {
    name: 'Cat',
    file: 'Cat.lottie',
    message: 'agent.welcome.cat',
  },
  {
    name: 'Shark',
    file: 'Shark.lottie',
    message: 'agent.welcome.shark',
  },
  {
    name: 'Mouse',
    file: 'Mouse.lottie',
    message: 'agent.welcome.mouse',
  },
  {
    name: 'Panda',
    file: 'Panda.lottie',
    message: 'agent.welcome.panda',
  },
  {
    name: 'Dolphin',
    file: 'Dolphin.lottie',
    message: 'agent.welcome.dolphin',
  },
  {
    name: 'Elephant',
    file: 'Elephant.lottie',
    message: 'agent.welcome.elephant',
  },
  {
    name: 'Dove',
    file: 'Dove.lottie',
    message: 'agent.welcome.dove',
  },
  {
    name: 'Penguin',
    file: 'Penguin.lottie',
    message: 'agent.welcome.penguin',
  },
  {
    name: 'Toucan',
    file: 'Toucan.lottie',
    message: 'agent.welcome.toucan',
  },
  {
    name: 'Starfish',
    file: 'Starfish.lottie',
    message: 'agent.welcome.starfish',
  },
  {
    name: 'Spider',
    file: 'Spider.lottie',
    message: 'agent.welcome.spider',
  },
  {
    name: 'Pig',
    file: 'Pig.lottie',
    message: 'agent.welcome.pig',
  },
] as const

export type MascotName = typeof MASCOTS[number]['name']

function useRandomMascot() {
  const [index, setIndex] = useState<number | null>(null)

  useEffect(() => {
    setIndex(Math.floor(Math.random() * MASCOTS.length))
  }, [])

  const mascot = useMemo(() => (index == null ? null : MASCOTS[index]), [index])

  return { mascot, reshuffle: () => setIndex(Math.floor(Math.random() * MASCOTS.length)) }
}

function Oc({ file, size = 100 }: { file: string; size?: number }) {
  const src = `${import.meta.env.BASE_URL}animations/${file}`
  const box = { width: size, height: size }
  return (
    <Suspense fallback={<div style={box} />}>
      <DotLottieReact src={src} autoplay loop style={box} />
    </Suspense>
  )
}

/**
 * Render the shared centered mascot welcome layout used across chat surfaces.
 */
function WelcomeLayout({
  file,
  message,
  className,
  showShuffle = false,
  onShuffle,
  afterContent,
}: {
  file: string
  message: string
  className?: string
  showShuffle?: boolean
  onShuffle?: () => void
  afterContent?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className={cn('relative w-full flex flex-col items-center justify-center text-center', className)}>
      <div className='flex justify-center'>
        <Oc file={file} />
      </div>
      <div className='mt-2 text-xl text-card-foreground'>
        <span>{message}</span>
      </div>
      {showShuffle && onShuffle ? (
        <button
          type='button'
          className='mt-3 rounded-md px-3 py-1 text-xs font-medium text-accent-foreground/50 bg-accent hover:bg-muted shadow-sm hover:text-accent-foreground transition-colors'
          onClick={onShuffle}
          aria-label={t('agent.welcome.shuffle_aria')}
        >
          {t('agent.welcome.shuffle')}
        </button>
      ) : null}
      {afterContent ? <div className='mt-4 flex justify-center'>{afterContent}</div> : null}
    </div>
  )
}

export function WelcomeMessage({ afterContent }: { afterContent?: ReactNode }) {
  const { t } = useTranslation()
  const { mascot, reshuffle } = useRandomMascot()

  if (!mascot) {
    return (
      <div className='relative w-full flex flex-col items-center justify-center text-center'>
        <div style={{ width: 100, height: 100 }} />
        <div className='mt-2 text-xl text-card-foreground'>
          <span>{t('agent.welcome.loading')}</span>
        </div>
      </div>
    )
  }

  return (
    <WelcomeLayout
      file={mascot.file}
      message={t(mascot.message)}
      showShuffle
      onShuffle={reshuffle}
      afterContent={afterContent}
    />
  )
}


/**
 * Render a fixed mascot variant with the shared welcome layout.
 */
export function ThemedWelcome({ name, message, className, afterContent }: { name: MascotName, message?: string, className?: string, afterContent?: ReactNode }) {
  const { t } = useTranslation()
  const mascot = MASCOTS.find(m => m.name === name) ?? MASCOTS[0]

  const customMessage = message ?? t(mascot.message)

  return (
    <WelcomeLayout
      file={mascot.file}
      message={customMessage}
      className={className}
      afterContent={afterContent}
    />
  )
}

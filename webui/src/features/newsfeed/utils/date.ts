import { getLanguage, i18n } from '@/i18n'

const MONTHS_SHORT = [
  'newsfeed.date.month_jan',
  'newsfeed.date.month_feb',
  'newsfeed.date.month_mar',
  'newsfeed.date.month_apr',
  'newsfeed.date.month_may',
  'newsfeed.date.month_jun',
  'newsfeed.date.month_jul',
  'newsfeed.date.month_aug',
  'newsfeed.date.month_sep',
  'newsfeed.date.month_oct',
  'newsfeed.date.month_nov',
  'newsfeed.date.month_dec',
]

const ORDINAL_SUFFIXES = [
  'newsfeed.date.ordinal_th',
  'newsfeed.date.ordinal_st',
  'newsfeed.date.ordinal_nd',
  'newsfeed.date.ordinal_rd',
]

export function formatNewsletterDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (getLanguage() === 'ru') {
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  const month = i18n.t(MONTHS_SHORT[d.getMonth()])
  const day = d.getDate()
  const year = d.getFullYear()
  return `${month} ${ordinal(day)}, ${year}`
}

export function ordinal(n: number) {
  const v = n % 100
  const suffix = ORDINAL_SUFFIXES[(v - 20) % 10] ?? ORDINAL_SUFFIXES[v] ?? ORDINAL_SUFFIXES[0]
  return `${n}${i18n.t(suffix)}`
}

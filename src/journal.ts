import { DoneQuest, GameState } from './game'

type Focus = NonNullable<GameState['focusSessions']>[number]
type Review = NonNullable<GameState['reviews']>[string]
export type JournalEntry = { key: string; at: number; day: string; text: string } & (
  { kind: 'done'; value: DoneQuest } | { kind: 'focus'; value: Focus } | { kind: 'review'; value: Review }
)

export interface JournalFilter {
  search: string
  kind: 'all' | JournalEntry['kind']
  period: 'all' | 'today' | 'week' | 'month' | 'custom'
  from: string
  to: string
}

export const JOURNAL_FILTER: JournalFilter = { search: '', kind: 'all', period: 'all', from: '', to: '' }

export function journalDay(at: number) {
  const date = new Date(at)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const searchable = (text: string) => text.normalize('NFKC').toLocaleLowerCase().trim()

export function journalEntries(state: Pick<GameState, 'done' | 'focusSessions' | 'reviews'>): JournalEntry[] {
  const entries: JournalEntry[] = []
  state.done.forEach((value, index) => {
    entries.push({
      key: `done-${value.id}-${index}`,
      at: value.completedAt,
      day: journalDay(value.completedAt),
      text: searchable(value.title),
      kind: 'done',
      value,
    })
  })
  state.focusSessions?.forEach((value, index) => {
    entries.push({
      key: `focus-${value.id}-${index}`,
      at: value.endedAt,
      day: journalDay(value.endedAt),
      text: searchable(value.title),
      kind: 'focus',
      value,
    })
  })
  Object.entries(state.reviews ?? {}).forEach(([key, value]) => {
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(key)) return
    const [year, month, day] = key.split('-').map(Number)
    const date = new Date(year, month, day, 23, 59, 59, 999)
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return
    const text = searchable(`${value.win} ${value.obstacle} ${value.next}`)
    if (!text) return
    entries.push({
      key: `review-${key}`,
      at: date.getTime(),
      day: journalDay(date.getTime()),
      text,
      kind: 'review',
      value,
    })
  })
  return entries
    .filter((e) => Number.isFinite(e.at) && !Number.isNaN(new Date(e.at).getTime()))
    .sort((a, b) => b.at - a.at)
}

export function filterJournal(entries: JournalEntry[], filter: JournalFilter, now = Date.now()) {
  let from = filter.period === 'custom' ? filter.from : ''
  const to = filter.period === 'custom' ? filter.to : filter.period === 'all' ? '' : journalDay(now)
  if (filter.period !== 'all' && filter.period !== 'custom') {
    const date = new Date(now)
    date.setDate(date.getDate() - (filter.period === 'week' ? 6 : filter.period === 'month' ? 29 : 0))
    from = journalDay(date.getTime())
  }
  if (from && to && from > to) return []
  const search = searchable(filter.search)
  return entries.filter(
    (entry) =>
      (filter.kind === 'all' || entry.kind === filter.kind) &&
      (!from || entry.day >= from) &&
      (!to || entry.day <= to) &&
      (!search || entry.text.includes(search)),
  )
}

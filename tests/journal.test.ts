import { describe, expect, it } from 'vitest'
import { GameState } from '../src/game'
import { JOURNAL_FILTER, filterJournal, journalDay, journalEntries } from '../src/journal'

const at = (day: number, hour = 12) => new Date(2026, 8, day, hour).getTime()
const done = (id: string, day: number, title = id) => ({
  id,
  title,
  difficulty: 'slime' as const,
  minutes: 15,
  energy: 'low' as const,
  createdAt: at(day),
  completedAt: at(day),
  xp: 10,
})
const source: Pick<GameState, 'done' | 'focusSessions' | 'reviews'> = {
  done: [done('past', 16), done('edge', 17), done('today', 23, '프로젝트 Ａ 검토'), done('future', 24)],
  focusSessions: Array.from({ length: 10 }, (_, i) => ({
    id: `f${i}`,
    questId: 'task',
    title: `집중 ${i}`,
    seconds: 25,
    endedAt: at(23, i),
  })),
  reviews: { '2026-8-23': { win: '문서 작성', obstacle: '회의', next: '프로젝트 A 제출' } },
}

describe('searchable chronological journal', () => {
  it('includes older focus sessions and reviews alongside completed work without mutating saves', () => {
    const before = JSON.stringify(source)
    const entries = journalEntries(source)
    expect(entries).toHaveLength(15)
    expect(entries.filter((e) => e.kind === 'focus')).toHaveLength(10)
    expect(entries[0].key).toContain('future')
    expect(entries[1].kind).toBe('review')
    expect(entries[1].day).toBe('2026-09-23')
    expect(JSON.stringify(source)).toBe(before)
  })

  it('uses inclusive local calendar boundaries for recent days and excludes tomorrow', () => {
    const entries = journalEntries(source)
    const week = filterJournal(entries, { ...JOURNAL_FILTER, period: 'week', kind: 'done' }, at(23))
    expect(week.map((e) => e.text)).toEqual(['프로젝트 a 검토', 'edge'])
    expect(
      filterJournal(entries, { ...JOURNAL_FILTER, period: 'today', kind: 'review' }, at(23)),
    ).toHaveLength(1)
    expect(journalDay(new Date(2026, 8, 23, 0, 0, 0).getTime())).toBe('2026-09-23')
  })

  it('combines normalized text, record kind, and inclusive custom dates', () => {
    const entries = journalEntries(source)
    expect(filterJournal(entries, { ...JOURNAL_FILTER, search: '  프로젝트 a  ' })).toHaveLength(2)
    expect(filterJournal(entries, { ...JOURNAL_FILTER, search: '회의', kind: 'review' })).toHaveLength(1)
    expect(
      filterJournal(entries, {
        ...JOURNAL_FILTER,
        period: 'custom',
        from: '2026-09-17',
        to: '2026-09-17',
      }).map((e) => e.text),
    ).toEqual(['edge'])
    expect(
      filterJournal(entries, { ...JOURNAL_FILTER, period: 'custom', from: '2026-09-24', to: '2026-09-17' }),
    ).toEqual([])
  })

  it('omits empty or invalid reviews without creating phantom days', () => {
    const review = { win: '유효한 회고', obstacle: '', next: '' }
    const entries = journalEntries({
      done: [],
      reviews: {
        nope: review,
        '2026-1-30': review,
        '2026-12-1': review,
        '2026-8-23': { win: '', obstacle: ' ', next: '' },
        '2026-8-22': review,
      },
    })
    expect(entries.map((e) => e.day)).toEqual(['2026-09-22'])
  })

  it('searches records beyond the rendered page in a large history', () => {
    const doneTasks = Array.from({ length: 5000 }, (_, i) => done(`task-${i}`, 23, `기록 ${i}`))
    const entries = journalEntries({ done: doneTasks })
    const match = filterJournal(entries, { ...JOURNAL_FILTER, search: '기록 4999' })
    expect(match).toHaveLength(1)
    expect(doneTasks).toHaveLength(5000)
  })
})

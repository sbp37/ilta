import { describe, expect, it } from 'vitest'
import { mergeSubtasks, validTaskDate } from '../src/taskEditing'

describe('task dates', () => {
  it.each(['', '2026-09-23', '2028-02-29'])('accepts %s', (date) => {
    expect(validTaskDate(date)).toBe(true)
  })
  it.each(['2026-02-29', '2026-04-31', '2026-13-01', '2026-1-1', 'broken'])('rejects %s', (date) => {
    expect(validTaskDate(date)).toBe(false)
  })
})

describe('subtask editing', () => {
  it('keeps current completion and reward flags when a stale draft changes labels', () => {
    const current = [{ id: 'a', title: 'old', done: true, rewarded: true }]
    expect(mergeSubtasks(current, [{ id: 'a', title: ' new ', done: false }])).toEqual([
      { id: 'a', title: 'new', done: true, rewarded: true },
    ])
    expect(current[0].title).toBe('old')
  })

  it('does not trust completion or reward flags on a new step', () => {
    expect(mergeSubtasks([], [{ id: 'a', title: 'new', done: true, rewarded: true }])).toEqual([
      { id: 'a', title: 'new' },
    ])
  })

  it('removes omitted steps and blank or duplicate entries without mutating the source', () => {
    const current = [
      { id: 'a', title: 'one' },
      { id: 'b', title: 'two' },
    ]
    expect(
      mergeSubtasks(current, [
        { id: 'b', title: 'two' },
        { id: 'b', title: 'duplicate' },
        { id: 'c', title: '  ' },
      ]),
    ).toEqual([{ id: 'b', title: 'two' }])
    expect(current).toHaveLength(2)
  })
})

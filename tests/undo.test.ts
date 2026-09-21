import { describe, expect, it } from 'vitest'
import { GameState, Task, nextDue } from '../src/game'
import { revertChange } from '../src/undo'

const task = (id: string): Task => ({
  id,
  title: id,
  difficulty: 'slime',
  minutes: 15,
  energy: 'low',
  createdAt: 1,
})
const initial = (): GameState => ({
  pool: [],
  active: [{ ...task('a'), acceptedAt: 1 }],
  done: [],
  xp: 0,
  gold: 0,
  loot: {},
  rewards: [],
  purchases: [],
  petFood: 0,
})

describe('action-scoped undo', () => {
  const before = initial()
  const after: GameState = {
    ...before,
    active: [],
    done: [{ ...task('a'), completedAt: 2, xp: 10 }],
    xp: 10,
    gold: 10,
  }
  const change = { id: 'a', before, after }
  it('preserves a new task and changed preferences', () => {
    const current = { ...after, active: [{ ...task('b'), acceptedAt: 3 }], heroName: 'New', dailyGoal: 5 }
    const result = revertChange(current, change)!
    expect(result.active.map((t) => t.id)).toEqual(['a', 'b'])
    expect(result.heroName).toBe('New')
    expect(result.dailyGoal).toBe(5)
    expect(result.gold).toBe(0)
    expect(current.active).toHaveLength(1)
  })
  it('does not erase a purchase made with earned gold', () => {
    expect(revertChange({ ...after, gold: 5 }, change)).toBeNull()
  })
  it('preserves unrelated edits in the pool when undoing a deletion', () => {
    const previous = { ...before, pool: [task('p'), task('other')] }
    const deleted = { ...previous, pool: [task('other')] }
    const result = revertChange(
      { ...deleted, pool: [{ ...task('other'), title: 'Edited' }] },
      { id: 'p', before: previous, after: deleted },
    )!
    expect(result.pool.map((t) => t.title)).toEqual(['p', 'Edited'])
  })
  it('blocks undo if the repeating successor was already edited', () => {
    const repeated = { ...after, pool: [task('next')] }
    expect(
      revertChange(
        { ...repeated, pool: [{ ...task('next'), title: 'Changed' }] },
        { ...change, after: repeated },
      ),
    ).toBeNull()
  })
})

describe('repeat due dates', () => {
  it('moves overdue daily tasks to the next occurrence', () => {
    expect(nextDue('2026-09-18', 'daily', new Date(2026, 8, 21, 12).getTime())).toBe('2026-09-22')
  })
  it('skips the weekend for weekday deadlines', () => {
    expect(nextDue('2026-09-25', 'weekdays', new Date(2026, 8, 25, 12).getTime())).toBe('2026-09-28')
  })
  it('keeps the weekday for weekly deadlines and allows undated tasks', () => {
    expect(nextDue('2026-09-21', 'weekly', new Date(2026, 8, 21, 12).getTime())).toBe('2026-09-28')
    expect(nextDue(undefined, 'daily')).toBeUndefined()
  })
})
